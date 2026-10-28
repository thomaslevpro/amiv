// Fonctions déclenchées par pg_cron : le cron envoie le header x-cron-secret
// (valeur lue dans Vault, secret « cron_secret »), comparé au secret de
// fonction CRON_SECRET. Sans secret configuré, tout appel est refusé.
function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let diff = left.length ^ right.length
  // Iterate over the configured secret length even when the provided value
  // has another length, so a length mismatch does not take an early return.
  for (let index = 0; index < right.length; index += 1) diff |= (left[index] ?? 0) ^ right[index]
  return diff === 0
}

export function isCronRequest(req: Request, configuredSecret = Deno.env.get('CRON_SECRET') ?? '') {
  if (req.method !== 'POST') return false
  const provided = req.headers.get('x-cron-secret') ?? ''
  return configuredSecret.length > 0 && timingSafeEqual(provided, configuredSecret)
}
