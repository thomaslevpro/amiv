import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useUnreadCounts(userId) {
  const [unreadByConversation, setUnreadByConversation] = useState(new Map())

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadByConversation(new Map())
      return
    }

    const { data, error } = await supabase.rpc('get_unread_counts', { p_user_id: userId })
    if (error) {
      console.error('[UnreadCounts] rpc error:', error)
      return
    }

    setUnreadByConversation(
      new Map((data ?? []).map(row => [row.conversation_id, Number(row.unread_count) || 0]))
    )
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setUnreadByConversation(new Map())
      return undefined
    }

    refresh()

    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`unread-counts:${userId}:${suffix}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        refresh
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_conversation_participants',
          filter: `user_id=eq.${userId}`,
        },
        refresh
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[UnreadCounts] Realtime error:', status)
        }
      })

    const handleRefresh = () => refresh()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('amiv:unread-counts-refresh', handleRefresh)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('amiv:unread-counts-refresh', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh, userId])

  const totalUnread = useMemo(
    () => Array.from(unreadByConversation.values()).reduce((sum, count) => sum + count, 0),
    [unreadByConversation]
  )

  return { unreadByConversation, totalUnread, refresh }
}
