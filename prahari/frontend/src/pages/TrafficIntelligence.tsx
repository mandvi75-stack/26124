import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, Car, AlertTriangle, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { usePrahariStore } from '@/store'
import { trafficAPI } from '@/services/api'
import { Bus, TrafficZone } from '@/types'
import { Badge } from '@/components/ui/badge'
import PrahariMap from '@/components/map/PrahariMap'
import { congestionBg, timeAgo } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TrafficTrend {
  time: string
  vehicles: number
  speed: number
  density: number
}

const CONGESTION_COLORS = {
  FREE: '#00c97a',
  MODERATE: '#ffb020',
  HEAVY: '#f97316',
  SEVERE: '#ff3b3b',
}

export default function TrafficIntelligence() {
  const { trafficZones, setTrafficZones, buses } = usePrahariStore()
  const [trends, setTrends] = useState<TrafficTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [zonesRes, trendsRes] = await Promise.allSettled([
          trafficAPI.getZones(),
          trafficAPI.getTrends(6),
        ])
        if (zonesRes.status === 'fulfilled') setTrafficZones(zonesRes.value.data)
        if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value.data)
      } catch (_) {}
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  const congestionCounts = {
    FREE: trafficZones.filter(z => z.congestion_level === 'FREE').length,
    MODERATE: trafficZones.filter(z => z.congestion_level === 'MODERATE').length,
    HEAVY: trafficZones.filter(z => z.congestion_level === 'HEAVY').length,
    SEVERE: trafficZones.filter(z => z.congestion_level === 'SEVERE').length,
  }

  const bottlenecks = trafficZones.filter(z => z.congestion_level === 'HEAVY' || z.congestion_level === 'SEVERE')
    .sort((a, b) => b.vehicle_count - a.vehicle_count)

  const totalVehicles = trafficZones.reduce((s, z) => s + z.vehicle_count, 0)
  const avgSpeed = trafficZones.length > 0
    ? Math.round(trafficZones.reduce((s, z) => s + z.avg_speed, 0) / trafficZones.length)
    : 0

  const trafficVehicles = useMemo<Bus[]>(() => {
    const zones = trafficZones.length ? trafficZones : []
    return zones.flatMap((zone, zoneIndex) => {
      const count = Math.max(1, Math.min(18, Math.ceil(zone.vehicle_count / 18)))
      return Array.from({ length: count }, (_, pointIndex) => {
        const angle = (pointIndex / count) * Math.PI * 2
        const radius = (zone.radius || 350) / 1200
        return {
          id: `${zone.id}-${pointIndex}`,
          bus_number: `V-${zoneIndex + 1}-${pointIndex + 1}`,
          route_id: zone.id,
          route_name: zone.name,
          status: zone.congestion_level === 'FREE' ? 'ONLINE' : 'DEGRADED',
          lat: zone.lat + Math.cos(angle) * radius,
          lng: zone.lng + Math.sin(angle) * radius,
          speed: zone.avg_speed,
          direction: (pointIndex * 45) % 360,
          heading: 'NE',
          gps_status: 'ACTIVE',
          camera_status: 'ACTIVE',
          ai_status: 'ACTIVE',
          current_incident: undefined,
          trip_progress: 40 + (pointIndex % 3) * 15,
          last_update: zone.timestamp,
          driver_name: `Traffic-${pointIndex + 1}`,
          passenger_count: Math.max(1, Math.round(zone.vehicle_count / count)),
        } as Bus
      })
    })
  }, [trafficZones])

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Traffic Intelligence</h1>
          <p className="text-xs text-prahari-muted">Real-time congestion analysis from AI vehicle detections</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-foreground font-bold">{totalVehicles.toLocaleString()} vehicles detected</span>
          <span className="text-prahari-muted">Avg: {avgSpeed} km/h</span>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {Object.entries(congestionCounts).map(([level, count]) => (
          <div key={level} className="glass-panel rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-8 rounded-sm" style={{ background: CONGESTION_COLORS[level as keyof typeof CONGESTION_COLORS] }} />
            <div>
              <div className="text-xl font-bold font-mono" style={{ color: CONGESTION_COLORS[level as keyof typeof CONGESTION_COLORS] }}>{count}</div>
              <div className="text-[10px] text-prahari-muted capitalize">{level.toLowerCase()} zones</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + Map + Bottlenecks */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Left: charts */}
        <div className="flex flex-col gap-3 w-80 shrink-0">
          {/* Traffic trend */}
          <div className="glass-panel rounded-lg p-3 flex-1">
            <h3 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-prahari-cyan" /> Vehicle Flow (6h)
            </h3>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                <XAxis dataKey="time" tick={{ fill: '#8b9ab5', fontSize: 9 }} />
                <YAxis tick={{ fill: '#8b9ab5', fontSize: 9 }} />
                <Tooltip contentStyle={{ background: '#131d35', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 11 }} />
                <Area type="monotone" dataKey="vehicles" stroke="#00d4ff" fill="url(#vGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Speed trend */}
          <div className="glass-panel rounded-lg p-3 flex-1">
            <h3 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity size={12} className="text-green-400" /> Avg Speed (6h)
            </h3>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="sGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00c97a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00c97a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                <XAxis dataKey="time" tick={{ fill: '#8b9ab5', fontSize: 9 }} />
                <YAxis tick={{ fill: '#8b9ab5', fontSize: 9 }} unit=" km/h" />
                <Tooltip contentStyle={{ background: '#131d35', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 11 }} />
                <Area type="monotone" dataKey="speed" stroke="#00c97a" fill="url(#sGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bottlenecks */}
          <div className="glass-panel rounded-lg p-3 flex-1">
            <h3 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-red-400" /> Bottlenecks
            </h3>
            <ScrollArea className="h-24">
              {bottlenecks.length === 0 ? (
                <p className="text-xs text-prahari-muted text-center py-4">No bottlenecks detected</p>
              ) : (
                <div className="space-y-1.5">
                  {bottlenecks.map(z => (
                    <div key={z.id} className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-foreground">{z.name}</span>
                        <div className="text-[9px] text-prahari-muted">{z.vehicle_count} vehicles · {z.avg_speed} km/h</div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${congestionBg(z.congestion_level)}`}>{z.congestion_level}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative rounded-lg overflow-hidden border border-prahari-border">
          <PrahariMap buses={trafficVehicles} className="w-full h-full" />

          {/* Congestion legend */}
          <div className="absolute bottom-4 left-4 glass-panel rounded-lg p-2 z-10">
            {Object.entries(CONGESTION_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-1.5 mb-0.5">
                <div className="w-3 h-3 rounded-sm opacity-70" style={{ background: color }} />
                <span className="text-[9px] text-prahari-muted">{level}</span>
              </div>
            ))}
          </div>

          {/* Live counter */}
          <div className="absolute top-3 left-3 glass-panel rounded-lg px-3 py-1.5 z-10 flex items-center gap-2">
            <Car size={12} className="text-prahari-cyan" />
            <span className="text-xs font-medium text-foreground">
              <span className="text-prahari-cyan font-bold">{totalVehicles.toLocaleString()}</span> vehicles
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
