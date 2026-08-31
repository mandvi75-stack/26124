import { useState, useEffect } from 'react'
import { BarChart3 } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { analyticsAPI } from '@/services/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ChartPanelProps {
  title: string
  children: React.ReactNode
  className?: string
}
function ChartPanel({ title, children, className = '' }: ChartPanelProps) {
  return (
    <div className={`glass-panel rounded-lg p-3 ${className}`}>
      <h3 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

const TOOLTIP_STYLE = { background: '#131d35', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 11 }

export default function Analytics() {
  const [period, setPeriod] = useState('7d')
  const [incidentData, setIncidentData] = useState<unknown[]>([])
  const [trafficData, setTrafficData] = useState<unknown[]>([])
  const [fleetData, setFleetData] = useState<unknown[]>([])
  const [routeData, setRouteData] = useState<unknown[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [inc, traf, flt, rte] = await Promise.allSettled([
          analyticsAPI.getIncidentStats(period),
          analyticsAPI.getTrafficStats(period),
          analyticsAPI.getFleetStats(period),
          analyticsAPI.getRouteStats(),
        ])
        if (inc.status === 'fulfilled') setIncidentData(inc.value.data)
        if (traf.status === 'fulfilled') setTrafficData(traf.value.data)
        if (flt.status === 'fulfilled') setFleetData(flt.value.data)
        if (rte.status === 'fulfilled') setRouteData(rte.value.data)
      } catch (_) {}
    }
    load()
  }, [period])

  const incidentTypes = Array.isArray(incidentData) && (incidentData as Record<string, unknown>[]).every(d => d.type)
    ? incidentData as { type: string; count: number }[]
    : []

  const trafficTrend = Array.isArray(trafficData) ? trafficData as { date: string; vehicles: number; avg_speed: number }[] : []
  const fleetActivity = Array.isArray(fleetData) ? fleetData as { date: string; active: number; incidents: number }[] : []
  const routeDelays = Array.isArray(routeData) ? routeData as { route: string; avg_delay: number; max_delay: number }[] : []

  const COLORS = ['#00d4ff', '#f97316', '#ff3b3b', '#ffb020', '#00c97a', '#a78bfa', '#3b82f6']

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Analytics</h1>
          <p className="text-xs text-prahari-muted">Data-driven insights from the PRAHARI platform</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-3 pb-3">
        {/* Incidents by type - pie */}
        <ChartPanel title="Incidents by Type">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={incidentTypes}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ type, percent }) => {
                  if (typeof percent !== 'number' || percent < 0.08) return ''
                  return type.length > 12 ? `${type.slice(0, 12)}...` : type
                }}
                labelLine={false}
                stroke="#0b1220"
                strokeWidth={1}
              >
                {incidentTypes.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  ...TOOLTIP_STYLE,
                  backgroundColor: '#0b1220',
                  borderColor: '#7dd3fc',
                  color: '#f8fafc',
                  boxShadow: '0 10px 20px rgba(15, 23, 42, 0.35)',
                }}
                labelStyle={{ color: '#f8fafc' }}
                itemStyle={{ color: '#f8fafc' }}
                formatter={(value: number, name: string) => [`${value}`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Route delays bar */}
        <ChartPanel title="Route Delays (min)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={routeDelays} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis type="number" tick={{ fill: '#8b9ab5', fontSize: 9 }} />
              <YAxis dataKey="route" type="category" tick={{ fill: '#8b9ab5', fontSize: 9 }} width={60} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="avg_delay" fill="#ffb020" name="Avg Delay" radius={[0, 2, 2, 0]} />
              <Bar dataKey="max_delay" fill="#ff3b3b" name="Max Delay" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Traffic trend */}
        <ChartPanel title="Traffic Volume Trend">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trafficTrend}>
              <defs>
                <linearGradient id="tvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="date" tick={{ fill: '#8b9ab5', fontSize: 9 }} />
              <YAxis tick={{ fill: '#8b9ab5', fontSize: 9 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="vehicles" stroke="#00d4ff" fill="url(#tvGrad)" strokeWidth={1.5} name="Vehicles" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Fleet activity */}
        <ChartPanel title="Fleet Activity">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fleetActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="date" tick={{ fill: '#8b9ab5', fontSize: 9 }} />
              <YAxis tick={{ fill: '#8b9ab5', fontSize: 9 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#8b9ab5' }} />
              <Bar dataKey="active" fill="#00c97a" name="Active Buses" radius={[2, 2, 0, 0]} />
              <Bar dataKey="incidents" fill="#ff3b3b" name="Incidents" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  )
}
