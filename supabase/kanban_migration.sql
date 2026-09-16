-- ============================================================
-- Kanban Board: tickets and subtasks
-- Run this in your Supabase SQL Editor.
-- project_folders already exists and is reused as "boards".
-- ============================================================

CREATE TABLE IF NOT EXISTS tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  board_id    uuid REFERENCES project_folders(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    text NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high')),
  deadline    date,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_subtasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticket_id   uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  done        boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tickets"
  ON tickets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own ticket subtasks"
  ON ticket_subtasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tickets_board ON tickets(board_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subtasks_ticket ON ticket_subtasks(ticket_id);
