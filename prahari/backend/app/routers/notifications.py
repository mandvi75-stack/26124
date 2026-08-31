from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from ..database import get_db
from ..models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).order_by(desc(Notification.timestamp)).limit(50)
    )
    notifs = result.scalars().all()
    return [notif_to_dict(n) for n in notifs]


@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    notif = result.scalar_one_or_none()
    if notif:
        notif.read = True
        await db.commit()
    return {"success": True}


@router.put("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.read == False))
    notifs = result.scalars().all()
    for n in notifs:
        n.read = True
    await db.commit()
    return {"success": True, "count": len(notifs)}


def notif_to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "severity": n.severity,
        "title": n.title,
        "description": n.description,
        "location": n.location,
        "bus_id": n.bus_id,
        "incident_id": n.incident_id,
        "read": n.read,
        "timestamp": n.timestamp.isoformat() if n.timestamp else None,
    }
