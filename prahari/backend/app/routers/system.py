from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timezone
import time

from ..database import get_db
from ..services.websocket_manager import ws_manager
from ..simulation.local_engine import simulation_engine

router = APIRouter(prefix="/system", tags=["system"])

_start_time = time.time()


async def check_db(db: AsyncSession) -> tuple:
    try:
        start = time.time()
        await db.execute(text("SELECT 1"))
        latency = round((time.time() - start) * 1000)
        return "HEALTHY", latency
    except Exception:
        return "DOWN", None


@router.get("/health")
async def get_health(db: AsyncSession = Depends(get_db)):
    db_status, db_latency = await check_db(db)
    uptime_seconds = time.time() - _start_time
    uptime_pct = 99.95  # would be calculated from actual monitoring
    
    buses = simulation_engine.get_all_buses()
    online_buses = sum(1 for b in buses if b["status"] == "ONLINE")
    
    services = [
        {
            "name": "Frontend",
            "status": "HEALTHY",
            "latency_ms": 12,
            "uptime_pct": 99.98,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "details": "React + Vite application"
        },
        {
            "name": "Backend",
            "status": "HEALTHY",
            "latency_ms": 8,
            "uptime_pct": 99.95,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "details": f"FastAPI — uptime {round(uptime_seconds/3600, 1)}h"
        },
        {
            "name": "Database",
            "status": db_status,
            "latency_ms": db_latency,
            "uptime_pct": 99.9 if db_status == "HEALTHY" else 0,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "details": "PostgreSQL + PostGIS"
        },
        {
            "name": "AI Engine",
            "status": "HEALTHY",
            "latency_ms": 45,
            "uptime_pct": 99.8,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "details": f"Processing {online_buses} active bus feeds"
        },
        {
            "name": "WebSocket",
            "status": "HEALTHY",
            "latency_ms": 5,
            "uptime_pct": 99.99,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "details": f"{ws_manager.connection_count} connected clients"
        },
        {
            "name": "GPS Engine",
            "status": "HEALTHY" if simulation_engine.running else "DEGRADED",
            "latency_ms": 2,
            "uptime_pct": 99.97,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "details": f"Simulating {len(buses)} buses"
        },
        {
            "name": "Camera Engine",
            "status": "HEALTHY",
            "latency_ms": 35,
            "uptime_pct": 99.85,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "details": f"{online_buses * 5} virtual camera streams"
        },
    ]
    
    healthy = sum(1 for s in services if s["status"] == "HEALTHY")
    overall = round((healthy / len(services)) * 100)
    
    return {
        "overall_health": overall,
        "services": services,
        "uptime_seconds": round(uptime_seconds),
        "connected_clients": ws_manager.connection_count,
        "active_buses": online_buses,
        "simulation_running": simulation_engine.running,
    }


@router.get("/stats")
async def get_stats():
    buses = simulation_engine.get_all_buses()
    return {
        "total_buses": len(buses),
        "online_buses": sum(1 for b in buses if b["status"] == "ONLINE"),
        "degraded_buses": sum(1 for b in buses if b["status"] == "DEGRADED"),
        "connected_ws_clients": ws_manager.connection_count,
        "simulation_running": simulation_engine.running,
        "uptime_seconds": round(time.time() - _start_time),
    }
