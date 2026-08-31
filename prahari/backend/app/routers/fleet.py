from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import Route, OperatingArea, Incident, RoadDefect
from ..simulation.local_engine import simulation_engine
from ..services.auth import require_roles
from ..services.route_metrics import calculate_route_delay_metrics

router = APIRouter(prefix="/fleet", tags=["fleet"])


def _delay_metrics(route_id: str, total_distance: float, scheduled_duration: int):
    return calculate_route_delay_metrics(route_id, total_distance, scheduled_duration)


class OperatingAreaRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_name: Optional[str] = Field(default=None, max_length=200)


@router.post("/operating-area")
async def set_operating_area(
    request: OperatingAreaRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles("admin", "operator")),
):
    """Configure the simulation to run around the user's device location."""
    db.add(OperatingArea(
        latitude=request.latitude,
        longitude=request.longitude,
        location_name=request.location_name,
        source="device_location",
    ))
    await db.commit()
    # Re-centre simulation buses around the real device location
    await simulation_engine.configure_operating_area(
        request.latitude,
        request.longitude,
        request.location_name,
    )
    return {
        "latitude": request.latitude,
        "longitude": request.longitude,
        "location_name": request.location_name,
        "source": "device_location",
        "buses_relocated": len(simulation_engine.buses),
    }


@router.get("/operating-area")
async def get_operating_area():
    if not simulation_engine.operating_area:
        return {"configured": False, "message": "Grant browser location to centre simulation on your area."}
    return {"configured": True, **simulation_engine.operating_area}


@router.get("/buses")
async def get_buses():
    """Return current simulation bus positions. Labelled as SIMULATION data."""
    return simulation_engine.get_all_buses()


@router.get("/buses/{bus_id}")
async def get_bus(bus_id: str):
    bus = simulation_engine.get_bus(bus_id)
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return bus


@router.get("/metrics")
async def get_metrics(db: AsyncSession = Depends(get_db)):
    """Return live metrics combining simulation + DB incident/defect counts."""
    sim_metrics = simulation_engine.get_metrics()

    # Augment with real DB counts
    try:
        active_inc = await db.execute(
            select(func.count(Incident.id)).where(
                ~Incident.status.in_(["RESOLVED", "CLOSED"])
            )
        )
        road_defects = await db.execute(
            select(func.count(RoadDefect.id)).where(
                ~RoadDefect.status.in_(["RESOLVED"])
            )
        )
        critical = await db.execute(
            select(func.count(Incident.id)).where(
                Incident.severity.in_(["CRITICAL", "HIGH"]),
                ~Incident.status.in_(["RESOLVED", "CLOSED"]),
            )
        )
        sim_metrics["active_incidents"] = active_inc.scalar() or 0
        sim_metrics["road_defects"] = road_defects.scalar() or 0
        sim_metrics["critical_alerts"] = critical.scalar() or 0
    except Exception:
        pass

    return sim_metrics


@router.get("/routes")
async def get_routes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route))
    routes = result.scalars().all()

    buses = simulation_engine.get_all_buses()
    if not routes:
        # Return simulation loops as pseudo-routes
        route_map: dict = {}
        for b in buses:
            rid = b.get("route_id", "unknown")
            if rid not in route_map:
                route_map[rid] = {
                    "id": rid,
                    "code": rid.upper(),
                    "name": b.get("route_name", rid),
                    "start_stop": "Simulation Start",
                    "end_stop": "Simulation End",
                    "total_distance": 3.2,
                    "scheduled_duration": 25,
                    "actual_duration": 25,
                    "current_delay": 0,
                    "avg_delay": 0,
                    "active_buses": 0,
                    "waypoints": [],
                    "color": "#6366f1",
                }
            route_map[rid]["active_buses"] += 1
        return list(route_map.values())

    delayed_route_data = []
    for r in routes:
        metrics = _delay_metrics(r.id, float(r.total_distance or 0), int(r.scheduled_duration or 0))
        delayed_route_data.append({
            "id": r.id,
            "code": r.code,
            "name": r.name,
            "start_stop": r.start_stop,
            "end_stop": r.end_stop,
            "total_distance": r.total_distance,
            "scheduled_duration": r.scheduled_duration,
            "actual_duration": metrics["actual_duration"],
            "current_delay": metrics["current_delay"],
            "avg_delay": metrics["avg_delay"],
            "active_buses": sum(1 for b in buses if b.get("route_id") == r.id and b.get("status") == "ONLINE"),
            "waypoints": r.waypoints or [],
            "color": r.color,
        })
    return delayed_route_data


@router.get("/routes/{route_id}")
async def get_route(route_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route).where(Route.id == route_id))
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    metrics = _delay_metrics(route.id, float(route.total_distance or 0), int(route.scheduled_duration or 0))
    return {
        "id": route.id, "code": route.code, "name": route.name,
        "start_stop": route.start_stop, "end_stop": route.end_stop,
        "total_distance": route.total_distance, "scheduled_duration": route.scheduled_duration,
        "actual_duration": metrics["actual_duration"], "current_delay": metrics["current_delay"], "avg_delay": metrics["avg_delay"],
        "active_buses": 0, "waypoints": route.waypoints or [], "color": route.color,
    }
