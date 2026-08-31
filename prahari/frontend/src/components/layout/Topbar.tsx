import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Wifi, WifiOff, CheckCheck, ChevronDown, Activity } from 'lucide-react'
import { usePrahariStore } from '@/store'
import { notificationsAPI } from '@/services/api'
import { formatDistanceToNow } from 'date-fns'

const SEV_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  CRITICAL: { dot: 'bg-red-500',    badge: 'risk-critical', label: 'Critical' },
  HIGH:     { dot: 'bg-orange-500', badge: 'risk-high',     label: 'High'     },
  MEDIUM:   { dot: 'bg-amber-500',  badge: 'risk-moderate', label: 'Medium'   },
  LOW:      { dot: 'bg-green-500',  badge: 'risk-low',      label: 'Low'      },
}

export default function Topbar() {
  const {
    notifications, unreadCount, wsConnected,
    simulationActive, markNotificationRead, markAllNotificationsRead, user,
    setNotifications,
  } = usePrahariStore()

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load notifications on mount
  useEffect(() => {
    notificationsAPI.getAll().then(res => {
      setNotifications(res.data)
    }).catch(() => {})
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead()
      markAllNotificationsRead()
    } catch {/* best effort */}
  }

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id)
      markNotificationRead(id)
    } catch {
      markNotificationRead(id)
    }
  }

  return (
    <header
      className="prahari-topbar flex items-center justify-between px-6 py-3 bg-white border-b border-prahari-border flex-shrink-0"
      style={{ position: 'relative', zIndex: 100 }}
    >
      {/* Left — title + simulation badge */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-prahari-text">PRAHARI Dashboard</h2>
          <p className="text-[11px] text-prahari-muted">AI-Powered Road Risk Intelligence</p>
        </div>
        {simulationActive && (
          <div className="sim-badge">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 status-blink" />
            SIMULATION ACTIVE
          </div>
        )}
      </div>

      {/* Right — WS status + notifications + user */}
      <div className="flex items-center gap-3">

        {/* WebSocket status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
          wsConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {wsConnected
            ? <><Wifi size={12} /><span>Live</span></>
            : <><WifiOff size={12} /><span>Reconnecting…</span></>
          }
        </div>

        {/* Notification bell — positioned relative so dropdown doesn't push layout */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(prev => !prev)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-prahari-bg hover:bg-prahari-border transition-colors"
            aria-label="Notifications"
          >
            <Bell size={17} className="text-prahari-muted" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown — rendered inside the relative container, z-index 9999 */}
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                key="notif-panel"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="notif-dropdown"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-prahari-border">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-prahari-muted" />
                    <span className="text-sm font-bold text-prahari-text">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs text-prahari-sky hover:text-prahari-indigo font-medium"
                    >
                      <CheckCheck size={12} />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-prahari-muted">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 20).map(n => {
                      const sev = SEV_STYLES[n.severity] ?? SEV_STYLES.MEDIUM
                      const timeAgo = n.timestamp
                        ? formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })
                        : ''
                      return (
                        <div
                          key={n.id}
                          onClick={() => !n.read && handleMarkRead(n.id)}
                          className={`px-4 py-3 border-b border-prahari-border last:border-0 cursor-pointer transition-colors hover:bg-prahari-bg ${
                            !n.read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-prahari-text truncate">{n.title}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sev.badge} flex-shrink-0`}>
                                  {sev.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-prahari-muted line-clamp-2">{n.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {n.location && (
                                  <span className="text-[10px] text-prahari-muted/70 truncate">{n.location}</span>
                                )}
                                <span className="text-[10px] text-prahari-muted/60 ml-auto flex-shrink-0">{timeAgo}</span>
                              </div>
                            </div>
                            {!n.read && (
                              <div className="w-1.5 h-1.5 rounded-full bg-prahari-sky flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 20 && (
                  <div className="px-4 py-2.5 text-center border-t border-prahari-border">
                    <span className="text-xs text-prahari-muted">
                      + {notifications.length - 20} more notifications
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-sky-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-prahari-text">{user.username}</div>
              <div className="text-[10px] text-prahari-muted capitalize">{user.role}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
