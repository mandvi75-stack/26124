// Core PRAHARI types

export interface GeoPoint {
  lat: number
  lng: number
}

export type BusStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE'
export type CameraStatus = 'ACTIVE' | 'DEGRADED' | 'OFFLINE'
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type IncidentStatus = 'DETECTED' | 'ANALYZING' | 'CONFIRMED' | 'ASSIGNED' | 'RESPONDING' | 'RESOLVED' | 'CLOSED'
export type DefectStatus = 'DETECTED' | 'VERIFIED' | 'ASSIGNED' | 'UNDER_MAINTENANCE' | 'RESOLVED'
export type CongestionLevel = 'FREE' | 'MODERATE' | 'HEAVY' | 'SEVERE'

export interface Bus {
  id: string
  bus_number: string
  route_id: string
  route_name: string
  status: BusStatus
  lat: number
  lng: number
  speed: number
  direction: number  // degrees 0-360
  heading: string    // 'N' | 'S' | 'E' | 'W' | 'NE' etc.
  gps_status: 'ACTIVE' | 'DEGRADED' | 'LOST'
  camera_status: CameraStatus
  ai_status: 'ACTIVE' | 'PROCESSING' | 'IDLE' | 'ERROR'
  current_incident?: string
  trip_progress: number  // 0-100
  last_update: string
  driver_name?: string
  passenger_count?: number
}

export interface Route {
  id: string
  name: string
  code: string
  start_stop: string
  end_stop: string
  total_distance: number
  scheduled_duration: number  // minutes
  actual_duration: number
  current_delay: number
  avg_delay: number
  active_buses: number
  waypoints: GeoPoint[]
  color: string
}

export interface Incident {
  id: string
  type: string
  severity: IncidentSeverity
  status: IncidentStatus
  confidence: number
  description: string
  bus_id: string
  bus_number?: string
  camera_id: string
  lat: number
  lng: number
  address?: string
  timestamp: string
  vehicle_class?: string
  number_plate?: string
  ocr_confidence?: number
  ai_reasoning?: string
  assigned_to?: string
  resolved_at?: string
  evidence_url?: string
  contributing_factors?: string[]
  corroborating_buses?: string[]
  authority_report?: AuthorityReport | null
}

export interface DetectedObject {
  id: string
  track_id: number
  class: string
  confidence: number
  bbox: [number, number, number, number]  // x, y, w, h in %
  speed_estimate?: number
  trajectory?: GeoPoint[]
}

export interface CameraFeed {
  camera_id: string
  bus_id: string
  position: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' | 'CABIN'
  status: CameraStatus
  fps: number
  resolution: string
  objects: DetectedObject[]
  events: string[]
  frame_count: number
  last_detection_time: string
}

export interface AIProcessingStats {
  fps: number
  latency_ms: number
  objects_per_frame: number
  events_per_minute: number
  total_detections: number
  active_tracks: number
}

export interface RoadDefect {
  id: string
  type: string
  severity: IncidentSeverity
  status: DefectStatus
  lat: number
  lng: number
  address?: string
  road_segment_id?: string
  observation_count: number
  first_observed: string
  last_observed: string
  confidence: number
  maintenance_priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  images?: string[]
  assigned_team?: string
}

export interface TrafficZone {
  id: string
  name: string
  lat: number
  lng: number
  radius: number  // meters
  congestion_level: CongestionLevel
  vehicle_count: number
  avg_speed: number
  vehicles_per_hour: number
  timestamp: string
}

export interface MetricsSummary {
  active_buses: number
  total_fleet: number
  active_incidents: number
  critical_alerts: number
  road_defects: number
  congested_zones: number
  ai_events_today: number
  system_health: number
}

export interface SystemService {
  name: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  latency_ms?: number
  uptime_pct?: number
  last_check: string
  details?: string
}

export interface Notification {
  id: string
  severity: IncidentSeverity
  title: string
  description: string
  location?: string
  bus_id?: string
  timestamp: string
  read: boolean
  incident_id?: string
}

export interface NumberPlate {
  id: string
  plate_number: string
  confidence: number
  bus_id: string
  camera_id: string
  lat: number
  lng: number
  timestamp: string
  incident_id?: string
  image_url?: string
}

export interface AuthorityReport {
  id: string
  incident_id: string
  report_id: string
  authority_name: string
  authority_type: string
  status: 'SENT' | 'ACKNOWLEDGED' | 'RESOLVED'
  sent_at?: string
  acknowledged_at?: string
  resolved_at?: string
  details?: Record<string, unknown>
}

export interface InfrastructureItem {
  id: string
  type: string
  status: DefectStatus
  severity: IncidentSeverity
  lat: number
  lng: number
  description: string
  first_detected: string
  last_verified: string
  maintenance_id?: string
}
