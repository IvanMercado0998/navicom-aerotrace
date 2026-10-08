//api/commands/route.ts
// Command API route for handling device command updates


import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deviceCommands } from '@/lib/db/schema'

function authorized(request: Request) {
  const expected = process.env.AEROTRACE_DEVICE_TOKEN
  const received = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return Boolean(expected && received && received === expected)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || !['completed', 'failed'].includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const [updated] = await db.update(deviceCommands).set({ status: body.status, result: body.results ?? body.result ?? null, completedAt: new Date() }).where(and(eq(deviceCommands.id, id), eq(deviceCommands.status, 'claimed'))).returning({ id: deviceCommands.id })
  return updated ? NextResponse.json({ accepted: true }) : NextResponse.json({ error: 'Command not found or already completed' }, { status: 404 })
}

export const runtime = 'nodejs'
