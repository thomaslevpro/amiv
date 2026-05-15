import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import GroupCard from '../components/GroupCard'

function frenchDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 10 12" fill="none">
      <rect x="1" y="5" width="8" height="7" rx="1.5" stroke="#993556" strokeWidth="1.2" />
      <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="#993556" strokeWidth="1.2" />
    </svg>
  )
}

const TABS = [
  { id: 'cadeaux', label: 'Cadeaux' },
  { id: 'cagnotte', label: 'Cagnotte' },
  { id: 'carte', label: 'Carte' },
]

export default function SecretSpacePage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [activeTab, setActiveTab] = useState('cadeaux')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }
      console.log('[SecretSpace] currentUser.id:', user.id)
      setCurrentUserId(user.id)

      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, user_id')
        .eq('id', eventId)
        .maybeSingle()

      console.log('[SecretSpace] event query result:', data, 'error:', error)

      if (error || !data) { navigate('/'); return }

      console.log('[SecretSpace] event.user_id:', data.user_id, '=== currentUser?', data.user_id === user.id)

      if (data.user_id) {
        const { data: orgProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.user_id)
          .maybeSingle()
        data.organizerName = orgProfile?.name ?? ''
      }

      setEvent(data)
      setLoading(false)
    }
    init()
  }, [eventId, navigate])

  useEffect(() => {
    if (loading) return
    if (!event) { navigate('/'); return }
  }, [event, loading, navigate])

  if (!event) return null

  const firstName = event.organizerName?.split(' ')[0] ?? ''

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', minHeight: '100dvh' }}>
      <div style={{ background: '#fff', padding: '16px 16px 12px', borderBottom: '1px solid #F2F2F7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px 4px 0', display: 'flex', alignItems: 'center' }}
          >
            <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
              <path d="M8.5 1.5L1.5 8.5L8.5 15.5" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>
              Amiv de {firstName}
            </div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 1 }}>
              {frenchDate(event.date)}
            </div>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(224,85,170,0.10)',
          border: '1px solid rgba(224,85,170,0.25)',
          borderRadius: 20,
          padding: '4px 12px',
          marginTop: 8,
        }}>
          <LockIcon />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#993556' }}>
            Espace secret · caché de {firstName}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <div style={{
          display: 'flex',
          background: 'rgba(118,118,128,0.12)',
          borderRadius: 10,
          padding: 3,
        }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: activeTab === tab.id ? '#1C1C1E' : '#8E8E93',
                background: activeTab === tab.id ? '#fff' : 'transparent',
                borderRadius: activeTab === tab.id ? 8 : 0,
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {activeTab === 'cadeaux' && <p style={{ color: '#8E8E93', fontSize: 14 }}>Section cadeaux — à venir</p>}
        {activeTab === 'cagnotte' && <p style={{ color: '#8E8E93', fontSize: 14 }}>Section cagnotte — à venir</p>}
        {activeTab === 'carte' && (
          <GroupCard
            eventId={event.id}
            eventDate={event.date}
            isOrganizer={currentUserId === event.user_id}
          />
        )}
      </div>
    </div>
  )
}
