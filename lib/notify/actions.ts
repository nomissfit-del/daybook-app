import type { SupabaseClient } from '@supabase/supabase-js'
import { collectSnapshot } from './collect'
import { composeSlot, type Slot, type Message } from './compose'
import { sendMessage } from '@/lib/telegram'
import { zonedNow, timeToMinutes } from '@/lib/dates'

export interface SettingsRow {
  user_id: string
  telegram_chat_id: number | null
  enabled: boolean
  timezone: string
  morning_time: string
  midday_time: string | null
  evening_time: string
  weekly_review_dow: number
}

/** How long after the scheduled time a missed run may still send (minutes) */
const CATCH_UP_WINDOW = 120

export function dueSlots(row: SettingsRow, at: Date = new Date()): { slot: Slot; date: string }[] {
  const now = zonedNow(row.timezone, at)
  const slots: [Slot, string | null][] = [
    ['morning', row.morning_time],
    ['midday', row.midday_time],
    ['evening', row.evening_time],
  ]
  return slots
    .filter(([, t]) => t !== null)
    .filter(([, t]) => {
      const m = timeToMinutes(t as string)
      return now.minutes >= m && now.minutes < m + CATCH_UP_WINDOW
    })
    .map(([slot]) => ({ slot, date: now.date }))
}

/** Build and send one reminder. Returns what was sent (null when nothing to say). */
export async function sendSlot(db: SupabaseClient, row: SettingsRow, slot: Slot, date: string): Promise<Message | null> {
  if (!row.telegram_chat_id) return null
  const snap = await collectSnapshot(db, row.user_id, date)
  const msg = composeSlot(slot, snap, row.weekly_review_dow ?? 0)
  if (msg) await sendMessage(row.telegram_chat_id, msg.text, msg.buttons)
  return msg
}

/**
 * Called by the scheduler every 15 minutes. Sends each reminder once per day:
 * the log row is claimed first (unique per user, slot, date), and released
 * again if sending fails so the next run retries.
 */
export async function runDue(db: SupabaseClient, at: Date = new Date()) {
  const { data: rows, error } = await db
    .from('notification_settings')
    .select('*')
    .eq('enabled', true)
    .not('telegram_chat_id', 'is', null)
  if (error) throw new Error(error.message)

  const results: { user: string; slot: Slot; status: string }[] = []

  for (const row of (rows ?? []) as SettingsRow[]) {
    for (const { slot, date } of dueSlots(row, at)) {
      const claim = await db
        .from('notification_log')
        .insert({ user_id: row.user_id, slot, local_date: date })
        .select('id')
        .single()
      if (claim.error) {
        // 23505 = already sent today
        results.push({ user: row.user_id, slot, status: claim.error.code === '23505' ? 'already_sent' : `error: ${claim.error.message}` })
        continue
      }
      try {
        const msg = await sendSlot(db, row, slot, date)
        results.push({ user: row.user_id, slot, status: msg ? 'sent' : 'nothing_to_say' })
      } catch (e) {
        await db.from('notification_log').delete().eq('id', claim.data.id)
        results.push({ user: row.user_id, slot, status: `error: ${(e as Error).message}` })
      }
    }
  }
  return results
}
