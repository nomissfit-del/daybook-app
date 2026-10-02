/* ============================================================
   Goals: long term goals with deadlines and milestones
   Run this in your Supabase SQL Editor.
   ============================================================ */

CREATE TABLE IF NOT EXISTS goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        text NOT NULL,
  why          text,
  category     text NOT NULL DEFAULT 'personal'
               CHECK (category IN ('personal', 'work')),
  start_date   date NOT NULL DEFAULT CURRENT_DATE,
  deadline     date NOT NULL,
  status       text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'on_hold', 'achieved', 'dropped')),
  achieved_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  CHECK (deadline >= start_date)
);

CREATE TABLE IF NOT EXISTS goal_milestones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id      uuid REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  title        text NOT NULL,
  target_date  date,
  done         boolean NOT NULL DEFAULT false,
  done_at      date,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
  ON goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own goal milestones"
  ON goal_milestones FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal ON goal_milestones(goal_id);
