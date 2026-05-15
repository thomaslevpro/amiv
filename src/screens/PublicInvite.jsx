import { useState, useEffect } from 'react'
import { Calendar, MapPin, User, Cake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Auth from './Auth'

const typeEmoji = {
  'Anniversaire': <Cake size={20} strokeWidth={1.5} />,
  'Soirée': '🥂',
  'Repas': '🍽️',
  'Autre': '🎉',
}

function formatDate(dateStr) {
  if (!dateStr) return 'Date non précisée'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PublicInvite({ token }) {
  const [event, setEvent] = useState(null)
  const [organizer, setOrganizer] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rsvpDone, setRsvpDone] = useState(false)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    async function load() {
      const [eventRes, { data: { user: currentUser } }] = await Promise.all([
        supabase.from('events').select('*').eq('share_token', token).maybeSingle(),
        supabase.auth.getUser(),
      ])

      if (eventRes.error || !eventRes.data) {
        setError('Événement introuvable.')
        setLoading(false)
        return
      }

      const ev = eventRes.data
      setEvent(ev)
      setUser(currentUser ?? null)

      if (ev.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', ev.created_by)
          .maybeSingle()
        setOrganizer(profile)
      }

      setLoading(false)
    }
    load()
  }, [token])

  async function handleRsvp() {
    if (!user) { setShowAuth(true); return }
    setRsvpLoading(true)
    const { error } = await supabase
      .from('rsvps')
      .upsert({ event_id: event.id, user_id: user.id, status: 'going' }, { onConflict: 'event_id,user_id' })
    if (!error) setRsvpDone(true)
    setRsvpLoading(false)
  }

  function handleAuthLogin() {
    setShowAuth(false)
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null)
    })
  }

  if (showAuth) return <Auth onLogin={handleAuthLogin} initialIsLogin={true} />

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9fb' }}>
      <div style={{ fontSize: 48, fontWeight: 900, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Amiv
      </div>
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#faf9fb', gap: 12 }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>{error}</div>
    </div>
  )

  const emoji = typeEmoji[event.type] ?? '🎉'

  const infoRows = [
    { icon: <Calendar size={16} strokeWidth={1.5} />, label: 'Date', value: formatDate(event.date) },
    { icon: <MapPin size={16} strokeWidth={1.5} />, label: 'Lieu', value: event.location || 'Lieu non précisé' },
    organizer?.name ? { icon: <User size={16} strokeWidth={1.5} />, label: 'Organisateur', value: organizer.name } : null,
  ].filter(Boolean)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg,#e055aa,#f5a623)', padding: '60px 20px 32px', textAlign: 'center', color: '#fff', flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 20, opacity: 0.95 }}>Amiv</div>
        <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>{event.name}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Tu es invité(e) !</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          {infoRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < infoRows.length - 1 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{row.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{row.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {event.description && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: '#1C1C1E', lineHeight: 1.5 }}>{event.description}</div>
          </div>
        )}

        {rsvpDone ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>Tu participes !</div>
          </div>
        ) : (
          <div
            onClick={handleRsvp}
            style={{
              padding: 17, borderRadius: 16, textAlign: 'center',
              fontSize: 16, fontWeight: 800,
              background: rsvpLoading ? '#F2F2F7' : 'linear-gradient(135deg,#e055aa,#f5a623)',
              color: rsvpLoading ? '#8E8E93' : '#fff',
              cursor: rsvpLoading ? 'default' : 'pointer',
              boxShadow: rsvpLoading ? 'none' : '0 4px 16px rgba(224,85,170,0.35)',
            }}
          >
            {rsvpLoading ? '…' : 'Je participe 🎉'}
          </div>
        )}
      </div>
    </div>
  )
}
