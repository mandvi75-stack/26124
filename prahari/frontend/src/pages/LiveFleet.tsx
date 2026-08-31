import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bus, Wifi, Camera, Cpu, Navigation, Filter, Search, X, ChevronRight, MapPin } from 'lucide-react'
import { usePrahariStore } from '@/store'
import { Bus as BusType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { busStatusBg, timeAgo, formatSpeed, formatLatLng } from '@/lib/utils'

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { ONLINE: 'bg-green-400', DEGRADED: 'bg-amber-400', OFFLINE: 'bg-red-400', ACTIVE: 'bg-green-400', IDLE: 'bg-blue-400', ERROR: 'bg-red-400' }
  return <div className={`w-1.5 h-1.5 rounded-full ${colors[status] ?? 'bg-gray-400'}`} />
}

function BusCard({ bus, onClick, selected }: { bus: BusType; onClick: () => void; selected: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-colors hover:border-prahari-cyan/40 ${
        selected
          ? 'bg-prahari-cyan/5 border-prahari-cyan/40'
          : 'bg-prahari-card border-prahari-border'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            bus.status === 'ONLINE' ? 'bg-green-500/20' : bus.status === 'DEGRADED' ? 'bg-amber-500/20' : 'bg-red-500/20'
          }`}>
            <Bus size={14} className={bus.status === 'ONLINE' ? 'text-green-400' : bus.status === 'DEGRADED' ? 'text-amber-400' : 'text-red-400'} />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{bus.bus_number}</div>
            <div className="text-[10px] text-prahari-muted">{bus.route_name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={bus.status.toLowerCase() as 'online' | 'degraded' | 'offline'}>{bus.status}</Badge>
          <ChevronRight size={12} className="text-prahari-muted" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center">
          <div className="text-xs font-mono font-bold text-foreground">{Math.round(bus.speed)}</div>
          <div className="text-[9px] text-prahari-muted">km/h</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-foreground">{bus.heading}</div>
          <div className="text-[9px] text-prahari-muted">Direction</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-foreground">{bus.trip_progress}%</div>
          <div className="text-[9px] text-prahari-muted">Progress</div>
        </div>
      </div>

      <Progress value={bus.trip_progress} className="mb-2" />

      <div className="flex items-center gap-3 text-[10px] text-prahari-muted">
        <div className="flex items-center gap-1">
          <Wifi size={10} className={bus.gps_status === 'ACTIVE' ? 'text-green-400' : 'text-amber-400'} />
          GPS
        </div>
        <div className="flex items-center gap-1">
          <Camera size={10} className={bus.camera_status === 'ACTIVE' ? 'text-green-400' : 'text-amber-400'} />
          CAM
        </div>
        <div className="flex items-center gap-1">
          <Cpu size={10} className={bus.ai_status === 'ACTIVE' || bus.ai_status === 'PROCESSING' ? 'text-green-400' : 'text-amber-400'} />
          AI
        </div>
        {bus.current_incident && (
          <span className="ml-auto text-red-400 font-medium truncate">⚠ {bus.current_incident}</span>
        )}
        {!bus.current_incident && (
          <span className="ml-auto">{timeAgo(bus.last_update)}</span>
        )}
      </div>
    </motion.div>
  )
}

function BusDetail({ bus, onClose }: { bus: BusType; onClose: () => void }) {
  const cameras = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'CABIN']

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 shrink-0 glass-panel rounded-lg overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-prahari-border">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Bus size={14} className="text-prahari-cyan" />
            <span className="font-bold text-foreground">{bus.bus_number}</span>
            <Badge variant={bus.status.toLowerCase() as 'online' | 'degraded' | 'offline'}>{bus.status}</Badge>
          </div>
          <p className="text-xs text-prahari-muted">{bus.route_name}</p>
        </div>
        <button onClick={onClose} className="text-prahari-muted hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* GPS */}
          <section>
            <h4 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-2">GPS & Position</h4>
            <div className="space-y-1.5">
              <InfoRow label="Coordinates" value={formatLatLng(bus.lat, bus.lng)} mono />
              <InfoRow label="Speed" value={formatSpeed(bus.speed)} />
              <InfoRow label="Direction" value={`${bus.heading} (${Math.round(bus.direction)}°)`} />
              <InfoRow label="GPS Status" value={bus.gps_status} status={bus.gps_status === 'ACTIVE'} />
            </div>
          </section>

          {/* Systems */}
          <section>
            <h4 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-2">Systems</h4>
            <div className="space-y-1.5">
              <InfoRow label="Camera System" value={bus.camera_status} status={bus.camera_status === 'ACTIVE'} />
              <InfoRow label="AI Engine" value={bus.ai_status} status={bus.ai_status === 'ACTIVE' || bus.ai_status === 'PROCESSING'} />
            </div>
          </section>

          {/* Cameras */}
          <section>
            <h4 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-2">Cameras</h4>
            <div className="grid grid-cols-5 gap-1">
              {cameras.map(cam => (
                <div key={cam} className="flex flex-col items-center gap-1 p-1.5 bg-prahari-surface rounded border border-prahari-border">
                  <Camera size={12} className={bus.camera_status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'} />
                  <span className="text-[8px] text-prahari-muted">{cam.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Trip */}
          <section>
            <h4 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-2">Trip</h4>
            <div className="space-y-1.5">
              <InfoRow label="Progress" value={`${bus.trip_progress}%`} />
              <Progress value={bus.trip_progress} />
              <InfoRow label="Last Update" value={timeAgo(bus.last_update)} />
              {bus.driver_name && <InfoRow label="Driver" value={bus.driver_name} />}
            </div>
          </section>

          {bus.current_incident && (
            <section>
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Active Incident</h4>
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                {bus.current_incident}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  )
}

function InfoRow({ label, value, mono, status }: { label: string; value: string; mono?: boolean; status?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-prahari-muted shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${mono ? 'font-mono text-[10px]' : ''} ${
        status === true ? 'text-green-400' : status === false ? 'text-red-400' : 'text-foreground'
      }`}>{value}</span>
    </div>
  )
}

export default function LiveFleet() {
  const { buses } = usePrahariStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterRoute, setFilterRoute] = useState('ALL')
  const [selectedBus, setSelectedBus] = useState<BusType | null>(null)

  const routes = useMemo(() => {
    const routeNames = [...new Set(buses.map(b => b.route_name))]
    return routeNames
  }, [buses])

  const filtered = useMemo(() => {
    return buses.filter(b => {
      if (searchQuery && !b.bus_number.toLowerCase().includes(searchQuery.toLowerCase()) && !b.route_name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filterStatus !== 'ALL' && b.status !== filterStatus) return false
      if (filterRoute !== 'ALL' && b.route_name !== filterRoute) return false
      return true
    })
  }, [buses, searchQuery, filterStatus, filterRoute])

  const stats = useMemo(() => ({
    online: buses.filter(b => b.status === 'ONLINE').length,
    degraded: buses.filter(b => b.status === 'DEGRADED').length,
    offline: buses.filter(b => b.status === 'OFFLINE').length,
  }), [buses])

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Live Fleet</h1>
          <p className="text-xs text-prahari-muted">Real-time bus monitoring and status</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-green-400">{stats.online} Online</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="text-amber-400">{stats.degraded} Degraded</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-red-400">{stats.offline} Offline</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-prahari-muted" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search buses..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
            <SelectItem value="DEGRADED">Degraded</SelectItem>
            <SelectItem value="OFFLINE">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRoute} onValueChange={setFilterRoute}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Routes</SelectItem>
            {routes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-prahari-muted ml-auto">{filtered.length} buses</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 gap-3 min-h-0">
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pr-2">
            {filtered.map(bus => (
              <BusCard
                key={bus.id}
                bus={bus}
                onClick={() => setSelectedBus(selectedBus?.id === bus.id ? null : bus)}
                selected={selectedBus?.id === bus.id}
              />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-prahari-muted text-sm">
                No buses match the current filters
              </div>
            )}
          </div>
        </ScrollArea>

        <AnimatePresence>
          {selectedBus && (
            <BusDetail bus={selectedBus} onClose={() => setSelectedBus(null)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
