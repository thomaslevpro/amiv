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

Deno.test('email_change, secure: current address gets token_hash_new, new address gets token_hash', () => {
  const result = buildAuthEmails({
    user: { email: 'old@amiv.app', new_email: 'new@amiv.app' },
    email_data: { email_action_type: 'email_change', token: '1', token_hash_new: 'for-old', token_new: '2', token_hash: 'for-new' },
  }, SUPABASE_URL)
  assert(Array.isArray(result) && result.length === 2, 'expected two emails')
  const [toOld, toNew] = result as { to: string; content: { html: string } }[]
  assert(toOld.to === 'old@amiv.app' && toOld.content.html.includes('type=email_change&amp;token=for-old'), 'old address link wrong')
  assert(toNew.to === 'new@amiv.app' && toNew.content.html.includes('type=email_change&amp;token=for-new'), 'new address link wrong')
})

Deno.test('email_change, not secure: one email to the new address', () => {
  const { to, content } = single(buildAuthEmails({
    user: { email: 'old@amiv.app', new_email: 'new@amiv.app' },
    email_data: { email_action_type: 'email_change', token: '1', token_hash: 'only', token_new: '', token_hash_new: '' },
  }, SUPABASE_URL))
  assert(to === 'new@amiv.app' && content.html.includes('token=only'), 'single email must go to the new address')
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
