import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// Entrée vers les souvenirs, pour la personne fêtée. La RLS ne lui renvoie
// des souvenirs qu'à partir du jour de l'événement : avant, le compte est 0
// et rien ne s'affiche.
export default function RevealedMemoriesEntry({ eventId }) {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!eventId) return undefined
    let cancelled = false
    supabase
      .from('collective_memories')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .then(({ count: total, error }) => {
        if (error) console.error('[RevealedMemoriesEntry] count error:', error)
        if (!cancelled) setCount(total ?? 0)
      })
    return () => { cancelled = true }
  }, [eventId])

  if (count === 0) return null

  return (
    <div onClick={() => navigate(`/events/${eventId}/souvenirs`)} style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: 16, marginBottom: 14, background: 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: 50, background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />
      <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', fontSize: 24 }}>🎁</div>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Tes amis t’ont préparé une surprise</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{count} souvenir{count > 1 ? 's' : ''} à découvrir</div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative' }}><path d="M1 1l6 6-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  )
}
