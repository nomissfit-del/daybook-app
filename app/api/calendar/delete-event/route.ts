import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getValidAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: row } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!row) return null
  if (new Date(row.expires_at) < new Date(Date.now() + 60_000)) {
    if (!row.refresh_token) return null
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: row.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    })
    const t = await res.json()
    if (!t.access_token) return null
    await supabase.from('google_tokens').update({
      access_token: t.access_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return t.access_token
  }
  return row.access_token
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exerciseId, calendarEventId } = await req.json()

  const token = await getValidAccessToken(supabase, user.id)
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 400 })

  // Delete from Google Calendar
  if (calendarEventId) {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  // Delete from DB
  await supabase.from('weekly_exercises').delete().eq('id', exerciseId)

  return NextResponse.json({ ok: true })
}
