"""Replaceable local operating-area hardware simulation.

This module models GPS/camera hardware through deterministic test sources.
Replacing either source with a real GPS or RTSP adapter does not change the
API contract — the same schema is returned.

Auto-starts with 8 placeholder buses at (0,0) that move to real coordinates
once the user grants browser location permission.
"""
import asyncio
import math
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

# Risk event types that feed the road-risk intelligence system
RISK_EVENT_TYPES = [
    ("Pothole Detected",    "MEDIUM", "Road surface damage detected by AI vision sensor on bus camera."),
    ("Sudden Braking Event","MEDIUM", "Unexpected deceleration detected — hidden road hazard suspected."),
    ("Traffic Bottleneck",  "MEDIUM", "Vehicle speed consistently below 15 km/h — congestion detected."),
    ("Pedestrian Danger",   "HIGH",   "Pedestrian movement near high-speed vehicle flow detected."),
    ("Road Obstruction",    "HIGH",   "Lane blocked by stationary object detected ahead of bus."),
    ("Rash Driving",        "HIGH",   "Vehicle exceeding safe speed for road conditions detected."),
    ("Hit & Run",           "CRITICAL", "Vehicle collision followed by flight from the scene detected."),
    ("Collision",           "CRITICAL", "Collision involving an identified vehicle detected."),
    ("Waterlogging",        "MEDIUM", "Standing water detected on road surface — aquaplaning risk."),
]

VEHICLE_CLASSES = ["Car", "Bus", "Truck", "Motorcycle", "Auto-rickshaw", "Van"]
PLATE_INCIDENT_TYPES = {"Rash Driving", "Hit & Run", "Collision"}

RISK_FACTORS_MAP = {
    "Pothole Detected":     ["Uneven road surface", "High vehicle count", "Poor maintenance history"],
    "Sudden Braking Event": ["Hidden road hazard", "Poor surface condition", "Visibility obstruction"],
    "Traffic Bottleneck":   ["Narrow road width", "Signal timing", "Heavy vehicle mix"],
    "Pedestrian Danger":    ["No pedestrian barriers", "Unmarked crossing", "Poor lighting"],
    "Road Obstruction":     ["Lane blockage", "Illegal parking", "Construction debris"],
    "Rash Driving":         ["Speed limit violations", "No enforcement", "Road geometry"],
    "Waterlogging":         ["Poor drainage", "Low elevation", "Rainfall accumulation"],
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def bearing(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    y = math.sin(math.radians(b_lng - a_lng)) * math.cos(math.radians(b_lat))
    x = (math.cos(math.radians(a_lat)) * math.sin(math.radians(b_lat))
         - math.sin(math.radians(a_lat)) * math.cos(math.radians(b_lat))
         * math.cos(math.radians(b_lng - a_lng)))
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def cardinal(degrees: float) -> str:
    return ("N", "NE", "E", "SE", "S", "SW", "W", "NW")[round(degrees / 45) % 8]


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return float(default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def random_ocr_plate() -> str:
    """Simulation OCR value retained from the original incident event schema."""
    import random
    return f"RJ {random.randint(10, 99):02d} {random.choice('ABCDEFGH')} {random.randint(1000, 9999):04d}"


def _make_loop(center_lat: float, center_lng: float, index: int, bus_count: int):
    """Generate a circular waypoint loop around the given centre."""
    lat_step = 0.0038
    lng_step = 0.0052
    radius = 1 + (index % 3) * 0.22
    phase = index * (2 * math.pi / bus_count)
    loop = []
    for point in range(12):
        theta = phase + point * (2 * math.pi / 12)
        loop.append({
            "lat": center_lat + math.sin(theta) * lat_step * radius,
            "lng": center_lng + math.cos(theta) * lng_step * radius,
        })
    return loop


class LocalSimulationEngine:
    """A software GPS + camera test-input adapter.

    Starts immediately with 8 buses at a generic starting point.
    When ``configure_operating_area`` is called with a real device location
    the buses are relocated to loop around that point.
    """

    # Default starting centre — buses start here until location is granted.
    # This keeps the simulation anchored to Jaipur while the browser GPS can
    # re-centre the map on the user's location when available.
    _DEFAULT_LAT = 26.9124
    _DEFAULT_LNG = 75.7873

    def __init__(self, bus_count: int = 8):
        self.bus_count = bus_count
        self.buses: dict[str, Any] = {}
        self.running = False
        self.tick = 0
        self.operating_area: Optional[dict[str, Any]] = None
        self.subscribers: list[Callable[[str, Any], Awaitable[None]]] = []
        self.position_callback = None
        self.detection_callback = None
        self.incident_callback = None
        self._task = None
        # Initialise with placeholder buses so REST endpoints return data
        self._init_buses(self._DEFAULT_LAT, self._DEFAULT_LNG)

    def _init_buses(self, center_lat: float, center_lng: float):
        """Spawn simulation buses around the given coordinates."""
        self.buses = {}
        for index in range(self.bus_count):
            loop = _make_loop(center_lat, center_lng, index, self.bus_count)
            bus_id = f"bus-{index + 1:03d}"
            self.buses[bus_id] = {
                "id": bus_id,
                "bus_number": f"SIM-BUS-{index + 1:03d}",
                "route_id": f"local-loop-{index % 3 + 1}",
                "route_name": f"Simulation Loop {index % 3 + 1}",
                "waypoints": loop,
                "segment": index % 12,
                "progress": float((index % 5) / 5),
                "status": "ONLINE",
                "speed": float(22 + (index % 5) * 4),
                "camera_status": "ACTIVE",
                "ai_status": "ACTIVE",
                "gps_status": "ACTIVE",
                "passenger_count": 14 + (index * 7) % 43,
                "driver_name": f"Driver {index + 1}",
                "last_update": now(),
                "data_source": "SIMULATION",
            }

    async def configure_operating_area(self, latitude: float, longitude: float, location_name: Optional[str] = None):
        """Relocate buses to loop around the confirmed device location."""
        self.operating_area = {
            "latitude": latitude,
            "longitude": longitude,
            "location_name": location_name or "Current operating area",
            "source": "device_location",
            "updated_at": now(),
        }
        self._init_buses(latitude, longitude)
        await self._broadcast("operating_area.updated", self.operating_area)
        await self._broadcast("buses_snapshot", self.get_all_buses())
        return self.operating_area

    def get_all_buses(self):
        return [self._public_bus(bus) for bus in self.buses.values()]

    def get_bus(self, bus_id: str):
        bus = self.buses.get(bus_id)
        return self._public_bus(bus) if bus else None

    def _public_bus(self, bus):
        if not bus:
            return None
        waypoints = bus.get("waypoints") or []
        segment = int(bus.get("segment") or 0)
        if not waypoints:
            return {
                **{k: v for k, v in bus.items() if k not in {"waypoints", "segment", "progress"}},
                "lat": 0.0,
                "lng": 0.0,
                "direction": 0.0,
                "heading": "N",
                "trip_progress": 0,
                "current_incident": None,
            }
        a = waypoints[segment % len(waypoints)]
        b = waypoints[(segment + 1) % len(waypoints)]
        p = _safe_float(bus.get("progress"), default=0.0)
        direction = bearing(_safe_float(a.get("lat"), 0.0), _safe_float(a.get("lng"), 0.0), _safe_float(b.get("lat"), 0.0), _safe_float(b.get("lng"), 0.0))
        lat = round(_safe_float(a.get("lat"), 0.0) + (_safe_float(b.get("lat"), 0.0) - _safe_float(a.get("lat"), 0.0)) * p, 6)
        lng = round(_safe_float(a.get("lng"), 0.0) + (_safe_float(b.get("lng"), 0.0) - _safe_float(a.get("lng"), 0.0)) * p, 6)
        return {
            **{k: v for k, v in bus.items() if k not in {"waypoints", "segment", "progress"}},
            "lat": lat,
            "lng": lng,
            "direction": round(direction, 1),
            "heading": cardinal(direction),
            "trip_progress": round((segment + p) / len(waypoints) * 100),
            "current_incident": None,
        }

    def get_metrics(self):
        online = sum(b["status"] == "ONLINE" for b in self.buses.values())
        return {
            "active_buses": online,
            "total_fleet": len(self.buses),
            "active_incidents": 0,
            "critical_alerts": 0,
            "road_defects": 0,
            "congested_zones": 0,
            "ai_events_today": self.tick // 15,
            "system_health": 95 if self.running else 60,
        }

    def get_camera_frame(self, bus_id: str, channel: str):
        """Simulation/test input descriptor. A real RTSP/video adapter returns this schema."""
        bus = self.get_bus(bus_id)
        if not bus:
            return None
        objects = self._frame_objects(bus, channel)
        return {
            "camera_id": f"{bus_id}-{channel}",
            "bus_id": bus_id,
            "channel": channel,
            "status": "ONLINE",
            "source": "simulation_test",
            "frame_id": f"{bus_id}-{channel}-{self.tick}",
            "timestamp": now(),
            "objects": objects,
            "stats": {
                "fps": 5,
                "latency_ms": 0,
                "objects_per_frame": len(objects),
                "active_tracks": len(objects),
                "total_detections": self.tick * len(objects),
            },
        }

    def _frame_objects(self, bus, channel):
        # Deterministic test-frame annotations
        classes = ["vehicle", "pedestrian", "traffic_sign"]
        seed = hash(f"{bus['id']}-{channel}-{self.tick // 5}")
        import random
        rng = random.Random(seed)
        return [
            {
                "id": f"{bus['id']}-{channel}-{i}",
                "track_id": 100 + i,
                "class": label,
                "confidence": round(0.91 - i * 0.07, 2),
                "bbox": [rng.randint(10, 60), rng.randint(30, 60), 18, 22],
                "speed_estimate": round(rng.uniform(10, 60), 1),
            }
            for i, label in enumerate(classes)
        ]

    def _generate_risk_event(self, bus):
        """Generate a road-risk event from a simulated bus observation."""
        import random
        event_type, severity, description = random.choice(RISK_EVENT_TYPES)
        factors = RISK_FACTORS_MAP.get(event_type, ["Multiple contributing factors"])
        confidence = round(random.uniform(0.72, 0.96), 2)
        pub = self._public_bus(bus)
        number_plate = random_ocr_plate() if event_type in PLATE_INCIDENT_TYPES else None
        ocr_confidence = round(random.uniform(0.72, 0.96), 2) if number_plate else None
        return {
            "type": event_type,
            "severity": severity,
            "confidence": confidence,
            "description": description,
            "bus_id": bus["id"],
            "bus_number": bus["bus_number"],
            "camera_id": f"{bus['id']}-FRONT",
            "lat": pub["lat"],
            "lng": pub["lng"],
            "vehicle_class": random.choice(VEHICLE_CLASSES) if number_plate else None,
            "number_plate": number_plate,
            "ocr_confidence": ocr_confidence,
            "contributing_factors": factors,
            "ai_reasoning": (
                f"PRAHARI AI detected {event_type.lower()} with {round(confidence * 100)}% confidence "
                f"via {bus['bus_number']} FRONT camera. "
                f"Primary factors: {', '.join(factors[:2])}."
            ),
        }

    def _traffic(self):
        jaipur_zones = [
            ("Amber Road", 26.9124, 75.7873),
            ("Malviya Nagar", 26.8388, 75.8034),
            ("Vaishali Nagar", 26.9347, 75.7513),
            ("Sanganer Corridor", 26.8135, 75.7858),
            ("Civil Lines", 26.9297, 75.8108),
            ("Jhotwara Junction", 26.9655, 75.7945),
        ]

        zones = []
        for i, (name, lat, lng) in enumerate(jaipur_zones):
            nearby = [b for b in self.get_all_buses() if abs(_safe_float(b.get("lat"), 0.0) - lat) < 0.08 and abs(_safe_float(b.get("lng"), 0.0) - lng) < 0.08]
            avg_speed = sum(_safe_float(b.get("speed"), 0.0) for b in nearby) / max(1, len(nearby))
            vehicle_count = max(20, min(180, int(28 + (self.tick + i * 7) % 56 + len(nearby) * 10)))
            if avg_speed > 38:
                congestion = "FREE"
            elif avg_speed > 24:
                congestion = "MODERATE"
            elif avg_speed > 15:
                congestion = "HEAVY"
            else:
                congestion = "SEVERE"

            zones.append({
                "id": f"traffic-{i+1}",
                "name": name,
                "lat": lat,
                "lng": lng,
                "radius": 320,
                "vehicle_count": vehicle_count,
                "avg_speed": round(avg_speed, 1),
                "vehicles_per_hour": int(vehicle_count * 6),
                "congestion_level": congestion,
                "source": "simulation_test",
                "timestamp": now(),
            })
        return zones

    def _generate_traffic_zone_update(self):
        return self._traffic()

    async def _emit_detection(self, bus):
        frame = self.get_camera_frame(bus["id"], "FRONT")
        if not frame or not frame["objects"]:
            return
        obj = frame["objects"][0]
        detection = {
            "camera_id": frame["camera_id"],
            "bus_id": bus["id"],
            "type": obj["class"],
            "confidence": obj["confidence"],
            "bounding_box": obj["bbox"],
            "tracking_id": str(obj["track_id"]),
            "latitude": bus["lat"] if isinstance(bus.get("lat"), float) else 0.0,
            "longitude": bus["lng"] if isinstance(bus.get("lng"), float) else 0.0,
            "location_name": (self.operating_area or {}).get("location_name", "Simulation"),
            "severity": "LOW",
            "status": "DETECTED",
            "source": "simulation_test",
            "timestamp": now(),
        }
        if self.detection_callback:
            await self.detection_callback(detection)

    async def _loop(self):
        while self.running:
            buses_list = list(self.buses.values())
            for bus in buses_list:
                bus["progress"] = _safe_float(bus.get("progress"), default=0.0) + 0.035
                if bus["progress"] >= 1:
                    bus["progress"] -= 1
                    bus["segment"] = (int(bus.get("segment") or 0) + 1) % len(bus["waypoints"])
                bus["last_update"] = now()
                snapshot = self._public_bus(bus)
                if self.position_callback:
                    await self.position_callback(snapshot)
                await self._broadcast("bus_update", snapshot)

            await self._broadcast("buses_snapshot", self.get_all_buses())

            if self.tick % 5 == 0 and buses_list:
                target = buses_list[self.tick % len(buses_list)]
                await self._emit_detection(target)
                await self._broadcast("traffic.updated", self._traffic())

                # Generate road-risk event every 15 ticks
                if self.tick % 15 == 0:
                    risk_bus = buses_list[(self.tick // 15) % len(buses_list)]
                    risk_event = self._generate_risk_event(risk_bus)
                    if self.incident_callback:
                        await self.incident_callback(risk_event)

            await self._broadcast("metrics", self.get_metrics())
            self.tick += 1
            await asyncio.sleep(2)

    async def _broadcast(self, name, data):
        for subscriber in list(self.subscribers):
            try:
                await subscriber(name, data)
            except Exception:
                pass

    def subscribe(self, callback):
        self.subscribers.append(callback)

    async def start(self):
        if not self.running:
            self.running = True
            self._task = asyncio.create_task(self._loop())

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()


simulation_engine = LocalSimulationEngine()
