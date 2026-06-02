import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  getFriendSuggestions,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,
} from '../lib/friendships'

export function useFriendships(userId) {
  const [suggestions, setSuggestions] = useState([])
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [sugRes, friendsRes, pendingRes] = await Promise.all([
      getFriendSuggestions(userId),
      getFriends(userId),
      getPendingRequests(userId),
    ])
    if (sugRes.data) setSuggestions(sugRes.data)
    if (friendsRes.data) setFriends(friendsRes.data)
    if (pendingRes.data) setPendingRequests(pendingRes.data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    refresh()

    const channelName = 'friendships-' + userId + '-' + Math.random().toString(36).slice(2)
    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'friendships' },
      (payload) => {
        const row = payload.new || payload.old
        if (row?.requester_id === userId || row?.addressee_id === userId) {
          refresh()
        }
      }
    )

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Friendships] Realtime error:', status)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  const sendRequest = async (addresseeId, eventContextId = null) => {
    const { error } = await sendFriendRequest(userId, addresseeId, eventContextId)
    if (!error) setSuggestions(prev => prev.filter(s => s.user_id !== addresseeId))
    return { error }
  }

  const acceptRequest = async (friendshipId) => {
    const { error } = await acceptFriendRequest(friendshipId)
    if (!error) refresh()
    return { error }
  }

  const declineRequest = async (friendshipId) => {
    const { error } = await declineFriendRequest(friendshipId)
    if (!error) setPendingRequests(prev => prev.filter(r => r.friendship_id !== friendshipId))
    return { error }
  }

  const toggleCloseFriend = async (friendshipId) => {
    const { data: row, error: fetchError } = await supabase
      .from('friendships')
      .select('is_close_friend')
      .eq('id', friendshipId)
      .single()

    if (fetchError) return { error: fetchError }

    const { error } = await supabase
      .from('friendships')
      .update({ is_close_friend: !row.is_close_friend })
      .eq('id', friendshipId)

    if (!error) refresh()
    return { error }
  }

  return { suggestions, friends, pendingRequests, loading, sendRequest, acceptRequest, declineRequest, toggleCloseFriend }
}
