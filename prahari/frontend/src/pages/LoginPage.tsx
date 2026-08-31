import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, AlertCircle, Loader2, Lock, User } from 'lucide-react'
import { usePrahariStore, UserRole } from '@/store'
import { authAPI } from '@/services/api'

const ROLE_REDIRECTS: Record<UserRole, string> = {
  admin:    '/command-center',
  operator: '/fleet',
  viewer:   '/command-center',
}

const DEMO_CREDENTIALS = [
  { label: 'Admin',    user: 'admin',    pass: 'prahari123',  role: 'admin'    as UserRole, color: '#7c3aed' },
  { label: 'Operator', user: 'operator', pass: 'operator123', role: 'operator' as UserRole, color: '#0369a1' },
  { label: 'Viewer',   user: 'viewer',   pass: 'viewer123',   role: 'viewer'   as UserRole, color: '#16a34a' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { setToken, setUser } = usePrahariStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doLogin = async (u: string, p: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authAPI.login(u, p)
      const { access_token, username: uname, role } = res.data
      setToken(access_token)
      setUser({ username: uname || u, role: role as UserRole })
      navigate(ROLE_REDIRECTS[role as UserRole] ?? '/command-center', { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e?.response?.data?.detail ?? 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.')
      return
    }
    doLogin(username.trim(), password.trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-sky-100/40 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="glass-panel rounded-2xl p-8 shadow-glass">
          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-prahari-text">PRAHARI</h1>
            <p className="text-sm text-prahari-muted mt-1">AI-Powered Road Risk Intelligence</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-prahari-muted mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-prahari-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-prahari-border bg-white text-sm text-prahari-text placeholder-prahari-muted focus:border-prahari-indigo focus:ring-0 focus:outline-none transition-colors"
                  placeholder="Enter username"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-prahari-muted mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-prahari-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-prahari-border bg-white text-sm text-prahari-text placeholder-prahari-muted focus:border-prahari-indigo focus:ring-0 focus:outline-none transition-colors"
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-prahari-muted hover:text-prahari-text"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm"
              >
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white text-sm font-semibold hover:from-indigo-600 hover:to-sky-600 transition-all shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-prahari-border">
            <p className="text-xs font-semibold text-prahari-muted text-center mb-3 uppercase tracking-wide">
              Quick Login (Demo)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_CREDENTIALS.map(cred => (
                <button
                  key={cred.user}
                  onClick={() => doLogin(cred.user, cred.pass)}
                  disabled={loading}
                  className="py-2 px-3 rounded-xl border text-xs font-medium transition-all hover:shadow-sm disabled:opacity-60"
                  style={{ borderColor: cred.color + '40', color: cred.color, background: cred.color + '10' }}
                >
                  {cred.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-4">
          PRAHARI v1.0 · Road Risk Intelligence Platform
        </p>
      </motion.div>
    </div>
  )
}
