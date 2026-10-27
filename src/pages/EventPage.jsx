import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import EventDetail from '../screens/EventDetail'

export default function EventPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)

  useEffect(() => {
    supabase.from('events').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { if (data) setEvent(data); else navigate('/') })
  }, [id])

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
