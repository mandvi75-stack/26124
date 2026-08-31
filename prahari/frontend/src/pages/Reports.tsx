import { useState } from 'react'
import { FileText, Download, Loader } from 'lucide-react'
import { reportsAPI } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const REPORT_TYPES = [
  { id: 'incidents', label: 'Incident Report', description: 'All incidents with severity, status, and resolution data' },
  { id: 'road_conditions', label: 'Road Conditions Report', description: 'Road defects by type, location, and maintenance status' },
  { id: 'traffic', label: 'Traffic Analysis Report', description: 'Traffic volume, congestion zones, and speed analytics' },
  { id: 'fleet', label: 'Fleet Activity Report', description: 'Bus status, trip data, and operational metrics' },
  { id: 'route_delays', label: 'Route Delay Report', description: 'Route performance, delays, and historical trends' },
  { id: 'infrastructure', label: 'Infrastructure Report', description: 'Infrastructure deficiencies and maintenance records' },
]

export default function Reports() {
  const [reportType, setReportType] = useState('incidents')
  const [format, setFormat] = useState('csv')
  const [period, setPeriod] = useState('7d')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await reportsAPI.generate(reportType, { format, period })
      const blob = new Blob([res.data], { type: format === 'csv' ? 'text/csv' : 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prahari-${reportType}-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (_) {
      setError('Failed to generate report. Please try again.')
    }
    setLoading(false)
  }

  const selected = REPORT_TYPES.find(r => r.id === reportType)

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="shrink-0">
        <h1 className="text-base font-bold text-foreground">Reports</h1>
        <p className="text-xs text-prahari-muted">Generate and export operational reports</p>
      </div>

      <div className="flex gap-3 flex-1">
        {/* Report type selector */}
        <div className="w-64 shrink-0 space-y-1.5">
          {REPORT_TYPES.map(rt => (
            <div
              key={rt.id}
              onClick={() => setReportType(rt.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                reportType === rt.id
                  ? 'border-prahari-cyan/40 bg-prahari-cyan/5'
                  : 'border-prahari-border bg-prahari-card hover:border-prahari-border/80'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText size={13} className={reportType === rt.id ? 'text-prahari-cyan' : 'text-prahari-muted'} />
                <span className="text-xs font-semibold text-foreground">{rt.label}</span>
              </div>
              <p className="text-[10px] text-prahari-muted leading-relaxed">{rt.description}</p>
            </div>
          ))}
        </div>

        {/* Configuration and generate */}
        <div className="flex-1">
          <div className="glass-panel rounded-lg p-4 max-w-md">
            <h3 className="text-sm font-bold text-foreground mb-1">{selected?.label}</h3>
            <p className="text-xs text-prahari-muted mb-4">{selected?.description}</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-medium text-prahari-muted mb-1.5 block">Format</label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                    <SelectItem value="pdf">PDF (Document)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-prahari-muted mb-1.5 block">Time Period</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded p-2">{error}</p>
            )}

            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader size={14} className="animate-spin" />
                  Generating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download size={14} />
                  Generate & Download {format.toUpperCase()}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
