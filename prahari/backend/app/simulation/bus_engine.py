"""
PRAHARI Virtual Bus Simulation Engine
======================================
Simulates a fleet of virtual buses moving along predefined routes,
generating GPS updates, camera events, and AI detections.
"""

import asyncio
import math
import random
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Delhi city routes - realistic GPS waypoints
DELHI_ROUTES = [
    {
        "id": "route-1",
        "code": "RT-1",
        "name": "Connaught Place - Dwarka Sector 21",
        "start_stop": "Connaught Place",
        "end_stop": "Dwarka Sector 21",
        "color": "#00d4ff",
        "scheduled_duration": 65,
        "total_distance": 22.5,
        "waypoints": [
            {"lat": 28.6328, "lng": 77.2197},
            {"lat": 28.6280, "lng": 77.2100},
            {"lat": 28.6200, "lng": 77.1950},
            {"lat": 28.6100, "lng": 77.1750},
            {"lat": 28.5980, "lng": 77.1500},
            {"lat": 28.5850, "lng": 77.1300},
            {"lat": 28.5750, "lng": 77.1100},
            {"lat": 28.5650, "lng": 77.0900},
            {"lat": 28.5550, "lng": 77.0600},
        ]
    },
    {
        "id": "route-2",
        "code": "RT-2",
        "name": "India Gate - Rohini Sector 18",
        "start_stop": "India Gate",
        "end_stop": "Rohini Sector 18",
        "color": "#00c97a",
        "scheduled_duration": 55,
        "total_distance": 18.3,
        "waypoints": [
            {"lat": 28.6120, "lng": 77.2295},
            {"lat": 28.6250, "lng": 77.2100},
            {"lat": 28.6450, "lng": 77.2050},
            {"lat": 28.6600, "lng": 77.1950},
            {"lat": 28.6750, "lng": 77.1850},
            {"lat": 28.6900, "lng": 77.1700},
            {"lat": 28.7100, "lng": 77.1600},
            {"lat": 28.7250, "lng": 77.1400},
        ]
    },
    {
        "id": "route-3",
        "code": "RT-3",
        "name": "Lajpat Nagar - Noida Sector 62",
        "start_stop": "Lajpat Nagar",
        "end_stop": "Noida Sector 62",
        "color": "#ffb020",
        "scheduled_duration": 50,
        "total_distance": 16.8,
        "waypoints": [
            {"lat": 28.5677, "lng": 77.2436},
            {"lat": 28.5600, "lng": 77.2600},
            {"lat": 28.5500, "lng": 77.2800},
            {"lat": 28.5400, "lng": 77.3000},
            {"lat": 28.5350, "lng": 77.3200},
            {"lat": 28.5300, "lng": 77.3400},
            {"lat": 28.5250, "lng": 77.3600},
        ]
    },
    {
        "id": "route-4",
        "code": "RT-4",
        "name": "Kashmere Gate - Saket District Centre",
        "start_stop": "Kashmere Gate",
        "end_stop": "Saket",
        "color": "#f97316",
        "scheduled_duration": 70,
        "total_distance": 24.1,
        "waypoints": [
            {"lat": 28.6666, "lng": 77.2282},
            {"lat": 28.6550, "lng": 77.2200},
            {"lat": 28.6400, "lng": 77.2150},
            {"lat": 28.6250, "lng": 77.2100},
            {"lat": 28.6100, "lng": 77.2000},
            {"lat": 28.5900, "lng": 77.2100},
            {"lat": 28.5700, "lng": 77.2150},
            {"lat": 28.5500, "lng": 77.2200},
        ]
    },
    {
        "id": "route-5",
        "code": "RT-5",
        "name": "Shahdara - Janakpuri West",
        "start_stop": "Shahdara",
        "end_stop": "Janakpuri West",
        "color": "#a78bfa",
        "scheduled_duration": 80,
        "total_distance": 28.6,
        "waypoints": [
            {"lat": 28.6724, "lng": 77.2916},
            {"lat": 28.6600, "lng": 77.2700},
            {"lat": 28.6500, "lng": 77.2500},
            {"lat": 28.6400, "lng": 77.2200},
            {"lat": 28.6300, "lng": 77.2000},
            {"lat": 28.6200, "lng": 77.1800},
            {"lat": 28.6100, "lng": 77.1600},
            {"lat": 28.5950, "lng": 77.1200},
        ]
    },
]

DRIVER_NAMES = [
    "Rajesh Kumar", "Suresh Sharma", "Anil Singh", "Mohan Verma", "Prakash Yadav",
    "Deepak Gupta", "Mahesh Patel", "Ramesh Tiwari", "Sanjay Mishra", "Vikram Chauhan",
    "Amit Joshi", "Ravi Saxena", "Sunil Pandey", "Naresh Dubey", "Dinesh Rawat",
    "Kamlesh Shah", "Bhupesh Soni", "Ashok Meena", "Pradeep Nair", "Vinod Pillai"
]

INCIDENT_TYPES = [
    {"type": "Hit & Run", "severity": "CRITICAL", "weight": 3},
    {"type": "Rash Driving", "severity": "HIGH", "weight": 8},
    {"type": "Road Obstruction", "severity": "HIGH", "weight": 10},
    {"type": "Pothole Detected", "severity": "MEDIUM", "weight": 15},
    {"type": "Traffic Bottleneck", "severity": "MEDIUM", "weight": 12},
    {"type": "Waterlogging", "severity": "MEDIUM", "weight": 10},
    {"type": "Pedestrian Danger", "severity": "HIGH", "weight": 7},
    {"type": "Collision", "severity": "CRITICAL", "weight": 4},
    {"type": "Sudden Braking", "severity": "MEDIUM", "weight": 12},
    {"type": "Dangerous Lane Change", "severity": "HIGH", "weight": 8},
    {"type": "Missing Road Divider", "severity": "MEDIUM", "weight": 6},
    {"type": "Damaged Traffic Sign", "severity": "LOW", "weight": 5},
]

VEHICLE_CLASSES = ["Car", "Bus", "Truck", "Motorcycle", "Auto-rickshaw", "Bicycle", "Van"]

AI_REASONING_TEMPLATES = {
    "Hit & Run": "Vehicle {plate} detected striking pedestrian/vehicle at high speed. Vehicle failed to stop. License plate captured via OCR with {ocr_conf}% confidence. Trajectory analysis confirms evasive maneuver post-impact. Multi-frame tracking confirms hit-and-run behavior.",
    "Rash Driving": "Vehicle detected operating at {speed} km/h in a {limit} km/h zone. Erratic lane changes observed across {frames} frames. ByteTrack trajectory analysis confirms hazardous driving pattern.",
    "Road Obstruction": "Static object(s) detected blocking {pct}% of road width for >{duration} seconds. Traffic flow analysis confirms 40% reduction in vehicle throughput. Multiple vehicles observed taking evasive action.",
    "Pothole Detected": "Road surface anomaly detected with {area} cm² exposure area. Depth estimation via shadow analysis suggests >5cm severity. Observed by {obs} vehicles over {duration} minutes.",
    "Traffic Bottleneck": "Vehicle density exceeds {density} vehicles/100m in zone. Average speed dropped to {speed} km/h vs {baseline} km/h baseline. Congestion pattern suggests incident or signal failure upstream.",
    "Pedestrian Danger": "Pedestrian(s) detected in high-risk zone. Vehicle approaching at {speed} km/h with {ttc}s TTC. Contextual factors: {context}. Risk level elevated based on trajectory convergence.",
    "Collision": "Impact event detected via sudden deceleration signature ({decel}G). Multiple vehicle trajectories converged. Post-impact stationary behavior of involved vehicles confirmed. Dispatching emergency alert.",
}


def haversine(lat1, lng1, lat2, lng2):
    R = 6371000  # meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def bearing(lat1, lng1, lat2, lng2):
    dLng = math.radians(lng2 - lng1)
    lat1, lat2 = math.radians(lat1), math.radians(lat2)
    x = math.sin(dLng) * math.cos(lat2)
    y = math.cos(lat1)*math.sin(lat2) - math.sin(lat1)*math.cos(lat2)*math.cos(dLng)
    bearing_deg = math.degrees(math.atan2(x, y))
    return (bearing_deg + 360) % 360


def degrees_to_cardinal(degrees):
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[round(degrees / 45) % 8]


def random_ocr_plate():
    state_codes = ["DL", "HR", "UP", "RJ", "MH"]
    return f"{random.choice(state_codes)} {random.randint(1,99):02d} {random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')} {random.randint(1000,9999)}"


class VirtualBus:
    """Represents a single virtual bus in the simulation"""
    
    def __init__(self, bus_id: str, bus_number: str, route: dict, driver_name: str):
        self.id = bus_id
        self.bus_number = bus_number
        self.route_id = route["id"]
        self.route_name = route["name"]
        self.route = route
        self.driver_name = driver_name
        
        self.waypoints = route["waypoints"]
        self.current_waypoint_idx = random.randint(0, max(0, len(self.waypoints) - 2))
        self.progress_to_next = random.random()
        
        wp = self.waypoints[self.current_waypoint_idx]
        self.lat = wp["lat"]
        self.lng = wp["lng"]
        self.speed = random.uniform(20, 45)
        self.direction = 0
        self.heading = "N"
        self.trip_progress = self.current_waypoint_idx * 100 // max(1, len(self.waypoints) - 1)
        
        self.status = "ONLINE"
        self.gps_status = "ACTIVE"
        self.camera_status = "ACTIVE"
        self.ai_status = "ACTIVE"
        self.current_incident = None
        self.last_update = datetime.now(timezone.utc).isoformat()
        
        # Internal sim state
        self._stop_timer = 0
        self._at_stop = False
        self._degraded_timer = 0
        self._incident_cooldown = 0
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "bus_number": self.bus_number,
            "route_id": self.route_id,
            "route_name": self.route_name,
            "status": self.status,
            "lat": round(self.lat, 6),
            "lng": round(self.lng, 6),
            "speed": round(self.speed, 1),
            "direction": round(self.direction, 1),
            "heading": self.heading,
            "gps_status": self.gps_status,
            "camera_status": self.camera_status,
            "ai_status": self.ai_status,
            "current_incident": self.current_incident,
            "trip_progress": self.trip_progress,
            "driver_name": self.driver_name,
            "last_update": datetime.now(timezone.utc).isoformat(),
        }
    
    def update(self, dt: float):
        """Update bus position. dt = time delta in seconds"""
        if self.status == "OFFLINE":
            # Occasionally come back online
            if random.random() < 0.01:
                self.status = "ONLINE"
                self.camera_status = "ACTIVE"
                self.ai_status = "ACTIVE"
            return
        
        # Randomly degrade
        if random.random() < 0.0003:
            self.status = "DEGRADED"
            self._degraded_timer = random.randint(30, 120)
        
        if self._degraded_timer > 0:
            self._degraded_timer -= dt
            if self._degraded_timer <= 0:
                self.status = "ONLINE"
                self._degraded_timer = 0
        
        # Random camera degradation
        if random.random() < 0.0002:
            self.camera_status = "DEGRADED"
        elif random.random() < 0.001 and self.camera_status == "DEGRADED":
            self.camera_status = "ACTIVE"
        
        # Handle bus stops
        if self._at_stop:
            self._stop_timer -= dt
            self.speed = 0
            if self._stop_timer <= 0:
                self._at_stop = False
                self.speed = random.uniform(20, 45)
            return
        
        # Move along route
        wp_len = len(self.waypoints)
        if wp_len < 2:
            return
        
        next_idx = (self.current_waypoint_idx + 1) % wp_len
        wp_curr = self.waypoints[self.current_waypoint_idx]
        wp_next = self.waypoints[next_idx]
        
        # Calculate bearing to next waypoint
        self.direction = bearing(wp_curr["lat"], wp_curr["lng"], wp_next["lat"], wp_next["lng"])
        self.heading = degrees_to_cardinal(self.direction)
        
        # Distance to next waypoint
        dist_to_next = haversine(wp_curr["lat"], wp_curr["lng"], wp_next["lat"], wp_next["lng"])
        
        # Vary speed realistically
        target_speed = random.gauss(35, 8)
        target_speed = max(10, min(60, target_speed))
        self.speed += (target_speed - self.speed) * 0.1
        
        # Progress along segment
        speed_m_per_s = self.speed / 3.6
        move_dist = speed_m_per_s * dt
        
        if dist_to_next > 0:
            self.progress_to_next += move_dist / dist_to_next
        
        # Interpolate position
        t = min(1.0, self.progress_to_next)
        self.lat = wp_curr["lat"] + (wp_next["lat"] - wp_curr["lat"]) * t
        self.lng = wp_curr["lng"] + (wp_next["lng"] - wp_curr["lng"]) * t
        
        # Arrived at next waypoint
        if self.progress_to_next >= 1.0:
            self.progress_to_next = 0.0
            self.current_waypoint_idx = next_idx
            
            # Simulate bus stop
            if random.random() < 0.3:
                self._at_stop = True
                self._stop_timer = random.uniform(15, 45)
                self.speed = 0
        
        # Calculate trip progress
        self.trip_progress = int((self.current_waypoint_idx / max(1, wp_len - 1)) * 100)
        self.last_update = datetime.now(timezone.utc).isoformat()
        
        # Decrement incident cooldown
        if self._incident_cooldown > 0:
            self._incident_cooldown -= dt
        if self._incident_cooldown <= 0:
            self.current_incident = None


class BusSimulationEngine:
    """
    PRAHARI Virtual Bus Simulation Engine
    
    Manages a fleet of virtual buses and generates:
    - GPS position updates
    - AI detection events  
    - Traffic intelligence data
    - Road defect observations
    - Incident events
    """
    
    def __init__(self, bus_count: int = 20):
        self.buses: Dict[str, VirtualBus] = {}
        self.bus_count = bus_count
        self.running = False
        self.subscribers: List = []  # WebSocket broadcast functions
        self.incident_callback = None
        self.gps_callback = None
        self._loop_task = None
        
        # Generate AI detection state per bus
        self._detection_state: Dict[str, dict] = {}
        
        self._init_buses()
    
    def _init_buses(self):
        """Initialize virtual bus fleet"""
        for i in range(self.bus_count):
            route = DELHI_ROUTES[i % len(DELHI_ROUTES)]
            bus_id = f"bus-{i+1:03d}"
            bus_number = f"DL-BUS-{100 + i}"
            driver = DRIVER_NAMES[i % len(DRIVER_NAMES)]
            
            bus = VirtualBus(bus_id, bus_number, route, driver)
            # Stagger starting positions
            bus.current_waypoint_idx = (i * 2) % max(1, len(route["waypoints"]) - 1)
            bus.progress_to_next = random.random()
            
            self.buses[bus_id] = bus
            self._detection_state[bus_id] = {
                "frame_count": 0,
                "track_id_counter": 1,
                "tracked_objects": {},
                "fps": random.uniform(22, 28),
                "latency_ms": random.randint(40, 120),
                "total_detections": 0,
                "events_per_minute": 0,
            }
        
        logger.info(f"Initialized {len(self.buses)} virtual buses")
    
    def get_all_buses(self) -> List[dict]:
        return [b.to_dict() for b in self.buses.values()]
    
    def get_bus(self, bus_id: str) -> Optional[dict]:
        bus = self.buses.get(bus_id)
        return bus.to_dict() if bus else None
    
    def get_metrics(self) -> dict:
        buses = list(self.buses.values())
        online = sum(1 for b in buses if b.status == "ONLINE")
        degraded = sum(1 for b in buses if b.status == "DEGRADED")
        return {
            "active_buses": online,
            "total_fleet": len(buses),
            "active_incidents": 0,  # Updated by incident tracker
            "critical_alerts": 0,
            "road_defects": 0,
            "congested_zones": 0,
            "ai_events_today": 0,
            "system_health": 95 - (degraded * 3),
        }
    
    def get_ai_detections(self, bus_id: str) -> dict:
        """Get current AI detection state for a bus"""
        if bus_id not in self._detection_state:
            return {"objects": [], "stats": {}}
        
        state = self._detection_state[bus_id]
        bus = self.buses.get(bus_id)
        
        if not bus or bus.camera_status != "ACTIVE":
            return {"objects": [], "stats": state}
        
        # Generate dynamic objects
        objects = self._generate_detections(bus_id)
        
        return {
            "objects": objects,
            "stats": {
                "fps": round(state["fps"] + random.gauss(0, 1), 1),
                "latency_ms": state["latency_ms"] + random.randint(-10, 10),
                "objects_per_frame": len(objects),
                "events_per_minute": state["events_per_minute"],
                "total_detections": state["total_detections"],
                "active_tracks": len(state["tracked_objects"]),
            }
        }
    
    def _generate_detections(self, bus_id: str) -> List[dict]:
        """Generate realistic object detections for a camera frame"""
        state = self._detection_state[bus_id]
        state["frame_count"] += 1
        
        # Number of visible objects varies
        n_objects = random.randint(2, 8)
        objects = []
        
        # Maintain some consistent tracked objects
        existing = list(state["tracked_objects"].items())
        
        # Update existing tracks
        for track_id, obj in list(state["tracked_objects"].items()):
            obj["bbox"][0] += random.gauss(0, 0.5)  # slight drift
            obj["bbox"][1] += random.gauss(0, 0.3)
            obj["confidence"] = max(0.55, min(0.99, obj["confidence"] + random.gauss(0, 0.02)))
            obj["confidence"] = round(obj["confidence"], 2)
            
            # Remove if out of frame
            if obj["bbox"][0] < -5 or obj["bbox"][0] > 100 or state["frame_count"] - obj["first_frame"] > 80:
                del state["tracked_objects"][track_id]
            else:
                objects.append({
                    "id": f"{bus_id}-{track_id}",
                    "track_id": track_id,
                    "class": obj["class"],
                    "confidence": obj["confidence"],
                    "bbox": [round(v, 1) for v in obj["bbox"]],
                })
        
        # Add new objects
        while len(objects) < n_objects and len(objects) < 12:
            cls_weights = [40, 15, 10, 20, 8, 5, 2]  # car, motorcycle, truck, person, auto, bus, other
            cls_names = ["Car", "Motorcycle", "Truck", "Person", "Auto-rickshaw", "Bus", "Bicycle"]
            cls = random.choices(cls_names, weights=cls_weights)[0]
            
            x = random.uniform(5, 75)
            y = random.uniform(30, 70)
            w = random.uniform(8, 25) if cls != "Person" else random.uniform(3, 6)
            h = random.uniform(6, 18) if cls != "Person" else random.uniform(8, 16)
            
            track_id = state["track_id_counter"]
            state["track_id_counter"] += 1
            
            obj = {
                "class": cls,
                "confidence": round(random.uniform(0.60, 0.97), 2),
                "bbox": [x, y, w, h],
                "first_frame": state["frame_count"],
            }
            state["tracked_objects"][track_id] = obj
            state["total_detections"] += 1
            
            objects.append({
                "id": f"{bus_id}-{track_id}",
                "track_id": track_id,
                "class": cls,
                "confidence": obj["confidence"],
                "bbox": [round(v, 1) for v in [x, y, w, h]],
            })
        
        return objects
    
    def _generate_incident(self, bus: VirtualBus) -> Optional[dict]:
        """Generate a probabilistic incident based on bus state"""
        if bus._incident_cooldown > 0 or bus.status != "ONLINE":
            return None
        
        # Low probability per update
        if random.random() > 0.003:
            return None
        
        # Select incident type
        types = INCIDENT_TYPES
        weights = [t["weight"] for t in types]
        incident_def = random.choices(types, weights=weights)[0]
        
        incident_type = incident_def["type"]
        severity = incident_def["severity"]
        
        # Confidence calculation
        detection_conf = random.uniform(0.65, 0.97)
        tracking_conf = random.uniform(0.70, 0.99)
        context_conf = random.uniform(0.60, 0.90)
        confidence = round((detection_conf * 0.5 + tracking_conf * 0.3 + context_conf * 0.2), 2)
        
        # OCR plate
        number_plate = None
        ocr_confidence = None
        if incident_type in ["Hit & Run", "Rash Driving", "Collision"]:
            number_plate = random_ocr_plate()
            ocr_confidence = round(random.uniform(0.72, 0.96), 2)
        
        # AI reasoning
        speed = round(bus.speed, 1)
        template = AI_REASONING_TEMPLATES.get(incident_type, "Event detected and confirmed by AI analysis.")
        ai_reasoning = template.format(
            plate=number_plate or "N/A",
            ocr_conf=round((ocr_confidence or 0) * 100),
            speed=speed,
            limit=random.choice([30, 40, 50]),
            frames=random.randint(8, 24),
            pct=random.randint(40, 80),
            duration=random.randint(30, 180),
            density=random.randint(15, 35),
            baseline=random.randint(35, 55),
            obs=random.randint(2, 8),
            area=random.randint(200, 1200),
            ttc=round(random.uniform(0.8, 3.5), 1),
            context="school zone, peak hours, high pedestrian density",
            decel=round(random.uniform(0.4, 0.9), 1),
        )
        
        contributing_factors = []
        if speed > 40:
            contributing_factors.append(f"High vehicle speed: {speed} km/h")
        if bus.camera_status == "ACTIVE":
            contributing_factors.append("Multiple camera angles confirm event")
        contributing_factors.append(f"Detection confidence: {round(detection_conf * 100)}%")
        contributing_factors.append(f"Tracking stability: {round(tracking_conf * 100)}%")
        if context_conf > 0.75:
            contributing_factors.append("Strong contextual indicators present")
        
        incident = {
            "id": str(uuid.uuid4()),
            "type": incident_type,
            "severity": severity,
            "status": "DETECTED",
            "confidence": confidence,
            "description": f"{incident_type} detected by {bus.bus_number} at {bus.lat:.4f}°N, {bus.lng:.4f}°E",
            "bus_id": bus.id,
            "bus_number": bus.bus_number,
            "camera_id": f"{bus.id}-FRONT",
            "lat": bus.lat + random.gauss(0, 0.0003),
            "lng": bus.lng + random.gauss(0, 0.0003),
            "address": f"Near {bus.route_name}",
            "vehicle_class": random.choice(VEHICLE_CLASSES) if incident_type not in ["Pothole Detected", "Waterlogging"] else None,
            "number_plate": number_plate,
            "ocr_confidence": ocr_confidence,
            "ai_reasoning": ai_reasoning,
            "contributing_factors": contributing_factors,
            "corroborating_buses": [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        bus._incident_cooldown = random.uniform(60, 180)
        bus.current_incident = incident_type
        
        return incident
    
    def _generate_traffic_zone_update(self) -> List[dict]:
        """Generate traffic zone congestion data from bus observations"""
        zones = []
        delhi_zones = [
            ("Connaught Place", 28.6328, 77.2197),
            ("India Gate Circle", 28.6120, 77.2295),
            ("Lajpat Nagar", 28.5677, 77.2436),
            ("Karol Bagh", 28.6514, 77.1907),
            ("Saket", 28.5250, 77.2197),
            ("Rohini", 28.7093, 77.1405),
            ("Dwarka Sector 21", 28.5526, 77.0575),
            ("Noida Sector 62", 28.6271, 77.3688),
            ("Janakpuri", 28.6265, 77.0947),
            ("Kashmere Gate", 28.6666, 77.2282),
        ]
        
        for name, lat, lng in delhi_zones:
            # Check nearby buses
            nearby_buses = [b for b in self.buses.values() 
                           if haversine(b.lat, b.lng, lat, lng) < 800 and b.status == "ONLINE"]
            
            n_buses = len(nearby_buses)
            avg_speed = sum(b.speed for b in nearby_buses) / max(1, n_buses)
            
            # Simulate background traffic
            base_vehicles = random.randint(15, 45)
            from_buses = n_buses * random.randint(3, 8)
            total_vehicles = base_vehicles + from_buses
            
            # Add time-of-day variation (simulated)
            hour = datetime.now(timezone.utc).hour
            peak_factor = 1.5 if (8 <= hour <= 10 or 17 <= hour <= 20) else 1.0
            total_vehicles = int(total_vehicles * peak_factor)
            avg_speed = avg_speed / peak_factor
            
            if avg_speed > 40:
                congestion = "FREE"
            elif avg_speed > 25:
                congestion = "MODERATE"
            elif avg_speed > 15:
                congestion = "HEAVY"
            else:
                congestion = "SEVERE"
            
            zones.append({
                "id": f"zone-{name.replace(' ', '-').lower()}",
                "name": name,
                "lat": lat,
                "lng": lng,
                "radius": 400,
                "congestion_level": congestion,
                "vehicle_count": total_vehicles,
                "avg_speed": round(avg_speed, 1),
                "vehicles_per_hour": total_vehicles * 6,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        
        return zones
    
    async def _simulation_loop(self):
        """Main simulation tick loop"""
        dt = 2.0  # update every 2 seconds
        tick = 0
        
        while self.running:
            try:
                # Update all buses
                for bus in self.buses.values():
                    bus.update(dt)
                
                # Broadcast bus positions
                bus_snapshots = self.get_all_buses()
                await self._broadcast("buses_snapshot", bus_snapshots)
                
                # Generate incidents occasionally
                for bus in self.buses.values():
                    incident = self._generate_incident(bus)
                    if incident and self.incident_callback:
                        await self.incident_callback(incident)
                
                # Update traffic zones every 10s
                if tick % 5 == 0:
                    zones = self._generate_traffic_zone_update()
                    await self._broadcast("traffic_zones", zones)
                
                # Update metrics every 5s
                if tick % 2 == 0:
                    await self._broadcast("metrics", self.get_metrics())
                
                tick += 1
                await asyncio.sleep(dt)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Simulation loop error: {e}")
                await asyncio.sleep(dt)
    
    async def _broadcast(self, event_type: str, data: Any):
        """Broadcast to all connected WebSocket clients"""
        for sub in list(self.subscribers):
            try:
                await sub(event_type, data)
            except Exception:
                pass
    
    def subscribe(self, callback):
        self.subscribers.append(callback)
        return lambda: self.subscribers.remove(callback) if callback in self.subscribers else None
    
    async def start(self):
        if not self.running:
            self.running = True
            self._loop_task = asyncio.create_task(self._simulation_loop())
            logger.info("Bus simulation engine started")
    
    async def stop(self):
        self.running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("Bus simulation engine stopped")


# Global simulation engine instance
simulation_engine = BusSimulationEngine(bus_count=20)
