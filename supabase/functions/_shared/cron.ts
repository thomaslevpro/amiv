// Fonctions déclenchées par pg_cron : le cron envoie le header x-cron-secret
// (valeur lue dans Vault, secret « cron_secret »), comparé au secret de
// fonction CRON_SECRET. Sans secret configuré, tout appel est refusé.
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index]
  return diff === 0
}

export function isCronRequest(req: Request) {
  const provided = req.headers.get('x-cron-secret') ?? ''
  return CRON_SECRET.length > 0 && timingSafeEqual(provided, CRON_SECRET)
}
