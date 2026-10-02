import type { Goal, GoalCategory, GoalHealth, GoalStatus, Milestone } from '@/lib/types'

export const GOALS_ACCENT = '#3F6E4F'
export const GOALS_ACCENT_LIGHT = '#E2ECDF'

export const CATEGORY_META: Record<GoalCategory, { label: string; color: string; bg: string }> = {
  personal: { label: 'Personal', color: '#B85C38', bg: '#F5E6DF' },
  work:     { label: 'Work',     color: '#1B3A6B', bg: '#DDE6F2' },
}

export const STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Active',
  on_hold: 'On hold',
  achieved: 'Achieved',
  dropped: 'Dropped',
}

export const HEALTH_META: Record<GoalHealth, { label: string; color: string; bg: string }> = {
  on_track:      { label: 'On track',      color: '#2F6B43', bg: '#DCEFE0' },
  at_risk:       { label: 'At risk',       color: '#9A5B05', bg: '#FCEFD6' },
  behind:        { label: 'Behind',        color: '#B42318', bg: '#FBE2DF' },
  overdue:       { label: 'Overdue',       color: '#FFFFFF', bg: '#B42318' },
  not_started:   { label: 'Not started',   color: '#5B6472', bg: '#ECEEF1' },
  no_milestones: { label: 'No milestones', color: '#8C7B6A', bg: '#F1EADD' },
  on_hold:       { label: 'On hold',       color: '#5B6472', bg: '#ECEEF1' },
  achieved:      { label: 'Achieved',      color: '#FFFFFF', bg: '#3F6E4F' },
  dropped:       { label: 'Dropped',       color: '#8C7B6A', bg: '#F1EADD' },
}

/** Parse 'YYYY-MM-DD' as a local midnight Date */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from a to b (b minus a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)
}

export function formatDate(s: string): string {
  return parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatShortDate(s: string): string {
  return parseDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function sortMilestones(ms: Milestone[]): Milestone[] {
  return [...ms].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
}

/** First milestone not yet done, in the user's order */
export function nextMilestone(ms: Milestone[]): Milestone | null {
  return sortMilestones(ms).find(m => !m.done) ?? null
}

export function milestoneProgress(ms: Milestone[]) {
  const total = ms.length
  const done = ms.filter(m => m.done).length
  return { total, done, pct: total === 0 ? 0 : done / total }
}

/** Share of the goal's time window already used, clamped to 0..1 */
export function timeElapsed(goal: Pick<Goal, 'start_date' | 'deadline'>, today: string): number {
  const span = daysBetween(goal.start_date, goal.deadline)
  if (span <= 0) return today >= goal.deadline ? 1 : 0
  const used = daysBetween(goal.start_date, today)
  return Math.min(1, Math.max(0, used / span))
}

/**
 * On track logic: compare milestone progress with time used.
 * A milestone past its own target date also counts as falling behind.
 */
export function goalHealth(goal: Goal, today: string): GoalHealth {
  if (goal.status === 'achieved') return 'achieved'
  if (goal.status === 'dropped') return 'dropped'
  if (goal.status === 'on_hold') return 'on_hold'
  if (today > goal.deadline) return 'overdue'
  if (today < goal.start_date) return 'not_started'

  const ms = goal.goal_milestones ?? []
  if (ms.length === 0) return 'no_milestones'

  const { pct } = milestoneProgress(ms)
  const elapsed = timeElapsed(goal, today)
  const gap = elapsed - pct
  const missedMilestone = ms.some(m => !m.done && m.target_date && m.target_date < today)

  if (gap > 0.25 || (missedMilestone && gap > 0.1)) return 'behind'
  if (gap > 0.1 || missedMilestone) return 'at_risk'
  return 'on_track'
}

export function deadlineLabel(goal: Goal, today: string): { text: string; tone: 'muted' | 'warn' | 'danger' | 'good' } {
  if (goal.status === 'achieved') {
    const when = goal.achieved_at ? formatDate(goal.achieved_at.slice(0, 10)) : formatDate(goal.deadline)
    return { text: `Achieved ${when}`, tone: 'good' }
  }
  if (goal.status === 'dropped') return { text: 'Dropped', tone: 'muted' }

  const d = daysBetween(today, goal.deadline)
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, tone: 'danger' }
  if (d === 0) return { text: 'Due today', tone: 'danger' }
  const text = d === 1 ? '1 day left' : `${d} days left`
  return { text, tone: d <= 14 ? 'warn' : 'muted' }
}

export const TONE_COLORS = {
  muted: '#8C7B6A',
  warn: '#B45309',
  danger: '#B42318',
  good: '#3F6E4F',
} as const

/** Health values that mean the goal needs attention */
export const ATTENTION: GoalHealth[] = ['at_risk', 'behind', 'overdue']
