'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────
interface TodoItem { text: string; done: boolean }
interface DayNotes { mon: string; tue: string; wed: string; thu: string; fri: string; sat: string; sun: string }
interface PlannerEntry {
  todos: TodoItem[]
  top_three: [string, string, string]
  day_notes: DayNotes
}
interface Habit { id: string; name: string; color: string; sort_order: number; created_at: string; archived_at: string | null }
interface Exercise {
  id: string
  exercise_date: string
  exercise_time: string
  duration_minutes: number
  type: string
  notes: string | null
  calendar_event_id: string | null
}
interface NewExercise {
  exercise_date: string
  exercise_time: string
  duration_minutes: number
  type: string
  notes: string
}

const EXERCISE_TYPES = ['Run', 'Gym', 'Yoga', 'Cycling', 'Swim', 'Walk', 'HIIT', 'Pilates', 'Other']

const DAYS: { key: keyof DayNotes; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]
const DAY_COLS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const TOP_THREE_COLORS = ['#C9B8D4', '#C8D8A8', '#E8DFA0']
const HABIT_COLORS = ['#C8D8A8', '#C9B8D4', '#E8DFA0', '#B8D4D8', '#F0C8A8', '#D4B8C8']

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addWeeks(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n * 7)
  return date
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function getDayDate(monday: Date, dayIndex: number): string {
  const d = new Date(monday)
  d.setDate(d.getDate() + dayIndex)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDayDateStr(monday: Date, dayIndex: number): string {
  const d = new Date(monday)
  d.setDate(d.getDate() + dayIndex)
  return toDateStr(d)
}

function emptyEntry(): PlannerEntry {
  return {
    todos: [{ text: '', done: false }],
    top_three: ['', '', ''],
    day_notes: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' },
  }
}

// ─── Main Component ───────────────────────────────────────────
export default function WeeklyPlanner({ userId }: { userId: string }) {
  const supabase = createClient()
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [entry, setEntry] = useState<PlannerEntry>(emptyEntry())
  const [habits, setHabits] = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Set<string>>(new Set())
  const [motivation, setMotivation] = useState<{ message: string; positive: boolean } | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [showExerciseForm, setShowExerciseForm] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [newExercise, setNewExercise] = useState<NewExercise>({
    exercise_date: toDateStr(new Date()),
    exercise_time: '07:00',
    duration_minutes: 60,
    type: 'Run',
    notes: '',
  })
  const [newHabitName, setNewHabitName] = useState('')
  const [showHabitInput, setShowHabitInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const weekKey = toDateStr(weekStart)

  // ── Load data for current week ──
  const loadWeekData = useCallback(async () => {
    const [entriesRes, habitsRes] = await Promise.all([
      supabase
        .from('weekly_planner_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekKey)
        .single(),
      supabase
        .from('weekly_habits')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    ])

    if (entriesRes.data) {
      setEntry({
        todos: entriesRes.data.todos ?? [{ text: '', done: false }],
        top_three: entriesRes.data.top_three ?? ['', '', ''],
        day_notes: entriesRes.data.day_notes ?? { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' },
      })
    } else {
      setEntry(emptyEntry())
    }

    // Only show habits that existed during this week:
    // created before the week ends AND (not archived OR archived after the week started)
    const weekEnd = toDateStr(addWeeks(weekStart, 1))
    const allHabits: Habit[] = habitsRes.data ?? []
    const visibleHabits = allHabits.filter(h => {
      const createdBefore = h.created_at.slice(0, 10) < weekEnd
      const notYetArchived = !h.archived_at || h.archived_at.slice(0, 10) >= weekKey
      return createdBefore && notYetArchived
    })
    setHabits(visibleHabits)

    // Load habit completions for this week
    const weekEndStr = toDateStr(addWeeks(weekStart, 1))
    const { data: comps } = await supabase
      .from('weekly_habit_completions')
      .select('habit_id, date')
      .eq('user_id', userId)
      .gte('date', weekKey)
      .lt('date', weekEndStr)

    const compSet = new Set<string>((comps ?? []).map(c => `${c.habit_id}:${c.date}`))
    setCompletions(compSet)

    // Load exercises for this week
    const { data: exs } = await supabase
      .from('weekly_exercises')
      .select('*')
      .eq('user_id', userId)
      .gte('exercise_date', weekKey)
      .lt('exercise_date', weekEndStr)
      .order('exercise_date', { ascending: true })
      .order('exercise_time', { ascending: true })
    setExercises(exs ?? [])
  }, [userId, weekKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadWeekData() }, [loadWeekData])

  // Check if Google Calendar is connected
  useEffect(() => {
    supabase
      .from('google_tokens')
      .select('id')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => setCalendarConnected(!!data))
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Motivation: compare current week habit % vs last 4 weeks ──
  const loadMotivation = useCallback(async () => {
    if (habits.length === 0) return

    const today = getMonday(new Date())
    const isCurrentWeek = toDateStr(weekStart) === toDateStr(today)
    if (!isCurrentWeek) { setMotivation(null); return }

    // Get last 4 week starts
    const pastWeeks = Array.from({ length: 4 }, (_, i) => toDateStr(addWeeks(today, -(i + 1))))
    const earliest = pastWeeks[pastWeeks.length - 1]

    const { data: pastComps } = await supabase
      .from('weekly_habit_completions')
      .select('habit_id, date')
      .eq('user_id', userId)
      .gte('date', earliest)
      .lt('date', toDateStr(today))

    if (!pastComps || pastComps.length === 0) { setMotivation(null); return }

    // Group completions by week
    const weekCounts: Record<string, number> = {}
    for (const comp of pastComps) {
      const d = new Date(comp.date)
      const wk = toDateStr(getMonday(d))
      weekCounts[wk] = (weekCounts[wk] ?? 0) + 1
    }

    const validWeeks = pastWeeks.filter(w => weekCounts[w] !== undefined)
    if (validWeeks.length === 0) { setMotivation(null); return }

    const maxPerWeek = habits.length * 7
    const avgCount = validWeeks.reduce((s, w) => s + (weekCounts[w] ?? 0), 0) / validWeeks.length
    const avgPct = Math.round((avgCount / maxPerWeek) * 100)

    // Current week completions (already loaded in state)
    const currentCount = completions.size
    const currentPct = Math.round((currentCount / maxPerWeek) * 100)

    if (currentPct >= avgPct) {
      setMotivation({
        message: `You're above your ${validWeeks.length}-week average (${avgPct}%) — keep it up! ✨`,
        positive: true,
      })
    } else {
      const diff = avgPct - currentPct
      setMotivation({
        message: `You're ${diff}% below your ${validWeeks.length}-week average (${avgPct}%) — you've got this! 💪`,
        positive: false,
      })
    }
  }, [habits, weekStart, completions, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMotivation() }, [loadMotivation])

  // ── Debounced save ──
  const scheduleSave = useCallback((updated: PlannerEntry) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await supabase.from('weekly_planner_entries').upsert({
        user_id: userId,
        week_start: weekKey,
        todos: updated.todos,
        top_three: updated.top_three,
        day_notes: updated.day_notes,
      }, { onConflict: 'user_id,week_start' })
      setSaving(false)
    }, 800)
  }, [userId, weekKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entry updaters ──
  const updateEntry = useCallback((patch: Partial<PlannerEntry>) => {
    setEntry(prev => {
      const next = { ...prev, ...patch }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // Todos
  const toggleTodo = (i: number) => {
    const todos = entry.todos.map((t, idx) => idx === i ? { ...t, done: !t.done } : t)
    updateEntry({ todos })
  }
  const setTodoText = (i: number, text: string) => {
    const todos = entry.todos.map((t, idx) => idx === i ? { ...t, text } : t)
    updateEntry({ todos })
  }
  const addTodo = () => updateEntry({ todos: [...entry.todos, { text: '', done: false }] })
  const removeTodo = (i: number) => {
    const todos = entry.todos.filter((_, idx) => idx !== i)
    updateEntry({ todos: todos.length ? todos : [{ text: '', done: false }] })
  }

  // Top Three
  const setTopThree = (i: number, val: string) => {
    const top_three = [...entry.top_three] as [string, string, string]
    top_three[i] = val
    updateEntry({ top_three })
  }

  // Day notes
  const setDayNote = (key: keyof DayNotes, val: string) => {
    updateEntry({ day_notes: { ...entry.day_notes, [key]: val } })
  }

  // ── Habit completions ──
  const toggleHabit = async (habitId: string, dayIndex: number) => {
    const date = getDayDateStr(weekStart, dayIndex)
    const key = `${habitId}:${date}`
    const checked = completions.has(key)

    // Optimistic
    setCompletions(prev => {
      const next = new Set(prev)
      checked ? next.delete(key) : next.add(key)
      return next
    })

    if (checked) {
      await supabase
        .from('weekly_habit_completions')
        .delete()
        .eq('user_id', userId)
        .eq('habit_id', habitId)
        .eq('date', date)
    } else {
      await supabase.from('weekly_habit_completions').insert({ user_id: userId, habit_id: habitId, date })
    }
  }

  // ── Habit management ──
  const addHabit = async () => {
    const name = newHabitName.trim()
    if (!name) return
    const color = HABIT_COLORS[habits.length % HABIT_COLORS.length]
    const { data } = await supabase
      .from('weekly_habits')
      .insert({ user_id: userId, name, color, sort_order: habits.length })
      .select()
      .single()
    if (data) setHabits(prev => [...prev, data])
    setNewHabitName('')
    setShowHabitInput(false)
  }

  const deleteHabit = async (id: string) => {
    // Soft-delete: set archived_at to start of current week so past weeks keep the habit
    const now = new Date().toISOString()
    await supabase.from('weekly_habits').update({ archived_at: now }).eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  // ── Exercises ──
  const addExercise = async () => {
    const { data } = await supabase
      .from('weekly_exercises')
      .insert({ user_id: userId, ...newExercise })
      .select()
      .single()
    if (data) {
      setExercises(prev => [...prev, data].sort((a, b) =>
        a.exercise_date.localeCompare(b.exercise_date) || a.exercise_time.localeCompare(b.exercise_time)
      ))
      setShowExerciseForm(false)
      setNewExercise({ exercise_date: toDateStr(new Date()), exercise_time: '07:00', duration_minutes: 60, type: 'Run', notes: '' })

      // Auto-create Google Calendar event if connected
      setCalendarError(null)
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      try {
        const res = await fetch('/api/calendar/create-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exerciseId: data.id,
            type: data.type,
            date: data.exercise_date,
            time: data.exercise_time.slice(0, 5),
            durationMinutes: data.duration_minutes,
            notes: data.notes,
            timeZone: tz,
          }),
        })
        const result = await res.json()
        if (result.eventId) {
          setExercises(prev => prev.map(e =>
            e.id === data.id ? { ...e, calendar_event_id: result.eventId } : e
          ))
          setCalendarConnected(true)
        } else if (result.error === 'not_connected') {
          setCalendarConnected(false)
        } else {
          setCalendarError(result.error ?? 'Calendar sync failed')
        }
      } catch (e) {
        setCalendarError('Could not reach calendar API')
      }
    }
  }

  const deleteExercise = async (ex: Exercise) => {
    await fetch('/api/calendar/delete-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId: ex.id, calendarEventId: ex.calendar_event_id }),
    })
    setExercises(prev => prev.filter(e => e.id !== ex.id))
  }

  const saveEditExercise = async (ex: Exercise, updated: NewExercise) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (ex.calendar_event_id) {
      await fetch('/api/calendar/update-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId: ex.id,
          calendarEventId: ex.calendar_event_id,
          type: updated.type,
          date: updated.exercise_date,
          time: updated.exercise_time,
          durationMinutes: updated.duration_minutes,
          notes: updated.notes,
          timeZone: tz,
        }),
      })
      setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, ...updated, exercise_time: updated.exercise_time } : e))
    } else {
      await supabase.from('weekly_exercises').update({
        type: updated.type, exercise_date: updated.exercise_date,
        exercise_time: updated.exercise_time, duration_minutes: updated.duration_minutes, notes: updated.notes,
      }).eq('id', ex.id)
      setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, ...updated } : e))
    }
    setEditingExercise(null)
  }

  // ── Week navigation ──
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(getMonday(new Date()))

  return (
    <section className="mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wide">Weekly Planner</h3>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-muted italic">saving…</span>}
          <button
            onClick={() => setWeekStart(w => addWeeks(w, -1))}
            className="w-7 h-7 flex items-center justify-center rounded-sm border border-border hover:border-ink transition-colors text-ink text-sm"
          >‹</button>
          <span className="text-sm text-muted font-mono min-w-[200px] text-center">{formatWeekRange(weekStart)}</span>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            disabled={isCurrentWeek}
            className="w-7 h-7 flex items-center justify-center rounded-sm border border-border hover:border-ink transition-colors text-ink text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >›</button>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(getMonday(new Date()))}
              className="text-xs px-2 py-1 rounded-sm border border-border hover:border-ink transition-colors text-muted"
            >Today</button>
          )}
        </div>
      </div>

      {/* Motivation banner */}
      {motivation && (
        <div
          className="mb-4 px-4 py-2.5 rounded-sm text-sm border"
          style={{
            backgroundColor: motivation.positive ? '#F0F7E8' : '#FEF9EC',
            borderColor: motivation.positive ? '#C8D8A8' : '#E8DFA0',
            color: motivation.positive ? '#4A6B2A' : '#7A6020',
          }}
        >
          {motivation.message}
        </div>
      )}

      {/* Planner grid */}
      <div className="border border-border rounded-sm overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr]">

        {/* ── Left column ── */}
        <div className="border-b md:border-b-0 md:border-r border-border flex flex-col divide-y divide-border">

          {/* To Do */}
          <div className="p-4">
            <p className="font-serif text-base text-muted mb-3 italic">to do</p>
            <div className="space-y-1.5">
              {entry.todos.map((todo, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleTodo(i)}
                    className="w-3.5 h-3.5 rounded-sm border-border flex-shrink-0 accent-[#B85C38]"
                  />
                  <input
                    type="text"
                    value={todo.text}
                    onChange={e => setTodoText(i, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTodo() }}
                    placeholder="…"
                    className={`flex-1 text-sm bg-transparent border-none outline-none placeholder-muted/40 ${todo.done ? 'line-through text-muted' : 'text-ink'}`}
                  />
                  <button
                    onClick={() => removeTodo(i)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink text-xs transition-opacity"
                  >×</button>
                </div>
              ))}
            </div>
            <button
              onClick={addTodo}
              className="mt-2 text-xs text-muted hover:text-ink transition-colors"
            >+ add item</button>
          </div>

          {/* Top Three */}
          <div className="p-4">
            <p className="font-serif text-base text-muted mb-3 italic">top three</p>
            <div className="space-y-2">
              {entry.top_three.map((val, i) => (
                <div
                  key={i}
                  className="rounded-sm px-3 py-2"
                  style={{ backgroundColor: TOP_THREE_COLORS[i] + '80' }}
                >
                  <input
                    type="text"
                    value={val}
                    onChange={e => setTopThree(i, e.target.value)}
                    placeholder={`Priority ${i + 1}…`}
                    className="w-full text-sm bg-transparent border-none outline-none placeholder-muted/40 text-ink"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Habit Tracker */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <p className="font-serif text-base text-muted italic">habit tracker</p>
              <button
                onClick={() => setShowHabitInput(v => !v)}
                className="text-xs text-muted hover:text-ink transition-colors"
              >+</button>
            </div>

            {showHabitInput && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newHabitName}
                  onChange={e => setNewHabitName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addHabit(); if (e.key === 'Escape') { setShowHabitInput(false); setNewHabitName('') } }}
                  placeholder="Habit name…"
                  autoFocus
                  className="flex-1 text-xs border border-border rounded-sm px-2 py-1 outline-none focus:border-ink bg-transparent"
                />
                <button onClick={addHabit} className="text-xs px-2 py-1 border border-border rounded-sm hover:border-ink">Add</button>
              </div>
            )}

            {habits.length === 0 ? (
              <p className="text-xs text-muted/60 italic">No habits yet. Add one above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left pr-2 pb-1 font-normal text-muted/60 w-full"></th>
                      {DAY_COLS.map((d, i) => (
                        <th key={i} className="text-center pb-1 font-normal text-muted/60 w-6">{d}</th>
                      ))}
                      <th className="w-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {habits.map(habit => (
                      <tr key={habit.id} className="group">
                        <td className="pr-2 py-1 text-ink truncate max-w-[110px]" title={habit.name}>{habit.name}</td>
                        {DAYS.map((_, dayIdx) => {
                          const date = getDayDateStr(weekStart, dayIdx)
                          const checked = completions.has(`${habit.id}:${date}`)
                          return (
                            <td key={dayIdx} className="text-center py-1">
                              <button
                                onClick={() => toggleHabit(habit.id, dayIdx)}
                                className="w-5 h-5 rounded-sm border transition-colors mx-auto flex items-center justify-center"
                                style={{
                                  backgroundColor: checked ? habit.color : 'transparent',
                                  borderColor: checked ? habit.color : '#D1C9C0',
                                }}
                              >
                                {checked && <span className="text-[9px] text-white/80 font-bold">✓</span>}
                              </button>
                            </td>
                          )
                        })}
                        <td className="pl-1">
                          <button
                            onClick={() => deleteHabit(habit.id)}
                            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted text-xs"
                          >×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: days ── */}
        <div className="divide-y divide-border">
          {DAYS.map(({ key, label }, i) => (
            <div key={key} className="flex items-stretch min-h-[72px]">
              <div
                className="w-24 md:w-28 flex-shrink-0 flex flex-col justify-center px-3 py-2 border-r border-border"
                style={{ backgroundColor: getDayBgColor(i) }}
              >
                <span className="font-serif text-sm italic text-ink/80">{label}</span>
                <span className="text-xs text-muted font-mono">{getDayDate(weekStart, i)}</span>
              </div>
              <textarea
                value={entry.day_notes[key]}
                onChange={e => setDayNote(key, e.target.value)}
                placeholder="Notes for the day…"
                rows={3}
                className="flex-1 resize-none bg-transparent text-base md:text-sm text-ink p-3 outline-none placeholder-muted/30 leading-relaxed"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Exercise section ── */}
      <div className="mt-4 border border-border rounded-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ backgroundColor: '#EDF3E8' }}>
          <p className="font-serif text-base italic text-ink/80">Exercise</p>
          <div className="flex items-center gap-2">
            {calendarConnected === false && (
              <a
                href="/api/auth/google"
                className="text-xs px-2.5 py-1 border border-border rounded-sm hover:border-ink transition-colors text-muted bg-white"
              >
                📅 Connect Google Calendar
              </a>
            )}
            {calendarConnected === true && (
              <span className="text-xs text-muted">📅 Calendar connected</span>
            )}
            <button
              onClick={() => setShowExerciseForm(v => !v)}
              className="text-xs px-2.5 py-1 border border-border rounded-sm hover:border-ink transition-colors text-ink bg-white"
            >
              + Plan workout
            </button>
          </div>
        </div>

        {/* Add exercise form */}
        {showExerciseForm && (
          <div className="p-4 border-b border-border bg-white grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Type</label>
              <select
                value={newExercise.type}
                onChange={e => setNewExercise(x => ({ ...x, type: e.target.value }))}
                className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent"
              >
                {EXERCISE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Date</label>
              <input
                type="date"
                value={newExercise.exercise_date}
                onChange={e => setNewExercise(x => ({ ...x, exercise_date: e.target.value }))}
                className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Time</label>
              <input
                type="time"
                value={newExercise.exercise_time}
                onChange={e => setNewExercise(x => ({ ...x, exercise_time: e.target.value }))}
                className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={newExercise.duration_minutes}
                min={5}
                step={5}
                onChange={e => setNewExercise(x => ({ ...x, duration_minutes: parseInt(e.target.value) || 60 }))}
                className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={newExercise.notes}
                onChange={e => setNewExercise(x => ({ ...x, notes: e.target.value }))}
                placeholder="e.g. 5km easy pace, leg day…"
                className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent"
              />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button
                onClick={() => setShowExerciseForm(false)}
                className="text-xs px-3 py-1.5 border border-border rounded-sm hover:border-ink text-muted"
              >Cancel</button>
              <button
                onClick={addExercise}
                className="text-xs px-3 py-1.5 rounded-sm text-white"
                style={{ backgroundColor: '#4A6B2A' }}
              >Save workout</button>
            </div>
          </div>
        )}

        {/* Calendar error */}
        {calendarError && (
          <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
            ⚠️ Calendar sync failed: {calendarError}
          </div>
        )}

        {/* Exercise list */}
        {exercises.length === 0 && !showExerciseForm ? (
          <div className="px-4 py-6 text-center text-sm text-muted/60 italic">No workouts planned for this week.</div>
        ) : (
          <div className="divide-y divide-border">
            {exercises.map(ex => (
              editingExercise?.id === ex.id ? (
                // ── Edit form ──
                <div key={ex.id} className="p-4 bg-white border-b border-border grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Type</label>
                    <select value={editingExercise.type} onChange={e => setEditingExercise(x => x ? { ...x, type: e.target.value } : x)}
                      className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent">
                      {EXERCISE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Date</label>
                    <input type="date" value={editingExercise.exercise_date}
                      onChange={e => setEditingExercise(x => x ? { ...x, exercise_date: e.target.value } : x)}
                      className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Time</label>
                    <input type="time" value={editingExercise.exercise_time.slice(0, 5)}
                      onChange={e => setEditingExercise(x => x ? { ...x, exercise_time: e.target.value } : x)}
                      className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Duration (min)</label>
                    <input type="number" value={editingExercise.duration_minutes} min={5} step={5}
                      onChange={e => setEditingExercise(x => x ? { ...x, duration_minutes: parseInt(e.target.value) || 60 } : x)}
                      className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted block mb-1">Notes</label>
                    <input type="text" value={editingExercise.notes ?? ''}
                      onChange={e => setEditingExercise(x => x ? { ...x, notes: e.target.value } : x)}
                      className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-transparent" />
                  </div>
                  <div className="col-span-2 flex gap-2 justify-end">
                    <button onClick={() => setEditingExercise(null)} className="text-xs px-3 py-1.5 border border-border rounded-sm text-muted">Cancel</button>
                    <button onClick={() => saveEditExercise(ex, { exercise_date: editingExercise.exercise_date, exercise_time: editingExercise.exercise_time, duration_minutes: editingExercise.duration_minutes, type: editingExercise.type, notes: editingExercise.notes ?? '' })}
                      className="text-xs px-3 py-1.5 rounded-sm text-white" style={{ backgroundColor: '#4A6B2A' }}>
                      {ex.calendar_event_id ? 'Save & update calendar' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                // ── Display row ──
                <div key={ex.id} className="flex items-center gap-4 px-4 py-3 group hover:bg-paper/50">
                  <div className="w-10 h-10 rounded-sm flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: '#EDF3E8' }}>
                    {exerciseEmoji(ex.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{ex.type}</span>
                      {ex.calendar_event_id && <span className="text-xs text-muted bg-paper px-1.5 py-0.5 rounded-sm border border-border">📅 on calendar</span>}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(ex.exercise_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}{formatTime(ex.exercise_time)}
                      {' · '}{ex.duration_minutes} min
                      {ex.notes && <span className="ml-1 text-muted/70">· {ex.notes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingExercise(ex)} className="text-xs text-muted hover:text-ink px-1">✎</button>
                    <button onClick={() => deleteExercise(ex)} className="text-xs text-muted hover:text-red-500 px-1">✕</button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function exerciseEmoji(type: string): string {
  const map: Record<string, string> = {
    Run: '🏃', Gym: '🏋️', Yoga: '🧘', Cycling: '🚴', Swim: '🏊',
    Walk: '🚶', HIIT: '⚡', Pilates: '🤸', Other: '💪',
  }
  return map[type] ?? '💪'
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')}${ampm}`
}

function getDayBgColor(dayIndex: number): string {
  const colors = [
    '#F5F0E8', // Mon - warm cream
    '#F5F0E8', // Tue
    '#F5F0E8', // Wed
    '#F5F0E8', // Thu
    '#EDF3E8', // Fri - light green tint
    '#EDE8F5', // Sat - light lavender
    '#E8EFF5', // Sun - light blue
  ]
  return colors[dayIndex] ?? '#F5F0E8'
}
