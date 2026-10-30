import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { corsHeaders, isEmailConfigured, json, maskEmail, sendEmail } from '../_shared/email.ts'
import { buildAuthEmails, normalizeEventType, type AuthEmailPayload } from './emails.ts'

// Hook d'auth Supabase « Send Email » uniquement. Chaque appel doit être
// signé par Supabase Auth (Standard Webhooks) avec le secret du hook :
// SEND_EMAIL_HOOK_SECRET, au format « v1,whsec_… » affiché dans le
// dashboard (Authentication → Hooks). Sans secret ou sans signature valide,
// rien n'est envoyé. Contenu des emails : emails.ts. Les emails déclenchés
// depuis l'app passent par app-email.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SEND_EMAIL_HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  if (!isEmailConfigured) return json({ error: 'RESEND_API_KEY is not configured' }, 500)
  if (!SEND_EMAIL_HOOK_SECRET) {
    console.error('auth email refused: SEND_EMAIL_HOOK_SECRET is not configured')
    return json({ error: 'Hook secret is not configured' }, 500)
  }

  // La signature porte sur le corps brut : vérifier avant tout parsing
  const rawBody = await req.text()
  let payload: AuthEmailPayload
  try {
    const webhook = new Webhook(SEND_EMAIL_HOOK_SECRET.replace(/^v1,whsec_/, ''))
    payload = webhook.verify(rawBody, Object.fromEntries(req.headers)) as AuthEmailPayload
  } catch {
    console.error('auth email refused: invalid webhook signature')
    return json({ error: 'Invalid signature' }, 401)
  }

  const eventType = normalizeEventType(payload)
  const emails = buildAuthEmails(payload, SUPABASE_URL)
  if (!Array.isArray(emails)) {
    console.error('auth email refused', { type: eventType, error: emails.error })
    return json({ error: emails.error }, 400)
  }

  for (const { to, content } of emails) {
    const resendResponse = await sendEmail(to, content)
    if (!resendResponse.ok) {
      const resendError = await resendResponse.text()
      console.error('auth email failed', { type: eventType, to: maskEmail(to), status: resendResponse.status })
      return json({ error: 'Failed to send email', details: resendError }, 502)
    }
    console.log('auth email sent', { type: eventType, to: maskEmail(to) })
  }

  if (!emails.length) console.log('auth email skipped', { type: eventType })
  return json({ success: true })
})
