"""
PRAHARI Database Models
"""
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from ..database import Base


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String(20), default="operator")  # admin, operator, viewer, field_officer
    email = Column(String(100), unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    last_login = Column(DateTime(timezone=True), nullable=True)


class Route(Base):
    __tablename__ = "routes"
    id = Column(String, primary_key=True, default=gen_uuid)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    start_stop = Column(String(100))
    end_stop = Column(String(100))
    total_distance = Column(Float, default=0)
    scheduled_duration = Column(Integer, default=60)  # minutes
    waypoints = Column(JSON, default=list)  # [{lat, lng}, ...]
    color = Column(String(10), default="#00d4ff")
    is_active = Column(Boolean, default=True)

    buses = relationship("Bus", back_populates="route")


class Bus(Base):
    __tablename__ = "buses"
    id = Column(String, primary_key=True, default=gen_uuid)
    bus_number = Column(String(20), unique=True, nullable=False)
    route_id = Column(String, ForeignKey("routes.id"), nullable=True)
    status = Column(String(20), default="ONLINE")  # ONLINE, DEGRADED, OFFLINE
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    speed = Column(Float, default=0)
    direction = Column(Float, default=0)
    heading = Column(String(5), default="N")
    gps_status = Column(String(20), default="ACTIVE")
    camera_status = Column(String(20), default="ACTIVE")
    ai_status = Column(String(20), default="ACTIVE")
    trip_progress = Column(Integer, default=0)
    driver_name = Column(String(100), nullable=True)
    current_waypoint_idx = Column(Integer, default=0)
    last_update = Column(DateTime(timezone=True), default=utcnow)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    route = relationship("Route", back_populates="buses")


class Camera(Base):
    __tablename__ = "cameras"
    id = Column(String, primary_key=True, default=gen_uuid)
    bus_id = Column(String, ForeignKey("buses.id"), nullable=False, index=True)
    channel = Column(String(10), nullable=False)  # FRONT, REAR, LEFT, RIGHT, CABIN
    source_kind = Column(String(30), default="simulation_test")  # rtsp, recorded_video, simulation_test
    source_uri = Column(String(500), nullable=True)
    status = Column(String(20), default="ONLINE")
    last_frame_at = Column(DateTime(timezone=True), nullable=True)


class Detection(Base):
    __tablename__ = "detections"
    id = Column(String, primary_key=True, default=gen_uuid)
    camera_id = Column(String, ForeignKey("cameras.id"), nullable=False, index=True)
    bus_id = Column(String, ForeignKey("buses.id"), nullable=False, index=True)
    type = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    bounding_box = Column(JSON, default=list)
    tracking_id = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(200), nullable=True)
    severity = Column(String(20), default="LOW")
    status = Column(String(30), default="DETECTED")
    source = Column(String(50), nullable=False)  # model_inference, simulation_test, recorded_video
    evidence_uri = Column(String(500), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)


class OperatingArea(Base):
    __tablename__ = "operating_areas"
    id = Column(String, primary_key=True, default=gen_uuid)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(200), nullable=True)
    source = Column(String(50), default="device_location")
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class GPSLog(Base):
    __tablename__ = "gps_logs"
    id = Column(String, primary_key=True, default=gen_uuid)
    bus_id = Column(String, ForeignKey("buses.id"), nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    speed = Column(Float, default=0)
    direction = Column(Float, default=0)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)


class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True, default=gen_uuid)
    type = Column(String(100), nullable=False)
    severity = Column(String(20), default="MEDIUM")  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(30), default="DETECTED")
    confidence = Column(Float, default=0.7)
    description = Column(Text, default="")
    bus_id = Column(String, nullable=False)
    bus_number = Column(String(20), nullable=True)
    camera_id = Column(String(50), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String(200), nullable=True)
    vehicle_class = Column(String(50), nullable=True)
    number_plate = Column(String(30), nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    assigned_to = Column(String(100), nullable=True)
    contributing_factors = Column(JSON, default=list)
    corroborating_buses = Column(JSON, default=list)
    evidence_url = Column(String(500), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class RoadDefect(Base):
    __tablename__ = "road_defects"
    id = Column(String, primary_key=True, default=gen_uuid)
    type = Column(String(100), nullable=False)
    severity = Column(String(20), default="MEDIUM")
    status = Column(String(30), default="DETECTED")
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String(200), nullable=True)
    observation_count = Column(Integer, default=1)
    confidence = Column(Float, default=0.75)
    maintenance_priority = Column(String(20), default="MEDIUM")
    assigned_team = Column(String(100), nullable=True)
    first_observed = Column(DateTime(timezone=True), default=utcnow)
    last_observed = Column(DateTime(timezone=True), default=utcnow)


class TrafficZone(Base):
    __tablename__ = "traffic_zones"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    radius = Column(Integer, default=300)  # meters
    congestion_level = Column(String(20), default="FREE")
    vehicle_count = Column(Integer, default=0)
    avg_speed = Column(Float, default=40)
    vehicles_per_hour = Column(Integer, default=0)
    timestamp = Column(DateTime(timezone=True), default=utcnow)


class InfrastructureItem(Base):
    __tablename__ = "infrastructure_items"
    id = Column(String, primary_key=True, default=gen_uuid)
    type = Column(String(100), nullable=False)
    severity = Column(String(20), default="MEDIUM")
    status = Column(String(30), default="DETECTED")
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    description = Column(Text, default="")
    first_detected = Column(DateTime(timezone=True), default=utcnow)
    last_verified = Column(DateTime(timezone=True), default=utcnow)
    maintenance_id = Column(String, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=gen_uuid)
    severity = Column(String(20), default="MEDIUM")
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    location = Column(String(200), nullable=True)
    bus_id = Column(String(50), nullable=True)
    incident_id = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    ip_address = Column(String(50), nullable=True)
