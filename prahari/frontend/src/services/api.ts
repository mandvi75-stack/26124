import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Auth token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('prahari_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('prahari_token')
      if (token && !token.startsWith('demo.')) {
        localStorage.removeItem('prahari_token')
        localStorage.removeItem('prahari_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:  (username: string, password: string) => api.post('/auth/login', { username, password }),
  me:     () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}


// ── Fleet ─────────────────────────────────────────────────────────────────────
export const fleetAPI = {
  getBuses:         () => api.get('/fleet/buses'),
  getBus:           (id: string) => api.get(`/fleet/buses/${id}`),
  getMetrics:       () => api.get('/fleet/metrics'),
  getRoutes:        () => api.get('/fleet/routes'),
  getRoute:         (id: string) => api.get(`/fleet/routes/${id}`),
  getOperatingArea: () => api.get('/fleet/operating-area'),
  setOperatingArea: (data: { latitude: number; longitude: number; location_name?: string }) =>
    api.post('/fleet/operating-area', data),
}

// ── Incidents ─────────────────────────────────────────────────────────────────
export const incidentsAPI = {
  getIncidents:     (params?: Record<string, string>) => api.get('/incidents', { params }),
  getIncident:      (id: string) => api.get(`/incidents/${id}`),
  acknowledgeIncident: (id: string) => api.post(`/incidents/${id}/acknowledge`),
  assignIncident:   (id: string, assignee: string) => api.post(`/incidents/${id}/assign`, { assignee }),
  resolveIncident:  (id: string, notes?: string) => api.post(`/incidents/${id}/resolve`, { notes }),
  addNote:          (id: string, note: string) => api.post(`/incidents/${id}/notes`, { note }),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiAPI = {
  getDetections:  (busId?: string) => api.get('/ai/detections', { params: { bus_id: busId } }),
  getCameraFeeds: (busId: string)  => api.get(`/ai/cameras/${busId}`),
  getStats:       () => api.get('/ai/stats'),
  getNumberPlates:(params?: Record<string, string>) => api.get('/ai/plates', { params }),
}

// ── Road Intelligence ─────────────────────────────────────────────────────────
export const roadAPI = {
  getDefects:        () => api.get('/road/defects'),
  getDefect:         (id: string) => api.get(`/road/defects/${id}`),
  updateDefectStatus:(id: string, status: string) => api.put(`/road/defects/${id}/status`, { status }),
  getSegments:       () => api.get('/road/segments'),
  getRiskScores:     () => api.get('/road/risk-scores'),
  getAnalytics:      () => api.get('/road/analytics'),
}

// ── Traffic ───────────────────────────────────────────────────────────────────
export const trafficAPI = {
  getZones:       () => api.get('/traffic/zones'),
  getTrends:      (hours?: number) => api.get('/traffic/trends', { params: { hours: hours ?? 24 } }),
  getBottlenecks: () => api.get('/traffic/bottlenecks'),
}

// ── Infrastructure ────────────────────────────────────────────────────────────
export const infraAPI = {
  getItems:          () => api.get('/infrastructure'),
  getItem:           (id: string) => api.get(`/infrastructure/${id}`),
  updateStatus:      (id: string, status: string) => api.put(`/infrastructure/${id}/status`, { status }),
  createMaintenance: (id: string, data: Record<string, unknown>) => api.post(`/infrastructure/${id}/maintenance`, data),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getIncidentStats: (period?: string) => api.get('/analytics/incidents', { params: { period } }),
  getTrafficStats:  (period?: string) => api.get('/analytics/traffic',   { params: { period } }),
  getFleetStats:    (period?: string) => api.get('/analytics/fleet',     { params: { period } }),
  getRouteStats:    () => api.get('/analytics/routes'),
}

// ── System ────────────────────────────────────────────────────────────────────
export const systemAPI = {
  getHealth: () => api.get('/system/health'),
  getStats:  () => api.get('/system/stats'),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll:      () => api.get('/notifications'),
  markRead:    (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsAPI = {
  generate: (type: string, params: Record<string, unknown>) =>
    api.post('/reports/generate', { type, ...params }, { responseType: 'blob' }),
}

export default api
