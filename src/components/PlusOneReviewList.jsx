import { useEffect, useState } from 'react'
import { usePlusOne } from '../hooks/usePlusOne'
import { supabase } from '../lib/supabase'

const GRADIENT = 'var(--gradient)'

function initials(name = '') {
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

function avatarColor(name = '') {
  const colors = ['#e055aa', '#f5a623', '#34C759', '#007AFF', '#AF52DE', '#FF9500']
  const hash = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export default function PlusOneReviewList({ eventId, isOrganizer }) {
  const { respondPlusOne } = usePlusOne()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (!eventId || !isOrganizer) return
    let cancelled = false

    async function fetchRequests() {
      setLoading(true)
      const [rsvpRes, guestRes] = await Promise.all([
        supabaseWithProfiles(eventId),
        fetchGuestRequests(eventId),
      ])

      if (cancelled) return

      setRequests([...(rsvpRes ?? []), ...(guestRes ?? [])])
      setLoading(false)
    }

    fetchRequests()
    return () => { cancelled = true }
  }, [eventId, isOrganizer])

  async function handleResponse(request, status) {
    setSavingId(request.key)
    try {
      await respondPlusOne({
        rsvpId: request.id,
        table: request.table,
        status,
        eventId,
        inviteeUserId: request.inviteeUserId,
      })
      setRequests(prev => prev.filter(item => item.key !== request.key))
    } catch (error) {
      console.error('Erreur réponse +1 :', error)
    } finally {
      setSavingId(null)
    }
  }

  if (!isOrganizer || loading || requests.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray1)', marginBottom: 12 }}>
        Demandes de +1
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map(request => (
          <div key={request.key} style={{ paddingTop: 12, borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: avatarColor(request.inviteeName), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                {initials(request.inviteeName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--black)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {request.inviteeName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray1)', marginTop: 2 }}>
                  +1 demandé : <span style={{ fontWeight: 700, color: 'var(--black)' }}>{request.plusOneName}</span>
                </div>
              </div>
            </div>
            {request.message && (
              <div style={{ color: 'var(--gray1)', fontSize: 13, fontStyle: 'italic', lineHeight: 1.4, marginBottom: 10 }}>
                "{request.message}"
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleResponse(request, 'accepted')}
                disabled={savingId === request.key}
                style={{ flex: 1, borderRadius: 12, padding: '10px 12px', background: GRADIENT, color: '#fff', fontSize: 13, fontWeight: 800, opacity: savingId === request.key ? 0.55 : 1 }}
              >
                ✓ Accepter
              </button>
              <button
                type="button"
                onClick={() => handleResponse(request, 'declined')}
                disabled={savingId === request.key}
                style={{ flex: 1, borderRadius: 12, padding: '10px 12px', background: '#F2F2F7', color: 'var(--black)', fontSize: 13, fontWeight: 800, opacity: savingId === request.key ? 0.55 : 1 }}
              >
                ✗ Refuser
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function supabaseWithProfiles(eventId) {
  const { data: rsvps, error } = await supabase
    .from('rsvps')
    .select('id, event_id, user_id, plus_one_name, plus_one_message')
    .eq('event_id', eventId)
    .eq('plus_one_status', 'pending')

  if (error) {
    console.error('Erreur chargement demandes +1 :', error)
    return []
  }

  const userIds = [...new Set((rsvps ?? []).map(row => row.user_id).filter(Boolean))]
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, first_name, name').in('id', userIds)
    : { data: [] }
  const profileMap = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))

  return (rsvps ?? []).map(row => {
    const profile = profileMap[row.user_id]
    return {
      key: `rsvps-${row.id}`,
      id: row.id,
      table: 'rsvps',
      inviteeUserId: row.user_id,
      inviteeName: profile?.first_name || profile?.name || 'Invité',
      plusOneName: row.plus_one_name,
      message: row.plus_one_message,
    }
  })
}

async function fetchGuestRequests(eventId) {
  const { data, error } = await supabase
    .from('guest_rsvps')
    .select('id, guest_name, plus_one_name, plus_one_message')
    .eq('event_id', eventId)
    .eq('plus_one_status', 'pending')

  if (error) {
    console.error('Erreur chargement demandes +1 publiques :', error)
    return []
  }

  return (data ?? []).map(row => ({
    key: `guest_rsvps-${row.id}`,
    id: row.id,
    table: 'guest_rsvps',
    inviteeUserId: null,
    inviteeName: row.guest_name || 'Invité',
    plusOneName: row.plus_one_name,
    message: row.plus_one_message,
  }))
}
