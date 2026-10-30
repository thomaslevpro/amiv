import { createClient } from 'npm:@supabase/supabase-js@2.104.1'
import { deleteAccount } from '../_shared/accountDeletion.ts'
import { isCronRequest } from '../_shared/cron.ts'
import { escapeHtml, isEmailConfigured, maskEmail, sendEmail, type EmailContent } from '../_shared/email.ts'
import { deliverInactivityWarning } from '../_shared/inactivityWarning.ts'

// Déclenchée chaque jour par le cron data-retention. Applique les durées de
// conservation de la politique de confidentialité :
//   1. purges SQL (run_data_retention) ;
//   2. vérifie les candidats à la suppression (désactivée côté SQL et TypeScript) ;
//   3. envoie un email informatif aux comptes sans activité depuis 3 ans.
// Les lots sont limités : le reste est traité les jours suivants.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const DELETE_BATCH_SIZE = 20
const WARN_BATCH_SIZE = 50
const DELETION_DELAY_DAYS = 365
// Resend limite le débit d'envoi (2 requêtes par seconde par défaut)
const EMAIL_SEND_INTERVAL_MS = 600

type InactiveAccount = {
  user_id: string
  email: string
  first_name: string | null
  last_activity_at: string
}

type PendingWarning = InactiveAccount & { deletion_scheduled_at: string }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getInactivityWarningContent(firstName: string | null): EmailContent {
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,'
  const intro = `Nous n'avons détecté aucune activité sur ton compte Amiv depuis plus de 3 ans.`
  const action = 'La suppression automatique des comptes inactifs n’est pas activée. Tu peux te reconnecter à tout moment pour continuer à utiliser Amiv.'

  return {
    subject: 'Nous n’avons pas détecté d’activité sur ton compte Amiv',
    html: `
      <div style="margin:0;padding:32px 16px;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
        <div style="max-width:480px;margin:0 auto;padding:40px;background:#fff;border-radius:20px;box-shadow:0 2px 16px rgba(0,0,0,0.08);text-align:center;">
          <div style="font-size:32px;font-weight:800;line-height:1;color:#e055aa;margin-bottom:28px;">Amiv</div>
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
  let deleteBlocked = 0
  const { data: toDelete, error: toDeleteError } = await supabase.rpc('get_inactive_accounts_to_delete', { p_limit: DELETE_BATCH_SIZE })
  if (toDeleteError) {
    console.error('[data-retention] list_to_delete_error', { requestId, message: toDeleteError.message })
  }
  for (const userId of (toDelete ?? []) as string[]) {
    try {
      const result = await deleteAccount(supabase, userId, true)
      if (result.ok) {
        deleted += 1
      } else if (result.step === 'blocked') {
        deleteBlocked += 1
      } else {
        deleteFailed += 1
        console.error('[data-retention] delete_failed', { requestId, userId, step: result.step, error: result.error })
      }
    } catch (error) {
      deleteFailed += 1
      console.error('[data-retention] delete_failed', { requestId, userId, error: String(error) })
    }
  }

  // ── 3. Avertissements ─────────────────────────────────────────────────────
  let warned = 0
  let warnFailed = 0
  if (!isEmailConfigured) {
    console.error('[data-retention] warnings skipped: RESEND_API_KEY is not configured', { requestId })
  } else {
    const { data: pending, error: pendingError } = await supabase.rpc('get_inactive_accounts_pending_warning', { p_limit: WARN_BATCH_SIZE })
    if (pendingError) console.error('[data-retention] list_pending_warnings_error', { requestId, message: pendingError.message })

    const sendWarning = async (account: PendingWarning, attemptId: string) => {
      const result = await deliverInactivityWarning(
        () => sendEmail(
          account.email,
          getInactivityWarningContent(account.first_name),
          AbortSignal.timeout(30_000),
        ),
        async () => {
          const { data, error } = await supabase.rpc('confirm_inactivity_warning_sent', {
            p_user_id: account.user_id,
            p_attempt_id: attemptId,
          })
          if (error) throw error
          return data === true
        },
      )

      if (result.status === 'email_error') {
        warnFailed += 1
        console.error('[data-retention] warning_email_error', { requestId, email: maskEmail(account.email) })
      } else if (result.status === 'email_rejected') {
        warnFailed += 1
        console.error('[data-retention] warning_email_failed', { requestId, email: maskEmail(account.email), status: result.httpStatus })
      } else if (result.status === 'confirmation_failed' || result.status === 'confirmation_error') {
        warnFailed += 1
        console.error('[data-retention] warning_confirmation_failed', { requestId, userId: account.user_id, status: result.status })
      } else {
        warned += 1
      }
      await new Promise(resolve => setTimeout(resolve, EMAIL_SEND_INTERVAL_MS))
    }

    const pendingWarnings = (pending ?? []) as PendingWarning[]
    for (const account of pendingWarnings) {
      try {
        const attemptId = crypto.randomUUID()
        const { data, error } = await supabase.rpc('refresh_pending_account_warning', {
          p_user_id: account.user_id,
          p_delay_days: DELETION_DELAY_DAYS,
          p_attempt_id: attemptId,
        })
        if (error) {
          warnFailed += 1
          console.error('[data-retention] pending_warning_refresh_failed', { requestId, userId: account.user_id, message: error.message })
        } else if (data) {
          await sendWarning({ ...account, deletion_scheduled_at: data as string }, attemptId)
        }
      } catch {
        warnFailed += 1
        console.error('[data-retention] pending_warning_refresh_error', { requestId, userId: account.user_id })
      }
    }

    const remaining = Math.max(0, WARN_BATCH_SIZE - pendingWarnings.length)
    if (remaining > 0) {
      const { data: toWarn, error: toWarnError } = await supabase.rpc('get_inactive_accounts_to_warn', { p_limit: remaining })
      if (toWarnError) console.error('[data-retention] list_to_warn_error', { requestId, message: toWarnError.message })

      for (const account of (toWarn ?? []) as InactiveAccount[]) {
        // La sélection et l'envoi sont séparés : cette RPC réévalue l'activité
        // et enregistre la date avant tout appel au prestataire email.
        let scheduledAt: string | null
        const attemptId = crypto.randomUUID()
        try {
          const { data, error: claimError } = await supabase.rpc('claim_inactive_account_warning', {
            p_user_id: account.user_id,
            p_delay_days: DELETION_DELAY_DAYS,
            p_attempt_id: attemptId,
          })
          if (claimError) {
            warnFailed += 1
            console.error('[data-retention] warning_claim_failed', { requestId, userId: account.user_id, message: claimError.message })
            continue
          }
          scheduledAt = data as string | null
        } catch {
          warnFailed += 1
          console.error('[data-retention] warning_claim_error', { requestId, userId: account.user_id })
          continue
        }
        if (!scheduledAt) continue
        await sendWarning({ ...account, deletion_scheduled_at: scheduledAt as string }, attemptId)
      }
    }
  }

  const summary = { purged, deleted, deleteFailed, deleteBlocked, warned, warnFailed }
  console.log('[data-retention] success', { requestId, ...summary })
  return json({ success: true, ...summary })
})
