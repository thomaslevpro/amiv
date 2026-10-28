import { createClient } from 'npm:@supabase/supabase-js@2.104.1'
import { isCronRequest } from '../_shared/cron.ts'

// Déclenchée chaque jour par le cron reveal-memories. L'accès de la personne
// fêtée aux souvenirs dépend de la date en base (RLS), pas de cette fonction :
// elle ne fait que notifier et remplir events.memories_revealed_at.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type RevealResult = {
  revealed_count: number
  notified_count: number
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!isCronRequest(req)) return json({ error: 'Unauthorized' }, 401)

  const requestId = crypto.randomUUID()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabase.rpc('reveal_due_memories')

  if (error) {
    console.error('[reveal-memories] rpc_error', {
      requestId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return json({ error: error.message }, 500)
  }

  const result = (data?.[0] ?? { revealed_count: 0, notified_count: 0 }) as RevealResult

  console.log('[reveal-memories] success', {
    requestId,
    revealed: result.revealed_count,
    notified: result.notified_count,
  })

  return json({
    success: true,
    revealed: result.revealed_count,
    notified: result.notified_count,
  })
})
