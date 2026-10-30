import { createClient } from 'npm:@supabase/supabase-js@2.104.1'
import { corsHeaders, escapeHtml, isEmailConfigured, json, maskEmail, sendEmail, type EmailContent } from '../_shared/email.ts'

// Emails déclenchés depuis l'app (JWT utilisateur vérifié ici). Seuls deux
// emails sont possibles, avec des destinataires fixés par la base :
//   - report_created : alerte à REPORTS_ADMIN_EMAIL (secret de fonction) ;
//   - invitation_reminder : relance aux adresses des invitations que
//     l'appelant organise.
// Le contenu vient des tables (reports, invitations, events), jamais du
// client, hormis le message de relance (échappé, 300 caractères).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// Destinataire des alertes de signalement (secret de fonction, jamais en dur)
const REPORTS_ADMIN_EMAIL = Deno.env.get('REPORTS_ADMIN_EMAIL')

type AppPayload = {
  action: 'report_created' | 'invitation_reminder' | 'support_message'
  invitation_ids?: string[]
  message?: string
  category?: 'bug' | 'contact'
  app_version?: string
  platform?: string
  screen?: string
}

const REPORT_TARGET_LABELS: Record<string, string> = {
  event_message: "Message de chat d'événement",
  direct_message: 'Message privé',
  profile: 'Profil',
  event_photo: "Photo d'album d'événement",
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

async function handleSupportMessage(user: { id: string; email?: string }, payload: AppPayload) {
  const message = typeof payload.message === 'string' ? payload.message.trim() : ''
  if (!message || message.length > 5000) return json({ error: 'Le message doit contenir entre 1 et 5 000 caractères.' }, 400)
  if (payload.category !== 'bug' && payload.category !== 'contact') return json({ error: 'Type de message invalide.' }, 400)
  if (!REPORTS_ADMIN_EMAIL) return json({ error: 'Le service de contact est momentanément indisponible.' }, 500)
  if (!user.email) return json({ error: 'Aucune adresse e-mail associée à ce compte.' }, 400)

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: allowed, error: limitError } = await admin.rpc('claim_support_message_daily_limit', { p_user_id: user.id })
  if (limitError) {
    console.error('support message rate limit failed', limitError)
    return json({ error: 'Impossible de vérifier la limite d’envoi. Réessaie dans un instant.' }, 500)
  }
  if (!allowed) return json({ error: 'Tu as atteint la limite de 5 messages par jour. Réessaie demain.' }, 429)

  const isBug = payload.category === 'bug'
  const details: [string, string][] = isBug ? [
    ['Version', String(payload.app_version ?? 'inconnue').slice(0, 50)],
    ['Plateforme', String(payload.platform ?? 'inconnue').slice(0, 30)],
    ['Écran', String(payload.screen ?? 'inconnu').slice(0, 200)],
  ] : []
  const subject = isBug ? '[Amiv] Signalement de bug' : '[Amiv] Message de contact'
  const safeMessage = escapeHtml(message)
  const content: EmailContent = {
    subject,
    replyTo: user.email,
    html: `<h2>${isBug ? 'Nouveau signalement de bug' : 'Nouveau message'}</h2><p style="white-space:pre-wrap">${safeMessage}</p>${details.length ? `<table>${details.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>` : ''}<p>Compte : ${escapeHtml(user.email)}</p>`,
    text: `${message}${details.length ? `\n\n${details.map(([label, value]) => `${label} : ${value}`).join('\n')}` : ''}\n\nCompte : ${user.email}`,
  }
  const response = await sendEmail(REPORTS_ADMIN_EMAIL, content)
  if (!response.ok) {
    console.error('support message email failed', { status: response.status })
    return json({ error: 'L’envoi a échoué. Réessaie dans un instant.' }, 502)
  }
  return json({ success: true })
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
  if (payload.action === 'support_message') return await handleSupportMessage(user, payload)
  return json({ error: 'Unsupported action' }, 400)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  if (!isEmailConfigured) return json({ error: 'RESEND_API_KEY is not configured' }, 500)

  let payload: AppPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  return await handleAppAction(req, payload)
})
