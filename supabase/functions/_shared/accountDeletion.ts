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
  | { ok: false; step: 'prepare' | 'storage' | 'auth' | 'blocked'; error: unknown }

export async function deleteAccount(supabase: SupabaseClient, userId: string, requireInactiveWarning = false): Promise<AccountDeletionResult> {
  // Supabase Auth deletion is a separate HTTP operation. No SQL lock or
  // eligibility check can make it conditional on the user's last activity.
  // Keep scheduled deletion fail-closed until that cross-service race is
  // covered by an Auth/session gate that applies to every client request.
  if (requireInactiveWarning) {
    return {
      ok: false,
      step: 'blocked',
      error: 'automatic deletion is disabled until reconnects can be excluded atomically',
    }
  }

  // ── Transfert / suppression des événements, nettoyage des tables ──────────
  let plan: DeletionPlan | null
  try {
    const { data, error: planError } = await supabase.rpc('prepare_account_deletion_with_storage_queue', { p_user_id: userId })
    if (planError || !data) return { ok: false, step: 'prepare', error: planError ?? 'empty deletion plan' }
    plan = data as DeletionPlan
  } catch (error) {
    return { ok: false, step: 'prepare', error }
  }

  // ── Fichiers Storage ──────────────────────────────────────────────────────
  const namesByBucket = new Map<string, string[]>()
  for (const file of plan.files ?? []) {
    namesByBucket.set(file.bucket, [...(namesByBucket.get(file.bucket) ?? []), file.name])
  }

  for (const [bucket, names] of namesByBucket) {
    for (let i = 0; i < names.length; i += STORAGE_BATCH_SIZE) {
      const batch = names.slice(i, i + STORAGE_BATCH_SIZE)
      try {
        const { error } = await supabase.storage.from(bucket).remove(batch)
        if (error) return { ok: false, step: 'storage', error: { bucket, error } }
      } catch (error) {
        return { ok: false, step: 'storage', error: { bucket, error } }
      }
      try {
        const { error: queueError } = await supabase
          .from('account_deletion_storage_queue')
          .delete()
          .eq('user_id', userId)
          .eq('bucket_id', bucket)
          .in('name', batch)
        if (queueError) return { ok: false, step: 'storage', error: { bucket, error: queueError } }
      } catch (error) {
        return { ok: false, step: 'storage', error: { bucket, error } }
      }
    }
  }

  try {
    const { data: pendingFiles, error: pendingFilesError } = await supabase
      .from('account_deletion_storage_queue')
      .select('name')
      .eq('user_id', userId)
      .limit(1)
    if (pendingFilesError || pendingFiles?.length) {
      return { ok: false, step: 'storage', error: pendingFilesError ?? 'storage queue still contains pending files' }
    }
  } catch (error) {
    return { ok: false, step: 'storage', error }
  }

  // ── Utilisateur (cascade sur profil, amitiés, RSVP, anonymisation…) ───────
  try {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) return { ok: false, step: 'auth', error: deleteError }
  } catch (error) {
    return { ok: false, step: 'auth', error }
  }

  return {
    ok: true,
    transferredEvents: plan.transferred_event_ids?.length ?? 0,
    deletedEvents: plan.deleted_event_ids?.length ?? 0,
    deletedFiles: plan.files?.length ?? 0,
  }
}
