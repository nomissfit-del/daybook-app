// Date helpers that work on plain 'YYYY-MM-DD' strings in a given time zone.
// Server code runs in UTC on Vercel, so never rely on the machine's local time.

export interface ZonedNow {
  date: string        // 'YYYY-MM-DD' in the zone
  minutes: number     // minutes since local midnight
  dow: number         // 0 = Sunday .. 6 = Saturday
}

export function zonedNow(timeZone: string, at: Date = new Date()): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return { date, minutes, dow: dowOf(date) }
}

function toUTC(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(s: string, n: number): string {
  const d = toUTC(s)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUTC(d)
}

export function dowOf(s: string): number {
  return toUTC(s).getUTCDay()
}

/** Monday of the week containing s */
export function mondayOf(s: string): string {
  const dow = dowOf(s)
  return addDays(s, dow === 0 ? -6 : 1 - dow)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000)
}

/** 'HH:MM' or 'HH:MM:SS' to minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** 'jueves 22 oct' */
export function longEs(s: string): string {
  const d = toUTC(s)
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}

/** '22 oct' */
export function shortEs(s: string): string {
  const d = toUTC(s)
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}
