import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.104.1'

// Suppression d'un compte, partagée par delete-account (à la demande de
// l'utilisateur) et data-retention (comptes inactifs). Client service role.
// Ordre : nettoyage SQL → fichiers Storage → utilisateur auth.
// Chaque étape est rejouable : si l'une échoue, l'utilisateur existe encore
// et la suppression peut être relancée.

const STORAGE_BATCH_SIZE = 100

type DeletionPlan = {
  transferred_event_ids: string[]
  deleted_event_ids: string[]
  files: { bucket: string; name: string }[]
}

export type AccountDeletionResult =
  | { ok: true; transferredEvents: number; deletedEvents: number; deletedFiles: number }
  | { ok: false; step: 'prepare' | 'storage' | 'auth'; error: unknown }

export async function deleteAccount(supabase: SupabaseClient, userId: string): Promise<AccountDeletionResult> {
  // ── Transfert / suppression des événements, nettoyage des tables ──────────
  const { data, error: planError } = await supabase.rpc('prepare_account_deletion', { p_user_id: userId })
  const plan = data as DeletionPlan | null
  if (planError || !plan) return { ok: false, step: 'prepare', error: planError }

  // ── Fichiers Storage ──────────────────────────────────────────────────────
  const namesByBucket = new Map<string, string[]>()
  for (const file of plan.files ?? []) {
    namesByBucket.set(file.bucket, [...(namesByBucket.get(file.bucket) ?? []), file.name])
  }

  for (const [bucket, names] of namesByBucket) {
    for (let i = 0; i < names.length; i += STORAGE_BATCH_SIZE) {
      const { error } = await supabase.storage.from(bucket).remove(names.slice(i, i + STORAGE_BATCH_SIZE))
      if (error) return { ok: false, step: 'storage', error: { bucket, error } }
    }
  }

  // ── Utilisateur (cascade sur profil, amitiés, RSVP, anonymisation…) ───────
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
  if (deleteError) return { ok: false, step: 'auth', error: deleteError }

  return {
    ok: true,
    transferredEvents: plan.transferred_event_ids?.length ?? 0,
    deletedEvents: plan.deleted_event_ids?.length ?? 0,
    deletedFiles: plan.files?.length ?? 0,
  }
}
