import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { savePendingEventLink } from '../lib/onboarding'
import EventDetail from '../screens/EventDetail'
import EventUnavailable from '../components/event/EventUnavailable'

export default function EventPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Pas connecté : l'app ouvrira l'événement après la connexion
      if (!session) {
        savePendingEventLink(id)
        if (!cancelled) navigate('/', { replace: true })
        return
      }
      const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
      if (cancelled) return
      if (data) setEvent(data)
      else setUnavailable(true)
    })
    return () => { cancelled = true }
  }, [id])

  if (unavailable) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <EventUnavailable onBack={() => navigate('/', { replace: true })} />
      </div>
    )
  }
  if (!event) return null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <EventDetail
        event={event}
        onBack={() => navigate('/')}
        onChat={() => {}}
        onMessagesClick={() => {}}
      />
    </div>
  )
}
