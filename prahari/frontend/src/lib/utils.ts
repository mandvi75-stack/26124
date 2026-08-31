import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { IncidentSeverity, BusStatus, CongestionLevel, DefectStatus } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false 
  })
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function severityColor(severity: IncidentSeverity): string {
  switch (severity) {
    case 'CRITICAL': return 'text-red-600'
    case 'HIGH': return 'text-orange-600'
    case 'MEDIUM': return 'text-amber-600'
    case 'LOW': return 'text-green-600'
  }
}

export function severityBg(severity: IncidentSeverity): string {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-50 border-red-200 text-red-700'
    case 'HIGH': return 'bg-orange-50 border-orange-200 text-orange-700'
    case 'MEDIUM': return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'LOW': return 'bg-green-50 border-green-200 text-green-700'
  }
}

export function busStatusColor(status: BusStatus): string {
  switch (status) {
    case 'ONLINE': return 'text-green-600'
    case 'DEGRADED': return 'text-amber-600'
    case 'OFFLINE': return 'text-red-600'
  }
}

export function busStatusBg(status: BusStatus): string {
  switch (status) {
    case 'ONLINE': return 'bg-green-50 border-green-200 text-green-700'
    case 'DEGRADED': return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'OFFLINE': return 'bg-red-50 border-red-200 text-red-700'
  }
}

export function congestionColor(level: CongestionLevel): string {
  switch (level) {
    case 'FREE': return 'text-green-600'
    case 'MODERATE': return 'text-amber-600'
    case 'HEAVY': return 'text-orange-600'
    case 'SEVERE': return 'text-red-600'
  }
}

export function congestionBg(level: CongestionLevel): string {
  switch (level) {
    case 'FREE': return 'bg-green-50 text-green-700'
    case 'MODERATE': return 'bg-amber-50 text-amber-700'
    case 'HEAVY': return 'bg-orange-50 text-orange-700'
    case 'SEVERE': return 'bg-red-50 text-red-700'
  }
}

export function defectStatusColor(status: DefectStatus): string {
  switch (status) {
    case 'DETECTED': return 'text-red-400'
    case 'VERIFIED': return 'text-orange-400'
    case 'ASSIGNED': return 'text-blue-400'
    case 'UNDER_MAINTENANCE': return 'text-amber-400'
    case 'RESOLVED': return 'text-green-400'
  }
}

export function compassHeading(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(degrees / 45) % 8]
}

export function formatSpeed(speed: number): string {
  return `${Math.round(speed)} km/h`
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`
}
