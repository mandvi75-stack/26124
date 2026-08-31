"""
PRAHARI — AI-Powered Road-Risk Intelligence Platform
Backend API & WebSocket Server
"""

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from sqlalchemy import select

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import init_db, AsyncSessionLocal
from .services.websocket_manager import ws_manager
from .services.seed import seed_database
from .simulation.local_engine import simulation_engine
from .models import Incident, Notification, GPSLog, Detection, Camera

# Routers
from .routers import auth, fleet, incidents, ai, road, traffic, infrastructure, analytics, notifications, system, reports

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


async def persist_incident(incident_data: dict):
    """Persist a risk/incident event from the simulation and broadcast via WebSocket."""
    async with AsyncSessionLocal() as db:
        try:
            inc_id = str(uuid.uuid4())
            inc = Incident(
                id=inc_id,
                type=incident_data["type"],
                severity=incident_data["severity"],
                status="DETECTED",
                confidence=incident_data.get("confidence", 0.8),
                description=incident_data.get("description", ""),
                bus_id=incident_data.get("bus_id", "sim"),
                bus_number=incident_data.get("bus_number"),
                camera_id=incident_data.get("camera_id", f"{incident_data.get('bus_id', 'sim')}-FRONT"),
                lat=incident_data.get("lat", 0.0),
                lng=incident_data.get("lng", 0.0),
                address=incident_data.get("address"),
                vehicle_class=incident_data.get("vehicle_class"),
                number_plate=incident_data.get("number_plate"),
                ocr_confidence=incident_data.get("ocr_confidence"),
                ai_reasoning=incident_data.get("ai_reasoning"),
                contributing_factors=incident_data.get("contributing_factors", []),
                corroborating_buses=incident_data.get("corroborating_buses", []),
            )
            db.add(inc)

            # Create notification
            notif_id = str(uuid.uuid4())
            notif = Notification(
                id=notif_id,
                title=incident_data["type"],
                description=incident_data.get("description", ""),
                severity=incident_data["severity"],
                bus_id=incident_data.get("bus_id"),
                location=incident_data.get("address"),
                incident_id=inc_id,
            )
            db.add(notif)
            await db.commit()

            # Broadcast via WebSocket
            await ws_manager.broadcast("incident", {
                **incident_data,
                "id": inc_id,
                "status": "DETECTED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "camera_id": inc.camera_id,
            })
            await ws_manager.broadcast("notification", {
                "id": notif_id,
                "severity": notif.severity,
                "title": notif.title,
                "description": notif.description,
                "location": notif.location,
                "bus_id": notif.bus_id,
                "incident_id": inc_id,
                "read": False,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        except Exception as e:
            logger.error(f"Failed to persist incident: {e}")
            await db.rollback()


async def persist_position(bus: dict):
    """Persist GPS update to the log (best-effort)."""
    async with AsyncSessionLocal() as db:
        try:
            db.add(GPSLog(
                bus_id=bus["id"],
                lat=bus.get("lat", 0.0),
                lng=bus.get("lng", 0.0),
                speed=bus.get("speed", 0),
                direction=bus.get("direction", 0),
            ))
            await db.commit()
        except Exception as exc:
            logger.debug("GPS persistence skipped: %s", exc)
            await db.rollback()


async def handle_risk_event(event: dict):
    """Called by simulation engine when a road-risk observation is generated."""
    # Add location from bus position
    lat = event.get("lat", 0.0)
    lng = event.get("lng", 0.0)
    event["address"] = f"Simulation zone ({lat:.4f}, {lng:.4f})"
    await persist_incident(event)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown"""
    try:
        await init_db()
        async with AsyncSessionLocal() as db:
            await seed_database(db)
        logger.info("Database initialized and seeded")
    except Exception as e:
        logger.warning(f"Database init warning: {e}")

    # Wire simulation callbacks
    simulation_engine.incident_callback = handle_risk_event
    simulation_engine.position_callback = persist_position

    # Auto-start simulation — buses move immediately at placeholder coords
    await simulation_engine.start()
    logger.info("PRAHARI simulation engine started — %d buses active", simulation_engine.bus_count)
    logger.info("PRAHARI is ready. Waiting for device location to re-centre simulation.")

    yield

    # Shutdown
    await simulation_engine.stop()
    logger.info("PRAHARI server shutdown complete")


app = FastAPI(
    title="PRAHARI API",
    description="AI-Powered Road-Risk Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(fleet.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(road.router, prefix="/api")
app.include_router(traffic.router, prefix="/api")
app.include_router(infrastructure.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(reports.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "PRAHARI API", "version": "1.0.0"}



@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    """Main WebSocket endpoint for real-time events"""
    await ws_manager.connect(websocket)

    # Send initial snapshot
    try:
        buses = simulation_engine.get_all_buses()
        await ws_manager.send_to(websocket, "buses_snapshot", buses)
        await ws_manager.send_to(websocket, "metrics", simulation_engine.get_metrics())
        await ws_manager.send_to(websocket, "connected", {
            "message": "Connected to PRAHARI",
            "simulation_active": simulation_engine.running,
            "bus_count": len(buses),
        })
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await ws_manager.send_to(websocket, "pong", {})
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
