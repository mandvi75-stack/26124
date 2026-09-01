from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
import uuid

from ..database import get_db
from ..models import Incident, AuthorityReport
from ..services.auth import require_roles

router = APIRouter(prefix="/incidents", tags=["incidents"])


def determine_authority(incident_type: str) -> tuple[str, str]:
    lower = incident_type.lower()
    if any(key in lower for key in ["pothole", "waterlogging", "road damage", "road obstruction", "divider", "zebra", "street light", "missing road sign", "damaged sign", "obstruction", "infrastructure", "damaged divider"]):
        return "PWD / Road Authority", "PWD"
    if any(key in lower for key in ["rash driving", "hit & run", "wrong-way", "traffic bottleneck", "pedestrian danger", "traffic", "violation"]):
        return "Traffic Police / Traffic Authority", "TRAFFIC"
    if any(key in lower for key in ["collision", "emergency"]):
        return "Emergency / Police Authority", "EMERGENCY"
    return "Traffic Police / Traffic Authority", "TRAFFIC"


async def ensure_authority_report(db: AsyncSession, incident: Incident) -> AuthorityReport:
    existing = await db.execute(select(AuthorityReport).where(AuthorityReport.incident_id == incident.id))
    report = existing.scalar_one_or_none()
    if report is not None:
        if report.status == "SENT" and incident.status == "RESOLVED":
            report.status = "RESOLVED"
            report.resolved_at = incident.resolved_at or datetime.now(timezone.utc)
        return report

    authority_name, authority_type = determine_authority(incident.type)
    report = AuthorityReport(
        id=str(uuid.uuid4()),
        incident_id=incident.id,
        report_id=f"PRH-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}",
        authority_name=authority_name,
        authority_type=authority_type,
        status="SENT",
        sent_at=datetime.now(timezone.utc),
        details={"incident_type": incident.type, "severity": incident.severity},
    )
    db.add(report)
    await db.flush()
    return report


async def get_reports_for_incidents(db: AsyncSession, incident_ids: list[str]) -> dict[str, AuthorityReport]:
    if not incident_ids:
        return {}
    result = await db.execute(select(AuthorityReport).where(AuthorityReport.incident_id.in_(incident_ids)))
    reports = result.scalars().all()
    return {report.incident_id: report for report in reports}


@router.get("")
async def get_incidents(
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db)
):
    query = select(Incident).order_by(desc(Incident.timestamp)).limit(limit)
    if severity:
        query = query.where(Incident.severity == severity)
    if status:
        query = query.where(Incident.status == status)
    
    result = await db.execute(query)
    incidents = result.scalars().all()
    reports = await get_reports_for_incidents(db, [i.id for i in incidents])
    return [incident_to_dict(i, reports.get(i.id)) for i in incidents]


@router.get("/{incident_id}")
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    report = (await db.execute(select(AuthorityReport).where(AuthorityReport.incident_id == incident_id))).scalar_one_or_none()
    return incident_to_dict(incident, report)


@router.get("/{incident_id}/authority-report")
async def get_authority_report(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    report = (await db.execute(select(AuthorityReport).where(AuthorityReport.incident_id == incident_id))).scalar_one_or_none()
    if report is None:
        report = await ensure_authority_report(db, incident)
        await db.commit()
    return authority_report_to_dict(report)


@router.post("/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_roles("admin", "operator"))):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = "ANALYZING"
    report = await ensure_authority_report(db, incident)
    report.status = "ACKNOWLEDGED"
    report.acknowledged_at = datetime.now(timezone.utc)
    if report.sent_at is None:
        report.sent_at = report.acknowledged_at
    await db.commit()
    return incident_to_dict(incident, report)


class AssignRequest(BaseModel):
    assignee: str


@router.post("/{incident_id}/assign")
async def assign_incident(incident_id: str, request: AssignRequest, db: AsyncSession = Depends(get_db), _=Depends(require_roles("admin", "operator"))):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = "ASSIGNED"
    incident.assigned_to = request.assignee
    await db.commit()
    return incident_to_dict(incident)


class ResolveRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/{incident_id}/resolve")
async def resolve_incident(incident_id: str, request: ResolveRequest, db: AsyncSession = Depends(get_db), _=Depends(require_roles("admin", "operator"))):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = "RESOLVED"
    incident.resolved_at = datetime.now(timezone.utc)
    report = await ensure_authority_report(db, incident)
    report.status = "RESOLVED"
    report.resolved_at = incident.resolved_at
    if report.sent_at is None:
        report.sent_at = report.resolved_at
    if report.acknowledged_at is None:
        report.acknowledged_at = report.resolved_at
    await db.commit()
    return incident_to_dict(incident, report)


class NoteRequest(BaseModel):
    note: str


@router.post("/{incident_id}/notes")
async def add_note(incident_id: str, request: NoteRequest, db: AsyncSession = Depends(get_db), _=Depends(require_roles("admin", "operator"))):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    # In a full system, notes would go to a separate table
    return {"success": True, "note": request.note}


def authority_report_to_dict(r: AuthorityReport) -> dict:
    return {
        "id": r.id,
        "incident_id": r.incident_id,
        "report_id": r.report_id,
        "authority_name": r.authority_name,
        "authority_type": r.authority_type,
        "status": r.status,
        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        "acknowledged_at": r.acknowledged_at.isoformat() if r.acknowledged_at else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        "details": r.details or {},
    }


def incident_to_dict(i: Incident, report: Optional[AuthorityReport] = None) -> dict:
    return {
        "id": i.id,
        "type": i.type,
        "severity": i.severity,
        "status": i.status,
        "confidence": i.confidence,
        "description": i.description,
        "bus_id": i.bus_id,
        "bus_number": i.bus_number,
        "camera_id": i.camera_id,
        "lat": i.lat,
        "lng": i.lng,
        "address": i.address,
        "vehicle_class": i.vehicle_class,
        "number_plate": i.number_plate,
        "ocr_confidence": i.ocr_confidence,
        "ai_reasoning": i.ai_reasoning,
        "assigned_to": i.assigned_to,
        "contributing_factors": i.contributing_factors or [],
        "corroborating_buses": i.corroborating_buses or [],
        "evidence_url": i.evidence_url,
        "timestamp": i.timestamp.isoformat() if i.timestamp else None,
        "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
        "authority_report": authority_report_to_dict(report) if report else None,
    }
