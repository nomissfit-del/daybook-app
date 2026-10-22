import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Service role client for server jobs (reminders, Telegram webhook).
 * It bypasses row level security, so every query must filter by user_id.
 * Never import this from client components.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
