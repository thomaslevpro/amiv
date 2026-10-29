import { supabase } from './supabase'

export async function getFriendSuggestions(userId) {
  return supabase.rpc('get_friend_suggestions', { p_user_id: userId })
}

export async function dismissFriendSuggestion(dismissedUserId) {
  const { error } = await supabase
    .from('suggestion_dismissals')
    .insert({ dismissed_user_id: dismissedUserId })
  // 23505 : déjà masqué, rien à faire.
  return { error: error?.code === '23505' ? null : error }
}

// search_people : nom, prénom ou pseudo (partiel), ou email exact. Mêmes exclusions
// que les suggestions ; les amis reviennent avec is_friend = true.
export async function searchPeople(query) {
  const search = query?.trim()
  if (!search || search.length < 2) return { data: [], error: null }
  return supabase.rpc('search_people', { p_query: search })
}

export async function sendFriendRequest(requesterId, addresseeId, eventContextId = null) {
  return supabase
    .from('friendships')
    .upsert(
      {
        requester_id: requesterId,
        addressee_id: addresseeId,
        event_context_id: eventContextId,
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'requester_id,addressee_id' }
    )
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

export async function cancelFriendRequest(friendshipId) {
  return supabase
    .from('friendships')
    .update({ status: 'declined' })
    .eq('id', friendshipId)
    .select()
    .single()
}

export async function getFriends(userId) {
  const { data, error } = await supabase.rpc('get_friends', { p_user_id: userId })
  if (error || !data?.length) return { data, error }

  const needsProfileFields = data.some(friend =>
    friend.friend_first_name === undefined || friend.friend_username === undefined
  )
  if (!needsProfileFields) return { data, error: null }

  const friendIds = data.map(friend => friend.friend_id).filter(Boolean)
  if (!friendIds.length) return { data, error: null }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, username')
    .in('id', friendIds)

  if (profilesError) return { data, error: null }

  const profilesById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
  return {
    data: data.map(friend => {
      const profile = profilesById[friend.friend_id] ?? {}
      return {
        ...friend,
        friend_first_name: friend.friend_first_name ?? profile.first_name ?? null,
        friend_username: friend.friend_username ?? profile.username ?? null,
      }
    }),
    error: null,
  }
}

export async function getPendingRequests(userId) {
  return supabase.rpc('get_pending_requests', { p_user_id: userId })
}
