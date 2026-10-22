import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { answerCallback, editButtons, esc, sendMessage, type ButtonRows } from '@/lib/telegram'
import { collectSnapshot } from '@/lib/notify/collect'
import { composeNow, composeWeeklyReview } from '@/lib/notify/compose'
import { zonedNow, longEs } from '@/lib/dates'

export const dynamic = 'force-dynamic'

interface TgUser { id: number }
interface TgChat { id: number }
interface TgMessage {
  message_id: number
  chat: TgChat
  from?: TgUser
  text?: string
  reply_markup?: { inline_keyboard: { text: string; callback_data?: string }[][] }
}
interface TgUpdate {
  message?: TgMessage
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage }
}

interface Linked { user_id: string; timezone: string; enabled: boolean }

const HELP = [
  '<b>Comandos de DayBook</b>',
  '/hoy · qué te queda hoy',
  '/estudio 45 Revenue Cloud · registra 45 min de estudio',
  '/estudio 30 Finanzas | fondo de emergencia · con nota',
  '/semana · revisión de la semana',
  '/pausa y /activar · parar o reanudar los avisos',
  '',
  'Los avisos llegan por la mañana, a mediodía y por la noche (horas en DayBook, pestaña Reminders). Los botones ✅ marcan cosas como hechas.',
].join('\n')

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = (await req.json()) as TgUpdate
  const db = createAdminClient()

  try {
    if (update.callback_query) await onCallback(db, update.callback_query)
    else if (update.message?.text) await onMessage(db, update.message)
  } catch (e) {
    console.error('telegram webhook', e)
  }
  // Always 200, otherwise Telegram keeps retrying the same update
  return NextResponse.json({ ok: true })
}

async function linkedUser(db: SupabaseClient, chatId: number): Promise<Linked | null> {
  const { data } = await db
    .from('notification_settings')
    .select('user_id, timezone, enabled')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  return data as Linked | null
}

// ── Text messages ───────────────────────────────────────────────

async function onMessage(db: SupabaseClient, msg: TgMessage) {
  const chatId = msg.chat.id
  const text = (msg.text ?? '').trim()
  const [rawCmd, ...rest] = text.split(/\s+/)
  const cmd = rawCmd.toLowerCase().replace(/@.*$/, '')
  const args = rest.join(' ')

  if (cmd === '/start') {
    if (args) return linkChat(db, chatId, args)
    const me = await linkedUser(db, chatId)
    return sendMessage(chatId, me ? HELP : 'Para conectar, abre DayBook, entra en <b>Reminders</b> y pulsa <b>Conectar Telegram</b>.')
  }

  const me = await linkedUser(db, chatId)
  if (!me) {
    return sendMessage(chatId, 'Este chat no está conectado a DayBook. Abre DayBook, entra en <b>Reminders</b> y pulsa <b>Conectar Telegram</b>.')
  }
  const today = zonedNow(me.timezone).date

  switch (cmd) {
    case '/hoy': {
      const m = composeNow(await collectSnapshot(db, me.user_id, today))
      return sendMessage(chatId, m.text, m.buttons)
    }
    case '/semana': {
      const m = composeWeeklyReview(await collectSnapshot(db, me.user_id, today))
      return sendMessage(chatId, m.text)
    }
    case '/estudio':
      return logStudy(db, chatId, me, today, args)
    case '/pausa':
      await db.from('notification_settings').update({ enabled: false }).eq('user_id', me.user_id)
      return sendMessage(chatId, '⏸ Avisos en pausa. Escribe /activar para volver.')
    case '/activar':
      await db.from('notification_settings').update({ enabled: true }).eq('user_id', me.user_id)
      return sendMessage(chatId, '▶️ Avisos activados.')
    default:
      return sendMessage(chatId, HELP)
  }
}

async function linkChat(db: SupabaseClient, chatId: number, code: string) {
  const { data: row } = await db
    .from('notification_settings')
    .select('user_id, link_code_expires_at')
    .eq('link_code', code)
    .maybeSingle()

  if (!row || !row.link_code_expires_at || new Date(row.link_code_expires_at) < new Date()) {
    return sendMessage(chatId, 'Ese enlace ha caducado. Vuelve a pulsar <b>Conectar Telegram</b> en DayBook.')
  }

  // A chat can only belong to one account
  await db.from('notification_settings').update({ telegram_chat_id: null }).eq('telegram_chat_id', chatId)
  await db.from('notification_settings').update({
    telegram_chat_id: chatId,
    link_code: null,
    link_code_expires_at: null,
    enabled: true,
    updated_at: new Date().toISOString(),
  }).eq('user_id', row.user_id)

  return sendMessage(chatId, `✅ <b>Conectado.</b> A partir de ahora te escribo cada día.\n\n${HELP}`)
}

async function logStudy(db: SupabaseClient, chatId: number, me: Linked, today: string, args: string) {
  // "/estudio 45 Revenue Cloud | pricing procedures"
  const match = args.match(/^(\d{1,4})\s*(?:min|m)?\s+([^|]+?)\s*(?:\|\s*(.+))?$/i)
  if (!match) {
    return sendMessage(chatId, 'Formato: <code>/estudio 45 Revenue Cloud</code> o <code>/estudio 45 Revenue Cloud | nota</code>')
  }
  const minutes = Number(match[1])
  const area = match[2].trim()
  const note = match[3]?.trim() || null
  if (minutes <= 0 || minutes > 1440) return sendMessage(chatId, 'Los minutos deben estar entre 1 y 1440.')

  // Reuse the spelling of an existing area ("revenue cloud" -> "Revenue Cloud")
  const { data: prev } = await db
    .from('study_sessions')
    .select('area')
    .eq('user_id', me.user_id)
    .ilike('area', area)
    .limit(1)
  const finalArea = prev?.[0]?.area ?? area

  const { error } = await db.from('study_sessions').insert({
    user_id: me.user_id, area: finalArea, minutes, note, session_date: today, source: 'telegram',
  })
  if (error) return sendMessage(chatId, `No he podido guardarlo: ${esc(error.message)}`)

  const { data: week } = await db
    .from('study_sessions')
    .select('minutes, session_date')
    .eq('user_id', me.user_id)
    .gte('session_date', mondayISO(today))
  const total = (week ?? []).reduce((a, x) => a + x.minutes, 0)
  return sendMessage(chatId, `📚 Guardado: ${minutes} min de <b>${esc(finalArea)}</b> (${longEs(today)}). Esta semana llevas ${total} min.`)
}

function mondayISO(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay()
  dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return dt.toISOString().slice(0, 10)
}

// ── Button presses ──────────────────────────────────────────────

async function onCallback(db: SupabaseClient, cb: NonNullable<TgUpdate['callback_query']>) {
  const chatId = cb.message?.chat.id ?? cb.from.id
  const me = await linkedUser(db, chatId)
  if (!me || !cb.data) return answerCallback(cb.id, 'Chat no conectado')

  const parts = cb.data.split('|')
  let reply = 'Hecho ✅'

  if (parts[0] === 'h' && parts.length === 3) {
    const [, habitId, date] = parts
    const { data: habit } = await db.from('weekly_habits').select('id').eq('id', habitId).eq('user_id', me.user_id).maybeSingle()
    if (!habit) return answerCallback(cb.id, 'Hábito no encontrado')
    const { error } = await db.from('weekly_habit_completions').insert({ user_id: me.user_id, habit_id: habitId, date })
    if (error && error.code !== '23505') reply = 'No se pudo guardar'
  } else if (parts[0] === 'k' && parts.length === 2) {
    const { error, count } = await db.from('tickets')
      .update({ status: 'done' }, { count: 'exact' })
      .eq('id', parts[1]).eq('user_id', me.user_id)
    if (error || !count) reply = 'Ticket no encontrado'
    else reply = 'Ticket cerrado ✅'
  } else if (parts[0] === 'm' && parts.length === 2) {
    const today = zonedNow(me.timezone).date
    const { error, count } = await db.from('goal_milestones')
      .update({ done: true, done_at: today }, { count: 'exact' })
      .eq('id', parts[1]).eq('user_id', me.user_id)
    if (error || !count) reply = 'Hito no encontrado'
    else reply = 'Hito completado 🎉'
  } else if (parts[0] === 't' && parts.length === 4) {
    const [, b, week, idx] = parts
    const dashboard = b === 'w' ? 'work' : 'personal'
    const { data: entry } = await db.from('weekly_planner_entries')
      .select('id, todos')
      .eq('user_id', me.user_id).eq('week_start', week).eq('dashboard', dashboard)
      .maybeSingle()
    const todos = (entry?.todos ?? []) as { text: string; done: boolean }[]
    const i = Number(idx)
    if (!entry || !todos[i]) {
      reply = 'Pendiente no encontrado'
    } else {
      todos[i] = { ...todos[i], done: true }
      await db.from('weekly_planner_entries').update({ todos }).eq('id', entry.id)
    }
  } else {
    reply = 'Acción desconocida'
  }

  await answerCallback(cb.id, reply)

  // Remove the pressed button from the message
  if (cb.message?.reply_markup) {
    const rows: ButtonRows = cb.message.reply_markup.inline_keyboard
      .map(r => r.filter(b => b.callback_data && b.callback_data !== cb.data)
        .map(b => ({ text: b.text, data: b.callback_data as string })))
      .filter(r => r.length > 0)
    await editButtons(chatId, cb.message.message_id, rows).catch(() => {})
  }
}
