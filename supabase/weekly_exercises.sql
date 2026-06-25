CREATE TABLE IF NOT EXISTS weekly_exercises (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_date       date NOT NULL,
  exercise_time       time NOT NULL,
  duration_minutes    int NOT NULL DEFAULT 60,
  type                text NOT NULL,
  notes               text,
  calendar_event_id   text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE weekly_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exercises"
  ON weekly_exercises FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_exercises_user_date ON weekly_exercises(user_id, exercise_date);
