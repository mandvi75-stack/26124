import { useState } from 'react'
import { Settings as SettingsIcon, Shield, Bell, Map, Cpu, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SettingSection {
  id: string
  label: string
  icon: React.ElementType
}

const SECTIONS: SettingSection[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'ai', label: 'AI Engine', icon: Cpu },
]

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex h-full p-3 gap-3">
      {/* Section nav */}
      <div className="w-48 shrink-0 space-y-0.5">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeSection === id
                ? 'bg-prahari-cyan/10 text-prahari-cyan border border-prahari-cyan/20'
                : 'text-prahari-muted hover:text-foreground hover:bg-prahari-card'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 glass-panel rounded-lg p-4 overflow-auto">
        {activeSection === 'general' && (
          <SettingsSection title="General Settings">
            <SettingGroup label="Platform">
              <SettingRow label="Platform Name" defaultValue="PRAHARI Command Center" />
              <SettingRow label="City" defaultValue="New Delhi" />
              <SettingRow label="Time Zone" defaultValue="Asia/Kolkata" />
              <SettingRow label="Data Retention (days)" defaultValue="90" type="number" />
            </SettingGroup>
            <SettingGroup label="Simulation">
              <SettingRow label="Bus Count" defaultValue="20" type="number" />
              <SettingRow label="GPS Update Interval (ms)" defaultValue="2000" type="number" />
              <SettingRow label="Incident Generation Rate (/min)" defaultValue="2" type="number" />
            </SettingGroup>
          </SettingsSection>
        )}

        {activeSection === 'security' && (
          <SettingsSection title="Security Settings">
            <SettingGroup label="Authentication">
              <SettingRow label="JWT Expiry (hours)" defaultValue="24" type="number" />
              <SettingRow label="Max Login Attempts" defaultValue="5" type="number" />
              <SettingRow label="Session Timeout (min)" defaultValue="60" type="number" />
            </SettingGroup>
            <SettingGroup label="Access Control">
              <div className="p-3 bg-prahari-surface rounded border border-prahari-border text-xs text-prahari-muted">
                Role-Based Access Control (RBAC) is active. Roles: Admin, Operator, Viewer, Field Officer.
              </div>
            </SettingGroup>
          </SettingsSection>
        )}

        {activeSection === 'notifications' && (
          <SettingsSection title="Notification Settings">
            <SettingGroup label="Alert Thresholds">
              <SettingRow label="Critical Incident Confidence (%)" defaultValue="80" type="number" />
              <SettingRow label="High Incident Confidence (%)" defaultValue="70" type="number" />
              <SettingRow label="Speed Alert Threshold (km/h)" defaultValue="80" type="number" />
            </SettingGroup>
            <SettingGroup label="Notification Channels">
              <div className="p-3 bg-prahari-surface rounded border border-prahari-border text-xs text-prahari-muted">
                Notifications are delivered via WebSocket to all connected clients in real-time.
              </div>
            </SettingGroup>
          </SettingsSection>
        )}

        {activeSection === 'map' && (
          <SettingsSection title="Map Settings">
            <SettingGroup label="Default View">
              <SettingRow label="Center Latitude" defaultValue="28.6139" />
              <SettingRow label="Center Longitude" defaultValue="77.2090" />
              <SettingRow label="Default Zoom" defaultValue="12" type="number" />
            </SettingGroup>
            <SettingGroup label="Layers">
              <div className="space-y-2 text-xs text-prahari-muted">
                <p>Active map layers: Buses, Incidents, Traffic Zones, Road Defects</p>
                <p>Tile provider: CARTO Dark Matter</p>
              </div>
            </SettingGroup>
          </SettingsSection>
        )}

        {activeSection === 'ai' && (
          <SettingsSection title="AI Engine Settings">
            <SettingGroup label="Detection Models">
              <div className="space-y-2">
                {[
                  { label: 'Object Detection', model: 'YOLOv8n', status: 'Configurable' },
                  { label: 'Vehicle Tracking', model: 'ByteTrack', status: 'Configurable' },
                  { label: 'Number Plate OCR', model: 'EasyOCR', status: 'Configurable' },
                  { label: 'Incident Detection', model: 'Rule-based + ML', status: 'Active' },
                ].map(({ label, model, status }) => (
                  <div key={label} className="flex items-center justify-between p-2.5 bg-prahari-surface rounded border border-prahari-border">
                    <div>
                      <div className="text-xs font-medium text-foreground">{label}</div>
                      <div className="text-[10px] text-prahari-muted">{model}</div>
                    </div>
                    <span className={`text-[10px] font-semibold ${status === 'Active' ? 'text-green-400' : 'text-amber-400'}`}>{status}</span>
                  </div>
                ))}
              </div>
            </SettingGroup>
            <SettingGroup label="Processing">
              <SettingRow label="Target FPS" defaultValue="25" type="number" />
              <SettingRow label="Detection Confidence Threshold" defaultValue="0.5" />
              <SettingRow label="Tracking Max Age (frames)" defaultValue="30" type="number" />
            </SettingGroup>
          </SettingsSection>
        )}

        <div className="mt-4 pt-4 border-t border-prahari-border">
          <Button onClick={handleSave} variant={saved ? 'success' : 'default'}>
            <Save size={14} />
            {saved ? 'Saved!' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-foreground mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-prahari-muted uppercase tracking-wider mb-2">{label}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function SettingRow({ label, defaultValue, type = 'text' }: { label: string; defaultValue: string; type?: string }) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-xs text-prahari-muted shrink-0 w-48">{label}</label>
      <Input type={type} value={value} onChange={e => setValue(e.target.value)} className="h-7 text-xs max-w-48" />
    </div>
  )
}
