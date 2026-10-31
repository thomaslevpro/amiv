import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  // Compté côté serveur : la liste est limitée à 30 lignes. Les messages ont
  // leur propre pastille (onglet Messages), on ne les compte pas ici.
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
      .neq('type', 'message_received')
    if (error) {
      console.error('[Notifications] unread count error:', error)
      return
    }
    setUnreadCount(count ?? 0)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      return
    }

    refreshUnreadCount()
    // Un « tout marquer comme lu » émet un UPDATE par ligne : on regroupe.
    let refreshTimer = null
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshUnreadCount, 300)
    }

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
        scheduleRefresh()
      }
    )

    // Lectures faites ailleurs (tap sur un push, autre appareil, panneau)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n))
        scheduleRefresh()
      }
    )

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Notifications] Realtime error:', status)
      }
    })

    // Retour au premier plan : le websocket a pu décrocher en arrière-plan.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [userId, refreshUnreadCount])

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
    refreshUnreadCount()
  }

  const markAllAsRead = async (syncRemote = true) => {
    if (syncRemote) await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const markAllAsReadByType = async (type) => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('type', type)
    setNotifications(prev => prev.map(n => n.type === type ? { ...n, read: true } : n))
    refreshUnreadCount()
  }

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, markAllAsReadByType }
}
