import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { corsHeaders, escapeHtml, isEmailConfigured, json, maskEmail, sendEmail, type EmailContent } from '../_shared/email.ts'

// Hook d'auth Supabase « Send Email » uniquement. Chaque appel doit être
// signé par Supabase Auth (Standard Webhooks) avec le secret du hook :
// SEND_EMAIL_HOOK_SECRET, au format « v1,whsec_… » affiché dans le
// dashboard (Authentication → Hooks). Sans secret ou sans signature valide,
// rien n'est envoyé. Les emails déclenchés depuis l'app passent par app-email.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SEND_EMAIL_HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET')

type AuthEmailPayload = {
  event?: string
  event_type?: string
  type?: string
  email?: string | {
    email_action_type?: string
  }
  token?: string
  token_hash?: string
  hashed_token?: string
  redirect_url?: string
  redirect_to?: string
  site_url?: string
  user?: {
    email?: string
  }
  email_data?: {
    email?: string
    email_action_type?: string
    token?: string
    token_hash?: string
    token_new?: string
    token_hash_new?: string
    redirect_to?: string
    redirect_url?: string
    site_url?: string
  }
}

function normalizeEventType(payload: AuthEmailPayload) {
  const rawType = payload.email_data?.email_action_type
    ?? (typeof payload.email === 'object' ? payload.email.email_action_type : undefined)
    ?? payload.event_type
    ?? payload.event
    ?? payload.type

  return rawType?.toLowerCase().replace(/[\s_-]+/g, '')
}

const RECOVERY_TYPES = ['recovery', 'passwordreset', 'resetpassword', 'passwordrecovery']
const AUTH_CALLBACK_URL = 'https://amiv.app/auth/callback'
const AUTH_RESET_URL = 'https://amiv.app/auth/reset'

function buildAuthUrl(payload: AuthEmailPayload, eventType: string) {
  const email_data = payload.email_data

  if (!SUPABASE_URL || !email_data?.token_hash) return null

  const verifyUrl = new URL(`${SUPABASE_URL}/auth/v1/verify`)
  const isRecovery = RECOVERY_TYPES.includes(eventType)

  // Le reset de mot de passe doit être vérifié en type "recovery" pour que le
  // client reçoive l'événement PASSWORD_RECOVERY sur /auth/reset.
  verifyUrl.searchParams.set('type', isRecovery ? 'recovery' : 'email')
  verifyUrl.searchParams.set('token', email_data.token_hash)
  verifyUrl.searchParams.set('redirect_to', isRecovery ? AUTH_RESET_URL : AUTH_CALLBACK_URL)

  const confirmationUrl = verifyUrl.toString()

  return confirmationUrl
}

function getEmailContent(eventType: string, authUrl: string): EmailContent | null {
  if (['signup', 'signupconfirmation', 'confirmation', 'confirm'].includes(eventType)) {
    const confirmationUrl = escapeHtml(authUrl)

    return {
      subject: 'Confirme ton inscription sur Amiv',
      html: `
        <div style="margin:0;padding:32px 16px;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
          <div style="max-width:480px;margin:0 auto;padding:40px;background:#fff;border-radius:20px;box-shadow:0 2px 16px rgba(0,0,0,0.08);text-align:center;">
            <div style="font-size:32px;font-weight:800;line-height:1;background:linear-gradient(135deg,#e055aa,#f5a623);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;margin-bottom:28px;">Amiv</div>
            <div style="font-size:48px;line-height:1;margin-bottom:20px;">🎉</div>
            <h1 style="margin:0 0 14px;color:#1C1C1E;font-size:22px;font-weight:700;line-height:1.25;">Confirme ton adresse email</h1>
            <p style="margin:0;color:#8E8E93;font-size:15px;line-height:1.6;">Clique sur le bouton ci-dessous pour activer ton compte et commencer à organiser des événements inoubliables.</p>
            <a href="${confirmationUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#e055aa,#f5a623);color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Confirmer mon email</a>
            <p style="margin:0 0 8px;color:#8E8E93;font-size:12px;line-height:1.5;">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :</p>
            <p style="margin:0;color:#8E8E93;font-size:12px;line-height:1.5;word-break:break-all;">${confirmationUrl}</p>
            <div style="margin-top:32px;color:#AEAEB2;font-size:12px;text-align:center;">© 2025 Amiv · amiv.app</div>
          </div>
        </div>
      `,
      text: `Bienvenue sur Amiv.\n\nConfirme ton adresse email pour finaliser ton inscription :\n${authUrl}`,
    }
  }

  if (RECOVERY_TYPES.includes(eventType)) {
    return {
      subject: 'Réinitialise ton mot de passe Amiv',
      html: `
        <p>Tu as demandé à réinitialiser ton mot de passe Amiv.</p>
        <p><a href="${authUrl}">Réinitialiser mon mot de passe</a></p>
        <p>Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.</p>
      `,
      text: `Tu as demandé à réinitialiser ton mot de passe Amiv.\n\nRéinitialise ton mot de passe :\n${authUrl}\n\nSi tu n'es pas à l'origine de cette demande, tu peux ignorer cet email.`,
    }
  }

  if (['magiclink', 'magiclinklogin', 'login'].includes(eventType)) {
    return {
      subject: 'Ton lien de connexion Amiv',
      html: `
        <p>Voici ton lien de connexion Amiv.</p>
        <p><a href="${authUrl}">Me connecter</a></p>
      `,
      text: `Voici ton lien de connexion Amiv :\n${authUrl}`,
    }
  }

  return null
}

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

  const email = typeof payload.email === 'string' ? payload.email : payload.email_data?.email ?? payload.user?.email
  const eventType = normalizeEventType(payload)

  if (!email) return json({ error: 'Missing email' }, 400)
  if (!eventType) return json({ error: 'Missing event type' }, 400)

  const authUrl = buildAuthUrl(payload, eventType)
  if (!authUrl) return json({ error: 'Missing token' }, 400)

  const content = getEmailContent(eventType, authUrl)
  if (!content) return json({ error: `Unsupported email type: ${eventType}` }, 400)

  const resendResponse = await sendEmail(email, content)

  if (!resendResponse.ok) {
    const resendError = await resendResponse.text()
    console.error('auth email failed', { type: eventType, to: maskEmail(email), status: resendResponse.status })
    return json({ error: 'Failed to send email', details: resendError }, 502)
  }

  console.log('auth email sent', { type: eventType, to: maskEmail(email) })
  return json({ success: true })
})

