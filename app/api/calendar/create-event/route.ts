import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getValidAccessToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: row } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!row) return null

  // Refresh if expired (or about to expire in the next 60s)
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
    const newTokens = await res.json()
    if (!newTokens.access_token) return null

    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
    await supabase.from('google_tokens').update({
      access_token: newTokens.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    return newTokens.access_token
  }

  return row.access_token
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exerciseId, type, date, time, durationMinutes, notes, timeZone } = await req.json()

  const token = await getValidAccessToken(supabase, user.id)
  if (!token) return NextResponse.json({ error: 'not_connected' }, { status: 400 })

  // Build start/end DateTimes
  const startDateTime = `${date}T${time}:00`
  const endDate = new Date(`${date}T${time}:00`)
  endDate.setMinutes(endDate.getMinutes() + durationMinutes)
  const endDateTime = endDate.toISOString().slice(0, 19)

  const tz = timeZone || 'UTC'
  const emoji: Record<string, string> = {
    Run: '🏃', Gym: '🏋️', Yoga: '🧘', Cycling: '🚴', Swim: '🏊',
    Walk: '🚶', HIIT: '⚡', Pilates: '🤸', Other: '💪',
  }

  const eventRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `${emoji[type] ?? '💪'} ${type}`,
        description: [
          notes,
          `Duration: ${durationMinutes} min`,
          'Added via Daybook',
        ].filter(Boolean).join('\n'),
        start: { dateTime: startDateTime, timeZone: tz },
        end: { dateTime: endDateTime, timeZone: tz },
        colorId: '10', // Basil (green)
      }),
    }
  )

  const event = await eventRes.json()

  if (!event.id) {
    return NextResponse.json({ error: event.error?.message ?? 'Unknown error' }, { status: 500 })
  }

  // Store the calendar event ID on the exercise row
  await supabase
    .from('weekly_exercises')
    .update({ calendar_event_id: event.id })
    .eq('id', exerciseId)

  return NextResponse.json({ eventId: event.id })
}
