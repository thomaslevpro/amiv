import { deliverInactivityWarning } from './inactivityWarning.ts'

Deno.test('email failure does not confirm or report a sent warning', async () => {
  let confirmationCalls = 0
  const result = await deliverInactivityWarning(
    async () => { throw new Error('network failure') },
    async () => { confirmationCalls += 1; return true },
  )
  if (result.status !== 'email_error') throw new Error(`unexpected result: ${result.status}`)
  if (confirmationCalls !== 0) throw new Error('database confirmation ran after email failure')
})

Deno.test('provider rejection leaves the warning unconfirmed', async () => {
  let confirmationCalls = 0
  const result = await deliverInactivityWarning(
    async () => new Response('', { status: 503 }),
    async () => { confirmationCalls += 1; return true },
  )
  if (result.status !== 'email_rejected' || result.httpStatus !== 503) throw new Error('provider rejection was not surfaced')
  if (confirmationCalls !== 0) throw new Error('database confirmation ran after provider rejection')
})

Deno.test('accepted email with failed database confirmation is not considered sent', async () => {
  const result = await deliverInactivityWarning(
    async () => new Response('', { status: 200 }),
    async () => false,
  )
  if (result.status !== 'confirmation_failed') throw new Error('unconfirmed warning was reported as sent')
})

Deno.test('confirmation transport errors leave the warning ambiguous', async () => {
  const result = await deliverInactivityWarning(
    async () => new Response('', { status: 200 }),
    async () => { throw new Error('database unavailable') },
  )
  if (result.status !== 'confirmation_error') throw new Error('confirmation error was not surfaced')
})

Deno.test('a superseded concurrent attempt cannot confirm the warning', async () => {
  const result = await deliverInactivityWarning(
    async () => new Response('', { status: 200 }),
    async () => false,
  )
  if (result.status !== 'confirmation_failed') throw new Error('superseded attempt was accepted')
})

Deno.test('email and database confirmation are both required for success', async () => {
  const result = await deliverInactivityWarning(
    async () => new Response('', { status: 200 }),
    async () => true,
  )
  if (result.status !== 'sent') throw new Error('confirmed warning was not reported as sent')
})
