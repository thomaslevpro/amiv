import {
  buildApnsPayload,
  createApnsJwt,
  createJwtCache,
  isInvalidTokenResponse,
  pemToPkcs8,
  profileLookupFor,
  pushTargetFor,
  sendToApns,
  type PushNotificationRow,
} from './apns.ts'

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function notification(type: string, data: Record<string, unknown> = {}, body: string | null = 'Corps'): PushNotificationRow {
  return { id: '11111111-1111-1111-1111-111111111111', type, title: 'Titre', body, data }
}

function base64UrlDecode(value: string) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

async function generateP8() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  let binary = ''
  for (const byte of pkcs8) binary += String.fromCharCode(byte)
  const lines = btoa(binary).match(/.{1,64}/g)!.join('\n')
  return { pem: `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`, publicKey: pair.publicKey, pkcs8 }
}

Deno.test('pemToPkcs8 accepts real and literal \\n line breaks', async () => {
  const { pem, pkcs8 } = await generateP8()
  assertEquals(Array.from(pemToPkcs8(pem)), Array.from(pkcs8), 'real newlines')
  assertEquals(Array.from(pemToPkcs8(pem.replace(/\n/g, '\\n'))), Array.from(pkcs8), 'literal \\n')
})

Deno.test('createApnsJwt produces a verifiable ES256 token with kid, iss and iat', async () => {
  const { pem, publicKey } = await generateP8()
  const jwt = await createApnsJwt(pem, 'KEY123', 'W4U4R3KHLC', 1_700_000_000)
  const [header, claims, signature] = jwt.split('.')
  assertEquals(JSON.parse(new TextDecoder().decode(base64UrlDecode(header))), { alg: 'ES256', kid: 'KEY123' }, 'header')
  assertEquals(JSON.parse(new TextDecoder().decode(base64UrlDecode(claims))), { iss: 'W4U4R3KHLC', iat: 1_700_000_000 }, 'claims')
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    base64UrlDecode(signature),
    new TextEncoder().encode(`${header}.${claims}`),
  )
  if (!valid) throw new Error('signature does not verify')
})

Deno.test('JWT cache reuses the token for 50 minutes then renews it', async () => {
  const calls: number[] = []
  const getJwt = createJwtCache(async issuedAt => { calls.push(issuedAt); return `jwt-${issuedAt}` })
  assertEquals(await getJwt(1000), 'jwt-1000', 'first')
  assertEquals(await getJwt(1000 + 49 * 60), 'jwt-1000', 'cached')
  assertEquals(await getJwt(1000 + 50 * 60), `jwt-${1000 + 50 * 60}`, 'renewed')
  assertEquals(calls.length, 2, 'sign calls')
})

Deno.test('pushTargetFor opens the event, its conversation, memories or the friend profile', () => {
  const eventId = '22222222-2222-2222-2222-222222222222'
  assertEquals(pushTargetFor(notification('event_invitation', { event_id: eventId }), null), { screen: 'event', event_id: eventId }, 'invitation')
  assertEquals(pushTargetFor(notification('message_received', { event_id: eventId }), null), { screen: 'messages', event_id: eventId }, 'message')
  assertEquals(
    pushTargetFor(notification('message_received', { conversation_id: 'c1', sender_id: 'u1' }), null),
    { screen: 'conversation', conversation_id: 'c1', sender_id: 'u1' },
    'direct message',
  )
  assertEquals(pushTargetFor(notification('memories_surprise', { event_id: eventId }), null), { screen: 'memories', event_id: eventId }, 'surprise')
  assertEquals(pushTargetFor(notification('memories_revealed', { event_id: eventId }), null), { screen: 'event', event_id: eventId }, 'revealed')
  assertEquals(pushTargetFor(notification('birthday_reminder', { birthday_id: 'b' }), 'lea'), { screen: 'profile', username: 'lea' }, 'birthday linked')
  assertEquals(pushTargetFor(notification('birthday_reminder', { birthday_id: 'b' }), null), { screen: 'home' }, 'birthday unlinked')
  assertEquals(pushTargetFor(notification('event_updated', { event_id: eventId, cancelled: true }), null), { screen: 'home' }, 'cancelled')
})

Deno.test('profileLookupFor resolves friend senders and birthday people only', () => {
  assertEquals(profileLookupFor(notification('friend_request', { sender_id: 'u1' })), { kind: 'profile', id: 'u1' }, 'friend')
  assertEquals(profileLookupFor(notification('birthday_today', { birthday_id: 'b1' })), { kind: 'birthday', id: 'b1' }, 'birthday')
  assertEquals(profileLookupFor(notification('message_received', { sender_id: 'u1', event_id: 'e' })), null, 'message')
})

Deno.test('buildApnsPayload puts the alert in aps and the target alongside', () => {
  const payload = buildApnsPayload(notification('rsvp_received', { event_id: 'e1' }), { screen: 'event', event_id: 'e1' })
  assertEquals(payload, {
    aps: { alert: { title: 'Titre', body: 'Corps' }, sound: 'default', 'thread-id': 'e1' },
    notification_id: '11111111-1111-1111-1111-111111111111',
    type: 'rsvp_received',
    target: { screen: 'event', event_id: 'e1' },
  }, 'payload')
  assertEquals(buildApnsPayload(notification('friend_accepted', {}, null), { screen: 'home' }).aps, { alert: { title: 'Titre' }, sound: 'default' }, 'no body')
  assertEquals(buildApnsPayload(notification('message_received', { conversation_id: 'c1', sender_id: 'u1' }), { screen: 'home' }).aps['thread-id'], 'c1', 'dm thread')
})

Deno.test('isInvalidTokenResponse only flags 410 and BadDeviceToken', () => {
  assertEquals(isInvalidTokenResponse(410, 'Unregistered'), true, '410')
  assertEquals(isInvalidTokenResponse(400, 'BadDeviceToken'), true, 'bad token')
  assertEquals(isInvalidTokenResponse(400, 'DeviceTokenNotForTopic'), false, 'wrong topic')
  assertEquals(isInvalidTokenResponse(403, 'ExpiredProviderToken'), false, 'expired jwt')
  assertEquals(isInvalidTokenResponse(500, null), false, 'server error')
})

Deno.test('sendToApns posts to api.push.apple.com with APNs headers and reads the reason', async () => {
  let seen: { url: string; init: RequestInit } | null = null
  const fakeFetch = (async (url: string, init: RequestInit) => {
    seen = { url, init }
    return new Response(JSON.stringify({ reason: 'BadDeviceToken' }), { status: 400 })
  }) as unknown as typeof fetch
  const result = await sendToApns('abcd', { aps: {} }, { jwt: 'J', bundleId: 'app.amiv', collapseId: 'c1' }, fakeFetch)
  assertEquals(result, { status: 400, reason: 'BadDeviceToken' }, 'result')
  assertEquals(seen!.url, 'https://api.push.apple.com/3/device/abcd', 'url')
  assertEquals(seen!.init.headers, {
    authorization: 'bearer J',
    'apns-topic': 'app.amiv',
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-collapse-id': 'c1',
    'content-type': 'application/json',
  }, 'headers')
})
