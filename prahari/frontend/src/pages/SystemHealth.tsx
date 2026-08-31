import { useEffect } from 'react'
import { Activity, Wifi, Database, Server, Cpu, Camera, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePrahariStore } from '@/store'
import { systemAPI } from '@/services/api'
import { SystemService } from '@/types'
import { Progress } from '@/components/ui/progress'

const SERVICE_ICONS: Record<string, React.ElementType> = {
  Frontend: Zap,
  Backend: Server,
  Database: Database,
  'AI Engine': Cpu,
  WebSocket: Wifi,
  'GPS Engine': Activity,
  'Camera Engine': Camera,
}

function ServiceCard({ service }: { service: SystemService }) {
  const Icon = SERVICE_ICONS[service.name] ?? Activity
  const isHealthy = service.status === 'HEALTHY'
  const isDegraded = service.status === 'DEGRADED'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-lg p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isHealthy ? 'bg-green-500/20' : isDegraded ? 'bg-amber-500/20' : 'bg-red-500/20'
          }`}>
            <Icon size={16} className={isHealthy ? 'text-green-400' : isDegraded ? 'text-amber-400' : 'text-red-400'} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{service.name}</div>
            <div className="text-[10px] text-prahari-muted">{service.details}</div>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-bold ${
          isHealthy ? 'text-green-400' : isDegraded ? 'text-amber-400' : 'text-red-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            isHealthy ? 'bg-green-400 status-blink' : isDegraded ? 'bg-amber-400 status-blink' : 'bg-red-400'
          }`} />
          {service.status}
        </div>
      </div>

      <div className="space-y-1.5">
        {service.latency_ms !== undefined && (
          <div className="flex justify-between text-xs">
            <span className="text-prahari-muted">Latency</span>
            <span className={`font-mono font-bold ${service.latency_ms < 100 ? 'text-green-400' : service.latency_ms < 500 ? 'text-amber-400' : 'text-red-400'}`}>
              {service.latency_ms} ms
            </span>
          </div>
        )}
        {service.uptime_pct !== undefined && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-prahari-muted">Uptime</span>
              <span className="font-mono font-bold text-foreground">{service.uptime_pct?.toFixed(2)}%</span>
            </div>
            <Progress value={service.uptime_pct} className={`h-1 ${
              service.uptime_pct >= 99 ? '[&>div]:bg-green-400' :
              service.uptime_pct >= 95 ? '[&>div]:bg-amber-400' : '[&>div]:bg-red-400'
            }`} />
          </div>
        )}
        <div className="flex justify-between text-[10px]">
          <span className="text-prahari-muted">Last Check</span>
          <span className="text-prahari-muted/70">{new Date(service.last_check).toLocaleTimeString()}</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function SystemHealth() {
  const { systemServices, setSystemServices, wsConnected } = usePrahariStore()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await systemAPI.getHealth()
        setSystemServices(res.data.services ?? [])
      } catch (_) {}
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const healthy = systemServices.filter(s => s.status === 'HEALTHY').length
  const degraded = systemServices.filter(s => s.status === 'DEGRADED').length
  const down = systemServices.filter(s => s.status === 'DOWN').length
  const overallHealth = systemServices.length > 0 
    ? Math.round((healthy / systemServices.length) * 100)
    : 0

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">System Health</h1>
          <p className="text-xs text-prahari-muted">Platform status and service monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Wifi size={13} className={wsConnected ? 'text-green-400' : 'text-red-400'} />
            <span className={`text-xs font-medium ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
              WebSocket {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Overall health bar */}
      <div className="glass-panel rounded-lg p-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-prahari-muted uppercase tracking-wider">Overall Platform Health</span>
          <span className={`text-2xl font-bold font-mono ${
            overallHealth >= 90 ? 'text-green-400' : overallHealth >= 70 ? 'text-amber-400' : 'text-red-400'
          }`}>{overallHealth}%</span>
        </div>
        <Progress value={overallHealth} className={`h-2 ${
          overallHealth >= 90 ? '[&>div]:bg-green-400' :
          overallHealth >= 70 ? '[&>div]:bg-amber-400' : '[&>div]:bg-red-400'
        }`} />
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="text-green-400">{healthy} Healthy</span>
          <span className="text-amber-400">{degraded} Degraded</span>
          <span className="text-red-400">{down} Down</span>
        </div>
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-auto pb-2">
        {systemServices.map(service => (
          <ServiceCard key={service.name} service={service} />
        ))}
        {systemServices.length === 0 && (
          <div className="col-span-full text-center py-16 text-prahari-muted text-xs">
            Loading system health data...
          </div>
        )}
      </div>
    </div>
  )
}
