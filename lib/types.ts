export type Dashboard = 'personal' | 'work'
export type RepeatType = 'daily' | 'weekly' | 'monthly' | 'once'

export interface ProjectFolder {
  id: string
  user_id: string
  name: string
  dashboard: Dashboard
  created_at: string
  tasks?: Task[]
  targets?: Target[]
}

export interface Task {
  id: string
  user_id: string
  project_folder_id: string
  title: string
  repeat_type: RepeatType
  repeat_config: {
    weekday?: number       // 0–6, for weekly tasks
    day_of_month?: number  // 1–31, for monthly tasks
    date?: string          // 'YYYY-MM-DD', for once tasks
  }
  created_at: string
  archived_at: string | null
}

export interface TaskCompletion {
  id: string
  user_id: string
  task_id: string
  completed_date: string  // 'YYYY-MM-DD'
  created_at: string
}

export interface Target {
  id: string
  user_id: string
  project_folder_id: string
  title: string
  target_value: number
  current_value: number
  unit: string | null
  created_at: string
}

// Derived type for a task enriched with today's completion status
export interface TaskWithStatus extends Task {
  completedToday: boolean
}

// ── Kanban board ────────────────────────────────────────────────
export type TicketStatus = 'todo' | 'in_progress' | 'done'
export type TicketPriority = 'low' | 'medium' | 'high'

export interface Subtask {
  id: string
  user_id: string
  ticket_id: string
  title: string
  done: boolean
  sort_order: number
  created_at: string
}

export interface Ticket {
  id: string
  user_id: string
  board_id: string       // project_folder.id
  title: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  deadline: string | null  // 'YYYY-MM-DD'
  sort_order: number
  created_at: string
  ticket_subtasks?: Subtask[]
}

// Heatmap day status
export type DayStatus = 'empty' | 'complete' | 'missed'

export interface HeatmapDay {
  date: string   // 'YYYY-MM-DD'
  status: DayStatus
  dueCount: number
  completedCount: number
}

// ── Goals ───────────────────────────────────────────────────────
export type GoalCategory = 'personal' | 'work'
export type GoalStatus = 'active' | 'on_hold' | 'achieved' | 'dropped'

export interface Milestone {
  id: string
  user_id: string
  goal_id: string
  title: string
  target_date: string | null  // 'YYYY-MM-DD'
  done: boolean
  done_at: string | null      // 'YYYY-MM-DD'
  sort_order: number
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  title: string
  why: string | null
  category: GoalCategory
  start_date: string  // 'YYYY-MM-DD'
  deadline: string    // 'YYYY-MM-DD'
  status: GoalStatus
  achieved_at: string | null
  created_at: string
  goal_milestones: Milestone[]
}

// How a goal is doing, derived from milestones, dates and status
export type GoalHealth =
  | 'on_track'
  | 'at_risk'
  | 'behind'
  | 'overdue'
  | 'not_started'
  | 'no_milestones'
  | 'on_hold'
  | 'achieved'
  | 'dropped'
