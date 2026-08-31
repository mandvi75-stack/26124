import { useState, useEffect } from 'react'
import { Building2, Wrench, CheckCircle, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { infraAPI } from '@/services/api'
import { InfrastructureItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { severityBg, defectStatusColor, timeAgo } from '@/lib/utils'

const INFRA_TYPES = ['Road Sign', 'Road Divider', 'Zebra Crossing', 'Drainage', 'Street Light', 'Bus Stop', 'Traffic Signal']

export default function Infrastructure() {
  const [items, setItems] = useState<InfrastructureItem[]>([])
  const [filterType, setFilterType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [selected, setSelected] = useState<InfrastructureItem | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await infraAPI.getItems()
        setItems(res.data)
      } catch (_) {}
    }
    load()
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [])

  const filtered = items.filter(i => {
    if (filterType !== 'ALL' && i.type !== filterType) return false
    if (filterStatus !== 'ALL' && i.status !== filterStatus) return false
    return true
  })

  const stats = {
    total: items.length,
    critical: items.filter(i => i.severity === 'CRITICAL').length,
    pending: items.filter(i => ['DETECTED', 'VERIFIED', 'ASSIGNED'].includes(i.status)).length,
    resolved: items.filter(i => i.status === 'RESOLVED').length,
  }

  const handleStatusUpdate = async (item: InfrastructureItem, status: string) => {
    try {
      await infraAPI.updateStatus(item.id, status)
      setItems(items.map(i => i.id === item.id ? { ...i, status: status as InfrastructureItem['status'] } : i))
      if (selected?.id === item.id) setSelected({ ...selected, status: status as InfrastructureItem['status'] })
    } catch (_) {}
  }

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Infrastructure</h1>
          <p className="text-xs text-prahari-muted">Track and manage urban infrastructure deficiencies</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-foreground">{stats.total} Total</span>
          <span className="text-red-400">{stats.critical} Critical</span>
          <span className="text-amber-400">{stats.pending} Pending</span>
          <span className="text-green-400">{stats.resolved} Resolved</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 shrink-0">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {INFRA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="DETECTED">Detected</SelectItem>
            <SelectItem value="VERIFIED">Verified</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-prahari-muted">{filtered.length} items</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Item list */}
        <ScrollArea className="flex-1 glass-panel rounded-lg">
          <div className="divide-y divide-prahari-border/50">
            {filtered.map(item => (
              <motion.div
                key={item.id}
                layout
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                  selected?.id === item.id ? 'bg-prahari-cyan/5' : 'hover:bg-prahari-surface/50'
                }`}
              >
                <div className={`w-2 h-6 rounded-full shrink-0 ${
                  item.severity === 'CRITICAL' ? 'bg-red-500' :
                  item.severity === 'HIGH' ? 'bg-orange-500' :
                  item.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{item.type}</span>
                    <span className={`text-[9px] font-bold border px-1 py-0.5 rounded ${severityBg(item.severity)}`}>{item.severity}</span>
                  </div>
                  <p className="text-[10px] text-prahari-muted truncate">{item.description}</p>
                  <span className="text-[9px] text-prahari-muted/70">{timeAgo(item.first_detected)}</span>
                </div>

                <span className={`text-[9px] font-semibold whitespace-nowrap ${defectStatusColor(item.status)}`}>
                  {item.status.replace('_', ' ')}
                </span>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-xs text-prahari-muted">No infrastructure items found</div>
            )}
          </div>
        </ScrollArea>

        {/* Detail */}
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-72 shrink-0 glass-panel rounded-lg p-4 flex flex-col gap-3"
          >
            <div>
              <h3 className="font-bold text-foreground mb-1">{selected.type}</h3>
              <p className="text-xs text-prahari-muted">{selected.description}</p>
            </div>

            <div className="space-y-1.5">
              {[
                ['Severity', selected.severity],
                ['Status', selected.status.replace('_', ' ')],
                ['First Detected', timeAgo(selected.first_detected)],
                ['Last Verified', timeAgo(selected.last_verified)],
                ['Location', `${selected.lat.toFixed(4)}°N, ${selected.lng.toFixed(4)}°E`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[10px] text-prahari-muted">{label}</span>
                  <span className="text-[10px] text-foreground font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-prahari-border">
              {selected.status === 'DETECTED' && (
                <Button size="sm" variant="warning" onClick={() => handleStatusUpdate(selected, 'VERIFIED')} className="flex-1">Verify</Button>
              )}
              {selected.status === 'VERIFIED' && (
                <Button size="sm" variant="default" onClick={() => handleStatusUpdate(selected, 'ASSIGNED')} className="flex-1">Assign</Button>
              )}
              {selected.status === 'ASSIGNED' && (
                <Button size="sm" variant="warning" onClick={() => handleStatusUpdate(selected, 'UNDER_MAINTENANCE')} className="flex-1">Start Work</Button>
              )}
              {selected.status === 'UNDER_MAINTENANCE' && (
                <Button size="sm" variant="success" onClick={() => handleStatusUpdate(selected, 'RESOLVED')} className="flex-1">Resolve</Button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
