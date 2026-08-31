from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timezone, timedelta
from typing import Optional

from ..database import get_db
from ..models import Incident, RoadDefect, Route, TrafficZone
from ..simulation.local_engine import simulation_engine
from ..services.route_metrics import calculate_route_delay_metrics

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


def _route_delay_from_distance(route_code: str, distance: float) -> tuple[float, float]:
    metrics = calculate_route_delay_metrics(route_code, distance, 60)
    avg_delay = float(metrics["avg_delay"])
    max_delay = round(avg_delay + max(4.0, distance * 0.35), 1)
    return avg_delay, max_delay


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
async def get_traffic_stats(period: Optional[str] = Query("7d"), db: AsyncSession = Depends(get_db)):
    since = get_period_start(period)
    rows = (await db.execute(
        select(TrafficZone)
        .where(TrafficZone.timestamp >= since)
        .order_by(TrafficZone.timestamp.asc())
    )).scalars().all()

    if not rows:
        return [
            {"date": "Mon", "vehicles": 120, "avg_speed": 31},
            {"date": "Tue", "vehicles": 146, "avg_speed": 29},
            {"date": "Wed", "vehicles": 132, "avg_speed": 32},
            {"date": "Thu", "vehicles": 158, "avg_speed": 27},
            {"date": "Fri", "vehicles": 149, "avg_speed": 30},
            {"date": "Sat", "vehicles": 170, "avg_speed": 26},
        ]

    return [
        {
            "date": row.timestamp.strftime("%a") if row.timestamp else "Now",
            "vehicles": int(row.vehicle_count or 0),
            "avg_speed": float(row.avg_speed or 0),
        }
        for row in rows[:7]
    ]


@router.get("/fleet")
async def get_fleet_stats(period: Optional[str] = Query("7d"), db: AsyncSession = Depends(get_db)):
    since = get_period_start(period)
    rows = (await db.execute(
        select(Incident.timestamp, func.count(Incident.id).label("count"))
        .where(Incident.timestamp >= since)
        .group_by(func.date(Incident.timestamp))
        .order_by(func.date(Incident.timestamp).asc())
    )).all()

    active_buses = len([bus for bus in simulation_engine.get_all_buses() if bus.get("status") == "ONLINE"])
    today = datetime.now(timezone.utc)
    results = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        bucket_date = day.strftime("%b %d")
        incident_count = 0
        for row in rows:
            if row[0].date() == day.date():
                incident_count = row[1]
                break
        results.append({
            "date": bucket_date,
            "active": active_buses,
            "incidents": incident_count,
        })
    return results


@router.get("/routes")
async def get_route_stats(db: AsyncSession = Depends(get_db)):
    """Route delay statistics derived from the active route dataset."""
    result = await db.execute(select(Route).order_by(Route.code.asc()))
    routes = result.scalars().all()

    if not routes:
        return []

    stats = []
    for route in routes:
        avg_delay, max_delay = _route_delay_from_distance(route.code, float(route.total_distance or 0))
        stats.append({
            "route": route.code,
            "avg_delay": avg_delay,
            "max_delay": max_delay,
        })
    return stats
