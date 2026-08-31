import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Bus, Camera, AlertTriangle, Map, Activity,
  Navigation, Building2, BarChart3, FileText, Server, Settings,
  LogOut, ChevronLeft, ChevronRight, Shield,
} from 'lucide-react'
import { usePrahariStore, UserRole } from '@/store'
import { praharWS } from '@/services/websocket'
import { authAPI } from '@/services/api'
import { useNavigate } from 'react-router-dom'

interface NavItem {
  icon: React.ElementType
  label: string
  path: string
  roles: UserRole[]
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Command Center',    path: '/command-center',    roles: ['admin', 'operator', 'viewer'] },
  { icon: Bus,             label: 'Live Fleet',        path: '/fleet',             roles: ['admin', 'operator'] },
  { icon: Camera,          label: 'AI Vision',         path: '/ai-vision',         roles: ['admin', 'operator'] },
  { icon: AlertTriangle,   label: 'Incidents',         path: '/incidents',         roles: ['admin', 'operator', 'viewer'] },
  { icon: Map,             label: 'Road Intelligence', path: '/road-intelligence', roles: ['admin', 'operator', 'viewer'] },
  { icon: Activity,        label: 'Traffic',           path: '/traffic',           roles: ['admin', 'operator', 'viewer'] },
  { icon: Navigation,      label: 'Routes',            path: '/routes',            roles: ['admin', 'operator'] },
  { icon: Building2,       label: 'Infrastructure',   path: '/infrastructure',    roles: ['admin', 'operator'] },
  { icon: BarChart3,       label: 'Analytics',         path: '/analytics',         roles: ['admin', 'operator', 'viewer'] },
  { icon: FileText,        label: 'Reports',           path: '/reports',           roles: ['admin', 'operator', 'viewer'] },
  { icon: Server,          label: 'System Health',     path: '/system-health',     roles: ['admin'] },
  { icon: Settings,        label: 'Settings',          path: '/settings',          roles: ['admin'] },
]

const ROLE_LABELS: Record<UserRole, { label: string; color: string; bg: string }> = {
  admin:    { label: 'Administrator', color: '#7c3aed', bg: '#f5f3ff' },
  operator: { label: 'Operator',      color: '#0369a1', bg: '#eff6ff' },
  viewer:   { label: 'Viewer',        color: '#16a34a', bg: '#f0fdf4' },
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, sidebarCollapsed, setSidebarCollapsed, logout } = usePrahariStore()
  const role = (user?.role ?? 'viewer') as UserRole
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.viewer

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))

  const handleLogout = async () => {
    try { await authAPI.logout() } catch { /* best effort */ }
    praharWS.disconnect()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col bg-white border-r border-prahari-border h-screen overflow-hidden relative flex-shrink-0"
      style={{ zIndex: 50 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-prahari-border flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center flex-shrink-0">
          <Shield size={16} className="text-white" />
        </div>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="font-bold text-sm text-prahari-text leading-tight">PRAHARI</div>
            <div className="text-[10px] text-prahari-muted">Road Risk Intelligence</div>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map(item => {
          const active = location.pathname === item.path
          const Icon = item.icon
          return (
            <Link key={item.path} to={item.path}>
              <div
                title={sidebarCollapsed ? item.label : undefined}
                className={`sidebar-nav-item ${active ? 'active' : ''} ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
              >
                <Icon size={17} className="flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm truncate">{item.label}</span>
                )}
                {!sidebarCollapsed && item.badge && (
                  <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-prahari-border p-3 flex-shrink-0">
        {!sidebarCollapsed && user && (
          <div className="mb-3 px-2">
            <div className="text-xs font-semibold text-prahari-text truncate">{user.username}</div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ color: roleInfo.color, background: roleInfo.bg }}
            >
              {roleInfo.label}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={sidebarCollapsed ? 'Log out' : undefined}
          className={`sidebar-nav-item w-full text-red-500 hover:bg-red-50 hover:text-red-600 ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!sidebarCollapsed && <span className="text-sm">Log Out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-prahari-border rounded-full flex items-center justify-center shadow-sm hover:bg-prahari-bg transition-colors"
        style={{ zIndex: 60 }}
      >
        {sidebarCollapsed
          ? <ChevronRight size={12} className="text-prahari-muted" />
          : <ChevronLeft size={12} className="text-prahari-muted" />
        }
      </button>
    </motion.aside>
  )
}
