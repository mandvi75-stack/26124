import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { usePrahariStore } from '@/store'
import {
  fleetAPI, incidentsAPI, notificationsAPI, systemAPI,
} from '@/services/api'

interface LayoutProps { children: React.ReactNode }

export default function Layout({ children }: LayoutProps) {
  const {
    token, setBuses, setIncidents, setNotifications,
    setMetrics, setSystemServices, setSimulationActive,
  } = usePrahariStore()

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAll = async () => {
    try {
      const [busRes, incRes, notifRes, healthRes, metricsRes] = await Promise.allSettled([
        fleetAPI.getBuses(),
        incidentsAPI.getIncidents({ limit: '100' }),
        notificationsAPI.getAll(),
        systemAPI.getHealth(),
        fleetAPI.getMetrics(),
      ])

      if (busRes.status === 'fulfilled') {
        const buses = busRes.value.data
        setBuses(buses)
        if (buses.length > 0) setSimulationActive(true)
      }
      if (incRes.status === 'fulfilled')    setIncidents(incRes.value.data)
      if (notifRes.status === 'fulfilled')  setNotifications(notifRes.value.data)
      if (healthRes.status === 'fulfilled') setSystemServices(healthRes.value.data.services ?? [])
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data)
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!token) return
    loadAll()
    pollRef.current = setInterval(loadAll, 10000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [token])

  return (
    <div className="flex h-screen bg-prahari-bg overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        <motion.main
          key="layout-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex-1 overflow-auto p-4"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
