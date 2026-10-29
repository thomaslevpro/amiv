import { createClient } from 'npm:@supabase/supabase-js@2.104.1'
import { isCronRequest } from '../_shared/cron.ts'
import {
  buildApnsPayload,
  createApnsJwt,
  createJwtCache,
  isInvalidTokenResponse,
  profileLookupFor,
  pushTargetFor,
  sendToApns,
  type PushNotificationRow,
} from '../_shared/apns.ts'

// Appelée par le trigger trg_enqueue_push_notification (pg_net) à chaque
// insertion dans notifications, avec { notification_id }. Le trigger a déjà
// vérifié les réglages du destinataire et qu'il a au moins un appareil.
//
// Sécurité : sans le header x-cron-secret (Vault cron_secret = secret de
// fonction CRON_SECRET), l'appel est refusé ; la clé publique de l'app ne
// suffit pas. L'appelant ne fournit qu'un id : texte et destinataire sont
// relus en base. Id inconnu → 404 ; notification déjà envoyée → 409
// (push_deliveries).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APNS_KEY = Deno.env.get('APNS_KEY') ?? ''
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') ?? ''
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? ''
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') ?? ''

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const getJwt = createJwtCache(issuedAt => createApnsJwt(APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, issuedAt))

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!isCronRequest(req)) return json({ error: 'Unauthorized' }, 401)
  if (!APNS_KEY || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID) {
    console.error('[send-push] missing_apns_secrets')
    return json({ error: 'APNs secrets not configured' }, 500)
  }

  let notificationId: unknown
  try {
    notificationId = (await req.json())?.notification_id
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (typeof notificationId !== 'string' || !UUID_REGEX.test(notificationId)) {
    return json({ error: 'notification_id required' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, data')
    .eq('id', notificationId)
    .maybeSingle()
  if (notificationError) {
    console.error('[send-push] notification_error', { notificationId, message: notificationError.message })
    return json({ error: notificationError.message }, 500)
  }
  if (!notification) return json({ error: 'Notification not found' }, 404)

  // Réserve l'envoi avant d'appeler APNs : un second appel avec le même id
  // échoue sur la clé primaire.
  const { error: claimError } = await supabase
    .from('push_deliveries')
    .insert({ notification_id: notification.id })
  if (claimError) {
    if (claimError.code === '23505') return json({ error: 'Notification already sent' }, 409)
    if (claimError.code === '23503') return json({ error: 'Notification not found' }, 404)
    console.error('[send-push] claim_error', { notificationId, message: claimError.message })
    return json({ error: claimError.message }, 500)
  }

  const { data: tokens, error: tokensError } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', notification.user_id)
  if (tokensError) {
    console.error('[send-push] tokens_error', { notificationId, message: tokensError.message })
    return json({ error: tokensError.message }, 500)
  }
  if (!tokens?.length) return json({ success: true, sent: 0, skipped: 'no_device' })

  const row = notification as PushNotificationRow
  let username: string | null = null
  const lookup = profileLookupFor(row)
  if (lookup) {
    let profileId: string | null = lookup.id
    if (lookup.kind === 'birthday') {
      const { data: birthday } = await supabase
        .from('birthdays')
        .select('linked_profile_id')
        .eq('id', lookup.id)
        .maybeSingle()
      profileId = birthday?.linked_profile_id ?? null
    }
    if (profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', profileId)
        .maybeSingle()
      username = profile?.username ?? null
    }
  }

  const payload = buildApnsPayload(row, pushTargetFor(row, username))
  const jwt = await getJwt()

  let sent = 0
  const invalidTokens: string[] = []
  for (const { token } of tokens) {
    try {
      const result = await sendToApns(token, payload, { jwt, bundleId: APNS_BUNDLE_ID, collapseId: row.id })
      if (result.status === 200) {
        sent += 1
      } else if (isInvalidTokenResponse(result.status, result.reason)) {
        invalidTokens.push(token)
      } else {
        console.error('[send-push] apns_error', {
          notificationId,
          token: token.slice(0, 8),
          status: result.status,
          reason: result.reason,
        })
      }
    } catch (error) {
      console.error('[send-push] apns_request_failed', {
        notificationId,
        token: token.slice(0, 8),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (invalidTokens.length) {
    const { error: deleteError } = await supabase.from('device_tokens').delete().in('token', invalidTokens)
    if (deleteError) console.error('[send-push] delete_invalid_tokens_error', { message: deleteError.message })
  }

  console.log('[send-push] done', { notificationId, type: row.type, sent, removed: invalidTokens.length })
  return json({ success: true, sent, removed: invalidTokens.length })
})
