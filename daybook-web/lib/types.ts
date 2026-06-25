export type Workspace = 'personal' | 'work';
export type Recurrence = 'daily' | 'weekly' | 'monthly';

export interface Project {
  id: string;
  user_id: string;
  workspace: Workspace;
  name: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  recurrence: Recurrence;
  day_of_week: number | null;
  day_of_month: number | null;
  archived: boolean;
  tracked: boolean;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  created_at: string;
}

export interface Target {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  unit: string | null;
  target_value: number;
  current_value: number;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;   // YYYY-MM-DD
  created_at: string;
}
