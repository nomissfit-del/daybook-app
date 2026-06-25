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

// Heatmap day status
export type DayStatus = 'empty' | 'complete' | 'missed'

export interface HeatmapDay {
  date: string   // 'YYYY-MM-DD'
  status: DayStatus
  dueCount: number
  completedCount: number
}
