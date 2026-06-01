import { supabase } from './supabase'

export async function getFriendSuggestions(userId) {
  return supabase.rpc('get_friend_suggestions', { p_user_id: userId })
}

export async function searchUsers(query, currentUserId) {
  const search = query?.trim()
  if (!search || search.length < 2 || !currentUserId) return { data: [], error: null }

  const friendshipsRes = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
    .in('status', ['pending', 'accepted'])

  if (friendshipsRes.error) return { data: null, error: friendshipsRes.error }

  const excludedIds = [
    currentUserId,
    ...(friendshipsRes.data ?? []).map(friendship =>
      friendship.requester_id === currentUserId ? friendship.addressee_id : friendship.requester_id
    ),
  ].filter(Boolean)

  const safeSearch = search.replace(/[(),]/g, ' ')
  let profilesQuery = supabase
    .from('profiles')
    .select('id, name, first_name, username, avatar_url')
    .or(`username.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`)
    .neq('id', currentUserId)
    .limit(10)

  if (excludedIds.length > 0) {
    profilesQuery = profilesQuery.not('id', 'in', `(${excludedIds.join(',')})`)
  }

  return profilesQuery
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
