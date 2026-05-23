import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    // 1. Fetch initial
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setNotifications(data)
        setLoading(false)
      })

    // 2. Realtime — .on() AVANT .subscribe()
    const channelName = 'notif-' + userId + '-' + Math.random().toString(36).slice(2)
    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        setNotifications(prev => [payload.new, ...prev])
      }
    )

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Notifications] Realtime error:', status)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = async (syncRemote = true) => {
    if (syncRemote) await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markAllAsReadByType = async (type) => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('type', type)
    setNotifications(prev => prev.map(n => n.type === type ? { ...n, read: true } : n))
  }

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, markAllAsReadByType }
}
