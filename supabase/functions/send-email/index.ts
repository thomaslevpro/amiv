import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// Destinataire des alertes de signalement (secret de fonction, jamais en dur)
const REPORTS_ADMIN_EMAIL = Deno.env.get('REPORTS_ADMIN_EMAIL')
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

// Appels depuis l'app (JWT utilisateur), distincts du hook d'auth
type AppPayload = {
  action: 'report_created' | 'invitation_reminder'
  invitation_ids?: string[]
  message?: string
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

// jean.dupont@gmail.com → je***@gmail.com (jamais d'adresse ni de jeton dans les logs)
function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 2)}***@${domain ?? ''}`
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

async function sendEmail(to: string, content: EmailContent) {
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
    }),
  })
}

const REPORT_TARGET_LABELS: Record<string, string> = {
  event_message: "Message de chat d'événement",
  direct_message: 'Message privé',
  profile: 'Profil',
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harcèlement',
  inappropriate: 'Contenu inapproprié',
  other: 'Autre',
}

type ReportRow = {
  id: string
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  comment: string | null
  reported_user_id: string | null
  event_id: string | null
  content_snapshot: string | null
  created_at: string
}

function getReportEmailContent(report: ReportRow): EmailContent {
  const lines: [string, string][] = [
    ['Type', REPORT_TARGET_LABELS[report.target_type] ?? report.target_type],
    ['Motif', REPORT_REASON_LABELS[report.reason] ?? report.reason],
    ['Commentaire', report.comment ?? '—'],
    ['Contenu signalé', report.content_snapshot ?? '—'],
    ['Utilisateur signalé', report.reported_user_id ?? '—'],
    ['Auteur du signalement', report.reporter_id],
    ['Événement', report.event_id ?? '—'],
    ['Cible', report.target_id],
    ['Signalement', `${report.id} · ${report.created_at}`],
  ]

  return {
    subject: `[Amiv] Signalement : ${REPORT_REASON_LABELS[report.reason] ?? report.reason}`,
    html: `
      <h2>Nouveau signalement</h2>
      <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
        ${lines.map(([label, value]) => `<tr><td style="color:#8E8E93;vertical-align:top;">${label}</td><td style="white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`).join('')}
      </table>
    `,
    text: lines.map(([label, value]) => `${label} : ${value}`).join('\n'),
  }
}

// Envoie l'alerte admin pour les signalements récents de l'appelant qui n'ont
// pas encore été notifiés. Le contenu vient de la table reports (figé par le
// trigger prepare_report), jamais du client : l'appelant ne peut que
// déclencher l'envoi de ses propres signalements, une fois chacun.
async function handleReportCreated(userId: string) {
  if (!REPORTS_ADMIN_EMAIL) {
    console.error('report email skipped: REPORTS_ADMIN_EMAIL is not configured')
    return json({ error: 'REPORTS_ADMIN_EMAIL is not configured' }, 500)
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: reports, error } = await admin
    .from('reports')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('reporter_id', userId)
    .is('email_sent_at', null)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .select('id, reporter_id, target_type, target_id, reason, comment, reported_user_id, event_id, content_snapshot, created_at')

  if (error) {
    console.error('report claim failed', error)
    return json({ error: 'Failed to load reports' }, 500)
  }

  let sent = 0
  for (const report of (reports ?? []) as ReportRow[]) {
    const response = await sendEmail(REPORTS_ADMIN_EMAIL, getReportEmailContent(report))
    if (response.ok) {
      sent += 1
    } else {
      console.error('report email failed', { report: report.id, status: response.status })
      await admin.from('reports').update({ email_sent_at: null }).eq('id', report.id)
    }
  }

  return json({ success: true, sent })
}

const INVITE_URL = 'https://amiv.app/invite'
const REMINDER_EMAIL_INTERVAL_MS = 12 * 60 * 60 * 1000
const REMINDER_FRESHNESS_MS = 10 * 60 * 1000

function formatEventDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
}

function getReminderEmailContent(event: { name: string; date: string | null }, organizerName: string, message: string | null, inviteUrl: string): EmailContent {
  const eventName = event.name || 'un événement'
  const date = formatEventDate(event.date)
  const intro = `${organizerName} attend ta réponse pour ${eventName}${date ? ` (${date})` : ''}.`
  const safeUrl = escapeHtml(inviteUrl)

  return {
    subject: `Petit rappel : ${eventName}`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
        <div style="max-width:480px;margin:0 auto;padding:40px;background:#fff;border-radius:20px;box-shadow:0 2px 16px rgba(0,0,0,0.08);text-align:center;">
          <div style="font-size:32px;font-weight:800;line-height:1;background:linear-gradient(135deg,#e055aa,#f5a623);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;margin-bottom:28px;">Amiv</div>
          <h1 style="margin:0 0 14px;color:#1C1C1E;font-size:22px;font-weight:700;line-height:1.25;">Petit rappel 🎉</h1>
          <p style="margin:0;color:#8E8E93;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
          ${message ? `<p style="margin:18px 0 0;padding:14px 16px;background:#F5F5F5;border-radius:12px;color:#1C1C1E;font-size:15px;line-height:1.5;white-space:pre-wrap;text-align:left;">${escapeHtml(message)}</p>` : ''}
          <a href="${safeUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#e055aa,#f5a623);color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Répondre à l'invitation</a>
          <p style="margin:0 0 8px;color:#8E8E93;font-size:12px;line-height:1.5;">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :</p>
          <p style="margin:0;color:#8E8E93;font-size:12px;line-height:1.5;word-break:break-all;">${safeUrl}</p>
        </div>
      </div>
    `,
    text: `${intro}${message ? `\n\n${message}` : ''}\n\nRéponds à l'invitation : ${inviteUrl}`,
  }
}

// Relance par email des invités sans compte Amiv. N'envoie que pour des
// invitations que l'appelant organise et qui viennent d'être relancées via
// remind_invitations (reminded_at récent), au plus une fois toutes les 12 h
// par invitation (reminder_emailed_at). Les invités ayant un compte
// reçoivent déjà la notification in-app.
async function handleInvitationReminder(userId: string, payload: AppPayload) {
  const ids = (payload.invitation_ids ?? []).filter(id => typeof id === 'string').slice(0, 200)
  if (!ids.length) return json({ success: true, sent: 0 })
  const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, 300) || null : null

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = Date.now()
  const { data: invitations, error } = await admin
    .from('invitations')
    .update({ reminder_emailed_at: new Date(now).toISOString() })
    .in('id', ids)
    .is('invited_user_id', null)
    .not('invited_email', 'is', null)
    .in('status', ['pending', 'maybe'])
    .gte('reminded_at', new Date(now - REMINDER_FRESHNESS_MS).toISOString())
    .or(`reminder_emailed_at.is.null,reminder_emailed_at.lt.${new Date(now - REMINDER_EMAIL_INTERVAL_MS).toISOString()}`)
    .select('id, event_id, invited_email, reminder_emailed_at')

  if (error) {
    console.error('reminder claim failed', error)
    return json({ error: 'Failed to load invitations' }, 500)
  }
  if (!invitations?.length) return json({ success: true, sent: 0 })

  const eventIds = [...new Set(invitations.map(invitation => invitation.event_id))]
  const [{ data: events }, { data: organizerRows }, { data: profile }, { data: accounts }] = await Promise.all([
    admin.from('events').select('id, name, date, user_id, invite_token').in('id', eventIds),
    admin.from('event_organizers').select('event_id').in('event_id', eventIds).eq('user_id', userId).in('role', ['owner', 'co_organizer']).eq('status', 'approved'),
    admin.from('profiles').select('first_name, name').eq('id', userId).maybeSingle(),
    admin.from('profiles').select('email').in('email', invitations.map(invitation => invitation.invited_email)),
  ])

  const organizedEventIds = new Set([
    ...(events ?? []).filter(event => event.user_id === userId).map(event => event.id),
    ...(organizerRows ?? []).map(row => row.event_id),
  ])
  const eventsById = new Map((events ?? []).map(event => [event.id, event]))
  const accountEmails = new Set((accounts ?? []).map(account => account.email?.toLowerCase()))
  const organizerName = profile?.first_name || profile?.name || "L'organisateur"

  let sent = 0
  for (const invitation of invitations) {
    const event = eventsById.get(invitation.event_id)
    const email = invitation.invited_email as string
    const allowed = event?.invite_token && organizedEventIds.has(invitation.event_id) && !accountEmails.has(email.toLowerCase())
    const response = allowed
      ? await sendEmail(email, getReminderEmailContent(event!, organizerName, message, `${INVITE_URL}/${event!.invite_token}`))
      : null

    if (response?.ok) {
      sent += 1
      continue
    }
    if (response) console.error('reminder email failed', { invitation: invitation.id, to: maskEmail(email), status: response.status })
    await admin.from('invitations').update({ reminder_emailed_at: null }).eq('id', invitation.id)
  }

  return json({ success: true, sent })
}

async function handleAppAction(req: Request, payload: AppPayload) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Non authentifié' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return json({ error: 'Session invalide' }, 401)

  if (payload.action === 'report_created') return await handleReportCreated(user.id)
  if (payload.action === 'invitation_reminder') return await handleInvitationReminder(user.id, payload)
  return json({ error: 'Unsupported action' }, 400)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not configured' }, 500)

  let payload: AuthEmailPayload & Partial<AppPayload>

  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (payload.action) return await handleAppAction(req, payload as AppPayload)

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
