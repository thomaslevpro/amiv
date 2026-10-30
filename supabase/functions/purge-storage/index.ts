import { createClient } from 'npm:@supabase/supabase-js@2.104.1'
import { isCronRequest } from '../_shared/cron.ts'

// Efface les fichiers listés dans storage_deletion_queue (photos d'album
// supprimées, y compris par cascade d'un événement ou d'un compte). Appelée
// par request_storage_purge (pg_net, juste après la suppression) et par le
// cron event-photos-maintenance. Le SQL ne peut pas effacer dans
// storage.objects (storage.protect_delete) : on passe par l'API Storage, puis
// confirm_storage_deletions ne retire de la file que les objets réellement
// absents.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const QUEUE_BATCH_SIZE = 500
const STORAGE_BATCH_SIZE = 100

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!isCronRequest(req)) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: queue, error: queueError } = await supabase
    .from('storage_deletion_queue')
    .select('bucket_id, name')
    .order('created_at')
    .limit(QUEUE_BATCH_SIZE)
  if (queueError) {
    console.error('[purge-storage] queue_error', { message: queueError.message })
    return json({ error: queueError.message }, 500)
  }

  const namesByBucket = new Map<string, string[]>()
  for (const item of queue ?? []) {
    namesByBucket.set(item.bucket_id, [...(namesByBucket.get(item.bucket_id) ?? []), item.name])
  }

  let failed = 0
  for (const [bucket, names] of namesByBucket) {
    for (let i = 0; i < names.length; i += STORAGE_BATCH_SIZE) {
      const batch = names.slice(i, i + STORAGE_BATCH_SIZE)
      const { error } = await supabase.storage.from(bucket).remove(batch)
      if (error) {
        failed += batch.length
        console.error('[purge-storage] remove_error', { bucket, count: batch.length, message: error.message })
      }
    }
  }

  const { data: remaining, error: confirmError } = await supabase.rpc('confirm_storage_deletions')
  if (confirmError) {
    console.error('[purge-storage] confirm_error', { message: confirmError.message })
    return json({ error: confirmError.message }, 500)
  }

  return json({ processed: queue?.length ?? 0, failed, remaining })
})
