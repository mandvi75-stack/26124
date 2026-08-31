from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timezone, timedelta
from typing import Optional

from ..database import get_db
from ..models import Incident, RoadDefect
from ..simulation.local_engine import simulation_engine

router = APIRouter(prefix="/analytics", tags=["analytics"])


def get_period_start(period: Optional[str]) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "24h":
        return now - timedelta(hours=24)
    elif period == "7d":
        return now - timedelta(days=7)
    elif period == "30d":
        return now - timedelta(days=30)
    elif period == "90d":
        return now - timedelta(days=90)
    return now - timedelta(days=7)


@router.get("/incidents")
async def get_incident_stats(period: Optional[str] = Query("7d"), db: AsyncSession = Depends(get_db)):
    """Incidents grouped by type"""
    since = get_period_start(period)
    result = await db.execute(
        select(Incident.type, func.count(Incident.id).label("count"))
        .where(Incident.timestamp >= since)
        .group_by(Incident.type)
        .order_by(desc("count"))
    )
    rows = result.fetchall()
    
    return [{"type": row.type, "count": row.count} for row in rows]


@router.get("/traffic")
async def get_traffic_stats(period: Optional[str] = Query("7d")):
    return []


@router.get("/fleet")
async def get_fleet_stats(period: Optional[str] = Query("7d")):
    return []


@router.get("/routes")
async def get_route_stats():
    """Route delay statistics"""
    return [
        {"route": r["code"], "avg_delay": round(random.uniform(1, 18), 1), "max_delay": round(random.uniform(10, 35), 1)}
        for r in []
    ]
