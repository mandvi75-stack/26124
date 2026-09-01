import { useState, useEffect, useRef } from 'react'
import { Camera, Cpu, Eye, Activity, RefreshCw, Info, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrahariStore } from '@/store'
import { aiAPI } from '@/services/api'
import { AIProcessingStats, DetectedObject } from '@/types'

const CAMERA_POSITIONS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'CABIN']

const CLASS_COLORS: Record<string, string> = {
  vehicle: '#6366f1', car: '#6366f1', bus: '#10b981', truck: '#f59e0b',
  motorcycle: '#8b5cf6', pedestrian: '#ef4444', person: '#ef4444',
  pothole: '#dc2626', traffic_sign: '#3b82f6', sign: '#3b82f6', other: '#64748b',
}

function getClassColor(cls: string): string {
  const lower = cls.toLowerCase()
  for (const [key, color] of Object.entries(CLASS_COLORS)) {
    if (lower.includes(key)) return color
  }
  return CLASS_COLORS.other
}

// Camera canvas — clearly labelled simulation
function CameraCanvas({ busId, cameraPos, objects, isActive }: {
  busId: string; cameraPos: string; objects: DetectedObject[]; isActive: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height

    const draw = () => {
      frameRef.current++
      const t = frameRef.current

      if (!isActive) {
        // Offline state
        ctx.fillStyle = '#f8faff'
        ctx.fillRect(0, 0, W, H)
        ctx.strokeStyle = '#e2e8f4'
        ctx.strokeRect(0, 0, W, H)
        ctx.font = '11px Inter,sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.textAlign = 'center'
        ctx.fillText('CAMERA OFFLINE', W / 2, H / 2 - 6)
        ctx.font = '9px Inter,sans-serif'
        ctx.fillStyle = '#cbd5e1'
        ctx.fillText(cameraPos, W / 2, H / 2 + 10)
        ctx.textAlign = 'left'
        animRef.current = requestAnimationFrame(draw)
        return
      }

      // Light road scene background
      ctx.fillStyle = '#f0f4fb'
      ctx.fillRect(0, 0, W, H)

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45)
      sky.addColorStop(0, '#dbeafe')
      sky.addColorStop(1, '#eff6ff')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H * 0.45)

      // Road
      ctx.fillStyle = '#e2e8f4'
      ctx.fillRect(0, H * 0.45, W, H * 0.55)

      // Road markings
      ctx.strokeStyle = '#c7d4e8'
      ctx.lineWidth = 1
      ctx.setLineDash([12, 10])
      ctx.beginPath()
      ctx.moveTo(W * 0.5, H * 0.45)
      ctx.lineTo(W * 0.5, H)
      ctx.stroke()
      ctx.setLineDash([])

      // Moving vehicles (light colours)
      for (let i = 0; i < 3; i++) {
        const x = ((t * (0.4 + i * 0.2) + i * 100) % (W + 50)) - 25
        const y = H * (0.55 + i * 0.12)
        const vw = 32 + i * 8, vh = 16 + i * 4
        ctx.fillStyle = ['#bfdbfe', '#bbf7d0', '#fde68a'][i]
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, vw, vh, 3)
        else ctx.rect(x, y, vw, vh)
        ctx.fill()
      }

      // Buildings
      for (let i = 0; i < 5; i++) {
        const bx = i * (W / 5)
        const bh = 60 + Math.sin(i * 1.2) * 20
        ctx.fillStyle = `hsl(220, 20%, ${88 + i * 2}%)`
        ctx.fillRect(bx + 4, H * 0.45 - bh, W / 5 - 8, bh)
        // Windows
        ctx.fillStyle = '#c7d4e8'
        for (let wy = 8; wy < bh - 10; wy += 12) {
          for (let wx = 8; wx < W / 5 - 16; wx += 10) {
            ctx.fillRect(bx + 4 + wx, H * 0.45 - bh + wy, 6, 7)
          }
        }
      }

      // Detected objects with bounding boxes
      objects.forEach(obj => {
        const [bx, by, bw, bh] = obj.bbox
        const x = (bx / 100) * W, y = (by / 100) * H
        const w = (bw / 100) * W, h = (bh / 100) * H
        const color = getClassColor(obj.class)

        // Semi-transparent fill
        ctx.fillStyle = color + '20'
        ctx.fillRect(x, y, w, h)

        // Stroke
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.strokeRect(x, y, w, h)

        // Corner accents
        const cl = 6
        ctx.lineWidth = 2
        ;[[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
          ctx.beginPath()
          ctx.moveTo(Number(cx) + Number(dx) * cl, Number(cy))
          ctx.lineTo(Number(cx), Number(cy))
          ctx.lineTo(Number(cx), Number(cy) + Number(dy) * cl)
          ctx.stroke()
        })

        // Label
        const label = `${obj.class.toUpperCase()} ${Math.round(obj.confidence * 100)}%`
        ctx.font = 'bold 8px Inter,monospace'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = color
        ctx.fillRect(x, y - 13, tw + 8, 13)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, x + 4, y - 3)
      })

      // Status bar
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(0, 0, W, 18)
      ctx.font = '8px monospace'
      ctx.fillStyle = '#475569'
      ctx.fillText(`${cameraPos} · ${busId} · SIMULATION · ${new Date().toTimeString().slice(0, 8)}`, 4, 12)

      // REC dot
      const blink = Math.floor(t / 15) % 2 === 0
      if (blink) {
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(W - 10, 9, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [objects, isActive, busId, cameraPos])

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={180}
      className="w-full rounded-lg border border-prahari-border"
    />
  )
}

export default function AIVision() {
  const { buses, incidents } = usePrahariStore()
  const [selectedBusId, setSelectedBusId] = useState<string>('')
  const [selectedCamera, setSelectedCamera] = useState('FRONT')
  const [objects, setObjects] = useState<DetectedObject[]>([])
  const [stats, setStats] = useState<AIProcessingStats>({
    fps: 0, latency_ms: 0, objects_per_frame: 0, events_per_minute: 0, total_detections: 0, active_tracks: 0,
  })
  const [aiMeta, setAiMeta] = useState<{ models?: Record<string, string> } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (buses.length > 0 && !selectedBusId) setSelectedBusId(buses[0].id)
  }, [buses])

  useEffect(() => {
    aiAPI.getStats().then(res => setAiMeta(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedBusId) return
    setLoading(true)
    const load = async () => {
      try {
        const res = await aiAPI.getDetections(selectedBusId)
        setObjects(res.data.objects ?? [])
        setStats(prev => ({ ...prev, ...(res.data.stats ?? {}) }))
      } catch { /* ignore */ } finally { setLoading(false) }
    }
    load()
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [selectedBusId])

  const selectedBus = buses.find(b => b.id === selectedBusId)
  const isActive = selectedBus?.camera_status === 'ACTIVE'

  const objectCounts = objects.reduce((acc, obj) => {
    acc[obj.class] = (acc[obj.class] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const incidentLog = incidents.filter(incident => incident.bus_id === selectedBusId).slice(0, 10)

  return (
    <div className="flex flex-col h-full gap-3 page-enter">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-prahari-text">AI Vision</h1>
          <p className="text-xs text-prahari-muted">Bus camera feeds · object detection · real-time analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Simulation warning banner */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold data-simulation border">
            <Info size={12} />
            SIMULATION — No live camera feed
          </div>
          {/* Bus selector */}
          {buses.length > 0 && (
            <select
              value={selectedBusId}
              onChange={e => setSelectedBusId(e.target.value)}
              className="h-8 px-2 rounded-xl border border-prahari-border text-xs bg-white text-prahari-text"
            >
              {buses.map(b => <option key={b.id} value={b.id}>{b.bus_number}</option>)}
            </select>
          )}
          <select
            value={selectedCamera}
            onChange={e => setSelectedCamera(e.target.value)}
            className="h-8 px-2 rounded-xl border border-prahari-border text-xs bg-white text-prahari-text"
          >
            {CAMERA_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {buses.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-prahari-muted">
          <Loader2 size={28} className="animate-spin opacity-40" />
          <p className="text-sm">Waiting for simulation buses…</p>
          <p className="text-xs">Buses appear once the backend simulation engine starts.</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-3 min-h-0">

          {/* Main camera + thumbnail grid */}
          <div className="flex-1 flex flex-col gap-3">
            {/* Primary view */}
            <div className="prahari-card overflow-hidden flex-shrink-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-prahari-border">
                <div className="flex items-center gap-2">
                  <Camera size={13} className={isActive ? 'text-green-500' : 'text-slate-400'} />
                  <span className="text-xs font-bold text-prahari-text">{selectedCamera} CAMERA</span>
                  {selectedBus && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                      {selectedBus.bus_number}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-prahari-muted font-mono">
                  <span>{stats.fps.toFixed(1)} FPS</span>
                  <span>{stats.latency_ms}ms</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-red-500 status-blink' : 'bg-slate-300'}`} />
                    <span className="font-semibold">{isActive ? 'SIMULATION' : 'OFFLINE'}</span>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <CameraCanvas busId={selectedBus?.bus_number ?? ''} cameraPos={selectedCamera} objects={objects} isActive={!!isActive} />
              </div>
            </div>

            {/* Camera thumbnails */}
            <div className="grid grid-cols-5 gap-2">
              {CAMERA_POSITIONS.map(pos => (
                <div
                  key={pos}
                  onClick={() => setSelectedCamera(pos)}
                  className={`prahari-card overflow-hidden cursor-pointer transition-all hover:shadow-card-hover ${
                    selectedCamera === pos ? 'ring-2 ring-prahari-indigo' : ''
                  }`}
                >
                  <div className="px-2 py-1 border-b border-prahari-border flex items-center justify-between">
                    <span className="text-[9px] font-bold text-prahari-muted">{pos}</span>
                    <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                  </div>
                  <CameraCanvas busId={selectedBus?.bus_number ?? ''} cameraPos={pos} objects={pos === selectedCamera ? objects : []} isActive={!!isActive} />
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-60 flex flex-col gap-3 flex-shrink-0 min-h-0 overflow-y-auto overflow-x-hidden pr-1">

            {/* AI Processing stats */}
            <div className="prahari-card p-3">
              <h3 className="text-xs font-bold text-prahari-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Cpu size={12} className="text-prahari-sky" /> AI Processing
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Frame Rate',   value: `${stats.fps.toFixed(1)} FPS`,        color: 'text-green-600' },
                  { label: 'Latency',      value: `${stats.latency_ms} ms`,              color: 'text-prahari-sky' },
                  { label: 'Objects/Frame',value: stats.objects_per_frame.toString(),    color: 'text-prahari-text' },
                  { label: 'Active Tracks',value: stats.active_tracks.toString(),        color: 'text-prahari-purple' },
                  { label: 'Detections',   value: stats.total_detections.toLocaleString(), color: 'text-prahari-text' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-prahari-muted">{label}</span>
                    <span className={`text-xs font-bold font-mono ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Model info */}
            {aiMeta?.models && (
              <div className="prahari-card p-3">
                <h3 className="text-xs font-bold text-prahari-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Info size={12} className="text-amber-500" /> Model Status
                </h3>
                <div className="space-y-1.5">
                  {Object.entries(aiMeta.models).map(([name, status]) => (
                    <div key={name}>
                      <div className="text-[10px] font-semibold text-prahari-muted capitalize">{name}</div>
                      <div className="text-[10px] text-prahari-text/70 line-clamp-2">{status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detected objects */}
            <div className="prahari-card p-3">
              <h3 className="text-xs font-bold text-prahari-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Eye size={12} className="text-prahari-sky" /> Live Detections
              </h3>
              <div className="space-y-1.5">
                {Object.entries(objectCounts).map(([cls, count]) => (
                  <div key={cls} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: getClassColor(cls) }} />
                    <span className="text-xs capitalize text-prahari-text flex-1">{cls}</span>
                    <span className="text-xs font-bold font-mono" style={{ color: getClassColor(cls) }}>{count}</span>
                  </div>
                ))}
                {Object.keys(objectCounts).length === 0 && (
                  <p className="text-xs text-prahari-muted text-center py-2">No detections yet</p>
                )}
              </div>
            </div>

            {/* Object list — flex-1 so it fills remaining right-panel space; overflow-y-auto enables scroll */}
            <div className="prahari-card p-3 flex-1 flex flex-col min-h-0">
              <h3 className="text-xs font-bold text-prahari-muted uppercase tracking-wide mb-2 flex items-center gap-1.5 flex-shrink-0">
                <Activity size={12} className="text-prahari-sky" /> Object Log
              </h3>
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                <AnimatePresence>
                  {objects.map(obj => (
                    <motion.div
                      key={obj.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-prahari-bg"
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: getClassColor(obj.class) }} />
                      <span className="text-[11px] capitalize text-prahari-text flex-1">{obj.class}</span>
                      <span className="text-[10px] text-prahari-muted">#{obj.track_id}</span>
                      <span className="text-[11px] font-bold font-mono" style={{ color: getClassColor(obj.class) }}>
                        {Math.round(obj.confidence * 100)}%
                      </span>
                    </motion.div>
                  ))}
                  {incidentLog.map(incident => (
                    <motion.div
                      key={`incident-${incident.id}`}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-medium text-prahari-text flex-1 truncate">{incident.type}</span>
                        <span className="text-[10px] text-prahari-muted">{incident.status}</span>
                      </div>
                      {(incident.vehicle_class || incident.number_plate) && (
                        <p className="text-[10px] text-amber-700 mt-1 pl-3.5">
                          {incident.vehicle_class ?? 'Vehicle'}{incident.number_plate ? ` · ${incident.number_plate}` : ''}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {objects.length === 0 && incidentLog.length === 0 && (
                  <p className="text-xs text-prahari-muted text-center py-3">No objects detected yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
