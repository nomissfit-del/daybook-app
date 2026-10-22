import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getBotUsername, setCommands, setWebhook } from '@/lib/telegram'

export const dynamic = 'force-dynamic'

// Creates a one time code and returns a t.me link that connects this account
// to the Telegram chat. Also (re)registers the webhook, so no manual setup is needed.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!process.env.TELEGRAM_BOT_TOKEN || !secret) {
    return NextResponse.json({ error: 'Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en Vercel' }, { status: 500 })
  }

  const code = randomBytes(9).toString('base64url')
  const expires = new Date(Date.now() + 30 * 60_000).toISOString()

  const { error } = await supabase.from('notification_settings').upsert({
    user_id: user.id,
    link_code: code,
    link_code_expires_at: expires,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    // The address the app is being used from is the reliable one; the env var is only a fallback
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    const origin = host && !host.startsWith('localhost')
      ? `https://${host}`
      : (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin)
    await setWebhook(`${origin}/api/telegram/webhook`, secret)
    await setCommands()
    const username = await getBotUsername()
    return NextResponse.json({ url: `https://t.me/${username}?start=${code}` })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
