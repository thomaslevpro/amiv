import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useActivity(userId) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setActivities([])
      setLoading(false)
      return
    }

    setLoading(true)

    supabase
      .from('activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (data) setActivities(data)
        setLoading(false)
      })

    const channelName = 'activity-' + userId + '-' + Math.random().toString(36).slice(2)
    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity',
      },
      (payload) => {
        setActivities(prev => [payload.new, ...prev])
      }
    )

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Activity] Realtime error:', status)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { activities, loading }
}
