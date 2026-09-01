import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, Clock, Bus, Camera, MapPin, CheckCircle, Filter, Search, Loader2 } from 'lucide-react'
import { usePrahariStore, UserRole } from '@/store'
import { incidentsAPI } from '@/services/api'
import { Incident } from '@/types'

const SEV_COLORS: Record<string, { bg: string; text: string; bar: string; border: string }> = {
  CRITICAL: { bg: '#fef2f2', text: '#dc2626', bar: 'bg-red-500',    border: '#fca5a5' },
  HIGH:     { bg: '#fff7ed', text: '#ea580c', bar: 'bg-orange-500', border: '#fdba74' },
  MEDIUM:   { bg: '#fefce8', text: '#ca8a04', bar: 'bg-amber-500',  border: '#fde047' },
  LOW:      { bg: '#f0fdf4', text: '#16a34a', bar: 'bg-green-500',  border: '#86efac' },
}

const STATUS_CLASSES: Record<string, string> = {
  DETECTED:   'bg-red-50 text-red-600 border-red-200',
  ANALYZING:  'bg-amber-50 text-amber-600 border-amber-200',
  CONFIRMED:  'bg-orange-50 text-orange-600 border-orange-200',
  ASSIGNED:   'bg-blue-50 text-blue-600 border-blue-200',
  RESPONDING: 'bg-purple-50 text-purple-600 border-purple-200',
  RESOLVED:   'bg-green-50 text-green-600 border-green-200',
  CLOSED:     'bg-slate-50 text-slate-500 border-slate-200',
}

function timeAgo(ts: string | undefined): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Incidents() {
  const { incidents, updateIncident, user } = usePrahariStore()
  const [selected, setSelected] = useState<Incident | null>(null)
  const [filterSev, setFilterSev] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const role = (user?.role ?? 'viewer') as UserRole
  const canEdit = role === 'admin' || role === 'operator'

  const filtered = useMemo(() => incidents.filter(i => {
    if (filterSev !== 'ALL' && i.severity !== filterSev) return false
    if (filterStatus !== 'ALL' && i.status !== filterStatus) return false
    if (search && !i.type.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [incidents, filterSev, filterStatus, search])

  const stats = {
    total:    incidents.length,
    active:   incidents.filter(i => !['RESOLVED', 'CLOSED'].includes(i.status)).length,
    critical: incidents.filter(i => i.severity === 'CRITICAL' && !['RESOLVED', 'CLOSED'].includes(i.status)).length,
    resolved: incidents.filter(i => i.status === 'RESOLVED').length,
  }

  const doAction = async (action: 'acknowledge' | 'resolve', inc: Incident) => {
    setActionLoading(true)
    try {
      let updated: Incident
      if (action === 'acknowledge') {
        const res = await incidentsAPI.acknowledgeIncident(inc.id)
        updated = res.data
      } else {
        const res = await incidentsAPI.resolveIncident(inc.id, 'Resolved via dashboard')
        updated = res.data
      }
      updateIncident(updated)
      setSelected(updated)
    } catch { /* ignore */ } finally { setActionLoading(false) }
  }

  return (
    <div className="flex flex-col h-full gap-3 page-enter">

      {/* Header + stats */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-prahari-text">Incidents</h1>
          <p className="text-xs text-prahari-muted">AI-detected road safety events · real-time & historical</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="text-center"><div className="text-xl font-black text-prahari-text">{stats.total}</div><div className="text-prahari-muted">Total</div></div>
          <div className="text-center"><div className="text-xl font-black text-amber-600">{stats.active}</div><div className="text-prahari-muted">Active</div></div>
          <div className="text-center"><div className="text-xl font-black text-red-600">{stats.critical}</div><div className="text-prahari-muted">Critical</div></div>
          <div className="text-center"><div className="text-xl font-black text-green-600">{stats.resolved}</div><div className="text-prahari-muted">Resolved</div></div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-prahari-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search incidents…"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-prahari-border text-xs bg-white focus:outline-none focus:border-prahari-indigo"
          />
        </div>
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
          <button
            key={sev}
            onClick={() => setFilterSev(sev)}
            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
              filterSev === sev ? 'bg-prahari-indigo text-white border-prahari-indigo' : 'bg-prahari-bg text-prahari-muted border-prahari-border hover:border-prahari-indigo/40'
            }`}
          >
            {sev}
          </button>
        ))}
        <div className="w-px h-5 bg-prahari-border" />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-8 px-2 rounded-xl border border-prahari-border text-xs bg-white text-prahari-text"
        >
          {['ALL', 'DETECTED', 'ANALYZING', 'CONFIRMED', 'ASSIGNED', 'RESOLVED'].map(s => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Status' : s}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-prahari-muted">{filtered.length} incidents</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-3 min-h-0">

        {/* Incident list */}
        <div className="flex-1 prahari-card overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-prahari-border flex-shrink-0 bg-prahari-bg">
            <AlertTriangle size={13} className="text-amber-500" />
            <span className="text-xs font-bold text-prahari-text uppercase tracking-wide">Incidents</span>
            <span className="text-[10px] px-2 py-1 rounded-lg font-semibold data-historical ml-auto">HISTORICAL + SIMULATION</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-prahari-muted">
                <Filter size={20} className="mb-2 opacity-40" />
                <p className="text-xs">No incidents match the filter</p>
              </div>
            ) : (
              filtered.map(inc => {
                const sevStyle = SEV_COLORS[inc.severity] ?? SEV_COLORS.MEDIUM
                const isSelected = selected?.id === inc.id
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelected(isSelected ? null : inc)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-prahari-border cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50/60' : 'hover:bg-prahari-bg'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: sevStyle.text }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-prahari-text truncate">{inc.type}</span>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: sevStyle.bg, color: sevStyle.text, border: `1px solid ${sevStyle.border}` }}
                        >
                          {inc.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-prahari-muted line-clamp-1">{inc.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_CLASSES[inc.status] ?? 'bg-slate-50 text-slate-500'}`}>
                          {inc.status}
                        </span>
                        <span className="text-[10px] text-prahari-muted">{inc.bus_number}</span>
                        <span className="text-[10px] text-prahari-muted ml-auto">{timeAgo(inc.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-80 prahari-card flex flex-col flex-shrink-0"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-prahari-border flex-shrink-0">
                <span className="text-xs font-bold text-prahari-text">Incident Detail</span>
                <button onClick={() => setSelected(null)} className="text-prahari-muted hover:text-prahari-text">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Type + severity */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-prahari-text">{selected.type}</h3>
                      {selected.bus_number && (
                        <p className="text-xs text-prahari-muted">Bus: {selected.bus_number}</p>
                      )}
                    </div>
                    {(() => {
                      const s = SEV_COLORS[selected.severity] ?? SEV_COLORS.MEDIUM
                      return (
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                          {selected.severity}
                        </span>
                      )
                    })()}
                  </div>
                  <p className="text-xs text-prahari-muted">{selected.description}</p>
                </div>

                {/* Metadata */}
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Status', value: selected.status, cls: STATUS_CLASSES[selected.status] },
                    { label: 'Confidence', value: `${Math.round(selected.confidence * 100)}%` },
                    { label: 'Camera', value: selected.camera_id },
                    { label: 'Reported', value: timeAgo(selected.timestamp) },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-prahari-muted">{label}</span>
                      {cls ? (
                        <span className={`font-bold px-1.5 py-0.5 rounded border text-[10px] ${cls}`}>{value}</span>
                      ) : (
                        <span className="font-medium text-prahari-text">{value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Location */}
                {selected.lat && selected.lng && (
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin size={13} className="text-prahari-muted flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-prahari-text font-medium">{selected.address ?? 'Unknown location'}</div>
                      <div className="text-prahari-muted font-mono">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</div>
                    </div>
                  </div>
                )}

                {/* AI reasoning */}
                {selected.ai_reasoning && (
                  <div className="bg-prahari-bg rounded-xl p-3 text-xs text-prahari-muted leading-relaxed">
                    <p className="font-semibold text-prahari-text mb-1">AI Analysis</p>
                    {selected.ai_reasoning}
                  </div>
                )}

                {/* Contributing factors */}
                {(selected.contributing_factors?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-prahari-muted uppercase tracking-wide mb-2">Contributing Factors</p>
                    {(selected.contributing_factors ?? []).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1" />
                        <span className="text-xs text-prahari-text">{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Number plate */}
                {(selected.vehicle_class || selected.number_plate) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-amber-600 mb-1">OFFENDING VEHICLE</p>
                    {selected.vehicle_class && <p className="text-xs font-medium text-amber-800">{selected.vehicle_class}</p>}
                    {selected.number_plate && <p className="text-sm font-bold text-amber-800 font-mono">{selected.number_plate}</p>}
                    {selected.ocr_confidence && (
                      <p className="text-[10px] text-amber-600">OCR confidence: {Math.round(selected.ocr_confidence * 100)}%</p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="p-3 border-t border-prahari-border flex gap-2 flex-shrink-0">
                  {!['RESOLVED', 'CLOSED', 'ANALYZING'].includes(selected.status) && (
                    <button
                      onClick={() => doAction('acknowledge', selected)}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {actionLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                      Acknowledge
                    </button>
                  )}
                  {!['RESOLVED', 'CLOSED'].includes(selected.status) && (
                    <button
                      onClick={() => doAction('resolve', selected)}
                      disabled={actionLoading}
                      className="flex-1 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      {actionLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                      <CheckCircle size={12} /> Resolve
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
