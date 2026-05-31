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

function buildAuthUrl(payload: AuthEmailPayload) {
  const email_data = payload.email_data

  if (!SUPABASE_URL || !email_data?.token_hash) return null

  const verifyUrl = new URL(`${SUPABASE_URL}/auth/v1/verify`)

  verifyUrl.searchParams.set('type', 'signup')
  verifyUrl.searchParams.set('token_hash', email_data.token_hash)
  verifyUrl.searchParams.set('redirect_to', 'https://amiv.app/auth/callback')

  const confirmationUrl = verifyUrl.toString()

  return confirmationUrl
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
    console.log('PAYLOAD_DEBUG:', JSON.stringify(payload, null, 2))
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email = typeof payload.email === 'string' ? payload.email : payload.email_data?.email ?? payload.user?.email
  const eventType = normalizeEventType(payload)

  if (!email) return json({ error: 'Missing email' }, 400)
  if (!eventType) return json({ error: 'Missing event type' }, 400)

  const authUrl = buildAuthUrl(payload)
  if (!authUrl) return json({ error: 'Missing token' }, 400)
  console.log('VERIFY_URL:', authUrl)

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
