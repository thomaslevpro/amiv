import { isCronRequest } from './cron.ts'

Deno.test('cron rejects non-POST requests even with a valid secret', () => {
  const request = new Request('https://example.test/cron', {
    method: 'GET',
    headers: { 'x-cron-secret': 'test-secret' },
  })
  if (isCronRequest(request, 'test-secret')) throw new Error('GET request was accepted')
})

Deno.test('cron rejects missing, empty, and incorrect secrets', () => {
  const missing = new Request('https://example.test/cron', { method: 'POST' })
  const empty = new Request('https://example.test/cron', {
    method: 'POST',
    headers: { 'x-cron-secret': '' },
  })
  const wrong = new Request('https://example.test/cron', {
    method: 'POST',
    headers: { 'x-cron-secret': 'wrong-secret' },
  })
  if (isCronRequest(missing, 'test-secret')) throw new Error('missing secret was accepted')
  if (isCronRequest(empty, '')) throw new Error('empty configured secret was accepted')
  if (isCronRequest(wrong, 'test-secret')) throw new Error('incorrect secret was accepted')
})

Deno.test('cron accepts POST with the configured secret', () => {
  const request = new Request('https://example.test/cron', {
    method: 'POST',
    headers: { 'x-cron-secret': 'test-secret' },
  })
  if (!isCronRequest(request, 'test-secret')) throw new Error('valid cron request was rejected')
})
