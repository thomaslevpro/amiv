import { supabase } from './supabase'

export async function getFriendSuggestions(userId) {
  return supabase.rpc('get_friend_suggestions', { p_user_id: userId })
}

export async function searchUsers(query, currentUserId) {
  const search = query?.trim()
  if (!search || search.length < 2 || !currentUserId) return { data: [], error: null }

  const friendshipsRes = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, status, id')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
    .in('status', ['pending', 'accepted'])

  if (friendshipsRes.error) return { data: null, error: friendshipsRes.error }

  const excludedIds = [
    currentUserId,
    ...(friendshipsRes.data ?? [])
      .filter(f => {
        const iSent = f.requester_id === currentUserId
        return f.status === 'accepted' || (f.status === 'pending' && !iSent)
      })
      .map(f => f.requester_id === currentUserId ? f.addressee_id : f.requester_id),
  ].filter(Boolean)

  const pendingSentMap = Object.fromEntries(
    (friendshipsRes.data ?? [])
      .filter(f => f.status === 'pending' && f.requester_id === currentUserId)
      .map(f => [f.addressee_id, { friendshipId: f.id, status: 'pending_sent' }])
  )

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

  const { data, error } = await profilesQuery
  if (error) return { data: null, error }

  return {
    data: (data ?? []).map(profile => ({
      ...profile,
      ...(pendingSentMap[profile.id] ?? {}),
    })),
    error: null,
  }
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
