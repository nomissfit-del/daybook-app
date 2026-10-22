import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { zonedNow, addDays } from '@/lib/dates'
import RemindersSettings from '@/components/RemindersSettings'

export const dynamic = 'force-dynamic'

export default async function RemindersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings, error } = await supabase
    .from('notification_settings')
    .select('telegram_chat_id, enabled, timezone, morning_time, midday_time, evening_time, weekly_review_dow')
    .eq('user_id', user.id)
    .maybeSingle()

  const today = zonedNow(settings?.timezone ?? 'Europe/London').date
  const { data: study } = await supabase
    .from('study_sessions')
    .select('id, area, minutes, note, session_date')
    .eq('user_id', user.id)
    .gte('session_date', addDays(today, -42))
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <RemindersSettings
      userId={user.id}
      userEmail={user.email ?? ''}
      todayStr={today}
      initialSettings={settings ?? null}
      initialStudy={study ?? []}
      migrationMissing={!!error}
    />
  )
}
