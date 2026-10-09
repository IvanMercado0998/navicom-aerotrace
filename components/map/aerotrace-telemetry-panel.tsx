'use client'

import { useEffect, useState } from 'react'
import { Settings2, X, MapPin, Radio, FlaskConical } from 'lucide-react'

const DEVICE_ID = 'aerotrace-001'
const SITE = { lat: 15.13175, lng: 120.58991666666667 }
const CLASSES = ['Vehicle Soot', 'Biomass Burning', 'Industrial Emissions'] as const
// Exact firmware B1/B2/B3 manual classification fixtures. Not sensor measurements.
const PRESETS = [[86, 9, 5], [7, 88, 5], [8, 12, 80]] as const
const KEYS = ['vehicle_soot', 'biomass_burning', 'industrial'] as const
// Display-only fixtures. OD/EC/pH exactly match the INO placeholder
// CENT array means. TDS follows firmware provisional EC * 0.5.
// Temperature/humidity are independent illustrative values, not INO observations.
// Never upload these fixtures to the real telemetry endpoint or scientific history.
const SENSOR_FIXTURES = [
  { od: 0.30, ph: 6.6, ec: 120, tds: 60, temp: 29.4, rh: 67.2 },
  { od: 0.20, ph: 7.4, ec: 250, tds: 125, temp: 30.1, rh: 71.5 },
  { od: 0.10, ph: 5.0, ec: 400, tds: 200, temp: 30.7, rh: 64.8 },
] as const

type Telemetry = {
  deviceId?: string
  createdAt?: string
  recordedAt?: string
  ph?: number | null
  tdsPpm?: number | null
  conductivityUsCm?: number | null
  temperatureC?: number | null
  humidityPct?: number | null
  signalDbm?: number | null
  latitude?: number | null
  longitude?: number | null
  location?: { lat?: number | null; lng?: number | null }
  rawPayload?: Record<string, any> | string | null
  sourceMode?: string | null
}

function numeric(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function display(v: unknown, digits = 2): string {
  const n = numeric(v)
  return n === null ? '—' : n.toFixed(digits)
}
function rawObject(v: Telemetry['rawPayload']): Record<string, any> {
  if (v && typeof v === 'object') return v
  if (typeof v === 'string') {
    try { const parsed = JSON.parse(v); return parsed && typeof parsed === 'object' ? parsed : {} } catch { return {} }
  }
  return {}
}

export function AeroTraceTelemetryPanel({ onClose }: { onClose: () => void }) {
  const [latest, setLatest] = useState<Telemetry | null>(null)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState<number | null>(null)
  const [showControls, setShowControls] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const response = await fetch(`/api/telemetry/latest?deviceId=${encodeURIComponent(DEVICE_ID)}`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json: unknown = await response.json()
        const rows = Array.isArray(json) ? json : (json && typeof json === 'object' && 'readings' in json && Array.isArray((json as any).readings) ? (json as any).readings : [])
        const row: Telemetry | null = rows.length ? rows[0] : null
        if (!cancelled) { setLatest(row); setError('') }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Telemetry request failed')
      }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 15000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const raw = rawObject(latest?.rawPayload)
  const deviceTest = raw.demoOnly === true || raw.simulation?.simulated === true || latest?.sourceMode === 'manual_test'
  const payloadClass = deviceTest ? raw.simulation : raw.result
  const classifier = payloadClass && typeof payloadClass === 'object' ? payloadClass : null
  const scoreObj = classifier?.scores ?? null
  const liveScores = KEYS.map(k => numeric(scoreObj?.[k]))
  const hasValidScores = liveScores.every(v => v !== null)
  const chosen = preset ?? (hasValidScores ? null : 0)
  const percentages = chosen !== null ? PRESETS[chosen] : liveScores.map(v => (v ?? 0) * 100)
  const dominantIndex = percentages.indexOf(Math.max(...percentages))
  const origin = chosen !== null ? 'Firmware test preset' : deviceTest ? 'Device test preset' : 'Classifier output'
  const coords = latest?.location ?? { lat: latest?.latitude, lng: latest?.longitude }
  const lat = numeric(coords.lat) ?? SITE.lat
  const lng = numeric(coords.lng) ?? SITE.lng
  const hasGnss = numeric(coords.lat) !== null && numeric(coords.lng) !== null && raw.locationSource !== 'fixed'
  const timestamp = latest?.recordedAt ?? latest?.createdAt
  const useTestSensorValues = chosen !== null && (preset !== null || !latest)
  const fixture = useTestSensorValues ? SENSOR_FIXTURES[chosen] : null
  const sensorCards = [
    ['pH', fixture?.ph ?? latest?.ph, '', 2],
    ['EC', fixture?.ec ?? latest?.conductivityUsCm, 'µS/cm', 1],
    ['TDS', fixture?.tds ?? latest?.tdsPpm, 'ppm', 1],
    ['Optical index (OD)', fixture?.od ?? numeric(raw.opticalDensity), '', 3],
    ['Temperature', fixture?.temp ?? latest?.temperatureC, '°C', 1],
    ['Humidity', fixture?.rh ?? latest?.humidityPct, '%', 1],
    // LTE signal is a modem status, not an environmental parameter; no fake RSSI.
    ['LTE signal', latest?.signalDbm, 'dBm', 0],
  ] as const

  return (
    <aside className="fixed right-4 top-4 bottom-4 z-[1500] w-[min(390px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-blue-100 bg-white text-slate-800 shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-blue-100 bg-white/95 px-5 py-5 backdrop-blur">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">Environmental monitoring</div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">AeroTrace Node Telemetry</h2>
          <p className="mt-1 text-xs text-slate-500">{DEVICE_ID}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close telemetry" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50"><X size={18}/></button>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-blue-700"><Radio size={14}/> Classification analysis</span>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">{chosen !== null || deviceTest ? 'TEST DATA' : 'DEVICE DATA'}</span>
        </div>
        <section className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
          <p className="mb-4 text-xs font-semibold text-slate-600">Pollution source composition</p>
          <div className="space-y-4">
            {CLASSES.map((name, i) => (
              <div key={name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-700">{name}</span><span className="font-mono font-semibold text-blue-800">{percentages[i].toFixed(0)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, percentages[i]))}%` }}/></div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-blue-100 pt-3">
            <p className="text-sm font-bold text-blue-900">{CLASSES[dominantIndex]}</p>
            <p className="mt-1 text-[11px] text-slate-500">{origin}{chosen !== null || deviceTest ? ' · Not sensor-derived' : ''}</p>
            <p className="mt-2 text-xs text-slate-600">Confidence <strong className="text-blue-800">{percentages[dominantIndex].toFixed(0)}%</strong></p>
          </div>
        </section>
        <div className="flex justify-end">
          <button type="button" onClick={() => setShowControls(v => !v)} aria-expanded={showControls} aria-label="Toggle test controls" title="Test settings" className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Settings2 size={16}/></button>
        </div>
        {showControls && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-2" aria-label="Manual classification test controls">
            {PRESETS.map((_, i) => <button key={i} type="button" onClick={() => setPreset(i)} className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${chosen === i ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700'}`}>B{i + 1}</button>)}
            {hasValidScores && <button type="button" onClick={() => setPreset(null)} className="ml-auto text-xs font-semibold text-blue-700">Device</button>}
          </div>
        )}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><FlaskConical size={15} className="text-blue-600"/> Sensor measurements</div>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">{useTestSensorValues ? 'SIMULATED' : latest ? 'DEVICE' : 'UNAVAILABLE'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sensorCards.map(([name, value, unit, digits]) => (
              <div key={name} className="rounded-lg border border-blue-50 bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">{name}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{display(value, digits)} {numeric(value) === null ? '' : unit}</p>
              </div>
            ))}
          </div>
          {useTestSensorValues && <p className="mt-3 text-[11px] text-blue-700">Test fixtures: OD, EC and pH use firmware placeholder centroids; TDS = 0.5 × EC. Temperature and humidity are illustrative. None are sensor observations.</p>}
          {timestamp && !useTestSensorValues && <p className="mt-3 text-[11px] text-slate-500">Last uploaded: {new Date(timestamp).toLocaleString()}</p>}
          {error && <p className="mt-2 text-[11px] text-amber-700">Telemetry service: {error}</p>}
        </section>
        <div className="rounded-lg bg-slate-50 px-3 py-3 text-[11px] text-slate-600"><p className="flex items-center gap-1 font-semibold"><MapPin size={13}/> Node location</p><p className="mt-1 font-mono">{lat.toFixed(6)}, {lng.toFixed(6)}</p><p className="mt-1">{hasGnss ? 'Device-reported coordinates' : 'Configured fixed site · GNSS not verified'}</p></div>
      </div>
    </aside>
  )
}
