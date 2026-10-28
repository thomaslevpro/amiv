import { createClient } from 'npm:@supabase/supabase-js@2.104.1'
import { deleteAccount } from '../_shared/accountDeletion.ts'
import { isCronRequest } from '../_shared/cron.ts'
import { escapeHtml, isEmailConfigured, maskEmail, sendEmail, type EmailContent } from '../_shared/email.ts'

// Déclenchée chaque jour par le cron data-retention. Applique les durées de
// conservation de la politique de confidentialité :
//   1. purges SQL (run_data_retention) ;
//   2. suppression des comptes avertis il y a 30 jours et toujours inactifs ;
//   3. email d'avertissement aux comptes sans connexion depuis 3 ans.
// Un compte n'est supprimé que si l'avertissement a bien été envoyé. Les
// lots sont limités : le reste est traité les jours suivants.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const DELETE_BATCH_SIZE = 20
const WARN_BATCH_SIZE = 50
const DELETION_DELAY_DAYS = 30
// Resend limite le débit d'envoi (2 requêtes par seconde par défaut)
const EMAIL_SEND_INTERVAL_MS = 600

type InactiveAccount = {
  user_id: string
  email: string
  first_name: string | null
  last_activity_at: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function formatDeletionDate(date: Date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
}

function getInactivityWarningContent(firstName: string | null, deletionDate: Date): EmailContent {
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,'
  const date = formatDeletionDate(deletionDate)
  const intro = `Tu n'as pas utilisé Amiv depuis plus de 3 ans. Comme prévu par notre politique de confidentialité, ton compte et tes données seront supprimés le ${date}.`
  const action = 'Pour garder ton compte, il suffit de te connecter avant cette date.'

  return {
    subject: 'Ton compte Amiv va être supprimé',
    html: `
      <div style="margin:0;padding:32px 16px;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
        <div style="max-width:480px;margin:0 auto;padding:40px;background:#fff;border-radius:20px;box-shadow:0 2px 16px rgba(0,0,0,0.08);text-align:center;">
          <div style="font-size:32px;font-weight:800;line-height:1;background:linear-gradient(135deg,#e055aa,#f5a623);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;margin-bottom:28px;">Amiv</div>
          <h1 style="margin:0 0 14px;color:#1C1C1E;font-size:22px;font-weight:700;line-height:1.25;">${escapeHtml(greeting)}</h1>
          <p style="margin:0 0 12px;color:#8E8E93;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
          <p style="margin:0;color:#8E8E93;font-size:15px;line-height:1.6;">${escapeHtml(action)}</p>
          <a href="https://amiv.app" style="display:inline-block;margin:24px 0;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#e055aa,#f5a623);color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Me connecter</a>
          <p style="margin:0;color:#8E8E93;font-size:12px;line-height:1.5;">Si tu ne souhaites plus utiliser Amiv, tu n'as rien à faire.</p>
        </div>
      </div>
    `,
    text: `${greeting}\n\n${intro}\n\n${action}\nhttps://amiv.app\n\nSi tu ne souhaites plus utiliser Amiv, tu n'as rien à faire.`,
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!isCronRequest(req)) return json({ error: 'Unauthorized' }, 401)

  const requestId = crypto.randomUUID()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── 1. Purges SQL ─────────────────────────────────────────────────────────
  const { data: purged, error: purgeError } = await supabase.rpc('run_data_retention')
  if (purgeError) {
    console.error('[data-retention] purge_error', { requestId, message: purgeError.message, code: purgeError.code })
    return json({ error: purgeError.message }, 500)
  }

  // ── 2. Comptes avertis et toujours inactifs ───────────────────────────────
  let deleted = 0
  let deleteFailed = 0
  const { data: toDelete, error: toDeleteError } = await supabase.rpc('get_inactive_accounts_to_delete', { p_limit: DELETE_BATCH_SIZE })
  if (toDeleteError) {
    console.error('[data-retention] list_to_delete_error', { requestId, message: toDeleteError.message })
  }
  for (const userId of (toDelete ?? []) as string[]) {
    const result = await deleteAccount(supabase, userId)
    if (result.ok) {
      deleted += 1
    } else {
      deleteFailed += 1
      console.error('[data-retention] delete_failed', { requestId, userId, step: result.step, error: result.error })
    }
  }

  // ── 3. Avertissements ─────────────────────────────────────────────────────
  let warned = 0
  let warnFailed = 0
  if (!isEmailConfigured) {
    console.error('[data-retention] warnings skipped: RESEND_API_KEY is not configured', { requestId })
  } else {
    const { data: toWarn, error: toWarnError } = await supabase.rpc('get_inactive_accounts_to_warn', { p_limit: WARN_BATCH_SIZE })
    if (toWarnError) {
      console.error('[data-retention] list_to_warn_error', { requestId, message: toWarnError.message })
    }
    for (const account of (toWarn ?? []) as InactiveAccount[]) {
      const deletionDate = new Date(Date.now() + DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000)
      const response = await sendEmail(account.email, getInactivityWarningContent(account.first_name, deletionDate))
      if (!response.ok) {
        warnFailed += 1
        console.error('[data-retention] warning_email_failed', { requestId, email: maskEmail(account.email), status: response.status })
      } else {
        const { error } = await supabase.from('account_inactivity_warnings').insert({
          user_id: account.user_id,
          deletion_scheduled_at: deletionDate.toISOString(),
        })
        if (error) {
          warnFailed += 1
          console.error('[data-retention] warning_insert_failed', { requestId, userId: account.user_id, message: error.message })
        } else {
          warned += 1
        }
      }
      await new Promise(resolve => setTimeout(resolve, EMAIL_SEND_INTERVAL_MS))
    }
  }

  const summary = { purged, deleted, deleteFailed, warned, warnFailed }
  console.log('[data-retention] success', { requestId, ...summary })
  return json({ success: true, ...summary })
})
