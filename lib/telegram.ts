// Minimal Telegram Bot API client (no dependencies)

export interface Button { text: string; data: string }
export type ButtonRows = Button[][]

function api(method: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN')
  return `https://api.telegram.org/bot${token}/${method}`
}

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(api(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`)
  return json.result as T
}

function markup(rows?: ButtonRows) {
  if (!rows || rows.length === 0) return undefined
  return {
    inline_keyboard: rows.map(r => r.map(b => ({ text: b.text, callback_data: b.data }))),
  }
}

/** Escape text for parse_mode HTML */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function sendMessage(chatId: number | string, text: string, rows?: ButtonRows) {
  // Telegram rejects messages over 4096 characters
  if (text.length > 4000) text = text.slice(0, 3990) + '\n…'
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: markup(rows),
  })
}

export function answerCallback(callbackId: string, text: string) {
  return call('answerCallbackQuery', { callback_query_id: callbackId, text })
}

export function editButtons(chatId: number | string, messageId: number, rows: ButtonRows) {
  return call('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: markup(rows) ?? { inline_keyboard: [] },
  })
}

export async function getBotUsername(): Promise<string> {
  const me = await call<{ username: string }>('getMe', {})
  return me.username
}

export function setWebhook(url: string, secret: string) {
  return call('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
  })
}

export function setCommands() {
  return call('setMyCommands', {
    commands: [
      { command: 'hoy', description: 'Qué me queda hoy' },
      { command: 'estudio', description: 'Registrar estudio: /estudio 45 Revenue Cloud' },
      { command: 'semana', description: 'Revisión de la semana' },
      { command: 'pausa', description: 'Pausar avisos' },
      { command: 'activar', description: 'Reactivar avisos' },
      { command: 'ayuda', description: 'Cómo funciona' },
    ],
  })
}
