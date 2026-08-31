"""
Seed initial data into the database.
All geographic records use placeholder offsets (0,0) that get replaced
when the simulation engine receives a real device location.
"""
import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models import User, Route, Incident, RoadDefect, TrafficZone, Notification
from ..services.auth import get_password_hash
from ..simulation.bus_engine import DELHI_ROUTES

# Keep the app consistent with the active city context: stale Delhi records
# must not survive across restarts or refreshed seed runs.
CITY_LAT = 26.9124
CITY_LNG = 75.7873


def utcnow():
    return datetime.now(timezone.utc)


# Realistic incident types with severity mapping
INCIDENT_TYPES = [
    ("Pothole Detected", "MEDIUM", "Road surface damage detected by PRAHARI AI vision. Observation confidence high based on multiple bus passes."),
    ("Severe Pothole", "HIGH", "Large pothole detected causing vehicle deflection. Immediate maintenance required."),
    ("Waterlogging", "MEDIUM", "Standing water on roadway detected. Risk of aquaplaning and reduced braking distance."),
    ("Road Obstruction", "HIGH", "Obstruction blocking lane detected. Traffic diversion recommended."),
    ("Rash Driving", "HIGH", "Vehicle detected driving significantly above speed limit. AI confidence > 85%."),
    ("Hit & Run", "CRITICAL", "Vehicle collision followed by fleeing detected on camera. Number plate captured."),
    ("Pedestrian Danger", "HIGH", "Pedestrian detected crossing at high-risk unmarked location near fast-moving traffic."),
    ("Traffic Bottleneck", "MEDIUM", "Congestion buildup detected. Average speed < 15 km/h for > 10 minutes."),
    ("Missing Road Sign", "LOW", "Road sign absent or severely damaged. Navigation hazard for unfamiliar drivers."),
    ("Damaged Divider", "MEDIUM", "Road divider damaged or missing. Cross-traffic risk elevated."),
    ("Collision", "CRITICAL", "Vehicle collision detected. Emergency services may be required."),
    ("Sudden Braking Event", "MEDIUM", "Multiple buses detected sudden braking at this location. Hidden hazard suspected."),
    ("Missing Zebra Crossing", "LOW", "Pedestrian crossing markings faded or absent. High pedestrian-vehicle conflict risk."),
    ("Street Light Failure", "MEDIUM", "Street lighting non-functional at this stretch. Night-time accident risk elevated."),
    ("Wrong-Way Driving", "CRITICAL", "Vehicle detected travelling against traffic flow. Immediate intervention required."),
]

# Road defect types
DEFECT_TYPES = [
    ("Pothole", "HIGH", "DETECTED", "HIGH"),
    ("Pothole", "MEDIUM", "VERIFIED", "MEDIUM"),
    ("Road Damage", "HIGH", "ASSIGNED", "HIGH"),
    ("Waterlogging", "MEDIUM", "DETECTED", "MEDIUM"),
    ("Missing Divider", "HIGH", "VERIFIED", "HIGH"),
    ("Missing Zebra Crossing", "LOW", "DETECTED", "LOW"),
    ("Damaged Sign", "MEDIUM", "UNDER_MAINTENANCE", "MEDIUM"),
    ("Obstruction", "CRITICAL", "DETECTED", "CRITICAL"),
    ("Pothole", "CRITICAL", "DETECTED", "CRITICAL"),
    ("Road Damage", "MEDIUM", "RESOLVED", "LOW"),
    ("Waterlogging", "HIGH", "ASSIGNED", "HIGH"),
    ("Missing Divider", "LOW", "RESOLVED", "LOW"),
]

# Risk factors for explaining road risk scores
RISK_FACTORS = {
    "Pothole": ["Uneven road surface", "High vehicle count", "Heavy rain damage"],
    "Severe Pothole": ["Deep surface damage", "Multiple observation reports", "No maintenance scheduled"],
    "Waterlogging": ["Poor drainage infrastructure", "Low road elevation", "Monsoon impact"],
    "Road Obstruction": ["Lane blockage", "Illegal parking", "Construction debris"],
    "Rash Driving": ["Speed violations", "Traffic signal non-compliance", "Poor enforcement"],
    "Hit & Run": ["No pedestrian barriers", "High vehicle speed", "Poor lighting"],
    "Pedestrian Danger": ["Unmarked crossing", "High pedestrian volume", "Fast traffic flow"],
    "Traffic Bottleneck": ["Narrow carriageway", "Signal timing issues", "Heavy vehicle mix"],
    "Missing Road Sign": ["Weathering", "Vandalism", "No replacement schedule"],
    "Damaged Divider": ["Vehicle impact damage", "Old infrastructure", "No maintenance"],
    "Collision": ["Intersection risk", "Visibility issues", "High traffic speed"],
    "Sudden Braking Event": ["Hidden hazard", "Poor road surface", "Animal crossing"],
    "Missing Zebra Crossing": ["Faded paint", "No remarking schedule", "High foot traffic"],
    "Street Light Failure": ["Electrical fault", "Vandalism", "Ageing infrastructure"],
    "Wrong-Way Driving": ["Confusing signage", "Poor lane markings", "Night visibility"],
}


async def seed_database(db: AsyncSession):
    """Seed the database with initial data if empty"""

    result = await db.execute(select(func.count(User.id)))
    count = result.scalar()

    if count > 0:
        await db.execute(Incident.__table__.delete())
        await db.execute(RoadDefect.__table__.delete())
        await db.execute(TrafficZone.__table__.delete())
        await db.execute(Notification.__table__.delete())
        await db.execute(Route.__table__.delete())
        print("Refreshing stale operational data for Jaipur context...")

    print("Seeding PRAHARI database...")

    # ── Routes ──────────────────────────────────────────────────────────────
    existing_routes = (await db.execute(select(func.count(Route.id)))).scalar() or 0
    if existing_routes == 0:
        for route in DELHI_ROUTES:
            db.add(Route(
                id=route["id"],
                code=route["code"],
                name=route["name"],
                start_stop=route["start_stop"],
                end_stop=route["end_stop"],
                total_distance=route["total_distance"],
                scheduled_duration=route["scheduled_duration"],
                waypoints=route["waypoints"],
                color=route["color"],
                is_active=True,
            ))

    # ── Users ────────────────────────────────────────────────────────────────
    result = await db.execute(select(func.count(User.id)))
    if result.scalar() == 0:
        users = [
        User(id=str(uuid.uuid4()), username="admin",    hashed_password=get_password_hash("prahari123"),  role="admin",    email="admin@prahari.in",    is_active=True),
        User(id=str(uuid.uuid4()), username="operator", hashed_password=get_password_hash("operator123"), role="operator", email="operator@prahari.in", is_active=True),
        User(id=str(uuid.uuid4()), username="viewer",   hashed_password=get_password_hash("viewer123"),   role="viewer",   email="viewer@prahari.in",  is_active=True),
    ]
        for u in users:
            db.add(u)

    # Historical records remain anchored around Jaipur city centre while the
    # live simulation engine may re-centre on user GPS when available.
    random.seed(42)
    CITY_LAT = 26.9124
    CITY_LNG = 75.7873

    incident_ids = []
    for i in range(30):
        inc_type, severity, base_desc = random.choice(INCIDENT_TYPES)
        hours_ago = random.randint(1, 168)  # up to 1 week ago
        status = random.choices(
            ["DETECTED", "ANALYZING", "CONFIRMED", "ASSIGNED", "RESOLVED"],
            weights=[20, 15, 20, 15, 30]
        )[0]

        lat_off = random.uniform(-0.08, 0.08)
        lng_off = random.uniform(-0.08, 0.08)

        factors = RISK_FACTORS.get(inc_type, ["Multiple contributing factors identified"])
        inc_id = str(uuid.uuid4())
        incident_ids.append(inc_id)

        db.add(Incident(
            id=inc_id,
            type=inc_type,
            severity=severity,
            status=status,
            confidence=round(random.uniform(0.72, 0.97), 2),
            description=base_desc,
            bus_id=f"bus-{random.randint(1, 8):03d}",
            bus_number=f"SIM-BUS-{random.randint(1, 8):03d}",
            camera_id=f"bus-{random.randint(1, 8):03d}-FRONT",
            lat=round(CITY_LAT + lat_off, 6),
            lng=round(CITY_LNG + lng_off, 6),
            address=f"Jaipur corridor near {random.choice(['Civil Lines','Malviya Nagar','Vaishali Nagar','Sanganer','Jhotwara','Amber Road'])}",
            number_plate=f"XX {random.randint(10,99)} AA {random.randint(1000,9999)}" if severity in ["CRITICAL", "HIGH"] else None,
            ocr_confidence=round(random.uniform(0.75, 0.96), 2) if severity in ["CRITICAL", "HIGH"] else None,
            ai_reasoning=(
                f"PRAHARI AI detected {inc_type.lower()} with {round(random.uniform(72, 97))}% confidence. "
                f"Event corroborated by {random.randint(1, 3)} nearby buses. "
                f"Contributing factors: {', '.join(factors[:2])}."
            ),
            contributing_factors=factors,
            corroborating_buses=[],
            timestamp=utcnow() - timedelta(hours=hours_ago),
            resolved_at=utcnow() - timedelta(hours=random.randint(1, hours_ago)) if status == "RESOLVED" else None,
        ))

    # ── Road Defects ─────────────────────────────────────────────────────────
    for i, (dtype, severity, status, priority) in enumerate(DEFECT_TYPES):
        days_ago = random.randint(1, 60)
        lat_off = random.uniform(-0.065, 0.065)
        lng_off = random.uniform(-0.065, 0.065)
        db.add(RoadDefect(
            id=str(uuid.uuid4()),
            type=dtype,
            severity=severity,
            status=status,
            lat=round(CITY_LAT + lat_off, 6),
            lng=round(CITY_LNG + lng_off, 6),
            address=f"Jaipur road segment {i + 1} near {random.choice(['Civil Lines','Vaishali Nagar','Malviya Nagar','Amber Road','Sanganer'])}",
            observation_count=random.randint(1, 15),
            confidence=round(random.uniform(0.68, 0.96), 2),
            maintenance_priority=priority,
            assigned_team="PWD Team Alpha" if status in ["ASSIGNED", "UNDER_MAINTENANCE"] else None,
            first_observed=utcnow() - timedelta(days=days_ago),
            last_observed=utcnow() - timedelta(hours=random.randint(2, 72)),
        ))

    # ── Traffic Zones ─────────────────────────────────────────────────────────
    zone_configs = [
        ("Amber Road",      0.0000,  0.0020, "HEAVY",    58, 26, 520),
        ("Malviya Nagar",  -0.0736,  0.0161, "MODERATE", 46, 35, 380),
        ("Vaishali Nagar",  0.0223, -0.0360, "FREE",     73, 48, 210),
        ("Sanganer Corridor", -0.0989, -0.0015, "SEVERE", 61, 18, 680),
        ("Civil Lines",     0.0173,  0.0235, "MODERATE", 52, 33, 290),
        ("Jhotwara Junction", 0.0531, 0.0072, "HEAVY",    63, 24, 610),
    ]
    for name, lat_off, lng_off, congestion, vehicles, speed, vph in zone_configs:
        db.add(TrafficZone(
            id=f"zone-{name.lower().replace(' ', '-')}",
            name=name,
            lat=round(CITY_LAT + lat_off, 6),
            lng=round(CITY_LNG + lng_off, 6),
            radius=350,
            congestion_level=congestion,
            vehicle_count=vehicles,
            avg_speed=speed,
            vehicles_per_hour=vph,
        ))

    # ── Notifications (for recent critical/high incidents) ────────────────────
    notif_items = [
        ("CRITICAL", "🚨 Collision Detected", "Vehicle collision at Zone Delta. AI confidence 94%. Emergency alert raised."),
        ("HIGH",     "⚠️  Pedestrian Hazard",  "Unmarked crossing with high pedestrian activity detected at Zone Beta."),
        ("HIGH",     "⚠️  Road Obstruction",   "Lane blockage detected on Main Corridor. Traffic diversion active."),
        ("MEDIUM",   "🕳️  Pothole Alert",       "New pothole detected at Zone Alpha. Added to maintenance queue."),
        ("MEDIUM",   "🌊 Waterlogging",         "Water accumulation detected at Zone Epsilon — school zone risk elevated."),
        ("LOW",      "ℹ️  Sign Damage",          "Road sign requires replacement at Zone Gamma. Low-priority work order raised."),
    ]
    for i, (severity, title, description) in enumerate(notif_items):
        db.add(Notification(
            id=str(uuid.uuid4()),
            severity=severity,
            title=title,
            description=description,
            location=f"Historical dataset zone {i + 1}",
            bus_id=f"bus-{(i % 8) + 1:03d}",
            incident_id=incident_ids[i] if i < len(incident_ids) else None,
            read=False,
            timestamp=utcnow() - timedelta(minutes=random.randint(5, 480)),
        ))

    await db.commit()
    print("✅ PRAHARI database seeded successfully")
