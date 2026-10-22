import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDue } from '@/lib/notify/actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Scheduler entry point (Supabase pg_cron every 15 minutes, or Vercel Cron).
// Protected by CRON_SECRET: send it as "Authorization: Bearer <secret>".
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const results = await runDue(createAdminClient())
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
