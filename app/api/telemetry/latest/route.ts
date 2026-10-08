// app/api/telemetry/latest/route.ts
import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { telemetryReadings } from '@/lib/db/schema'
import { isAdminLoggedIn } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await isAdminLoggedIn())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('deviceId')
  if (!id) return NextResponse.json({ error: 'deviceId required' }, { status: 400 })
  const rows = await db.select().from(telemetryReadings)
    .where(eq(telemetryReadings.deviceId, id))
    .orderBy(desc(telemetryReadings.createdAt)).limit(1)
  const row = rows[0]
  return NextResponse.json(row ? { ...row, sequenceNumber: row.sequenceNumber.toString() } : null,
    { headers: { 'Cache-Control': 'no-store' } })
}
