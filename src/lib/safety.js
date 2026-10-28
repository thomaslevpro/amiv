import { supabase } from './supabase'
import { captureSupabaseError } from './monitoring'

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harcèlement' },
  { id: 'inappropriate', label: 'Contenu inapproprié' },
  { id: 'other', label: 'Autre' },
]

// targetType : 'event_message' | 'direct_message' | 'profile'
// La personne signalée et le contenu sont figés côté base (trigger prepare_report).
export async function submitReport({ targetType, targetId, reason, comment }) {
  const { error } = await supabase.from('reports').insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    comment: comment?.trim() || null,
  })
  // Déjà signalé par cette personne : le signalement existe, rien à refaire
  if (error && error.code !== '23505') {
    captureSupabaseError(error, { operation: 'submit_report' })
    throw error
  }
  if (!error) {
    supabase.functions.invoke('send-email', { body: { action: 'report_created' } })
      .then(({ error: invokeError }) => {
        if (invokeError) console.error('[safety] report email failed', invokeError)
      })
  }
}

export async function blockUser(userId) {
  const { error } = await supabase.from('user_blocks').insert({ blocked_id: userId })
  if (error && error.code !== '23505') {
    captureSupabaseError(error, { operation: 'block_user' })
    throw error
  }
}

export async function unblockUser(userId) {
  const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', userId)
  if (error) {
    captureSupabaseError(error, { operation: 'unblock_user' })
    throw error
  }
}

export async function isBlockedByMe(userId) {
  const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('blocked_id', userId).maybeSingle()
  if (error) return false
  return !!data
}

export async function fetchBlockedUsers() {
  const { data: rows, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!rows?.length) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, name, username, avatar_url')
    .in('id', rows.map(row => row.blocked_id))
  if (profilesError) throw profilesError

  const byId = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
  return rows.map(row => ({ id: row.blocked_id, blockedAt: row.created_at, profile: byId[row.blocked_id] ?? null }))
}
