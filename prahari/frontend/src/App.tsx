import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import CommandCenter from './pages/CommandCenter'
import LiveFleet from './pages/LiveFleet'
import AIVision from './pages/AIVision'
import Incidents from './pages/Incidents'
import RoadIntelligence from './pages/RoadIntelligence'
import TrafficIntelligence from './pages/TrafficIntelligence'
import Routes_ from './pages/Routes'
import Infrastructure from './pages/Infrastructure'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import SystemHealth from './pages/SystemHealth'
import Settings from './pages/Settings'
import { usePrahariStore, UserRole } from './store'
import { praharWS } from './services/websocket'
import { authAPI } from './services/api'
import { Bus, Incident, Notification, MetricsSummary } from './types'

function RoleGuard({ children, roles }: { children: React.ReactNode; roles: UserRole[] }) {
  const user = usePrahariStore(s => s.user)
  if (!user || !roles.includes(user.role)) return <Navigate to="/command-center" replace />
  return <>{children}</>
}

function AppRoutes() {
  const token = usePrahariStore(s => s.token)
  const user  = usePrahariStore(s => s.user)

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  const home = user?.role === 'operator' ? '/fleet' : '/command-center'

  return (
    <Layout>
      <Routes>
        <Route path="/"         element={<Navigate to={home} replace />} />
        <Route path="/login"    element={<Navigate to={home} replace />} />
        <Route path="/command-center"    element={<CommandCenter />} />
        <Route path="/fleet"             element={<RoleGuard roles={['admin','operator']}><LiveFleet /></RoleGuard>} />
        <Route path="/ai-vision"         element={<RoleGuard roles={['admin','operator']}><AIVision /></RoleGuard>} />
        <Route path="/incidents"         element={<Incidents />} />
        <Route path="/road-intelligence" element={<RoadIntelligence />} />
        <Route path="/traffic"           element={<TrafficIntelligence />} />
        <Route path="/routes"            element={<RoleGuard roles={['admin','operator']}><Routes_ /></RoleGuard>} />
        <Route path="/infrastructure"    element={<RoleGuard roles={['admin','operator']}><Infrastructure /></RoleGuard>} />
        <Route path="/analytics"         element={<Analytics />} />
        <Route path="/reports"           element={<Reports />} />
        <Route path="/system-health"     element={<RoleGuard roles={['admin']}><SystemHealth /></RoleGuard>} />
        <Route path="/settings"          element={<RoleGuard roles={['admin']}><Settings /></RoleGuard>} />
        <Route path="*"                  element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  const {
    token, setUser, setWsConnected, updateBus, addIncident,
    addNotification, setMetrics, setBuses, setSimulationActive, logout,
  } = usePrahariStore()
  const wsSetup = useRef(false)

  // Restore session after page refresh
  useEffect(() => {
    if (!token) return
    authAPI.me()
      .then(res => setUser({ username: res.data.username, role: res.data.role as UserRole }))
      .catch(() => { /* demo token — user already loaded from localStorage */ })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // WebSocket
  useEffect(() => {
    if (!token || wsSetup.current) return
    wsSetup.current = true

    praharWS.connect()

    const offs = [
      praharWS.on('connected', (data: unknown) => {
        setWsConnected(true)
        const d = data as { simulation_active?: boolean }
        if (d?.simulation_active) setSimulationActive(true)
      }),
      praharWS.on('disconnected', () => setWsConnected(false)),
      praharWS.on('bus_update',     (d) => updateBus(d as Bus)),
      praharWS.on('buses_snapshot', (d) => setBuses(d as Bus[])),
      praharWS.on('incident', (d) => {
        const inc = d as Incident
        addIncident(inc)
        addNotification({
          id: `notif-${inc.id}`,
          severity: inc.severity,
          title: inc.type,
          description: inc.description,
          location: inc.address,
          bus_id: inc.bus_id,
          timestamp: inc.timestamp,
          read: false,
          incident_id: inc.id,
        })
      }),
      praharWS.on('metrics',      (d) => setMetrics(d as MetricsSummary)),
      praharWS.on('notification', (d) => addNotification(d as Notification)),
    ]

    return () => {
      offs.forEach(off => off())
      praharWS.disconnect()
      wsSetup.current = false
    }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <AppRoutes />
      </AnimatePresence>
    </BrowserRouter>
  )
}
