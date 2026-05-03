import { supabase } from './supabase'

export async function findOrCreateDirectConversation(currentUserId, friendId) {
  const { data, error } = await supabase.rpc(
    'find_or_create_direct_conversation',
    { p_user_id: currentUserId, p_friend_id: friendId }
  )
  return { id: data, error }
}
