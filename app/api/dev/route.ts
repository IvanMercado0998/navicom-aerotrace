//api/dev/route.ts
// Development API route for handling device command retrieval
import { NextResponse } from 'next/server'
import { and, asc, eq, gt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deviceCommands } from '@/lib/db/schema'

function authorized(request: Request) {
  const expected = process.env.AEROTRACE_DEVICE_TOKEN
  const received = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return Boolean(expected && received && received === expected)
}

export async function GET(request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { deviceId } = await params
  const [command] = await db.select().from(deviceCommands).where(and(eq(deviceCommands.deviceId, deviceId), eq(deviceCommands.status, 'pending'), gt(deviceCommands.expiresAt, new Date()))).orderBy(asc(deviceCommands.createdAt)).limit(1)
  if (!command) return NextResponse.json({ command: null })
  await db.update(deviceCommands).set({ status: 'claimed', claimedAt: new Date() }).where(eq(deviceCommands.id, command.id))
  return NextResponse.json({ command: { id: command.id, command: command.command, payload: command.payload } })
}

export const runtime = 'nodejs'
