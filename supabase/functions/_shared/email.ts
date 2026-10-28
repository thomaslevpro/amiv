// Utilitaires partagés par send-email (hook d'auth) et app-email (emails
// déclenchés depuis l'app).
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
const SENDER = 'Amiv <noreply@amiv.app>'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type EmailContent = {
  subject: string
  html: string
  text: string
  replyTo?: string
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export const isEmailConfigured = Boolean(RESEND_API_KEY)

// jean.dupont@gmail.com → je***@gmail.com (jamais d'adresse ni de jeton dans les logs)
export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 2)}***@${domain ?? ''}`
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendEmail(to: string, content: EmailContent) {
  return await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SENDER,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(content.replyTo ? { reply_to: content.replyTo } : {}),
    }),
  })
}
