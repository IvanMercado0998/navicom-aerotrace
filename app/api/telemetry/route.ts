// app/api/telemetry/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { telemetryReadings } from '@/lib/db/schema'

export const runtime = 'nodejs'

function authorized(req: Request): boolean {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return !!process.env.AEROTRACE_DEVICE_TOKEN && bearer === process.env.AEROTRACE_DEVICE_TOKEN
}
const decimal = (v: unknown): string | null => typeof v === 'number' && Number.isFinite(v) ? String(v) : null
const object = (v: unknown): Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let b: Record<string, any>
  try { b = object(await request.json()) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const deviceId = b.deviceId
  // Current Arduino code emits sequenceNumber; older API expected sequence.
  const sequence = b.sequenceNumber ?? b.sequence
  if (typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(deviceId) ||
      typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 0) {
    return NextResponse.json({ error: 'Valid deviceId and integer sequenceNumber required' }, { status: 400 })
  }
  const timestampOK = typeof b.timestamp === 'string' && !b.timestamp.startsWith('unsynced') &&
    Number.isFinite(Date.parse(b.timestamp))
  const recordedAt = timestampOK ? new Date(b.timestamp) : new Date()
  const location = object(b.location)
  const latitude = b.latitude ?? location.lat
  const longitude = b.longitude ?? location.lng
  if (latitude != null && (typeof latitude !== 'number' || latitude < -90 || latitude > 90))
    return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 })
  if (longitude != null && (typeof longitude !== 'number' || longitude < -180 || longitude > 180))
    return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 })
  // Classification provenance must remain visible even when AP layout is simplified.
  const modeText = String(b.sourceMode ?? b.mode ?? b.result?.model ?? '').toLowerCase()
  const manual = b.demoOnly === true || b.simulated === true || b.manualTest === true ||
    modeText.includes('demo') || modeText.includes('simulat') || modeText.includes('manual_test')
  const trainedModel = modeText.includes('random_forest') || modeText.includes('validated_model')
  const sourceMode = manual ? 'manual_test' : trainedModel ? 'model_output_unverified' : 'unclassified'
  try {
    const [inserted] = await db.insert(telemetryReadings).values({
      id: crypto.randomUUID(), deviceId, sequenceNumber: BigInt(sequence), recordedAt,
      latitude: decimal(latitude), longitude: decimal(longitude),
      gpsAccuracyM: decimal(location.accuracyM), ph: decimal(b.ph),
      tdsPpm: decimal(b.tdsPpm), conductivityUsCm: decimal(b.conductivityUsCm ?? b.ecUsCm),
      // The earlier firmware's vDust*1000 is not validated PM2.5. Do not store as PM2.5.
      pm25UgM3: null,
      temperatureC: decimal(b.temperatureC), humidityPct: decimal(b.humidityPct),
      pressureHpa: decimal(b.pressureHpa), batteryPct: decimal(b.batteryPct),
      signalDbm: Number.isInteger(b.signalDbm) ? b.signalDbm : null,
      opticalDensity: decimal(b.opticalDensity),
      dustSensorVoltageV: decimal(b.dustSensorVoltageV ?? b.vDust),
      sourceMode, rawPayload: b, createdAt: new Date(),
    }).onConflictDoNothing({ target: [telemetryReadings.deviceId, telemetryReadings.sequenceNumber] })
      .returning({ id: telemetryReadings.id })
    return NextResponse.json({ accepted: true, duplicate: !inserted, id: inserted?.id ?? null })
  } catch (error) {
    console.error('Telemetry insert failed', error)
    return NextResponse.json({ error: 'Database write failed' }, { status: 500 })
  }
}
