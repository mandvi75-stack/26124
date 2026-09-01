from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import Incident
from ..simulation.local_engine import simulation_engine

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/detections")
async def get_detections(bus_id: Optional[str] = Query(None)):
    if bus_id:
        frame = simulation_engine.get_camera_frame(bus_id, "FRONT")
        if not frame: raise HTTPException(404, "Bus not found")
        return {
            "objects": frame["objects"],
            "stats": frame["stats"],
            "source": "simulation_adapter",
            "message": "Selected bus camera feed generated from the live simulation model adapter."
        }

    all_objects = []
    for bid in list(simulation_engine.buses.keys())[:5]:
        data = simulation_engine.get_camera_frame(bid, "FRONT")
        if data: all_objects.extend(data["objects"])

    return {"objects": all_objects[:30], "stats": {
        "fps": 5,
        "latency_ms": 0,
        "objects_per_frame": len(all_objects),
        "events_per_minute": 0,
        "total_detections": max(1, len(all_objects) * 4),
        "active_tracks": len(all_objects),
    }}


@router.get("/cameras/{bus_id}")
async def get_camera_feeds(bus_id: str):
    bus = simulation_engine.get_bus(bus_id)
    if not bus:
        return []
    
    cameras = []
    for position in ["FRONT", "REAR", "LEFT", "RIGHT", "CABIN"]:
        detections = simulation_engine.get_camera_frame(bus_id, position)
        cameras.append({
            "camera_id": f"{bus_id}-{position}",
            "bus_id": bus_id,
            "position": position,
            "status": detections["status"],
            "fps": detections["stats"].get("fps", 5),
            "resolution": "1920x1080",
            "objects": detections["objects"],
            "events": [],
            "frame_count": 0,
            "last_detection_time": bus["last_update"],
        })
    
    return cameras


@router.get("/stats")
async def get_ai_stats():
    buses = simulation_engine.get_all_buses()
    active = sum(1 for b in buses if b["ai_status"] in ["ACTIVE", "PROCESSING"])
    total_detections = sum(1 for b in buses if b["camera_status"] == "ACTIVE") * 18
    return {
        "active_ai_buses": active,
        "total_buses": len(buses),
        "global_fps": 5,
        "global_latency_ms": 0,
        "total_detections_today": total_detections,
        "events_generated_today": max(12, total_detections // 3),
        "models": {
            "detection": "Simulation adapter — live frame generation for bus camera feeds",
            "tracking": "Temporal object tracking across camera frames",
            "ocr": "Plate OCR remains disabled in this simulation-only environment",
        }
    }


@router.get("/plates")
async def get_number_plates(
    bus_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return plates already captured on persisted incident records."""
    query = select(Incident).where(Incident.number_plate.is_not(None))
    if bus_id:
        query = query.where(Incident.bus_id == bus_id)
    result = await db.execute(query.order_by(desc(Incident.timestamp)).limit(limit))
    return [
        {
            "id": incident.id,
            "plate_number": incident.number_plate,
            "confidence": incident.ocr_confidence,
            "bus_id": incident.bus_id,
            "camera_id": incident.camera_id,
            "lat": incident.lat,
            "lng": incident.lng,
            "timestamp": incident.timestamp.isoformat() if incident.timestamp else None,
            "incident_id": incident.id,
        }
        for incident in result.scalars()
    ]
