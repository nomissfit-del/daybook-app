import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSlot, type SettingsRow } from '@/lib/notify/actions'
import { zonedNow } from '@/lib/dates'
import type { Slot } from '@/lib/notify/compose'
import { sendMessage } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// "Send me a test" button in Settings: sends the chosen reminder right now.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slot = 'morning' } = await req.json().catch(() => ({}))
  if (!['morning', 'midday', 'evening'].includes(slot)) {
    return NextResponse.json({ error: 'Bad slot' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: row } = await db.from('notification_settings').select('*').eq('user_id', user.id).single()
  if (!row?.telegram_chat_id) return NextResponse.json({ error: 'not_connected' }, { status: 400 })

  try {
    const today = zonedNow(row.timezone).date
    const msg = await sendSlot(db, row as SettingsRow, slot as Slot, today)
    if (!msg) await sendMessage(row.telegram_chat_id, '✅ Nada pendiente para el aviso de mediodía ahora mismo.')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
