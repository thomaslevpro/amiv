import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STORAGE_BATCH_SIZE = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type DeletionPlan = {
  transferred_event_ids: string[]
  deleted_event_ids: string[]
  files: { bucket: string; name: string }[]
}

// Ordre : nettoyage SQL → fichiers Storage → utilisateur auth.
// Chaque étape est rejouable : si l'une échoue, l'utilisateur existe encore
// et peut relancer la suppression depuis l'app.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Non authentifié' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── Identité de l'appelant (JWT vérifié par le serveur auth) ───────────────
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return json({ error: 'Session invalide' }, 401)

  // ── Transfert / suppression des événements, nettoyage des tables ──────────
  const { data, error: planError } = await supabase.rpc('prepare_account_deletion', { p_user_id: user.id })
  const plan = data as DeletionPlan | null

  if (planError || !plan) {
    console.error('prepare_account_deletion failed', user.id, planError)
    return json({ error: 'Impossible de préparer la suppression du compte.' }, 500)
  }

  // ── Fichiers Storage ──────────────────────────────────────────────────────
  const namesByBucket = new Map<string, string[]>()
  for (const file of plan.files ?? []) {
    namesByBucket.set(file.bucket, [...(namesByBucket.get(file.bucket) ?? []), file.name])
  }

  for (const [bucket, names] of namesByBucket) {
    for (let i = 0; i < names.length; i += STORAGE_BATCH_SIZE) {
      const { error } = await supabase.storage.from(bucket).remove(names.slice(i, i + STORAGE_BATCH_SIZE))
      if (error) {
        console.error('storage remove failed', user.id, bucket, error)
        return json({ error: 'Impossible de supprimer tes fichiers.' }, 500)
      }
    }
  }

  // ── Utilisateur (cascade sur profil, amitiés, RSVP, anonymisation…) ───────
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('deleteUser failed', user.id, deleteError)
    return json({ error: 'Impossible de supprimer le compte.' }, 500)
  }

  return json({
    ok: true,
    transferred_events: plan.transferred_event_ids?.length ?? 0,
    deleted_events: plan.deleted_event_ids?.length ?? 0,
    deleted_files: plan.files?.length ?? 0,
  })
})
