'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addDays, mondayOf, shortEs } from '@/lib/dates'
import NavBar from './NavBar'

const ACCENT = '#6B4E9B'
const ACCENT_LIGHT = '#EDE6F5'

interface Settings {
  telegram_chat_id: number | null
  enabled: boolean
  timezone: string
  morning_time: string
  midday_time: string | null
  evening_time: string
  weekly_review_dow: number
}

interface StudyRow {
  id: string
  area: string
  minutes: number
  note: string | null
  session_date: string
}

interface Props {
  userId: string
  userEmail: string
  todayStr: string
  initialSettings: Settings | null
  initialStudy: StudyRow[]
  migrationMissing: boolean
}

const DEFAULTS: Omit<Settings, 'telegram_chat_id'> = {
  enabled: true,
  timezone: 'Europe/London',
  morning_time: '07:30',
  midday_time: '13:00',
  evening_time: '21:00',
  weekly_review_dow: 0,
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function hhmm(t: string | null) { return t ? t.slice(0, 5) : '' }

function fmtMin(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export default function RemindersSettings({ userId, userEmail, todayStr, initialSettings, initialStudy, migrationMissing }: Props) {
  const supabase = createClient()
  const [settings, setSettings] = useState<Settings>({ telegram_chat_id: null, ...DEFAULTS, ...(initialSettings ?? {}) })
  const [study, setStudy] = useState<StudyRow[]>(initialStudy)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)

  const [area, setArea] = useState('')
  const [minutes, setMinutes] = useState(45)
  const [note, setNote] = useState('')
  const [studyDate, setStudyDate] = useState(todayStr)

  const connected = !!settings.telegram_chat_id

  // ── Settings ──
  const save = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { error } = await supabase.from('notification_settings').upsert({
      user_id: userId,
      enabled: next.enabled,
      timezone: next.timezone,
      morning_time: next.morning_time,
      midday_time: next.midday_time || null,
      evening_time: next.evening_time,
      weekly_review_dow: next.weekly_review_dow,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setStatus(error ? `Could not save: ${error.message}` : 'Saved')
    setTimeout(() => setStatus(null), 2000)
  }

  const connect = async () => {
    setBusy(true)
    setStatus(null)
    const res = await fetch('/api/telegram/link', { method: 'POST' })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setStatus(json.error ?? 'Could not create link'); return }
    setLinkUrl(json.url)
    window.open(json.url, '_blank')
  }

  const refreshConnection = async () => {
    const { data } = await supabase.from('notification_settings').select('telegram_chat_id').eq('user_id', userId).maybeSingle()
    if (data?.telegram_chat_id) {
      setSettings(s => ({ ...s, telegram_chat_id: data.telegram_chat_id }))
      setLinkUrl(null)
      setStatus('Telegram connected')
    } else {
      setStatus('Not connected yet: press Start in Telegram, then check again')
    }
  }

  const sendTest = async (slot: 'morning' | 'midday' | 'evening') => {
    setBusy(true)
    const res = await fetch('/api/notify/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot }),
    })
    const json = await res.json()
    setBusy(false)
    setStatus(res.ok ? 'Sent. Check Telegram.' : `Error: ${json.error}`)
  }

  // ── Study log ──
  const areas = useMemo(() => [...new Set(study.map(s => s.area))], [study])
  const weekKey = mondayOf(todayStr)
  const lastWeekKey = addDays(weekKey, -7)

  const sumBy = (from: string, to: string) => {
    const m = new Map<string, number>()
    for (const s of study) if (s.session_date >= from && s.session_date <= to) m.set(s.area, (m.get(s.area) ?? 0) + s.minutes)
    return m
  }
  const thisWeek = sumBy(weekKey, todayStr)
  const lastWeek = sumBy(lastWeekKey, addDays(weekKey, -1))
  const totalThis = [...thisWeek.values()].reduce((a, b) => a + b, 0)
  const totalLast = [...lastWeek.values()].reduce((a, b) => a + b, 0)

  const addStudy = async () => {
    const a = area.trim()
    if (!a || minutes <= 0) return
    const existing = areas.find(x => x.toLowerCase() === a.toLowerCase())
    const { data, error } = await supabase.from('study_sessions')
      .insert({ user_id: userId, area: existing ?? a, minutes, note: note.trim() || null, session_date: studyDate, source: 'app' })
      .select('id, area, minutes, note, session_date')
      .single()
    if (error) { setStatus(error.message); return }
    setStudy(prev => [data as StudyRow, ...prev].sort((x, y) => y.session_date.localeCompare(x.session_date)))
    setNote('')
  }

  const deleteStudy = async (id: string) => {
    await supabase.from('study_sessions').delete().eq('id', id)
    setStudy(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="min-h-screen">
      <NavBar active="reminders" userEmail={userEmail} />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {migrationMissing && (
          <div className="card p-4 text-sm" style={{ borderColor: '#B42318', color: '#B42318' }}>
            Run <code>supabase/notifications_migration.sql</code> in the Supabase SQL Editor first.
          </div>
        )}

        {status && (
          <div className="text-sm px-3 py-2 rounded-sm" style={{ backgroundColor: ACCENT_LIGHT, color: ACCENT }}>{status}</div>
        )}

        {/* Telegram */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl text-ink">Telegram reminders</h2>
              <p className="text-sm text-muted mt-1">
                Daily plan, midday nudge and evening check of what you have not done, with buttons to tick things off.
              </p>
            </div>
            <span
              className="text-xs font-medium px-2 py-1 rounded-sm whitespace-nowrap"
              style={connected ? { backgroundColor: '#DCEFE0', color: '#2F6B43' } : { backgroundColor: '#FBE2DF', color: '#B42318' }}
            >
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={connect}
              disabled={busy}
              className="text-white px-4 py-2 text-sm font-medium rounded-sm transition-opacity disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {connected ? 'Reconnect Telegram' : 'Connect Telegram'}
            </button>
            {linkUrl && (
              <button onClick={refreshConnection} className="btn-ghost border border-border">I pressed Start, check again</button>
            )}
          </div>
          {linkUrl && (
            <p className="text-xs text-muted">
              If Telegram did not open, use this link (valid 30 minutes): <a className="underline break-all" href={linkUrl} target="_blank" rel="noreferrer">{linkUrl}</a>
            </p>
          )}

          {connected && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="label">Morning plan</label>
                  <input type="time" className="input" value={hhmm(settings.morning_time)}
                    onChange={e => e.target.value && save({ morning_time: e.target.value })} />
                </div>
                <div>
                  <label className="label">Midday nudge</label>
                  <div className="flex gap-2 items-center">
                    <input type="time" className="input" value={hhmm(settings.midday_time)} disabled={!settings.midday_time}
                      onChange={e => e.target.value && save({ midday_time: e.target.value })} />
                    <input type="checkbox" checked={!!settings.midday_time} title="On or off"
                      onChange={e => save({ midday_time: e.target.checked ? '13:00' : null })} />
                  </div>
                </div>
                <div>
                  <label className="label">Evening check</label>
                  <input type="time" className="input" value={hhmm(settings.evening_time)}
                    onChange={e => e.target.value && save({ evening_time: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Weekly review (with the evening check)</label>
                  <select className="input" value={settings.weekly_review_dow}
                    onChange={e => save({ weekly_review_dow: Number(e.target.value) })}>
                    {DOW.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={settings.enabled} onChange={e => save({ enabled: e.target.checked })} />
                    Reminders on
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <span className="text-xs text-muted self-center mr-1">Send a test now:</span>
                <button disabled={busy} onClick={() => sendTest('morning')} className="btn-ghost border border-border">Morning</button>
                <button disabled={busy} onClick={() => sendTest('midday')} className="btn-ghost border border-border">Midday</button>
                <button disabled={busy} onClick={() => sendTest('evening')} className="btn-ghost border border-border">Evening</button>
              </div>
            </>
          )}
        </section>

        {/* Study log */}
        <section className="card p-5 space-y-4">
          <div>
            <h2 className="text-xl text-ink">Study log</h2>
            <p className="text-sm text-muted mt-1">
              Log what you study so the coach can follow up. From Telegram: <code className="font-mono">/estudio 45 Revenue Cloud</code>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
            <div className="col-span-2">
              <label className="label">Area</label>
              <input className="input" list="study-areas" value={area} onChange={e => setArea(e.target.value)} placeholder="Revenue Cloud" />
              <datalist id="study-areas">{areas.map(a => <option key={a} value={a} />)}</datalist>
            </div>
            <div>
              <label className="label">Minutes</label>
              <input className="input" type="number" min={1} max={1440} value={minutes}
                onChange={e => setMinutes(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={studyDate} max={todayStr} onChange={e => setStudyDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Note (optional)</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addStudy() }} placeholder="What you covered" />
            </div>
          </div>
          <button onClick={addStudy} className="text-white px-4 py-2 text-sm font-medium rounded-sm" style={{ backgroundColor: ACCENT }}>
            Log session
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-sm p-3" style={{ backgroundColor: ACCENT_LIGHT }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: ACCENT }}>This week</p>
              <p className="font-serif text-2xl text-ink">{fmtMin(totalThis)}</p>
              <p className="text-xs text-muted">Last week {fmtMin(totalLast)}</p>
            </div>
            <div className="space-y-1">
              {[...thisWeek.entries()].sort((a, b) => b[1] - a[1]).map(([a, m]) => (
                <div key={a} className="flex justify-between text-sm">
                  <span className="text-ink">{a}</span>
                  <span className="font-mono text-muted">{fmtMin(m)}</span>
                </div>
              ))}
              {thisWeek.size === 0 && <p className="text-sm text-muted">Nothing logged this week yet.</p>}
            </div>
          </div>

          {study.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="label">Recent sessions</p>
              <ul className="divide-y divide-border">
                {study.slice(0, 15).map(s => (
                  <li key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="font-mono text-xs text-muted w-14">{shortEs(s.session_date)}</span>
                    <span className="text-ink flex-1">
                      {s.area}{s.note ? <span className="text-muted">: {s.note}</span> : null}
                    </span>
                    <span className="font-mono text-xs text-muted">{s.minutes} min</span>
                    <button onClick={() => deleteStudy(s.id)} className="text-muted hover:text-ink text-xs" title="Delete">✕</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
