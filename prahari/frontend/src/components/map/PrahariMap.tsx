/**
 * PrahariMap — MapTiler + Leaflet implementation
 *
 * Key design decisions:
 * - Map is initialised ONCE via a ref guard. Never recreated.
 * - Markers are stored in Maps (busMarkersRef, etc.) and updated in-place.
 * - No React state drives the map div; only refs do.
 * - Tiles come from MapTiler raster API using VITE_MAPTILER_API_KEY.
 * - If the key is absent we show a small config note — not a fake map.
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Bus, Incident, RoadDefect, GeoPoint } from '@/types'

// ── Fix Leaflet default marker icon paths broken by Vite bundling ─────────────
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── MapTiler tile URL ─────────────────────────────────────────────────────────
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY ?? ''

// Use streets-v2 light style. Falls back to OSM if key is empty.
function tileUrl(): string {
  if (MAPTILER_KEY) {
    return `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  }
  // Public OSM fallback (no key needed, no API-required screen)
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
}

function tileAttribution(): string {
  if (MAPTILER_KEY) {
    return '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
  }
  return '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
}

// ── Marker icon factories ─────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', LOW: '#16a34a',
}
const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MODERATE: '#ca8a04', LOW: '#16a34a',
}

function busIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;color:#fff;font-weight:700;
    ">🚌</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function incidentIcon(severity: string): L.DivIcon {
  const c = SEV_COLOR[severity] ?? '#ca8a04'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:20px;height:20px;border-radius:4px;
      background:${c};border:2px solid #fff;
      box-shadow:0 2px 4px rgba(0,0,0,0.2);
      transform:rotate(45deg);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function userLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:20px;height:20px">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(99,102,241,0.2);
        animation:prahari-pulse 2s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:12px;height:12px;border-radius:50%;
        background:#6366f1;border:2.5px solid #fff;
        box-shadow:0 0 0 2px rgba(99,102,241,0.4);
      "></div>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

// Add the pulse keyframe once
if (typeof document !== 'undefined' && !document.getElementById('prahari-pulse-style')) {
  const s = document.createElement('style')
  s.id = 'prahari-pulse-style'
  s.textContent = `
    @keyframes prahari-pulse {
      0%,100% { transform: scale(1); opacity:0.6; }
      50%      { transform: scale(2); opacity:0; }
    }
  `
  document.head.appendChild(s)
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface RiskZone {
  lat: number
  lng: number
  score: number
  level: string
  factors: string[]
}

export interface RouteLine {
  id: string
  name: string
  color: string
  waypoints: GeoPoint[]
  delayed?: boolean
}

export interface PrahariMapProps {
  buses?: Bus[]
  incidents?: Incident[]
  defects?: RoadDefect[]
  riskZones?: RiskZone[]
  routeLines?: RouteLine[]
  userLocation?: [number, number] | null
  onBusClick?: (bus: Bus) => void
  onIncidentClick?: (incident: Incident) => void
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PrahariMap({
  buses = [],
  incidents = [],
  defects = [],
  riskZones = [],
  routeLines = [],
  userLocation,
  onBusClick,
  onIncidentClick,
  className = '',
}: PrahariMapProps) {
  const containerRef     = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<L.Map | null>(null)
  const initializedRef   = useRef(false)
  const tileLayerRef     = useRef<L.TileLayer | null>(null)
  const routeLayerRef    = useRef<L.LayerGroup | null>(null)

  // Marker registries — keyed by ID, updated in-place
  const busMarkersRef       = useRef<Map<string, L.Marker>>(new Map())
  const incidentMarkersRef  = useRef<Map<string, L.Marker>>(new Map())
  const defectLayerRef      = useRef<L.LayerGroup | null>(null)
  const riskLayerRef        = useRef<L.LayerGroup | null>(null)
  const userMarkerRef       = useRef<L.Marker | null>(null)
  const centeredOnUser      = useRef(false)

  // ── Map initialisation (runs once) ─────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return
    initializedRef.current = true

    // Default view: generic world view — will pan to user when location arrives
    const map = L.map(containerRef.current, {
      center: [20, 78],   // India centre — will immediately pan on location
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    })

    // Tile layer
    tileLayerRef.current = L.tileLayer(tileUrl(), {
      attribution: tileAttribution(),
      maxZoom: 19,
      tileSize: 256,
    }).addTo(map)

    defectLayerRef.current = L.layerGroup().addTo(map)
    riskLayerRef.current   = L.layerGroup().addTo(map)
    routeLayerRef.current  = L.layerGroup().addTo(map)

    mapRef.current = map

    // Clean up on unmount
    return () => {
      map.remove()
      mapRef.current = null
      initializedRef.current = false
    }
  }, []) // ← empty deps — runs exactly once

  // ── User location marker ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return
    const [lat, lng] = userLocation

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([lat, lng], {
        icon: userLocationIcon(),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:160px">
            <div style="font-weight:700;color:#4f46e5;margin-bottom:4px">📍 Your Location</div>
            <div style="font-size:12px;color:#64748b">Lat: ${lat.toFixed(5)}</div>
            <div style="font-size:12px;color:#64748b">Lng: ${lng.toFixed(5)}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px">Browser GPS</div>
          </div>
        `, { maxWidth: 200 })
    } else {
      userMarkerRef.current.setLatLng([lat, lng])
      userMarkerRef.current
        .getPopup()
        ?.setContent(`
          <div style="font-family:Inter,sans-serif;min-width:160px">
            <div style="font-weight:700;color:#4f46e5;margin-bottom:4px">📍 Your Location</div>
            <div style="font-size:12px;color:#64748b">Lat: ${lat.toFixed(5)}</div>
            <div style="font-size:12px;color:#64748b">Lng: ${lng.toFixed(5)}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px">Browser GPS</div>
          </div>
        `)
    }

    // Pan to user only on first location fix
    if (!centeredOnUser.current) {
      centeredOnUser.current = true
      map.setView([lat, lng], 14, { animate: true })
    }
  }, [userLocation?.[0], userLocation?.[1]]) // ← only re-runs when coords change

  // ── Bus markers ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const seen = new Set<string>()

    buses.forEach(bus => {
      seen.add(bus.id)
      const color = bus.status === 'ONLINE' ? '#10b981'
                  : bus.status === 'DEGRADED' ? '#f59e0b' : '#ef4444'
      const pos: L.LatLngExpression = [bus.lat, bus.lng]

      const existing = busMarkersRef.current.get(bus.id)
      if (existing) {
        existing.setLatLng(pos)
        existing.setIcon(busIcon(color))
      } else {
        const marker = L.marker(pos, { icon: busIcon(color), zIndexOffset: 100 })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:180px">
              <div style="font-weight:700;color:#4f46e5;font-size:14px;margin-bottom:8px">🚌 ${bus.bus_number}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:12px">
                <span style="color:#64748b">Route</span><span style="font-weight:600">${bus.route_name}</span>
                <span style="color:#64748b">Speed</span><span>${Math.round(bus.speed)} km/h</span>
                <span style="color:#64748b">Status</span><span style="color:${color};font-weight:700">${bus.status}</span>
                <span style="color:#64748b">Heading</span><span>${bus.heading}</span>
              </div>
              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f4">
                <span style="background:#eff6ff;color:#2563eb;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700">SIMULATION</span>
              </div>
            </div>
          `, { maxWidth: 220 })

        if (onBusClick) {
          marker.on('click', () => onBusClick(bus))
        }
        busMarkersRef.current.set(bus.id, marker)
      }
    })

    // Remove stale bus markers
    busMarkersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        busMarkersRef.current.delete(id)
      }
    })
  }, [buses]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Incident markers ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const seen = new Set<string>()

    incidents
      .filter(i => i.lat && i.lng && !['RESOLVED', 'CLOSED'].includes(i.status))
      .forEach(inc => {
        seen.add(inc.id)
        if (incidentMarkersRef.current.has(inc.id)) return

        const marker = L.marker([inc.lat, inc.lng], {
          icon: incidentIcon(inc.severity),
          zIndexOffset: 200,
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:200px">
              <div style="font-weight:700;color:${SEV_COLOR[inc.severity] ?? '#ca8a04'};font-size:13px;margin-bottom:6px">⚠ ${inc.type}</div>
              <div style="font-size:11px;color:#64748b;margin-bottom:8px">${inc.description}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:11px">
                <span style="color:#64748b">Severity</span><span style="color:${SEV_COLOR[inc.severity]};font-weight:700">${inc.severity}</span>
                <span style="color:#64748b">Status</span><span>${inc.status}</span>
                <span style="color:#64748b">Confidence</span><span>${Math.round(inc.confidence * 100)}%</span>
              </div>
              ${inc.contributing_factors?.length ? `
              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f4;font-size:10px;color:#64748b">
                ${inc.contributing_factors.slice(0, 2).map(f => `• ${f}`).join('<br>')}
              </div>` : ''}
            </div>
          `, { maxWidth: 240 })

        if (onIncidentClick) {
          marker.on('click', () => onIncidentClick(inc))
        }
        incidentMarkersRef.current.set(inc.id, marker)
      })

    // Remove resolved incidents from map
    incidentMarkersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        incidentMarkersRef.current.delete(id)
      }
    })
  }, [incidents]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Risk zone circles ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const layer = riskLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    riskZones
      .filter(z => z.score >= 20)
      .forEach(zone => {
        const color = RISK_COLOR[zone.level] ?? '#ca8a04'
        const radius = 180 + zone.score * 3

        L.circle([zone.lat, zone.lng], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.12,
          weight: 1,
          opacity: 0.4,
        })
          .addTo(layer)
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:180px">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <div style="font-size:28px;font-weight:900;color:${color}">${zone.score}</div>
                <div>
                  <div style="font-size:10px;color:#64748b">RISK SCORE</div>
                  <div style="font-size:12px;font-weight:700;color:${color}">${zone.level}</div>
                </div>
              </div>
              <div style="font-size:10px;color:#64748b;font-weight:600;margin-bottom:4px">WHY THIS SCORE</div>
              ${zone.factors.slice(0, 3).map(f => `<div style="font-size:11px;color:#475569;margin-bottom:2px">• ${f}</div>`).join('')}
            </div>
          `, { maxWidth: 220 })
      })
  }, [riskZones])

  // ── Defect circles ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const layer = defectLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    defects.forEach(defect => {
      const color = SEV_COLOR[defect.severity] ?? '#ca8a04'
      L.circleMarker([defect.lat, defect.lng], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.7,
        weight: 2,
      })
        .addTo(layer)
        .bindPopup(`
          <div style="font-family:Inter,sans-serif">
            <div style="font-weight:700;color:${color};margin-bottom:4px">${defect.type}</div>
            <div style="font-size:11px;color:#64748b">Severity: ${defect.severity}</div>
            <div style="font-size:11px;color:#64748b">Seen ${defect.observation_count}×</div>
            <div style="font-size:11px;color:#64748b">Status: ${defect.status}</div>
          </div>
        `, { maxWidth: 180 })
    })
  }, [defects])

  useEffect(() => {
    const layer = routeLayerRef.current
    if (!layer) return

    layer.clearLayers()
    ;(routeLines ?? []).forEach((route) => {
      if (!route.waypoints || route.waypoints.length < 2) return

      const points = route.waypoints.map(p => [p.lat, p.lng] as [number, number])
      const polyline = L.polyline(points, {
        color: route.color,
        weight: route.delayed ? 4 : 3,
        opacity: route.delayed ? 0.95 : 0.8,
        dashArray: route.delayed ? undefined : '8 8',
      }).addTo(layer)

      polyline.bindPopup(`
        <div style="font-family:Inter,sans-serif;min-width:150px">
          <div style="font-weight:700;color:${route.color};margin-bottom:4px">${route.name}</div>
          <div style="font-size:11px;color:#64748b">${route.delayed ? 'Delayed route' : 'Alternative route'}</div>
        </div>
      `, { maxWidth: 180 })
    })
  }, [routeLines])

  // No API key needed — we fall back to OSM. No "required" screen.
  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ minHeight: 200 }}
    >
      {/* MapTiler config hint — only in dev, only if key is missing */}
      {!MAPTILER_KEY && import.meta.env.DEV && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-[9000] pointer-events-none"
        >
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-3 py-1.5 rounded-lg shadow-sm font-medium">
            💡 Add <code className="bg-amber-100 px-1 rounded">VITE_MAPTILER_API_KEY</code> to .env.local for styled tiles
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
      />
    </div>
  )
}
