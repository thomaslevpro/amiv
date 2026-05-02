import { supabase } from './supabase'

export async function getFriendSuggestions(userId) {
  return supabase.rpc('get_friend_suggestions', { p_user_id: userId })
}

export async function sendFriendRequest(requesterId, addresseeId, eventContextId = null) {
  return supabase
    .from('friendships')
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      event_context_id: eventContextId,
      status: 'pending',
    })
    .select()
    .single()
}

export async function acceptFriendRequest(friendshipId) {
  return supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select()
    .single()
}

export async function declineFriendRequest(friendshipId) {
  return supabase
    .from('friendships')
    .update({ status: 'declined' })
    .eq('id', friendshipId)
    .select()
    .single()
}

export async function getFriends(userId) {
  return supabase.rpc('get_friends', { p_user_id: userId })
}

export async function getPendingRequests(userId) {
  return supabase.rpc('get_pending_requests', { p_user_id: userId })
}
