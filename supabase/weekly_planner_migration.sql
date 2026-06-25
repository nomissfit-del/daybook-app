-- Weekly planner entries (todos, top three, day notes per week)
CREATE TABLE IF NOT EXISTS weekly_planner_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start  date NOT NULL,
  todos       jsonb NOT NULL DEFAULT '[]',
  top_three   jsonb NOT NULL DEFAULT '["","",""]',
  day_notes   jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Habits to track
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
