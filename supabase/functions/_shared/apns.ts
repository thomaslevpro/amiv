// Envoi direct à APNs (HTTP/2, authentification par jeton JWT ES256 signé
// avec la clé .p8). Les builds TestFlight et App Store utilisent
// l'environnement production.
export const APNS_HOST = 'https://api.push.apple.com'

export type PushNotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
}

// Écran à ouvrir quand on appuie sur la notification (lu par src/lib/push.js).
export type PushTarget =
  | { screen: 'event'; event_id: string }
  | { screen: 'messages'; event_id: string }
  | { screen: 'memories'; event_id: string }
  | { screen: 'conversation'; conversation_id: string; sender_id: string }
  | { screen: 'profile'; username: string }
  | { screen: 'home' }

function base64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlJson(value: unknown) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

// Accepte le contenu du fichier .p8 tel quel, avec de vrais retours à la
// ligne ou des « \n » littéraux (copie dans le dashboard).
export function pemToPkcs8(pem: string) {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function createApnsJwt(keyPem: string, keyId: string, teamId: string, issuedAt: number) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(keyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signingInput = `${base64UrlJson({ alg: 'ES256', kid: keyId })}.${base64UrlJson({ iss: teamId, iat: issuedAt })}`
  // WebCrypto renvoie la signature au format r||s attendu par JWS.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`
}

// APNs refuse un jeton de plus d'une heure et limite les renouvellements
// (pas plus d'un toutes les 20 min) : on le garde 50 min.
const JWT_LIFETIME_SECONDS = 50 * 60

export function createJwtCache(sign: (issuedAt: number) => Promise<string>) {
  let cached: { jwt: string; issuedAt: number } | null = null
  return async (now = Math.floor(Date.now() / 1000)) => {
    if (!cached || now - cached.issuedAt >= JWT_LIFETIME_SECONDS) {
      cached = { jwt: await sign(now), issuedAt: now }
    }
    return cached.jwt
  }
}

function stringField(data: Record<string, unknown> | null, key: string) {
  const value = data?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

// Même logique que NotificationPanel.handleNavigate ; pour les amis et les
// anniversaires, l'username du profil est résolu par send-push.
export function pushTargetFor(notification: PushNotificationRow, profileUsername: string | null): PushTarget {
  const eventId = stringField(notification.data, 'event_id')
  if (notification.data?.cancelled) return { screen: 'home' }
  const conversationId = stringField(notification.data, 'conversation_id')
  const senderId = stringField(notification.data, 'sender_id')
  if (notification.type === 'message_received' && conversationId && senderId) {
    return { screen: 'conversation', conversation_id: conversationId, sender_id: senderId }
  }
  if (eventId) {
    if (notification.type === 'message_received') return { screen: 'messages', event_id: eventId }
    if (notification.type === 'memories_surprise') return { screen: 'memories', event_id: eventId }
    return { screen: 'event', event_id: eventId }
  }
  if (profileUsername) return { screen: 'profile', username: profileUsername }
  return { screen: 'home' }
}

// Profil de l'ami à ouvrir : expéditeur d'une demande d'ami, ou personne
// fêtée (birthdays.linked_profile_id) pour un rappel d'anniversaire.
export function profileLookupFor(notification: PushNotificationRow) {
  if (notification.type === 'friend_request' || notification.type === 'friend_accepted') {
    const senderId = stringField(notification.data, 'sender_id')
    return senderId ? { kind: 'profile' as const, id: senderId } : null
  }
  if (notification.type === 'birthday_reminder' || notification.type === 'birthday_today') {
    const birthdayId = stringField(notification.data, 'birthday_id')
    return birthdayId ? { kind: 'birthday' as const, id: birthdayId } : null
  }
  return null
}

export function buildApnsPayload(notification: PushNotificationRow, target: PushTarget) {
  const threadId = stringField(notification.data, 'event_id') ?? stringField(notification.data, 'conversation_id')
  return {
    aps: {
      alert: notification.body
        ? { title: notification.title, body: notification.body }
        : { title: notification.title },
      sound: 'default',
      // Regroupe les notifications d'un même événement ou d'une même
      // conversation dans le centre de notifications.
      ...(threadId ? { 'thread-id': threadId } : {}),
    },
    notification_id: notification.id,
    type: notification.type,
    target,
  }
}

// 410 = jeton désinscrit ; BadDeviceToken = jeton invalide pour cet
// environnement (ex. build Xcode de développement).
export function isInvalidTokenResponse(status: number, reason: string | null) {
  return status === 410 || reason === 'BadDeviceToken'
}

export async function sendToApns(
  token: string,
  payload: unknown,
  options: { jwt: string; bundleId: string; collapseId?: string },
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(`${APNS_HOST}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${options.jwt}`,
      'apns-topic': options.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      ...(options.collapseId ? { 'apns-collapse-id': options.collapseId } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  let reason: string | null = null
  if (!response.ok) {
    try {
      reason = (await response.json())?.reason ?? null
    } catch {
      reason = null
    }
  } else {
    await response.body?.cancel()
  }
  return { status: response.status, reason }
}
