import { createClient } from '@supabase/supabase-js'

type VercelRequest = {
  method?: string
  query: { token?: string | string[] }
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => void
  send: (body: string) => void
  end: () => void
}

type CalendarItem = {
  item_id?: string
  id?: string
  item_type?: string
  dtstart?: string
  dtend?: string
  starts_at?: string
  ends_at?: string
  start_at?: string
  end_at?: string
  date?: string
  summary?: string
  title?: string
  name?: string
  description?: string | null
  location?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function escapeText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function foldLine(line: string) {
  const parts = []
  let remaining = line

  while (remaining.length > 75) {
    parts.push(remaining.slice(0, 75))
    remaining = ` ${remaining.slice(75)}`
  }

  parts.push(remaining)
  return parts.join('\r\n')
}

function formatDateTime(value?: string) {
  if (!value) return null
  if (/^\d{8}$/.test(value)) return { property: 'DATE', value }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { property: 'DATE', value: value.replaceAll('-', '') }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return {
    property: 'DATE-TIME',
    value: date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'),
  }
}

function addDaysToDateValue(value: string, days: number) {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6)) - 1
  const day = Number(value.slice(6, 8))
  const date = new Date(Date.UTC(year, month, day + days))

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('')
}

function pickDate(item: CalendarItem, fields: Array<keyof CalendarItem>) {
  for (const field of fields) {
    const value = item[field]
    if (typeof value === 'string' && value) return value
  }
  return undefined
}

function buildEvent(item: CalendarItem, dtstamp: string) {
  const uid = item.item_id ?? item.id
  const start = formatDateTime(pickDate(item, ['dtstart', 'starts_at', 'start_at', 'date']))
  const rawEnd = pickDate(item, ['dtend', 'ends_at', 'end_at'])
  const end = formatDateTime(rawEnd)
  const summary = item.summary ?? item.title ?? item.name

  if (!uid || !start || !summary) return null

  const effectiveEnd = end ?? (
    start.property === 'DATE'
      ? { property: 'DATE', value: addDaysToDateValue(start.value, 1) }
      : start
  )

  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(uid)}@amiv.app`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART${start.property === 'DATE' ? ';VALUE=DATE' : ''}:${start.value}`,
    `DTEND${effectiveEnd.property === 'DATE' ? ';VALUE=DATE' : ''}:${effectiveEnd.value}`,
    `SUMMARY:${escapeText(summary)}`,
  ]

  if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`)
  if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`)

  if (item.item_type === 'birthday') {
    lines.push(
      'X-APPLE-DEFAULT-ALARM:TRUE',
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(summary)}`,
      'END:VALARM'
    )
  }

  lines.push('END:VEVENT')
  return lines
}

function buildCalendar(items: CalendarItem[]) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const events = items.flatMap(item => buildEvent(item, dtstamp) ?? [])
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amiv//FR',
    'CALNAME:Amiv',
    'X-WR-CALNAME:Amiv',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...events,
    'END:VCALENDAR',
  ]

  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token
  const normalizedToken = token?.replace(/\.ics$/i, '')

  if (!normalizedToken || !UUID_RE.test(normalizedToken)) {
    res.status(404).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  // Ajouter dans Vercel Dashboard > Settings > Environment Variables :
  // SUPABASE_URL = (même valeur que VITE_SUPABASE_URL)
  // SUPABASE_ANON_KEY = (même valeur que VITE_SUPABASE_ANON_KEY)
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send('Variables Supabase manquantes.')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase
    .from('calendar_feed_items')
    .select('*')
    .eq('calendar_token', normalizedToken)

  if (error) {
    res.status(500).send('Impossible de générer le calendrier.')
    return
  }

  if (!data?.length) {
    res.status(404).end()
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
  res.setHeader('Content-Disposition', 'inline; filename="amiv.ics"')
  res.send(buildCalendar(data))
}
