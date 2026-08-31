from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models import Incident
from ..services.auth import require_roles

router = APIRouter(prefix="/incidents", tags=["incidents"])


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
    return [incident_to_dict(i) for i in incidents]


@router.get("/{incident_id}")
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident_to_dict(incident)


@router.post("/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_roles("admin", "operator"))):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = "ANALYZING"
    await db.commit()
    return incident_to_dict(incident)


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
    await db.commit()
    return incident_to_dict(incident)


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


def incident_to_dict(i: Incident) -> dict:
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
    }
