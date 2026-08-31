from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from ..database import get_db
from ..models import TrafficZone

router = APIRouter(prefix="/traffic", tags=["traffic"])


@router.get("/zones")
async def get_traffic_zones(db: AsyncSession = Depends(get_db)):
    """Return only traffic observations persisted by an actual ingestion source."""
    rows = (await db.execute(select(TrafficZone).order_by(TrafficZone.timestamp.desc()))).scalars().all()
    return [{"id": z.id, "name": z.name, "lat": z.lat, "lng": z.lng, "radius": z.radius, "congestion_level": z.congestion_level, "vehicle_count": z.vehicle_count, "avg_speed": z.avg_speed, "vehicles_per_hour": z.vehicles_per_hour, "timestamp": z.timestamp.isoformat() if z.timestamp else None} for z in rows]


@router.get("/trends")
async def get_traffic_trends(hours: int = Query(6, le=48)):
    # Historical traffic storage is not implemented yet; do not fabricate a chart.
    return []


@router.get("/bottlenecks")
async def get_bottlenecks(db: AsyncSession = Depends(get_db)):
    zones = await get_traffic_zones(db)
    return sorted((z for z in zones if z["congestion_level"] in ["HEAVY", "SEVERE"]), key=lambda z: z["vehicle_count"], reverse=True)
