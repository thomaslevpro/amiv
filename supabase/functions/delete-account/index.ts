import { createClient } from 'npm:@supabase/supabase-js@2.104.1'
import { deleteAccount } from '../_shared/accountDeletion.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

const ERROR_MESSAGES = {
  prepare: 'Impossible de préparer la suppression du compte.',
  storage: 'Impossible de supprimer tes fichiers.',
  auth: 'Impossible de supprimer le compte.',
  blocked: 'La suppression automatique des comptes inactifs est désactivée.',
}

// Suppression à la demande de l'utilisateur. La logique est partagée avec
// data-retention (comptes inactifs) : voir _shared/accountDeletion.ts.
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

  const result = await deleteAccount(supabase, user.id)
  if (!result.ok) {
    console.error(`delete-account ${result.step} failed`, user.id, result.error)
    return json({ error: ERROR_MESSAGES[result.step] }, 500)
  }

  return json({
    ok: true,
    transferred_events: result.transferredEvents,
    deleted_events: result.deletedEvents,
    deleted_files: result.deletedFiles,
  })
})
