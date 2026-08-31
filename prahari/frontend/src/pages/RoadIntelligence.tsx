import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Construction, AlertTriangle, CheckCircle, MapPin, BarChart2,
  TrendingUp, Shield, Info, RefreshCw, Loader2,
} from 'lucide-react'
import { usePrahariStore, UserRole } from '@/store'
import { roadAPI } from '@/services/api'
import { useDeviceLocation } from '@/hooks/useDeviceLocation'
import PrahariMap from '@/components/map/PrahariMap'

interface RiskZone {
  lat: number
  lng: number
  score: number
  level: string
  factors: string[]
  defect_count: number
  incident_count: number
  defect_types: string[]
}

interface RoadAnalytics {
  total_defects: number
  total_incidents: number
  defects_by_type: Record<string, number>
  defects_by_severity: Record<string, number>
  incidents_by_type: Record<string, number>
  top_risk_locations: { lat: number; lng: number; severity: string; type: string }[]
  avg_risk_score: number
}

const RISK_META: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  CRITICAL: { label: 'Critical Risk',  color: '#dc2626', bg: '#fef2f2', bar: 'bg-red-500'    },
  HIGH:     { label: 'High Risk',      color: '#ea580c', bg: '#fff7ed', bar: 'bg-orange-500' },
  MODERATE: { label: 'Moderate Risk',  color: '#ca8a04', bg: '#fefce8', bar: 'bg-amber-500'  },
  LOW:      { label: 'Low Risk',       color: '#16a34a', bg: '#f0fdf4', bar: 'bg-green-500'  },
}

const SEV_CLR: Record<string, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#ca8a04', LOW: '#16a34a'
}

export default function RoadIntelligence() {
  const { defects, setDefects, user } = usePrahariStore()
  const [riskZones, setRiskZones] = useState<RiskZone[]>([])
  const [analytics, setAnalytics] = useState<RoadAnalytics | null>(null)
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null)
  const [filterSeverity, setFilterSeverity] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const { location } = useDeviceLocation(false)
  const role = (user?.role ?? 'viewer') as UserRole
  const canEdit = role === 'admin' || role === 'operator'

  const userPos: [number, number] | undefined = location ? [location.lat, location.lng] : undefined

  const loadData = async () => {
    setLoading(true)
    try {
      const [defectsRes, riskRes, analyticsRes] = await Promise.allSettled([
        roadAPI.getDefects(),
        roadAPI.getRiskScores(),
        roadAPI.getAnalytics(),
      ])
      if (defectsRes.status === 'fulfilled') setDefects(defectsRes.value.data)
      if (riskRes.status === 'fulfilled') setRiskZones(riskRes.value.data)
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 30000)
    return () => clearInterval(t)
  }, [])

  const filteredDefects = filterSeverity === 'ALL'
    ? defects
    : defects.filter(d => d.severity === filterSeverity)

  const totalRiskScore = riskZones.length > 0
    ? Math.round(riskZones.reduce((s, z) => s + z.score, 0) / riskZones.length)
    : 0

  const topLevel =
    totalRiskScore >= 75 ? 'CRITICAL' :
    totalRiskScore >= 50 ? 'HIGH'     :
    totalRiskScore >= 25 ? 'MODERATE' : 'LOW'

  const riskMeta = RISK_META[topLevel]

  const stats = {
    total:    defects.length,
    critical: defects.filter(d => d.severity === 'CRITICAL').length,
    pending:  defects.filter(d => ['DETECTED', 'VERIFIED'].includes(d.status)).length,
    resolved: defects.filter(d => d.status === 'RESOLVED').length,
  }

  return (
    <div className="flex flex-col h-full gap-4 page-enter">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-prahari-text">Road Intelligence</h1>
          <p className="text-xs text-prahari-muted">GIS-based road condition monitoring · defect tracking · risk scoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-lg font-semibold data-historical">HISTORICAL DATA</span>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-prahari-bg border border-prahari-border text-xs text-prahari-muted hover:bg-prahari-border transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Risk Score Banner */}
      {riskZones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 rounded-2xl border flex-shrink-0"
          style={{ background: riskMeta.bg, borderColor: riskMeta.color + '40' }}
        >
          <div className="text-center">
            <div className="text-4xl font-black" style={{ color: riskMeta.color }}>{totalRiskScore}</div>
            <div className="text-[10px] font-semibold text-prahari-muted">/ 100</div>
          </div>
          <div className="w-px h-12 bg-prahari-border" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold" style={{ color: riskMeta.color }}>{riskMeta.label}</span>
              <Shield size={14} style={{ color: riskMeta.color }} />
            </div>
            <p className="text-xs text-prahari-muted">
              Average across {riskZones.length} road segments ·{' '}
              {riskZones.filter(z => z.level === 'CRITICAL').length} critical,{' '}
              {riskZones.filter(z => z.level === 'HIGH').length} high risk zones
            </p>
            {/* Score bar */}
            <div className="mt-2 bg-slate-100 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${totalRiskScore}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${riskMeta.bar}`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] flex-shrink-0">
            <div><span className="text-prahari-muted">Defects: </span><span className="font-bold text-prahari-text">{stats.total}</span></div>
            <div><span className="text-prahari-muted">Critical: </span><span className="font-bold text-red-600">{stats.critical}</span></div>
            <div><span className="text-prahari-muted">Pending: </span><span className="font-bold text-amber-600">{stats.pending}</span></div>
            <div><span className="text-prahari-muted">Resolved: </span><span className="font-bold text-green-600">{stats.resolved}</span></div>
          </div>
        </motion.div>
      )}

      {/* Main layout: Map + Risk List + Details */}
      <div className="flex flex-1 gap-4 min-h-0">

        {/* Map */}
        <div className="flex-1 prahari-map-container">
          <PrahariMap
            defects={filteredDefects}
            riskZones={riskZones}
            userLocation={userPos}
            className="w-full h-full"
          />

          {/* Defect legend */}
          <div className="absolute bottom-4 left-4 glass-panel rounded-xl p-3" style={{ zIndex: 10 }}>
            <p className="text-[10px] font-semibold text-prahari-muted mb-2 uppercase tracking-wide">Defect Severity</p>
            {Object.entries(SEV_CLR).map(([sev, color]) => (
              <div key={sev} className="flex items-center gap-2 mb-1 last:mb-0">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-prahari-muted">{sev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex flex-col gap-3 flex-shrink-0">

          {/* Severity filter */}
          <div className="prahari-card p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Construction size={14} className="text-prahari-sky" />
              <h3 className="text-xs font-bold text-prahari-text uppercase tracking-wide">Filter Defects</h3>
            </div>
            <div className="flex gap-1 flex-wrap">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                    filterSeverity === sev ? 'bg-prahari-indigo text-white border-prahari-indigo' : 'bg-prahari-bg text-prahari-muted border-prahari-border hover:border-prahari-indigo'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-prahari-muted mt-2">{filteredDefects.length} defects shown</p>
          </div>

          {/* Top risk zones */}
          <div className="prahari-card p-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-red-500" />
              <h3 className="text-xs font-bold text-prahari-text uppercase tracking-wide">Top Risk Zones</h3>
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-prahari-muted" /></div>
            ) : (
              <div className="space-y-2">
                {riskZones.slice(0, 5).map((zone, i) => {
                  const meta = RISK_META[zone.level] ?? RISK_META.LOW
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl border transition-colors ${
                        selectedZone === zone ? 'border-prahari-indigo bg-indigo-50' : 'border-prahari-border bg-prahari-bg hover:border-prahari-indigo/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-prahari-muted">Zone {i + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black" style={{ color: meta.color }}>{zone.score}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ color: meta.color, background: meta.bg }}>
                            {zone.level}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-100 rounded-full h-1.5">
                        <div className="h-full rounded-full" style={{ width: `${zone.score}%`, background: meta.color }} />
                      </div>
                      <p className="text-[10px] text-prahari-muted mt-1">
                        {zone.defect_count} defects · {zone.incident_count} incidents
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected zone detail */}
          {selectedZone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="prahari-card p-3 flex-shrink-0"
            >
              <div className="flex items-center gap-2 mb-3">
                <Info size={14} className="text-prahari-indigo" />
                <h3 className="text-xs font-bold text-prahari-text uppercase tracking-wide">Risk Explanation</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-prahari-muted">Risk Score</span>
                  <span className="text-sm font-black" style={{ color: RISK_META[selectedZone.level]?.color }}>
                    {selectedZone.score}/100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-prahari-muted">Classification</span>
                  <span className="text-xs font-bold" style={{ color: RISK_META[selectedZone.level]?.color }}>
                    {selectedZone.level}
                  </span>
                </div>
                <div className="pt-2 border-t border-prahari-border">
                  <p className="text-[10px] font-semibold text-prahari-muted mb-2 uppercase tracking-wide">Why this score?</p>
                  {selectedZone.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1" />
                      <span className="text-[11px] text-prahari-text">{f}</span>
                    </div>
                  ))}
                </div>
                {selectedZone.defect_types.length > 0 && (
                  <div className="pt-2 border-t border-prahari-border">
                    <p className="text-[10px] font-semibold text-prahari-muted mb-1.5 uppercase tracking-wide">Defect Types</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedZone.defect_types.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-lg bg-prahari-bg border border-prahari-border text-prahari-muted">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Analytics summary */}
          {analytics && (
            <div className="prahari-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 size={14} className="text-prahari-purple" />
                <h3 className="text-xs font-bold text-prahari-text uppercase tracking-wide">Analytics</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(analytics.defects_by_type).slice(0, 4).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-[11px] text-prahari-muted flex-1 truncate">{type}</span>
                    <div className="w-16 bg-slate-100 rounded-full h-1.5">
                      <div
                        className="h-full rounded-full bg-prahari-indigo"
                        style={{ width: `${Math.min((count as number) / Math.max(...Object.values(analytics.defects_by_type) as number[]) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-prahari-text w-4 text-right">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
