import type { SupabaseClient } from '@supabase/supabase-js'
import type { Goal } from '@/lib/types'
import { addDays, mondayOf } from '@/lib/dates'

export type Board = 'personal' | 'work'

export interface SnapHabit {
  id: string
  name: string
  dashboard: Board
  created_at: string
}

export interface SnapTodo { text: string; done: boolean }

export interface SnapPlanner {
  todos: SnapTodo[]
  top_three: string[]
}

export interface SnapTicket {
  id: string
  title: string
  deadline: string
  priority: 'low' | 'medium' | 'high'
  status: string
  board: string
}

export interface SnapExercise {
  type: string
  exercise_time: string
  duration_minutes: number
}

export interface SnapStudy {
  area: string
  minutes: number
  session_date: string
}

/** Everything the reminder messages need, read once per run */
export interface Snapshot {
  today: string
  weekKey: string                         // Monday of this week
  habits: SnapHabit[]
  done: Set<string>                       // `${habitId}:${date}` for the last ~70 days
  planner: Partial<Record<Board, SnapPlanner>>
  nextPlanner: Partial<Record<Board, SnapPlanner>>  // next week, for the Sunday review
  tickets: SnapTicket[]                   // open tickets with a deadline
  goals: Goal[]                           // active goals with milestones
  exercisesToday: SnapExercise[]
  study: SnapStudy[]                      // last 21 days
}

export async function collectSnapshot(db: SupabaseClient, userId: string, today: string): Promise<Snapshot> {
  const weekKey = mondayOf(today)
  const nextWeekKey = addDays(weekKey, 7)
  const since = addDays(today, -70)

  const [habitsRes, compRes, plannerRes, boardsRes, ticketsRes, goalsRes, exRes, studyRes] = await Promise.all([
    db.from('weekly_habits')
      .select('id, name, dashboard, created_at, archived_at, sort_order')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    db.from('weekly_habit_completions')
      .select('habit_id, date')
      .eq('user_id', userId)
      .gte('date', since),
    db.from('weekly_planner_entries')
      .select('week_start, dashboard, todos, top_three')
      .eq('user_id', userId)
      .in('week_start', [weekKey, nextWeekKey]),
    db.from('project_folders')
      .select('id, name')
      .eq('user_id', userId),
    db.from('tickets')
      .select('id, title, deadline, priority, status, board_id')
      .eq('user_id', userId)
      .neq('status', 'done')
      .not('deadline', 'is', null),
    db.from('goals')
      .select('*, goal_milestones(*)')
      .eq('user_id', userId)
      .eq('status', 'active'),
    db.from('weekly_exercises')
      .select('type, exercise_time, duration_minutes')
      .eq('user_id', userId)
      .eq('exercise_date', today)
      .order('exercise_time', { ascending: true }),
    db.from('study_sessions')
      .select('area, minutes, session_date')
      .eq('user_id', userId)
      .gte('session_date', addDays(today, -21)),
  ])

  for (const r of [habitsRes, compRes, plannerRes, boardsRes, ticketsRes, goalsRes, exRes]) {
    if (r.error) throw new Error(r.error.message)
  }

  const boardName = new Map<string, string>((boardsRes.data ?? []).map(b => [b.id, b.name]))

  const planner: Snapshot['planner'] = {}
  const nextPlanner: Snapshot['nextPlanner'] = {}
  for (const row of plannerRes.data ?? []) {
    const target = row.week_start === weekKey ? planner : nextPlanner
    target[row.dashboard as Board] = {
      todos: (row.todos ?? []) as SnapTodo[],
      top_three: (row.top_three ?? []) as string[],
    }
  }

  return {
    today,
    weekKey,
    habits: (habitsRes.data ?? []).map(h => ({
      id: h.id, name: h.name, dashboard: (h.dashboard ?? 'personal') as Board, created_at: h.created_at,
    })),
    done: new Set((compRes.data ?? []).map(c => `${c.habit_id}:${c.date}`)),
    planner,
    nextPlanner,
    tickets: (ticketsRes.data ?? []).map(t => ({
      id: t.id, title: t.title, deadline: t.deadline, priority: t.priority, status: t.status,
      board: boardName.get(t.board_id) ?? '',
    })),
    goals: (goalsRes.data ?? []) as Goal[],
    exercisesToday: (exRes.data ?? []) as SnapExercise[],
    // study_sessions may not exist yet if the migration has not run; treat as empty
    study: studyRes.error ? [] : ((studyRes.data ?? []) as SnapStudy[]),
  }
}
