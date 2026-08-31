import { useState, useEffect, useMemo } from 'react'
import { Clock, Bus, TrendingUp, MapPin, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { fleetAPI } from '@/services/api'
import { Route } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import PrahariMap from '@/components/map/PrahariMap'
import { usePrahariStore } from '@/store'

export default function Routes() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const { buses } = usePrahariStore()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fleetAPI.getRoutes()
        setRoutes(res.data)
        if (res.data.length > 0 && !selectedRoute) setSelectedRoute(res.data[0])
      } catch (_) {}
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const routeBuses = selectedRoute ? buses.filter(b => b.route_id === selectedRoute.id) : []
  const alternativeRoute = useMemo(() => {
    if (!selectedRoute || selectedRoute.current_delay <= 0) return null
    return routes
      .filter(route => route.id !== selectedRoute.id)
      .sort((a, b) => {
        if (a.current_delay !== b.current_delay) return a.current_delay - b.current_delay
        return a.total_distance - b.total_distance
      })[0] ?? null
  }, [routes, selectedRoute])

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="shrink-0">
        <h1 className="text-base font-bold text-foreground">Routes</h1>
        <p className="text-xs text-prahari-muted">Route intelligence and delay analysis</p>
      </div>

      <div className="flex flex-1 gap-3 min-h-0">
        {/* Route list */}
        <div className="w-72 shrink-0 flex flex-col gap-2">
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-1">
              {routes.map(route => {
                const delayColor = route.current_delay <= 0 ? 'text-green-400' : route.current_delay <= 5 ? 'text-amber-400' : 'text-red-400'
                return (
                  <motion.div
                    key={route.id}
                    layout
                    onClick={() => setSelectedRoute(route)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRoute?.id === route.id
                        ? 'border-prahari-cyan/40 bg-prahari-cyan/5'
                        : 'border-prahari-border bg-prahari-card hover:border-prahari-border/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: route.color }} />
                        <span className="text-xs font-bold text-foreground">{route.code}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bus size={11} className="text-prahari-muted" />
                        <span className="text-xs text-prahari-muted">{route.active_buses}</span>
                      </div>
                    </div>
                    <p className="text-xs text-foreground mb-0.5 truncate">{route.name}</p>
                    <div className="text-[10px] text-prahari-muted mb-2">
                      {route.start_stop} → {route.end_stop}
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-prahari-muted">Scheduled: {route.scheduled_duration}min</span>
                      <span className="text-prahari-muted">Actual: {route.actual_duration}min</span>
                    </div>
                    <div className={`text-xs font-bold mt-1 ${delayColor}`}>
                      {route.current_delay > 0 ? `+${route.current_delay} min delay` : route.current_delay < 0 ? `${route.current_delay} min early` : 'On time'}
                    </div>
                    <div className="mt-1.5">
                      <div className="flex justify-between text-[9px] text-prahari-muted mb-0.5">
                        <span>Avg Delay: {route.avg_delay}min</span>
                        <span>{route.total_distance} km</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              {routes.length === 0 && (
                <div className="text-xs text-prahari-muted text-center py-8">Loading routes...</div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Map */}
        <div className="flex-1 relative rounded-lg overflow-hidden border border-prahari-border">
          <PrahariMap
            buses={routeBuses}
            routeLines={selectedRoute ? [
              { id: selectedRoute.id, name: selectedRoute.name, color: selectedRoute.color, waypoints: selectedRoute.waypoints, delayed: true },
              ...(alternativeRoute ? [{ id: alternativeRoute.id, name: alternativeRoute.name, color: '#60a5fa', waypoints: alternativeRoute.waypoints, delayed: false }] : [])
            ] : []}
            className="w-full h-full"
          />

          {selectedRoute && (
            <div className="absolute top-3 right-3 glass-panel rounded-lg p-3 w-56 z-10">
              <h3 className="text-xs font-bold text-foreground mb-2">{selectedRoute.code} — {selectedRoute.name}</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-prahari-muted">Scheduled</span>
                  <span className="text-foreground">{selectedRoute.scheduled_duration} min</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-prahari-muted">Actual</span>
                  <span className="text-foreground">{selectedRoute.actual_duration} min</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-prahari-muted">Current Delay</span>
                  <span className={selectedRoute.current_delay > 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                    {selectedRoute.current_delay > 0 ? `+${selectedRoute.current_delay}` : selectedRoute.current_delay} min
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-prahari-muted">Active Buses</span>
                  <span className="text-prahari-cyan font-bold">{selectedRoute.active_buses}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-prahari-muted">Distance</span>
                  <span className="text-foreground">{selectedRoute.total_distance} km</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
