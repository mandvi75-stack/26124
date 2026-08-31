from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel
from typing import Optional
import math

from ..database import get_db
from ..models import RoadDefect, Incident

router = APIRouter(prefix="/road", tags=["road"])

# Risk scoring weights
SEVERITY_SCORES = {"CRITICAL": 35, "HIGH": 25, "MEDIUM": 15, "LOW": 5}
TYPE_RISK_BASE = {
    "Pothole": 20, "Severe Pothole": 35, "Road Damage": 25,
    "Waterlogging": 15, "Missing Divider": 20, "Missing Zebra Crossing": 10,
    "Damaged Sign": 10, "Obstruction": 25,
    "Hit & Run": 40, "Collision": 45, "Rash Driving": 30,
    "Pedestrian Danger": 30, "Traffic Bottleneck": 15,
    "Sudden Braking Event": 20, "Street Light Failure": 15,
    "Wrong-Way Driving": 45,
}


def _risk_score(defects: list, incidents: list) -> dict:
    """Compute a 0-100 road risk score for a location cluster."""
    score = 0
    factors = []

    for d in defects:
        base = TYPE_RISK_BASE.get(d["type"], 10)
        sev_mult = {"CRITICAL": 1.5, "HIGH": 1.2, "MEDIUM": 1.0, "LOW": 0.7}.get(d["severity"], 1.0)
        obs_bonus = min(d["observation_count"] * 2, 15)
        contribution = min(base * sev_mult + obs_bonus, 40)
        score += contribution
        if d["severity"] in ("CRITICAL", "HIGH"):
            factors.append(f"{d['severity']} severity {d['type'].lower()}")

    for i in incidents:
        base = SEVERITY_SCORES.get(i["severity"], 10)
        score += base
        if i["severity"] in ("CRITICAL", "HIGH"):
            factors.append(f"{i['type'].lower()} incident ({i['severity'].lower()} severity)")

    score = min(round(score), 100)

    if score >= 75:
        level = "CRITICAL"
    elif score >= 50:
        level = "HIGH"
    elif score >= 25:
        level = "MODERATE"
    else:
        level = "LOW"

    if not factors:
        factors = ["Low historical incident rate", "Good road surface condition"]

    return {"score": score, "level": level, "factors": factors[:4]}


@router.get("/defects")
async def get_defects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoadDefect).order_by(desc(RoadDefect.last_observed)))
    defects = result.scalars().all()
    return [defect_to_dict(d) for d in defects]


@router.get("/defects/{defect_id}")
async def get_defect(defect_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoadDefect).where(RoadDefect.id == defect_id))
    defect = result.scalar_one_or_none()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    return defect_to_dict(defect)


class StatusUpdate(BaseModel):
    status: str


@router.put("/defects/{defect_id}/status")
async def update_defect_status(defect_id: str, request: StatusUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoadDefect).where(RoadDefect.id == defect_id))
    defect = result.scalar_one_or_none()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")

    valid = ["DETECTED", "VERIFIED", "ASSIGNED", "UNDER_MAINTENANCE", "RESOLVED"]
    if request.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    defect.status = request.status
    await db.commit()
    return defect_to_dict(defect)


@router.get("/segments")
async def get_road_segments(db: AsyncSession = Depends(get_db)):
    """Group defects by approximate location to form road segments."""
    result = await db.execute(select(RoadDefect))
    defects = result.scalars().all()

    segments: dict = {}
    for d in defects:
        seg_key = f"{round(d.lat, 3)},{round(d.lng, 3)}"
        if seg_key not in segments:
            segments[seg_key] = {
                "id": seg_key,
                "lat": d.lat,
                "lng": d.lng,
                "defect_count": 0,
                "severity": "LOW",
                "condition": "GOOD",
                "observation_count": 0,
                "last_observation": d.last_observed.isoformat() if d.last_observed else None,
            }
        segments[seg_key]["defect_count"] += 1
        segments[seg_key]["observation_count"] += d.observation_count

    return list(segments.values())


@router.get("/risk-scores")
async def get_risk_scores(db: AsyncSession = Depends(get_db)):
    """
    Compute road-risk scores (0-100) for each location cluster using
    defect observations and incident history.
    """
    defects_res = await db.execute(
        select(RoadDefect).where(RoadDefect.status != "RESOLVED")
    )
    defects = defects_res.scalars().all()

    incidents_res = await db.execute(
        select(Incident).where(~Incident.status.in_(["RESOLVED", "CLOSED"])).limit(200)
    )
    incidents = incidents_res.scalars().all()

    # Cluster by ~0.005° grid (~550m)
    GRID = 0.005
    clusters: dict = {}

    for d in defects:
        key = (round(d.lat / GRID) * GRID, round(d.lng / GRID) * GRID)
        clusters.setdefault(key, {"defects": [], "incidents": []})
        clusters[key]["defects"].append(defect_to_dict(d))

    for i in incidents:
        key = (round(i.lat / GRID) * GRID, round(i.lng / GRID) * GRID)
        clusters.setdefault(key, {"defects": [], "incidents": []})
        clusters[key]["incidents"].append({
            "id": i.id, "type": i.type, "severity": i.severity,
            "description": i.description, "timestamp": i.timestamp.isoformat() if i.timestamp else None,
        })

    risk_zones = []
    for (lat, lng), data in clusters.items():
        rs = _risk_score(data["defects"], data["incidents"])
        risk_zones.append({
            "lat": lat,
            "lng": lng,
            "score": rs["score"],
            "level": rs["level"],
            "factors": rs["factors"],
            "defect_count": len(data["defects"]),
            "incident_count": len(data["incidents"]),
            "defect_types": list({d["type"] for d in data["defects"]}),
        })

    risk_zones.sort(key=lambda z: z["score"], reverse=True)
    return risk_zones


@router.get("/analytics")
async def get_road_analytics(db: AsyncSession = Depends(get_db)):
    """Historical road defect + incident analytics."""
    defects_res = await db.execute(select(RoadDefect))
    defects = defects_res.scalars().all()

    incidents_res = await db.execute(select(Incident).limit(500))
    incidents = incidents_res.scalars().all()

    # Defect type distribution
    by_type: dict = {}
    for d in defects:
        by_type[d.type] = by_type.get(d.type, 0) + 1

    # Severity distribution
    by_severity: dict = {}
    for d in defects:
        by_severity[d.severity] = by_severity.get(d.severity, 0) + 1

    # Incident type distribution
    inc_by_type: dict = {}
    for i in incidents:
        inc_by_type[i.type] = inc_by_type.get(i.type, 0) + 1

    # Top risk locations (highest incident + defect co-occurrence)
    top_risk = sorted(
        [(d.lat, d.lng, d.severity, d.type) for d in defects],
        key=lambda x: SEVERITY_SCORES.get(x[2], 0),
        reverse=True,
    )[:5]

    return {
        "total_defects": len(defects),
        "total_incidents": len(incidents),
        "defects_by_type": by_type,
        "defects_by_severity": by_severity,
        "incidents_by_type": inc_by_type,
        "top_risk_locations": [
            {"lat": lat, "lng": lng, "severity": sev, "type": typ}
            for lat, lng, sev, typ in top_risk
        ],
        "avg_risk_score": round(
            sum(SEVERITY_SCORES.get(d.severity, 5) for d in defects) / max(len(defects), 1)
        ),
        "data_source": "HISTORICAL_DATASET",
    }


def defect_to_dict(d: RoadDefect) -> dict:
    return {
        "id": d.id,
        "type": d.type,
        "severity": d.severity,
        "status": d.status,
        "lat": d.lat,
        "lng": d.lng,
        "address": d.address,
        "observation_count": d.observation_count,
        "confidence": d.confidence,
        "maintenance_priority": d.maintenance_priority,
        "assigned_team": d.assigned_team,
        "first_observed": d.first_observed.isoformat() if d.first_observed else None,
        "last_observed": d.last_observed.isoformat() if d.last_observed else None,
    }
