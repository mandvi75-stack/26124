import { create } from 'zustand'
import { Bus, Incident, Notification, MetricsSummary, RoadDefect, TrafficZone, SystemService } from '../types'

export type UserRole = 'admin' | 'operator' | 'viewer'

interface PrahariState {
  // Auth
  token: string | null
  user: { username: string; role: UserRole } | null

  // Fleet
  buses: Bus[]
  selectedBusId: string | null

  // Incidents
  incidents: Incident[]
  selectedIncidentId: string | null

  // Notifications
  notifications: Notification[]
  unreadCount: number

  // Metrics
  metrics: MetricsSummary | null

  // Road
  defects: RoadDefect[]

  // Traffic
  trafficZones: TrafficZone[]

  // System
  systemServices: SystemService[]
  wsConnected: boolean

  // Simulation
  simulationActive: boolean
  locationGranted: boolean

  // UI
  sidebarCollapsed: boolean
  activePage: string

  // Actions
  setToken: (token: string | null) => void
  setUser: (user: { username: string; role: UserRole } | null) => void
  logout: () => void
  updateBus: (bus: Bus) => void
  setBuses: (buses: Bus[]) => void
  setSelectedBus: (id: string | null) => void
  addIncident: (incident: Incident) => void
  setIncidents: (incidents: Incident[]) => void
  updateIncident: (incident: Incident) => void
  setSelectedIncident: (id: string | null) => void
  addNotification: (notification: Notification) => void
  setNotifications: (notifications: Notification[]) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  setMetrics: (metrics: MetricsSummary) => void
  setDefects: (defects: RoadDefect[]) => void
  setTrafficZones: (zones: TrafficZone[]) => void
  setSystemServices: (services: SystemService[]) => void
  setWsConnected: (connected: boolean) => void
  setSimulationActive: (active: boolean) => void
  setLocationGranted: (granted: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setActivePage: (page: string) => void
}

function loadUser(): { username: string; role: UserRole } | null {
  try {
    const raw = localStorage.getItem('prahari_user')
    if (raw) return JSON.parse(raw)
  } catch {/* ignore */}
  return null
}

export const usePrahariStore = create<PrahariState>((set) => ({
  token: localStorage.getItem('prahari_token'),
  user: loadUser(),
  buses: [],
  selectedBusId: null,
  incidents: [],
  selectedIncidentId: null,
  notifications: [],
  unreadCount: 0,
  metrics: null,
  defects: [],
  trafficZones: [],
  systemServices: [],
  wsConnected: false,
  simulationActive: false,
  locationGranted: false,
  sidebarCollapsed: false,
  activePage: 'command-center',

  setToken: (token) => {
    if (token) localStorage.setItem('prahari_token', token)
    else localStorage.removeItem('prahari_token')
    set({ token })
  },

  setUser: (user) => {
    if (user) localStorage.setItem('prahari_user', JSON.stringify(user))
    else localStorage.removeItem('prahari_user')
    set({ user })
  },

  logout: () => {
    localStorage.removeItem('prahari_token')
    localStorage.removeItem('prahari_user')
    set({
      token: null, user: null, buses: [], incidents: [],
      notifications: [], unreadCount: 0, metrics: null,
      defects: [], trafficZones: [], systemServices: [],
      wsConnected: false, simulationActive: false, locationGranted: false,
    })
  },

  updateBus: (bus) => set((state) => ({
    buses: state.buses.some(b => b.id === bus.id)
      ? state.buses.map(b => b.id === bus.id ? { ...b, ...bus } : b)
      : [...state.buses, bus],
  })),

  setBuses: (buses) => set({ buses }),
  setSelectedBus: (id) => set({ selectedBusId: id }),

  addIncident: (incident) => set((state) => ({
    incidents: [incident, ...state.incidents.filter(i => i.id !== incident.id).slice(0, 499)],
  })),
  setIncidents: (incidents) => set({ incidents }),
  updateIncident: (incident) => set((state) => ({
    incidents: state.incidents.map(i => i.id === incident.id ? { ...i, ...incident } : i),
  })),
  setSelectedIncident: (id) => set({ selectedIncidentId: id }),

  addNotification: (notification) => set((state) => {
    if (state.notifications.find(n => n.id === notification.id)) return {}
    return {
      notifications: [notification, ...state.notifications.slice(0, 99)],
      unreadCount: state.unreadCount + 1,
    }
  }),
  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  }),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),
  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  setMetrics: (metrics) => set({ metrics }),
  setDefects: (defects) => set({ defects }),
  setTrafficZones: (zones) => set({ trafficZones: zones }),
  setSystemServices: (services) => set({ systemServices: services }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setSimulationActive: (active) => set({ simulationActive: active }),
  setLocationGranted: (granted) => set({ locationGranted: granted }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setActivePage: (page) => set({ activePage: page }),
}))
