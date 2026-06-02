import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function getNextSundayEnd() {
  const now = new Date()
  const expires = new Date(now)
  const daysUntilSunday = (7 - now.getDay()) % 7
  expires.setDate(now.getDate() + daysUntilSunday)
  expires.setHours(23, 59, 0, 0)
  return expires.toISOString()
}

function responseCount(post) {
  const raw = post?.availability_responses
  if (typeof raw === 'number') return raw
  if (Array.isArray(raw)) return raw[0]?.count ?? raw.length
  return raw?.count ?? 0
}

async function getFriendData(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, is_close_friend')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')

  if (error) throw error

  return (data ?? []).map(row => ({
    friendId: row.requester_id === userId ? row.addressee_id : row.requester_id,
    isCloseFriend: row.is_close_friend,
  }))
}

async function fetchGoingResponses(postIds) {
  if (!postIds.length) return {}

  let { data, error } = await supabase
    .from('availability_responses')
    .select('id, post_id, user_id, status, moods, profiles(first_name, name, avatar_url)')
    .in('post_id', postIds)
    .eq('status', 'going')
    .order('created_at', { ascending: true })

  if (error) {
    const fallback = await supabase
      .from('availability_responses')
      .select('id, post_id, user_id, status, moods')
      .in('post_id', postIds)
      .eq('status', 'going')
      .order('created_at', { ascending: true })
    if (fallback.error) throw fallback.error
    data = fallback.data ?? []
  }

  return (data ?? []).reduce((acc, response) => {
    acc[response.post_id] = [...(acc[response.post_id] ?? []), response]
    return acc
  }, {})
}

export function useAvailability(userId) {
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchFeed = useCallback(async () => {
    if (!userId) {
      setFeed([])
      return []
    }

    setLoading(true)
    try {
      const friendData = await getFriendData(userId)
      const friendIds = friendData.map(f => f.friendId)
      const closeFriendIds = friendData.filter(f => f.isCloseFriend).map(f => f.friendId)
      const visibleUserIds = [userId, ...friendIds]

      const { data, error } = await supabase
        .from('availability_posts')
        .select('*, profiles(first_name, name, avatar_url), availability_responses(count)')
        .gt('expires_at', new Date().toISOString())
        .in('user_id', visibleUserIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      const posts = data ?? []
      const visiblePosts = posts.filter(post => {
        if (post.user_id === userId) return true
        if (post.visibility === 'close_friends' || post.visibility === 'close') {
          return closeFriendIds.includes(post.user_id)
        }
        return true
      })
      const responsesByPost = await fetchGoingResponses(visiblePosts.map(post => post.id))
      const enriched = visiblePosts.map(post => {
        const goingResponses = responsesByPost[post.id] ?? []
        return {
          ...post,
          response_count: responseCount(post),
          going_count: goingResponses.length,
          going_responses: goingResponses,
        }
      })

      setFeed(enriched)
      return enriched
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchFeed().catch(error => console.error('[Availability] fetchFeed error:', error))
  }, [fetchFeed])

  const createPost = useCallback(async (_userId, { message, moods, available_dates, visibility }) => {
    const actorId = _userId ?? userId
    const { data, error } = await supabase
      .from('availability_posts')
      .insert({
        user_id: actorId,
        message,
        moods,
        available_dates,
        visibility,
        expires_at: getNextSundayEnd(),
      })
      .select()
      .single()

    if (error) throw error
    await fetchFeed()
    return data
  }, [fetchFeed, userId])

  const respond = useCallback(async (postId, _userId, status, moods = []) => {
    const actorId = _userId ?? userId
    const { data, error } = await supabase
      .from('availability_responses')
      .upsert(
        { post_id: postId, user_id: actorId, status, moods },
        { onConflict: 'post_id,user_id' }
      )
      .select()
      .single()

    if (error) throw error
    return data
  }, [userId])

  const convertToEvent = useCallback(async (postId, eventId) => {
    const { data, error } = await supabase
      .from('availability_posts')
      .update({ converted_event_id: eventId })
      .eq('id', postId)
      .select()
      .single()

    if (error) throw error
    await fetchFeed()
    return data
  }, [fetchFeed])

  return { feed, loading, fetchFeed, createPost, respond, convertToEvent, refetch: fetchFeed }
}
