CREATE TABLE IF NOT EXISTS google_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token  text NOT NULL,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google tokens"
  ON google_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
