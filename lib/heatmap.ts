import { Task, TaskCompletion, HeatmapDay, DayStatus } from '@/lib/types'

/** Returns 'YYYY-MM-DD' for a given Date */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Today as 'YYYY-MM-DD' in local time */
export function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a 'YYYY-MM-DD' string into a local Date (midnight) */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Returns true if a task was due on the given date string */
export function isTaskDue(task: Task, dateStr: string): boolean {
  // Task must have been created on or before this date
  const createdDate = toDateString(new Date(task.created_at))
  if (dateStr < createdDate) return false
  // Task must not have been archived before this date
  if (task.archived_at && toDateString(new Date(task.archived_at)) <= dateStr) return false

  const date = parseDate(dateStr)
  const dow = date.getDay()   // 0=Sun … 6=Sat
  const dom = date.getDate()  // 1–31

  switch (task.repeat_type) {
    case 'daily':
      return true
    case 'weekly':
      return task.repeat_config.weekday === dow
    case 'monthly':
      return task.repeat_config.day_of_month === dom
    default:
      return false
  }
}

/**
 * Build a 365-day heatmap (most recent day last).
 */
export function buildHeatmap(
  tasks: Task[],
  completions: TaskCompletion[]
): HeatmapDay[] {
  // Build a completion lookup: task_id -> Set<dateStr>
  const completionMap: Record<string, Set<string>> = {}
  for (const c of completions) {
    if (!completionMap[c.task_id]) completionMap[c.task_id] = new Set()
    completionMap[c.task_id].add(c.completed_date)
  }

  const days: HeatmapDay[] = []
  const todayStr = today()
  const todayDate = parseDate(todayStr)

  for (let i = 364; i >= 0; i--) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const dueTasks = tasks.filter(t => isTaskDue(t, dateStr))
    const completedCount = dueTasks.filter(
      t => completionMap[t.id]?.has(dateStr)
    ).length

    let status: DayStatus
    if (dueTasks.length === 0) {
      status = 'empty'
    } else if (completedCount === dueTasks.length) {
      status = 'complete'
    } else {
      status = 'missed'
    }

    days.push({ date: dateStr, status, dueCount: dueTasks.length, completedCount })
  }

  return days
}
