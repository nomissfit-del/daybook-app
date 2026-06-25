-- ============================================================
-- Daybook Schema
-- Run this in your Supabase SQL Editor to set up all tables.
-- ============================================================

-- Project Folders
CREATE TABLE IF NOT EXISTS project_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  dashboard   text NOT NULL CHECK (dashboard IN ('personal', 'work')),
  created_at  timestamptz DEFAULT now()
);

-- Tasks (recurring)
-- repeat_type: 'daily' | 'weekly' | 'monthly'
-- repeat_config for weekly:  { "weekday": 1 }   (0=Sun … 6=Sat)
-- repeat_config for monthly: { "day_of_month": 15 }
CREATE TABLE IF NOT EXISTS tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_folder_id   uuid REFERENCES project_folders(id) ON DELETE CASCADE NOT NULL,
  title               text NOT NULL,
  repeat_type         text NOT NULL CHECK (repeat_type IN ('daily', 'weekly', 'monthly')),
  repeat_config       jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now(),
  archived_at         timestamptz
);

-- Task completions (one row per task per day it was checked off)
CREATE TABLE IF NOT EXISTS task_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id         uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  completed_date  date NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(task_id, completed_date)
);

-- Targets (manual-progress goals)
CREATE TABLE IF NOT EXISTS targets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_folder_id   uuid REFERENCES project_folders(id) ON DELETE CASCADE NOT NULL,
  title               text NOT NULL,
  target_value        numeric NOT NULL,
  current_value       numeric DEFAULT 0,
  unit                text,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- Row-Level Security
-- Each user can only see and modify their own rows.
-- ============================================================

ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

-- project_folders
CREATE POLICY "Users manage own folders"
  ON project_folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tasks
CREATE POLICY "Users manage own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- task_completions
CREATE POLICY "Users manage own completions"
  ON task_completions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- targets
CREATE POLICY "Users manage own targets"
  ON targets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Indexes for common queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_folder ON tasks(project_folder_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_task_date ON task_completions(task_id, completed_date);
CREATE INDEX IF NOT EXISTS idx_completions_user ON task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_folder ON targets(project_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_dashboard ON project_folders(user_id, dashboard);

-- ============================================================
-- Weekly Planner
-- ============================================================

-- One entry per user per week (todos, top three, day notes)
CREATE TABLE IF NOT EXISTS weekly_planner_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start  date NOT NULL,  -- Monday of the week
  todos       jsonb NOT NULL DEFAULT '[]',       -- [{text: string, done: boolean}]
  top_three   jsonb NOT NULL DEFAULT '["","",""]', -- [string, string, string]
  day_notes   jsonb NOT NULL DEFAULT '{}',       -- {mon: string, tue: ..., sun: string}
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Habits to track (user-defined list)
CREATE TABLE IF NOT EXISTS weekly_habits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#C8D8A8',
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Daily habit completions
CREATE TABLE IF NOT EXISTS weekly_habit_completions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  habit_id    uuid REFERENCES weekly_habits(id) ON DELETE CASCADE NOT NULL,
  date        date NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, habit_id, date)
);

ALTER TABLE weekly_planner_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weekly planner entries"
  ON weekly_planner_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own weekly habits"
  ON weekly_habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own weekly habit completions"
  ON weekly_habit_completions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_entries_user_week ON weekly_planner_entries(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_habits_user ON weekly_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_habit_completions_user ON weekly_habit_completions(user_id, date);
