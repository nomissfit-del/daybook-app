-- Add dashboard column to weekly_habits
ALTER TABLE weekly_habits
  ADD COLUMN IF NOT EXISTS dashboard text NOT NULL DEFAULT 'personal'
  CHECK (dashboard IN ('personal', 'work'));

-- Add dashboard column to weekly_planner_entries
ALTER TABLE weekly_planner_entries
  ADD COLUMN IF NOT EXISTS dashboard text NOT NULL DEFAULT 'personal'
  CHECK (dashboard IN ('personal', 'work'));

-- The old unique constraint is on (user_id, week_start).
-- Drop it and replace with (user_id, week_start, dashboard) so personal and work can coexist.
ALTER TABLE weekly_planner_entries
  DROP CONSTRAINT IF EXISTS weekly_planner_entries_user_id_week_start_key;

ALTER TABLE weekly_planner_entries
  ADD CONSTRAINT weekly_planner_entries_user_id_week_start_dashboard_key
  UNIQUE (user_id, week_start, dashboard);

-- Add dashboard column to weekly_exercises
ALTER TABLE weekly_exercises
  ADD COLUMN IF NOT EXISTS dashboard text NOT NULL DEFAULT 'personal'
  CHECK (dashboard IN ('personal', 'work'));
