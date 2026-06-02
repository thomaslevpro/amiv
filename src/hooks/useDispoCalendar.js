import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useDispoCalendar(userId) {
  const [posts, setPosts] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const refetch = useCallback(async () => {
    if (!userId) {
      setPosts([])
      return []
    }

    setLoading(true)
    try {
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted')
        .eq('is_close_friend', true)

      if (friendshipsError) throw friendshipsError

      const closeFriendIds = (friendships ?? []).map(friendship =>
        friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
      )

      if (!closeFriendIds.length) {
        setPosts([])
        return []
      }

      const { data, error } = await supabase
        .from('availability_posts')
        .select('*, profiles(id, first_name, name, avatar_url)')
        .in('user_id', closeFriendIds)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data ?? [])
      return data ?? []
    } catch (error) {
      console.error('[DispoCalendar] fetchPosts error:', error)
      setPosts([])
      return []
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchMyPosts = useCallback(async () => {
    if (!userId) {
      setMyPosts([])
      return []
    }

    try {
      const { data, error } = await supabase
        .from('availability_posts')
        .select('*, profiles(id, first_name, name, avatar_url)')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      setMyPosts(data ?? [])
      return data ?? []
    } catch (error) {
      console.error('[DispoCalendar] fetchMyPosts error:', error)
      setMyPosts([])
      return []
    }
  }, [userId])

  useEffect(() => {
    refetch()
    fetchMyPosts()
  }, [fetchMyPosts, refetch])

  const createDispo = useCallback(async (actorId, dates, moods) => {
    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('availability_posts')
        .insert({
          user_id: actorId,
          message: '',
          moods,
          available_dates: dates,
          visibility: 'close_friends',
          expires_at: (() => {
            const d = new Date()
            d.setDate(d.getDate() + 7)
            return d.toISOString()
          })(),
        })
        .select()
        .single()

      if (error) throw error
      await Promise.all([refetch(), fetchMyPosts()])
      return data
    } finally {
      setCreating(false)
    }
  }, [fetchMyPosts, refetch])

  const deleteDispo = useCallback(async (postId) => {
    const { error } = await supabase
      .from('availability_posts')
      .delete()
      .eq('id', postId)

    if (error) throw error
    await fetchMyPosts()
  }, [fetchMyPosts])

  const updateDispo = useCallback(async (postId, dates, moods) => {
    const { error } = await supabase
      .from('availability_posts')
      .update({ available_dates: dates, moods })
      .eq('id', postId)

    if (error) throw error
    await fetchMyPosts()
  }, [fetchMyPosts])

  return { posts, myPosts, loading, createDispo, creating, deleteDispo, updateDispo }
}
