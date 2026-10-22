/* ============================================================
   Notifications (Telegram), study log and coach
   Run this in your Supabase SQL Editor.
   ============================================================ */

-- One row per user: Telegram link and reminder schedule
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_chat_id      bigint UNIQUE,
  link_code             text UNIQUE,
  link_code_expires_at  timestamptz,
  enabled               boolean NOT NULL DEFAULT true,
  timezone              text NOT NULL DEFAULT 'Europe/London',
  morning_time          time NOT NULL DEFAULT '07:30',
  midday_time           time DEFAULT '13:00',          -- NULL turns the midday nudge off
  evening_time          time NOT NULL DEFAULT '21:00',
  weekly_review_dow     int  NOT NULL DEFAULT 0         -- 0 = Sunday, review goes with the evening message
                        CHECK (weekly_review_dow BETWEEN 0 AND 6),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Which reminders went out, so each one is sent once per day
CREATE TABLE IF NOT EXISTS notification_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slot        text NOT NULL,          -- morning | midday | evening
  local_date  date NOT NULL,
  sent_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, slot, local_date)
);

-- Study and learning sessions (Salesforce, finance, ...)
CREATE TABLE IF NOT EXISTS study_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  area          text NOT NULL,
  minutes       int  NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  note          text,
  session_date  date NOT NULL,
  source        text NOT NULL DEFAULT 'app',   -- app | telegram
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification settings" ON notification_settings;
CREATE POLICY "Users manage own notification settings"
  ON notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own notification log" ON notification_log;
CREATE POLICY "Users read own notification log"
  ON notification_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own study sessions" ON study_sessions;
CREATE POLICY "Users manage own study sessions"
  ON study_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date ON study_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_date ON notification_log(user_id, local_date);
