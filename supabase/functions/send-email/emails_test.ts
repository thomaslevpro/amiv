import { buildAuthEmails } from './emails.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const user = { email: 'lea@amiv.app' }

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function single(result: ReturnType<typeof buildAuthEmails>) {
  assert(Array.isArray(result) && result.length === 1, `expected one email, got ${JSON.stringify(result)}`)
  return (result as Exclude<typeof result, { error: string }>)[0]
}

Deno.test('signup: 6-digit code in subject and body, no link', () => {
  const { to, content } = single(buildAuthEmails({ user, email_data: { email_action_type: 'signup', token: '123456', token_hash: 'hash' } }, SUPABASE_URL))
  assert(to === 'lea@amiv.app', 'wrong recipient')
  assert(content.subject === 'Ton code Amiv : 123456', `subject: ${content.subject}`)
  assert(content.html.includes('123456') && content.text.includes('123456'), 'code missing')
  assert(!content.html.includes('href') && !content.html.includes('hash'), 'signup email must not contain a link')
  assert(!content.html.includes('background-clip'), 'logo must be plain pink for Gmail')
})

Deno.test('recovery: 6-digit code, no link', () => {
  const { content } = single(buildAuthEmails({ user, email_data: { email_action_type: 'recovery', token: '654321', token_hash: 'hash' } }, SUPABASE_URL))
  assert(content.subject === 'Ton code pour changer de mot de passe : 654321', `subject: ${content.subject}`)
  assert(content.html.includes('654321') && !content.html.includes('href'), 'recovery email must show the code without link')
})

Deno.test('signup and recovery fail without a code', () => {
  for (const type of ['signup', 'recovery']) {
    const result = buildAuthEmails({ user, email_data: { email_action_type: type, token_hash: 'hash' } }, SUPABASE_URL)
    assert(!Array.isArray(result), `${type} accepted without token`)
  }
})

Deno.test('magiclink: verification link of type magiclink', () => {
  const { content } = single(buildAuthEmails({ user, email_data: { email_action_type: 'magiclink', token: '1', token_hash: 'abc' } }, SUPABASE_URL))
  assert(content.html.includes('https://project.supabase.co/auth/v1/verify?type=magiclink&amp;token=abc'), 'magic link missing')
})

Deno.test('email_change, secure: one code per address, no link, clear subjects', () => {
  const result = buildAuthEmails({
    user: { email: 'old@amiv.app', new_email: 'new@amiv.app' },
    email_data: { email_action_type: 'email_change', token: '111111', token_hash_new: 'for-old', token_new: '222222', token_hash: 'for-new' },
  }, SUPABASE_URL)
  assert(Array.isArray(result) && result.length === 2, 'expected two emails')
  const [toOld, toNew] = result as { to: string; content: { subject: string; html: string } }[]
  assert(toOld.to === 'old@amiv.app' && toOld.content.subject === 'Code de ton adresse actuelle : 111111', `old: ${toOld.to} ${toOld.content.subject}`)
  assert(toOld.content.html.includes('new@amiv.app'), 'current address must see the requested new address')
  assert(toNew.to === 'new@amiv.app' && toNew.content.subject === 'Code de ta nouvelle adresse : 222222', `new: ${toNew.to} ${toNew.content.subject}`)
  assert(!toOld.content.html.includes('href') && !toNew.content.html.includes('href'), 'no link by default')
})

Deno.test('email_change, secure + fallback: each code with its own link', () => {
  const result = buildAuthEmails({
    user: { email: 'old@amiv.app', new_email: 'new@amiv.app' },
    email_data: { email_action_type: 'email_change', token: '111111', token_hash_new: 'for-old', token_new: '222222', token_hash: 'for-new' },
  }, SUPABASE_URL, { fallbackLinks: true }) as { to: string; content: { html: string } }[]
  assert(result[0].content.html.includes('type=email_change&amp;token=for-old'), 'old address link wrong')
  assert(result[1].content.html.includes('type=email_change&amp;token=for-new'), 'new address link wrong')
})

Deno.test('email_change, not secure: one code to the new address', () => {
  const { to, content } = single(buildAuthEmails({
    user: { email: 'old@amiv.app', new_email: 'new@amiv.app' },
    email_data: { email_action_type: 'email_change', token: '', token_hash: 'only', token_new: '333333', token_hash_new: '' },
  }, SUPABASE_URL))
  assert(to === 'new@amiv.app' && content.subject === 'Code de ta nouvelle adresse : 333333', 'single email must go to the new address with its code')
})

Deno.test('email_change escapes the new address', () => {
  const result = buildAuthEmails({
    user: { email: 'old@amiv.app', new_email: '<b>x</b>@amiv.app' },
    email_data: { email_action_type: 'email_change', token: '1', token_new: '2' },
  }, SUPABASE_URL) as { content: { html: string } }[]
  assert(!result[0].content.html.includes('<b>x</b>'), 'new address not escaped')
})

Deno.test('reauthentication: code email', () => {
  const { content } = single(buildAuthEmails({ user, email_data: { email_action_type: 'reauthentication', token: '777777' } }, SUPABASE_URL))
  assert(content.html.includes('777777'), 'code missing')
})

Deno.test('security notifications are skipped without error', () => {
  const result = buildAuthEmails({ user, email_data: { email_action_type: 'password_changed_notification' } }, SUPABASE_URL)
  assert(Array.isArray(result) && result.length === 0, 'notification should be skipped')
})

Deno.test('unknown type is refused', () => {
  const result = buildAuthEmails({ user, email_data: { email_action_type: 'invite', token: '1', token_hash: 'x' } }, SUPABASE_URL)
  assert(!Array.isArray(result), 'invite should be refused (no template)')
})

Deno.test('transition: fallback link under the code only when enabled', () => {
  const payload = { user, email_data: { email_action_type: 'signup', token: '123456', token_hash: 'abc' } }
  const off = single(buildAuthEmails(payload, SUPABASE_URL)).content
  const on = single(buildAuthEmails(payload, SUPABASE_URL, { fallbackLinks: true })).content
  assert(!off.html.includes('href'), 'no link by default')
  assert(on.html.includes('123456') && on.html.includes('type=email&amp;token=abc'), 'fallback link missing')
  const recovery = single(buildAuthEmails({ user, email_data: { email_action_type: 'recovery', token: '1', token_hash: 'r' } }, SUPABASE_URL, { fallbackLinks: true })).content
  assert(recovery.html.includes('type=recovery&amp;token=r') && recovery.html.includes('auth%2Freset'), 'recovery fallback must go to /auth/reset')
})
