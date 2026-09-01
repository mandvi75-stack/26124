from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from ..database import get_db
from ..models import InfrastructureItem, RoadDefect

router = APIRouter(prefix="/infrastructure", tags=["infrastructure"])


async def sync_infrastructure_items(db: AsyncSession):
    """Backfill infrastructure records from existing road-defect data when the dedicated table is empty."""
    count = (await db.execute(select(func.count(InfrastructureItem.id)))).scalar() or 0
    if count > 0:
        return

    result = await db.execute(select(RoadDefect).order_by(desc(RoadDefect.last_observed)))
    defects = result.scalars().all()
    if not defects:
        return

    seen = set()
    for defect in defects:
        key = (defect.type, round(defect.lat, 6), round(defect.lng, 6))
        if key in seen:
            continue
        seen.add(key)
        db.add(InfrastructureItem(
            id=defect.id,
            type=defect.type,
            severity=defect.severity,
            status=defect.status,
            lat=defect.lat,
            lng=defect.lng,
            description=f"{defect.type} observed in the field. Priority {defect.maintenance_priority}.",
            first_detected=defect.first_observed or defect.last_observed,
            last_verified=defect.last_observed,
            maintenance_id=defect.id,
        ))
    await db.commit()


@router.get("")
async def get_items(db: AsyncSession = Depends(get_db)):
    await sync_infrastructure_items(db)
    result = await db.execute(select(InfrastructureItem).order_by(desc(InfrastructureItem.first_detected)))
    items = result.scalars().all()
    return [item_to_dict(i) for i in items]


@router.get("/{item_id}")
async def get_item(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InfrastructureItem).where(InfrastructureItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item_to_dict(item)


class StatusUpdate(BaseModel):
    status: str


@router.put("/{item_id}/status")
async def update_status(item_id: str, request: StatusUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InfrastructureItem).where(InfrastructureItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.status = request.status
    item.last_verified = datetime.now(timezone.utc)
    await db.commit()
    return item_to_dict(item)


class MaintenanceRequest(BaseModel):
    team: Optional[str] = None
    notes: Optional[str] = None


@router.post("/{item_id}/maintenance")
async def create_maintenance(item_id: str, request: MaintenanceRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InfrastructureItem).where(InfrastructureItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.status = "ASSIGNED"
    await db.commit()
    return {"success": True, "maintenance_created": True}


def item_to_dict(i: InfrastructureItem) -> dict:
    return {
        "id": i.id,
        "type": i.type,
        "severity": i.severity,
        "status": i.status,
        "lat": i.lat,
        "lng": i.lng,
        "description": i.description,
        "first_detected": i.first_detected.isoformat() if i.first_detected else None,
        "last_verified": i.last_verified.isoformat() if i.last_verified else None,
        "maintenance_id": i.maintenance_id,
    }
