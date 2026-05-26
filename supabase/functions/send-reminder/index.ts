const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
const SENDER = 'Amiv <noreply@amiv.app>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ReminderRecipient = {
  invitation_id?: string
  email?: string
  first_name?: string
}

type ReminderPayload = {
  event_id?: string
  invitation_ids?: string[]
  event?: {
    id?: string
    name?: string
    date?: string
  }
  message?: string
  recipients?: ReminderRecipient[]
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatEventDate(date?: string) {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not configured' }, 500)

  let payload: ReminderPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const recipients = (payload.recipients ?? []).filter(recipient => recipient.email)
  const message = payload.message?.trim()
  const eventName = payload.event?.name?.trim() || 'ton événement'

  if (!message) return json({ error: 'Missing message' }, 400)
  if (payload.event_id && Array.isArray(payload.invitation_ids) && !payload.event?.id) {
    payload.event = { id: payload.event_id }
  }
  if (recipients.length === 0) return json({ error: 'Missing recipients' }, 400)

  const subject = `Petit rappel pour ${eventName}`
  const eventDate = formatEventDate(payload.event?.date)
  const escapedMessage = escapeHtml(message).replaceAll('\n', '<br>')

  const results = await Promise.allSettled(recipients.map(async (recipient) => {
    const greeting = recipient.first_name ? `Bonjour ${escapeHtml(recipient.first_name)},` : 'Bonjour,'
    const html = `
      <p>${greeting}</p>
      <p>${escapedMessage}</p>
      <p><strong>${escapeHtml(eventName)}</strong>${eventDate ? ` · ${escapeHtml(eventDate)}` : ''}</p>
      <p>À très vite sur Amiv.</p>
    `
    const text = `${recipient.first_name ? `Bonjour ${recipient.first_name},` : 'Bonjour,'}\n\n${message}\n\n${eventName}${eventDate ? ` · ${eventDate}` : ''}\n\nÀ très vite sur Amiv.`

    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SENDER,
        to: recipient.email,
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(details)
    }

    return recipient.email
  }))

  const failed = results
    .map((result, index) => ({ result, recipient: recipients[index] }))
    .filter(({ result }) => result.status === 'rejected')

  if (failed.length > 0) {
    return json({
      error: 'Some reminders failed',
      failed: failed.map(({ recipient }) => recipient.email),
    }, 502)
  }

  return json({ success: true, sent: recipients.length })
})
