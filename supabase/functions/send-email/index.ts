const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
const SENDER = 'Amiv <noreply@amiv.app>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

type EmailContent = {
  subject: string
  html: string
  text: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEventType(payload: AuthEmailPayload) {
  const rawType = payload.email_data?.email_action_type
    ?? (typeof payload.email === 'object' ? payload.email.email_action_type : undefined)
    ?? payload.event_type
    ?? payload.event
    ?? payload.type

  return rawType?.toLowerCase().replace(/[\s_-]+/g, '')
}

function buildAuthUrl(payload: AuthEmailPayload, email: string, eventType: string) {
  const emailData = payload.email_data ?? {}
  const redirectUrl = payload.redirect_url ?? payload.redirect_to ?? emailData.redirect_url ?? emailData.redirect_to
  const verifyBaseUrl = SUPABASE_URL ?? payload.site_url ?? emailData.site_url ?? 'https://amiv.app'
  const token = payload.token_hash
    ?? payload.hashed_token
    ?? payload.token
    ?? emailData.token_hash
    ?? emailData.token_hash_new
    ?? emailData.token
    ?? emailData.token_new

  if (!token) return null

  const url = new URL('/auth/v1/verify', verifyBaseUrl)
  url.searchParams.set('token_hash', token)
  url.searchParams.set('email', email)
  url.searchParams.set('type', eventType === 'recovery' ? 'recovery' : eventType === 'magiclink' ? 'magiclink' : 'email')
  if (redirectUrl) url.searchParams.set('redirect_to', redirectUrl)

  return url.toString()
}

function getEmailContent(eventType: string, authUrl: string): EmailContent | null {
  if (['signup', 'signupconfirmation', 'confirmation', 'confirm'].includes(eventType)) {
    return {
      subject: 'Confirme ton inscription sur Amiv',
      html: `
        <p>Bienvenue sur Amiv.</p>
        <p>Confirme ton adresse email pour finaliser ton inscription.</p>
        <p><a href="${authUrl}">Confirmer mon email</a></p>
      `,
      text: `Bienvenue sur Amiv.\n\nConfirme ton adresse email pour finaliser ton inscription :\n${authUrl}`,
    }
  }

  if (['recovery', 'passwordreset', 'resetpassword', 'passwordrecovery'].includes(eventType)) {
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

  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not configured' }, 500)

  let payload: AuthEmailPayload

  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email = typeof payload.email === 'string' ? payload.email : payload.email_data?.email ?? payload.user?.email
  const eventType = normalizeEventType(payload)

  if (!email) return json({ error: 'Missing email' }, 400)
  if (!eventType) return json({ error: 'Missing event type' }, 400)

  const authUrl = buildAuthUrl(payload, email, eventType)
  if (!authUrl) return json({ error: 'Missing token' }, 400)

  const content = getEmailContent(eventType, authUrl)
  if (!content) return json({ error: `Unsupported email type: ${eventType}` }, 400)

  const resendResponse = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SENDER,
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
  })

  if (!resendResponse.ok) {
    const resendError = await resendResponse.text()
    return json({ error: 'Failed to send email', details: resendError }, 502)
  }

  return json({ success: true })
})
