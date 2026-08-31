import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Bus, AlertTriangle, ShieldAlert, Activity, TrendingUp, Users,
  MapPin, RotateCcw, Settings, Eye, Loader2, RefreshCw, BarChart3,
  Camera, CheckCircle, XCircle,
} from 'lucide-react'
import { usePrahariStore, UserRole } from '@/store'
import { fleetAPI, roadAPI, incidentsAPI } from '@/services/api'
import PrahariMap from '@/components/map/PrahariMap'
import { Incident } from '@/types'

// ── Geolocation hook (auto-request, no hardcoded coords) ─────────────────────
function useLocation() {
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [state, setState] = useState<'idle'|'requesting'|'ready'|'denied'|'error'>('idle')
  const watchRef = useRef<number | null>(null)
  const { setLocationGranted } = usePrahariStore()

  const request = useCallback(() => {
    if (!navigator.geolocation) { setState('error'); return }
    setState('requesting')
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPos([coords.latitude, coords.longitude])
        setState('ready')
        setLocationGranted(true)
      },
      (err) => setState(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
    )
  }, [setLocationGranted])

  // Auto-request on mount
  useEffect(() => {
    request()
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { pos, state, request }
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color = '#6366f1', loading = false }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; color?: string; loading?: boolean
}) {
  return (
    <div className="prahari-card p-4 flex items-start gap-3">
      <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: color + '18' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-prahari-muted font-medium truncate">{label}</p>
        {loading
          ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mt-1" />
          : <p className="text-2xl font-bold text-prahari-text mt-0.5">{value}</p>
        }
        {sub && <p className="text-[11px] text-prahari-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Location status banner ────────────────────────────────────────────────────
function LocationBanner({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === 'ready' || state === 'requesting') return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm flex-shrink-0 ${
        state === 'denied' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
                             'bg-slate-50 border border-slate-200 text-slate-600'
      }`}
    >
      <MapPin size={15} className="flex-shrink-0" />
      <div className="flex-1">
        {state === 'denied' && 'Location permission denied. Map is showing a default view. Grant location permission in your browser to centre on your area.'}
        {state === 'error'  && 'Could not detect your location.'}
        {state === 'idle'   && 'Requesting your location…'}
      </div>
      {state !== 'denied' && (
        <button onClick={onRetry} className="flex items-center gap-1 text-xs font-medium underline">
          <RotateCcw size={11} /> Retry
        </button>
      )}
    </motion.div>
  )
}

// ── OPERATOR view ─────────────────────────────────────────────────────────────
function OperatorDashboard({ location, locState, onRetryLoc }: {
  location: [number, number] | null; locState: string; onRetryLoc: () => void
}) {
  const { buses, incidents, metrics, simulationActive } = usePrahariStore()
  const [riskZones, setRiskZones] = useState<unknown[]>([])
  const { updateIncident } = usePrahariStore()

  useEffect(() => {
    roadAPI.getRiskScores().then(r => setRiskZones(r.data)).catch(() => {})
  }, [])

  const activeIncidents = incidents.filter(i => !['RESOLVED','CLOSED'].includes(i.status))
  const onlineBuses = buses.filter(b => b.status === 'ONLINE')

  const doAcknowledge = async (inc: Incident) => {
    try {
      const res = await incidentsAPI.acknowledgeIncident(inc.id)
      updateIncident(res.data)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3 flex-shrink-0">
        <h1 className="text-lg font-bold text-prahari-text">Operations Dashboard</h1>
        {simulationActive && (
          <span className="sim-badge"><div className="w-1.5 h-1.5 rounded-full bg-sky-500 status-blink"/>SIMULATION</span>
        )}
        <div className="ml-auto text-xs text-prahari-muted">
          {onlineBuses.length}/{buses.length} buses online · {activeIncidents.length} active incidents
        </div>
      </div>

      <LocationBanner state={locState} onRetry={onRetryLoc} />

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <MetricCard icon={Bus}           label="Online Buses"      value={onlineBuses.length}         sub={`${buses.length} total`}        color="#0ea5e9" />
        <MetricCard icon={AlertTriangle} label="Active Incidents"  value={activeIncidents.length}     sub={`${activeIncidents.filter(i=>i.severity==='CRITICAL').length} critical`} color="#ef4444" />
        <MetricCard icon={Activity}      label="AI Events Today"   value={metrics?.ai_events_today ?? 0} sub="Road risk detections"          color="#8b5cf6" />
        <MetricCard icon={ShieldAlert}   label="System Health"     value={`${metrics?.system_health ?? 95}%`} sub="All services nominal"      color="#10b981" />
      </div>

      {/* Map + right panel */}
      <div className="flex flex-1 gap-3 min-h-0">
        <div className="flex-1 prahari-map-container relative">
          <PrahariMap
            buses={buses}
            incidents={activeIncidents}
            riskZones={riskZones as never[]}
            userLocation={location}
            className="w-full h-full"
          />
          {/* Simulation label overlay */}
          {simulationActive && (
            <div className="absolute top-2 right-2 z-[9000] sim-badge pointer-events-none">
              🚌 {buses.length} simulation buses
            </div>
          )}
          {/* Map legend */}
          <div className="absolute bottom-4 left-4 glass-panel rounded-xl p-3 z-[9000] pointer-events-none">
            <p className="text-[10px] font-semibold text-prahari-muted mb-2 uppercase tracking-wide">Map Legend</p>
            {[
              ['#10b981', 'Bus (Online)'],
              ['#f59e0b', 'Bus (Degraded)'],
              ['#dc2626', 'Incident (Critical)'],
              ['#ca8a04', 'Incident (Medium)'],
              ['#6366f1', 'Your Location'],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-2 mb-1 last:mb-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                <span className="text-[10px] text-prahari-muted">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Bus list + Incident queue */}
        <div className="w-72 flex flex-col gap-3 flex-shrink-0 overflow-hidden">
          {/* Bus fleet status */}
          <div className="prahari-card p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Bus size={13} className="text-prahari-sky" />
              <span className="text-xs font-bold text-prahari-text uppercase tracking-wide">Fleet Status</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {buses.length === 0 ? (
                <p className="text-xs text-prahari-muted text-center py-3">Loading buses…</p>
              ) : buses.map(b => {
                const c = b.status === 'ONLINE' ? '#10b981' : b.status === 'DEGRADED' ? '#f59e0b' : '#ef4444'
                return (
                  <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-prahari-bg">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c }} />
                    <span className="text-xs font-medium text-prahari-text flex-1">{b.bus_number}</span>
                    <span className="text-[10px] text-prahari-muted">{Math.round(b.speed)} km/h</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: c, background: c+'18' }}>{b.status}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Incident queue — operator can acknowledge */}
          <div className="prahari-card p-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <AlertTriangle size={13} className="text-red-500" />
              <span className="text-xs font-bold text-prahari-text uppercase tracking-wide">Incident Queue</span>
              {activeIncidents.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{activeIncidents.length}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {activeIncidents.slice(0, 15).map(inc => {
                const c = inc.severity === 'CRITICAL' ? '#dc2626' : inc.severity === 'HIGH' ? '#ea580c' : '#ca8a04'
                return (
                  <div key={inc.id} className="px-2.5 py-2 rounded-xl bg-prahari-bg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                      <span className="text-xs font-semibold text-prahari-text truncate flex-1">{inc.type}</span>
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ color: c, background: c+'18' }}>{inc.severity}</span>
                    </div>
                    <p className="text-[11px] text-prahari-muted line-clamp-1 mb-1.5">{inc.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-prahari-muted">{inc.bus_number} · {inc.status}</span>
                      {inc.status === 'DETECTED' && (
                        <button
                          onClick={() => doAcknowledge(inc)}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {activeIncidents.length === 0 && (
                <div className="flex flex-col items-center py-4 text-prahari-muted">
                  <CheckCircle size={18} className="mb-1 text-green-400" />
                  <p className="text-xs">No active incidents</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ADMIN view ────────────────────────────────────────────────────────────────
function AdminDashboard({ location, locState, onRetryLoc }: {
  location: [number, number] | null; locState: string; onRetryLoc: () => void
}) {
  const { buses, incidents, defects, metrics, simulationActive } = usePrahariStore()
  const [riskZones, setRiskZones] = useState<unknown[]>([])

  useEffect(() => {
    roadAPI.getRiskScores().then(r => setRiskZones(r.data)).catch(() => {})
  }, [])

  const activeInc = incidents.filter(i => !['RESOLVED','CLOSED'].includes(i.status))
  const criticalInc = activeInc.filter(i => i.severity === 'CRITICAL')

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3 flex-shrink-0">
        <h1 className="text-lg font-bold text-prahari-text">System Overview</h1>
        {simulationActive && (
          <span className="sim-badge"><div className="w-1.5 h-1.5 rounded-full bg-sky-500 status-blink"/>SIMULATION</span>
        )}
        <span className="ml-auto text-[10px] px-2 py-1 rounded-lg font-semibold data-historical">HISTORICAL + SIMULATION</span>
      </div>

      <LocationBanner state={locState} onRetry={onRetryLoc} />

      {/* Admin metrics */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <MetricCard icon={Bus}           label="Active Fleet"       value={buses.filter(b=>b.status==='ONLINE').length} sub={`of ${buses.length} buses`} color="#0ea5e9" />
        <MetricCard icon={AlertTriangle} label="Critical Incidents" value={criticalInc.length} sub={`${activeInc.length} total active`} color="#ef4444" />
        <MetricCard icon={ShieldAlert}   label="High-Risk Zones"   value={riskZones.filter((z:unknown) => (z as {level:string}).level==='CRITICAL').length} sub="CRITICAL level zones" color="#f59e0b" />
        <MetricCard icon={BarChart3}     label="Road Defects"      value={defects.length} sub={`${defects.filter(d=>d.severity==='CRITICAL').length} critical`} color="#8b5cf6" />
      </div>

      {/* Main grid: map + analytics */}
      <div className="flex flex-1 gap-3 min-h-0">
        <div className="flex-1 prahari-map-container relative">
          <PrahariMap
            buses={buses}
            incidents={activeInc}
            defects={defects}
            riskZones={riskZones as never[]}
            userLocation={location}
            className="w-full h-full"
          />
        </div>

        {/* Right: risk breakdown + recent incidents */}
        <div className="w-72 flex flex-col gap-3 flex-shrink-0">
          {/* Risk zone summary */}
          <div className="prahari-card p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={13} className="text-red-500" />
              <span className="text-xs font-bold text-prahari-text uppercase tracking-wide">Risk Zone Summary</span>
            </div>
            {(['CRITICAL','HIGH','MODERATE','LOW'] as const).map(level => {
              const count = riskZones.filter((z:unknown) => (z as {level:string}).level === level).length
              const total = riskZones.length || 1
              const colors: Record<string, string> = { CRITICAL:'#dc2626', HIGH:'#ea580c', MODERATE:'#ca8a04', LOW:'#16a34a' }
              const c = colors[level]
              return (
                <div key={level} className="flex items-center gap-2 mb-1.5 last:mb-0">
                  <span className="text-[10px] font-bold w-16 flex-shrink-0" style={{ color: c }}>{level}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count/total)*100}%`, background: c }} />
                  </div>
                  <span className="text-[11px] font-bold text-prahari-text w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Incident type breakdown */}
          <div className="prahari-card p-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <Activity size={13} className="text-prahari-purple" />
              <span className="text-xs font-bold text-prahari-text uppercase tracking-wide">Recent Incidents</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {activeInc.slice(0, 12).map(inc => {
                const c = inc.severity === 'CRITICAL' ? '#dc2626' : inc.severity === 'HIGH' ? '#ea580c' : '#ca8a04'
                return (
                  <div key={inc.id} className="flex items-start gap-2 px-2.5 py-2 rounded-xl bg-prahari-bg">
                    <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: c }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-xs font-semibold text-prahari-text truncate flex-1">{inc.type}</span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ color: c, background: c+'18' }}>{inc.severity}</span>
                      </div>
                      <p className="text-[10px] text-prahari-muted">{inc.bus_number} · {inc.status}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick admin links */}
          <div className="prahari-card p-3 flex-shrink-0">
            <p className="text-[10px] font-semibold text-prahari-muted uppercase tracking-wide mb-2">Quick Actions</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'System Health', icon: Activity, path: '/system-health', color: '#10b981' },
                { label: 'Analytics',     icon: BarChart3, path: '/analytics',    color: '#6366f1' },
                { label: 'Road Intel',    icon: ShieldAlert, path: '/road-intelligence', color: '#f59e0b' },
                { label: 'AI Vision',     icon: Camera, path: '/ai-vision',       color: '#0ea5e9' },
              ].map(({ label, icon: Icon, path, color }) => (
                <a
                  key={path}
                  href={path}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-prahari-border hover:bg-prahari-bg transition-colors text-xs font-medium text-prahari-muted hover:text-prahari-text"
                >
                  <Icon size={13} style={{ color }} />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── VIEWER view ───────────────────────────────────────────────────────────────
function ViewerDashboard({ location, locState, onRetryLoc }: {
  location: [number, number] | null; locState: string; onRetryLoc: () => void
}) {
  const { incidents, defects } = usePrahariStore()
  const [riskZones, setRiskZones] = useState<unknown[]>([])
  const [analytics, setAnalytics] = useState<{avg_risk_score?:number; total_defects?:number; total_incidents?:number} | null>(null)

  useEffect(() => {
    roadAPI.getRiskScores().then(r => setRiskZones(r.data)).catch(() => {})
    roadAPI.getAnalytics().then(r => setAnalytics(r.data)).catch(() => {})
  }, [])

  const totalScore = riskZones.length > 0
    ? Math.round((riskZones as {score:number}[]).reduce((a, z) => a + z.score, 0) / riskZones.length)
    : null
  const topLevel = totalScore == null ? null
    : totalScore >= 75 ? 'CRITICAL' : totalScore >= 50 ? 'HIGH' : totalScore >= 25 ? 'MODERATE' : 'LOW'
  const levelColor: Record<string, string> = { CRITICAL:'#dc2626', HIGH:'#ea580c', MODERATE:'#ca8a04', LOW:'#16a34a' }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-3 flex-shrink-0">
        <h1 className="text-lg font-bold text-prahari-text">Road Risk Overview</h1>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg font-semibold bg-slate-50 text-slate-500 border border-slate-200">
          <Eye size={10} /> READ ONLY
        </span>
      </div>

      <LocationBanner state={locState} onRetry={onRetryLoc} />

      {/* Risk score banner */}
      {totalScore != null && topLevel && (
        <div className="flex items-center gap-4 p-4 rounded-2xl border flex-shrink-0"
          style={{ background: levelColor[topLevel]+'10', borderColor: levelColor[topLevel]+'40' }}
        >
          <div className="text-center">
            <div className="text-4xl font-black" style={{ color: levelColor[topLevel] }}>{totalScore}</div>
            <div className="text-[10px] text-prahari-muted font-semibold">AVG RISK SCORE</div>
          </div>
          <div className="w-px h-10 bg-prahari-border" />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: levelColor[topLevel] }}>{topLevel} risk level</p>
            <p className="text-xs text-prahari-muted">{riskZones.length} zones analysed · {analytics?.total_defects ?? 0} defects · {analytics?.total_incidents ?? 0} incidents</p>
          </div>
          <div className="text-[11px] text-prahari-muted">Read-only view. Contact administrator to modify data.</div>
        </div>
      )}

      {/* Map takes most of the space */}
      <div className="flex flex-1 gap-3 min-h-0">
        <div className="flex-1 prahari-map-container relative">
          <PrahariMap
            incidents={incidents.filter(i => !['RESOLVED','CLOSED'].includes(i.status))}
            defects={defects}
            riskZones={riskZones as never[]}
            userLocation={location}
            className="w-full h-full"
          />
        </div>
        {/* Stats sidebar */}
        <div className="w-60 flex flex-col gap-3 flex-shrink-0">
          <div className="prahari-card p-3">
            <p className="text-xs font-bold text-prahari-muted uppercase tracking-wide mb-3">Risk Breakdown</p>
            {(['CRITICAL','HIGH','MODERATE','LOW'] as const).map(level => {
              const count = (riskZones as {level:string}[]).filter(z => z.level === level).length
              const total = riskZones.length || 1
              const c = levelColor[level]
              return (
                <div key={level} className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold w-16" style={{ color: c }}>{level}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${(count/total)*100}%`, background: c }} />
                  </div>
                  <span className="text-[11px] font-bold text-prahari-text w-5 text-right">{count}</span>
                </div>
              )
            })}
          </div>
          <div className="prahari-card p-3 flex-1">
            <p className="text-xs font-bold text-prahari-muted uppercase tracking-wide mb-3">Recent Incidents</p>
            <div className="space-y-1.5 overflow-y-auto max-h-48">
              {incidents.filter(i=>!['RESOLVED','CLOSED'].includes(i.status)).slice(0,10).map(inc => {
                const c = levelColor[inc.severity] ?? '#ca8a04'
                return (
                  <div key={inc.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-prahari-bg">
                    <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: c }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-prahari-text truncate">{inc.type}</p>
                      <p className="text-[10px] text-prahari-muted">{inc.severity} · {inc.status}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CommandCenter() {
  const user = usePrahariStore(s => s.user)
  const { setMetrics } = usePrahariStore()
  const role = (user?.role ?? 'viewer') as UserRole
  const { pos: location, state: locState, request: retryLoc } = useLocation()

  // Post user location to backend to re-centre simulation buses
  const postedRef = useRef(false)
  useEffect(() => {
    if (!location || postedRef.current) return
    postedRef.current = true
    fleetAPI.setOperatingArea({
      latitude: location[0],
      longitude: location[1],
      location_name: 'Live Device Location',
    }).catch(() => {})
  }, [location])

  // Poll metrics
  useEffect(() => {
    const load = () => fleetAPI.getMetrics().then(r => setMetrics(r.data)).catch(() => {})
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shared = { location, locState, onRetryLoc: retryLoc }

  if (role === 'admin')    return <AdminDashboard    {...shared} />
  if (role === 'operator') return <OperatorDashboard {...shared} />
  return <ViewerDashboard {...shared} />
}
