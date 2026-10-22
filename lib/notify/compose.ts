// Pure functions that turn a Snapshot into Telegram messages.
// No I/O here, so this file can be tested with plain data.

import type { Button, ButtonRows } from '@/lib/telegram'
import { esc } from '@/lib/telegram'
import { addDays, daysBetween, dowOf, longEs, shortEs } from '@/lib/dates'
import { goalHealth, nextMilestone, milestoneProgress } from '@/lib/goals'
import type { Board, Snapshot, SnapHabit, SnapTicket } from './collect'

export interface Message { text: string; buttons: ButtonRows }
export type Slot = 'morning' | 'midday' | 'evening'

const BOARD_LABEL: Record<Board, string> = { personal: 'Personal', work: 'Work' }
const MAX_BUTTONS = 14

// ── Facts ───────────────────────────────────────────────────────

function habitDueOn(h: SnapHabit, date: string): boolean {
  if (h.created_at.slice(0, 10) > date) return false
  if (h.dashboard === 'work') {
    const dow = dowOf(date)
    return dow >= 1 && dow <= 5
  }
  return true
}

export function dueHabits(s: Snapshot, date: string): SnapHabit[] {
  return s.habits.filter(h => habitDueOn(h, date))
}

export function missingHabits(s: Snapshot, date: string): SnapHabit[] {
  return dueHabits(s, date).filter(h => !s.done.has(`${h.id}:${date}`))
}

/** Days in a row (ending yesterday, or today if already complete) with every due habit ticked */
export function habitStreak(s: Snapshot): number {
  let streak = 0
  let date = missingHabits(s, s.today).length === 0 && dueHabits(s, s.today).length > 0
    ? s.today
    : addDays(s.today, -1)
  for (let i = 0; i < 60; i++) {
    const due = dueHabits(s, date)
    if (due.length > 0) {
      if (due.some(h => !s.done.has(`${h.id}:${date}`))) break
      streak++
    }
    date = addDays(date, -1)
  }
  return streak
}

function weekHabitRate(s: Snapshot, monday: string, upTo: string): { done: number; due: number } {
  let done = 0, due = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i)
    if (d > upTo) break
    for (const h of dueHabits(s, d)) {
      due++
      if (s.done.has(`${h.id}:${d}`)) done++
    }
  }
  return { done, due }
}

function openTodos(s: Snapshot) {
  const out: { board: Board; index: number; text: string }[] = []
  for (const board of ['personal', 'work'] as Board[]) {
    const p = s.planner[board]
    if (!p) continue
    p.todos.forEach((t, index) => {
      if (!t.done && t.text.trim()) out.push({ board, index, text: t.text.trim() })
    })
  }
  return out
}

function topThree(s: Snapshot, board: Board, next = false): string[] {
  const p = (next ? s.nextPlanner : s.planner)[board]
  return (p?.top_three ?? []).map(x => (x ?? '').trim()).filter(Boolean)
}

function ticketsBy(s: Snapshot) {
  const overdue = s.tickets.filter(t => t.deadline < s.today)
  const today = s.tickets.filter(t => t.deadline === s.today)
  const soon = s.tickets.filter(t => t.deadline > s.today && t.deadline <= addDays(s.today, 2))
  const byDate = (a: SnapTicket, b: SnapTicket) => a.deadline.localeCompare(b.deadline)
  return { overdue: overdue.sort(byDate), today, soon: soon.sort(byDate) }
}

function milestonesBy(s: Snapshot) {
  const overdue: { id: string; title: string; goal: string; date: string }[] = []
  const soon: typeof overdue = []
  for (const g of s.goals) {
    for (const m of g.goal_milestones ?? []) {
      if (m.done || !m.target_date) continue
      const item = { id: m.id, title: m.title, goal: g.title, date: m.target_date }
      if (m.target_date < s.today) overdue.push(item)
      else if (m.target_date <= addDays(s.today, 7)) soon.push(item)
    }
  }
  return { overdue, soon }
}

function goalsNeedingAttention(s: Snapshot) {
  return s.goals
    .map(g => ({ g, health: goalHealth(g, s.today) }))
    .filter(x => x.health === 'at_risk' || x.health === 'behind' || x.health === 'overdue')
}

const HEALTH_ES: Record<string, string> = {
  at_risk: 'en riesgo', behind: 'retrasado', overdue: 'vencido',
}

function studyMinutes(s: Snapshot, from: string, to: string) {
  const byArea = new Map<string, number>()
  let total = 0
  for (const x of s.study) {
    if (x.session_date < from || x.session_date > to) continue
    byArea.set(x.area, (byArea.get(x.area) ?? 0) + x.minutes)
    total += x.minutes
  }
  return { total, byArea }
}

function lastStudyDate(s: Snapshot): string | null {
  return s.study.reduce<string | null>((acc, x) => (!acc || x.session_date > acc ? x.session_date : acc), null)
}

function fmtMin(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ── Buttons ─────────────────────────────────────────────────────

function pairs(btns: Button[]): ButtonRows {
  const rows: ButtonRows = []
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2))
  return rows
}

function habitButtons(habits: SnapHabit[], date: string, suffix = ''): Button[] {
  return habits.map(h => ({ text: `✅ ${trunc(h.name, 22)}${suffix}`, data: `h|${h.id}|${date}` }))
}

function cap(btns: Button[]): Button[] {
  return btns.slice(0, MAX_BUTTONS)
}

// ── Sections ────────────────────────────────────────────────────

function habitLine(list: SnapHabit[]): string {
  return list.map(h => esc(h.name)).join(', ')
}

function ticketLine(t: SnapTicket): string {
  const pr = t.priority === 'high' ? '🔴 ' : ''
  const board = t.board ? ` <i>(${esc(t.board)})</i>` : ''
  return `${pr}${esc(t.title)}${board}`
}

// ── Messages ────────────────────────────────────────────────────

export function composeMorning(s: Snapshot): Message {
  const lines: string[] = []
  const btns: Button[] = []
  const dow = dowOf(s.today)
  const yesterday = addDays(s.today, -1)

  lines.push(`☀️ <b>Buenos días, David.</b> Plan para el ${longEs(s.today)}`)

  // Yesterday's accountability
  const missedY = missingHabits(s, yesterday)
  if (missedY.length > 0) {
    lines.push('', `⚠️ <b>Ayer se quedó sin marcar:</b> ${habitLine(missedY)}`,
      'Si lo hiciste, márcalo abajo. Si no, hoy toca recuperar el ritmo.')
    btns.push(...habitButtons(missedY, yesterday, ' (ayer)'))
  }

  const streak = habitStreak(s)
  if (streak >= 2) lines.push('', `🔥 Racha de ${streak} días cumpliendo todos tus hábitos. No la rompas.`)

  // Today's habits
  const due = dueHabits(s, s.today)
  if (due.length > 0) {
    lines.push('', `<b>Hábitos de hoy (${due.length})</b>`)
    for (const b of ['personal', 'work'] as Board[]) {
      const list = due.filter(h => h.dashboard === b)
      if (list.length) lines.push(`${BOARD_LABEL[b]}: ${habitLine(list)}`)
    }
  }

  if (s.exercisesToday.length) {
    lines.push('', '<b>Entreno de hoy</b>')
    for (const e of s.exercisesToday) {
      lines.push(`${esc(e.type)} a las ${e.exercise_time.slice(0, 5)} (${e.duration_minutes} min)`)
    }
  }

  // Top three
  const boards: Board[] = dow === 0 || dow === 6 ? ['personal'] : ['personal', 'work']
  for (const b of boards) {
    const top = topThree(s, b)
    if (top.length) {
      lines.push('', `🎯 <b>Top three ${BOARD_LABEL[b]}</b>`, ...top.map((t, i) => `${i + 1}. ${esc(t)}`))
    } else if (dow >= 1 && dow <= 3) {
      lines.push('', `🎯 <b>No has fijado tu Top three ${BOARD_LABEL[b]} de esta semana.</b> Hazlo ahora en DayBook: sin prioridades claras, la semana se te va.`)
    }
  }

  // Tickets
  const tk = ticketsBy(s)
  if (tk.overdue.length || tk.today.length || tk.soon.length) {
    lines.push('', '<b>Tickets con deadline</b>')
    for (const t of tk.overdue) lines.push(`❗ ${ticketLine(t)}: vencido hace ${daysBetween(t.deadline, s.today)} d`)
    for (const t of tk.today) lines.push(`⏰ ${ticketLine(t)}: vence hoy`)
    for (const t of tk.soon) lines.push(`• ${ticketLine(t)}: ${shortEs(t.deadline)}`)
  }

  // Goals
  const ms = milestonesBy(s)
  const att = goalsNeedingAttention(s)
  if (ms.overdue.length || ms.soon.length || att.length) {
    lines.push('', '<b>Goals</b>')
    for (const m of ms.overdue) lines.push(`❗ Hito vencido: ${esc(m.title)} <i>(${esc(m.goal)}, ${shortEs(m.date)})</i>`)
    for (const m of ms.soon) lines.push(`• Hito esta semana: ${esc(m.title)} <i>(${esc(m.goal)}, ${shortEs(m.date)})</i>`)
    for (const { g, health } of att) {
      const nm = nextMilestone(g.goal_milestones ?? [])
      lines.push(`⚠️ ${esc(g.title)} va ${HEALTH_ES[health]}${nm ? `. Siguiente paso: ${esc(nm.title)}` : ''}`)
    }
    btns.push(...ms.overdue.map(m => ({ text: `✔ Hito: ${trunc(m.title, 24)}`, data: `m|${m.id}` })))
  }

  // Study coach
  const last = lastStudyDate(s)
  const gap = last ? daysBetween(last, s.today) : null
  if (gap === null) {
    lines.push('', '📚 Aún no has registrado estudio. Cuando estudies, escribe por ejemplo <code>/estudio 45 Revenue Cloud</code>.')
  } else if (gap >= 2) {
    lines.push('', `📚 Llevas ${gap} días sin registrar estudio. Reserva hoy un bloque, aunque sean 30 minutos.`)
  }

  if (lines.length === 1) lines.push('', 'No tienes nada pendiente registrado. Buen momento para planificar la semana en DayBook.')

  return { text: lines.join('\n'), buttons: pairs(cap(btns)) }
}

/** Midday nudge: only what is still open today. Returns null when there is nothing to say. */
export function composeMidday(s: Snapshot): Message | null {
  const lines: string[] = []
  const btns: Button[] = []
  const missing = missingHabits(s, s.today)
  const tk = ticketsBy(s)

  if (!missing.length && !tk.today.length && !tk.overdue.length) return null

  lines.push('🕐 <b>Mitad del día.</b> Esto sigue abierto:')
  if (missing.length) {
    lines.push('', `<b>Hábitos (${missing.length})</b>: ${habitLine(missing)}`)
    btns.push(...habitButtons(missing, s.today))
  }
  if (tk.today.length || tk.overdue.length) {
    lines.push('', '<b>Tickets</b>')
    for (const t of tk.overdue) lines.push(`❗ ${ticketLine(t)}: vencido`)
    for (const t of tk.today) lines.push(`⏰ ${ticketLine(t)}: vence hoy`)
    btns.push(...[...tk.overdue, ...tk.today].map(t => ({ text: `✔ ${trunc(t.title, 26)}`, data: `k|${t.id}` })))
  }
  lines.push('', 'Elige una cosa y hazla ahora.')
  return { text: lines.join('\n'), buttons: pairs(cap(btns)) }
}

export function composeEvening(s: Snapshot, reviewDow = 0): Message {
  const lines: string[] = []
  const btns: Button[] = []
  const due = dueHabits(s, s.today)
  const missing = missingHabits(s, s.today)
  const doneCount = due.length - missing.length

  lines.push(`🌙 <b>Cierre del día</b> (${longEs(s.today)})`)

  if (due.length) {
    if (!missing.length) {
      lines.push('', `✅ Hábitos: ${doneCount}/${due.length}. Día completo, bien hecho.`)
    } else {
      lines.push('', `Hábitos: ${doneCount}/${due.length}. <b>Te falta:</b> ${habitLine(missing)}`,
        'Si ya lo hiciste, márcalo. Si no, aún estás a tiempo para alguno.')
      btns.push(...habitButtons(missing, s.today))
    }
  }

  const tk = ticketsBy(s)
  if (tk.overdue.length || tk.today.length) {
    lines.push('', '<b>Tickets sin cerrar</b>')
    for (const t of [...tk.overdue, ...tk.today]) lines.push(`❗ ${ticketLine(t)} (${shortEs(t.deadline)})`)
    lines.push('Si ya están hechos, ciérralos. Si no, cambia la fecha en DayBook a una realista.')
    btns.push(...[...tk.overdue, ...tk.today].map(t => ({ text: `✔ ${trunc(t.title, 26)}`, data: `k|${t.id}` })))
  }

  const todos = openTodos(s)
  if (todos.length) {
    lines.push('', `<b>Pendientes de la semana (${todos.length})</b>`)
    for (const t of todos.slice(0, 6)) lines.push(`• ${esc(t.text)}`)
    if (todos.length > 6) lines.push(`… y ${todos.length - 6} más`)
    btns.push(...todos.slice(0, 4).map(t => ({
      text: `✔ ${trunc(t.text, 26)}`, data: `t|${t.board === 'work' ? 'w' : 'p'}|${s.weekKey}|${t.index}`,
    })))
  }

  const studiedToday = s.study.filter(x => x.session_date === s.today).reduce((a, x) => a + x.minutes, 0)
  lines.push('', studiedToday
    ? `📚 Hoy has estudiado ${fmtMin(studiedToday)}.`
    : '📚 ¿Has estudiado hoy? Regístralo: <code>/estudio 30 Área</code>')

  const msg = { text: lines.join('\n'), buttons: pairs(cap(btns)) }
  if (dowOf(s.today) === reviewDow) msg.text += '\n\n' + composeWeeklyReview(s).text
  return msg
}

export function composeWeeklyReview(s: Snapshot): Message {
  const lines: string[] = []
  const lastMonday = addDays(s.weekKey, -7)

  lines.push('📊 <b>Revisión semanal</b>')

  const now = weekHabitRate(s, s.weekKey, s.today)
  const prev = weekHabitRate(s, lastMonday, addDays(lastMonday, 6))
  if (now.due) {
    const pct = Math.round((now.done / now.due) * 100)
    const prevPct = prev.due ? Math.round((prev.done / prev.due) * 100) : null
    const trend = prevPct === null ? '' : pct > prevPct ? ` (▲ desde ${prevPct}%)` : pct < prevPct ? ` (▼ desde ${prevPct}%)` : ' (igual que la semana pasada)'
    lines.push('', `Hábitos: <b>${pct}%</b> cumplidos${trend}`)

    const weak = s.habits
      .map(h => {
        let d = 0, n = 0
        for (let i = 0; i < 7; i++) {
          const day = addDays(s.weekKey, i)
          if (day > s.today || !habitDueOn(h, day)) continue
          n++
          if (s.done.has(`${h.id}:${day}`)) d++
        }
        return { h, d, n }
      })
      .filter(x => x.n > 0 && x.d / x.n < 0.6)
    if (weak.length) lines.push(`Flojos: ${weak.map(x => `${esc(x.h.name)} ${x.d}/${x.n}`).join(', ')}`)
  }

  const st = studyMinutes(s, s.weekKey, s.today)
  const stPrev = studyMinutes(s, lastMonday, addDays(lastMonday, 6))
  lines.push('', `📚 Estudio: <b>${fmtMin(st.total)}</b> esta semana${stPrev.total ? ` (semana pasada ${fmtMin(stPrev.total)})` : ''}`)
  for (const [area, m] of [...st.byArea.entries()].sort((a, b) => b[1] - a[1])) lines.push(`• ${esc(area)}: ${fmtMin(m)}`)

  if (s.goals.length) {
    lines.push('', '<b>Goals</b>')
    for (const g of s.goals) {
      const h = goalHealth(g, s.today)
      const { done, total } = milestoneProgress(g.goal_milestones ?? [])
      const icon = h === 'on_track' ? '🟢' : h === 'at_risk' ? '🟠' : h === 'behind' || h === 'overdue' ? '🔴' : '⚪'
      lines.push(`${icon} ${esc(g.title)}: ${done}/${total} hitos, deadline ${shortEs(g.deadline)}`)
    }
  }

  const tk = ticketsBy(s)
  if (tk.overdue.length) lines.push('', `❗ ${tk.overdue.length} ticket(s) vencidos. Ciérralos o replanifícalos.`)

  const missingTop = (['personal', 'work'] as Board[]).filter(b => topThree(s, b, true).length === 0)
  lines.push('', missingTop.length
    ? `🎯 <b>Antes de dormir:</b> fija el Top three de la semana que viene (${missingTop.map(b => BOARD_LABEL[b]).join(' y ')}) en DayBook.`
    : '🎯 Top three de la semana que viene listo. Buen trabajo.')

  return { text: lines.join('\n'), buttons: [] }
}

/** On demand status for /hoy */
export function composeNow(s: Snapshot): Message {
  return composeMidday(s) ?? { text: '✅ Todo al día por ahora. Nada pendiente para hoy.', buttons: [] }
}

export function composeSlot(slot: Slot, s: Snapshot, reviewDow = 0): Message | null {
  if (slot === 'morning') return composeMorning(s)
  if (slot === 'midday') return composeMidday(s)
  return composeEvening(s, reviewDow)
}
