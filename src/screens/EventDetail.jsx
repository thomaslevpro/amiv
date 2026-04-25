import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const typeEmoji = {
  'Anniversaire': '🎂',
  'Soirée': '🥂',
  'Repas': '🍽️',
  'Autre': '🎉',
}

const visibilityLabel = {
  'private': 'Privé 🔒',
  'invite_only': 'Sur invitation',
  'public': 'Public 🌍',
}

function formatDate(dateStr) {
  if (!dateStr) return 'Date non précisée'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const statusIcon = { pending: '⏳', accepted: '✅', declined: '❌' }

export default function EventDetail({ event, onBack }) {
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [invitations, setInvitations] = useState([])

  useEffect(() => {
    if (!event) return
    let cancelled = false

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)

      const [rsvpRes, invRes] = await Promise.all([
        supabase.from('rsvps').select('status').eq('event_id', event.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('invitations').select('id, invited_email, status').eq('event_id', event.id).order('created_at', { ascending: true }),
      ])

      if (!cancelled) {
        setRsvpStatus(rsvpRes.data?.status ?? null)
        setInvitations(invRes.data ?? [])
      }
    }

    init()
    return () => { cancelled = true }
  }, [event?.id])

  async function fetchInvitations() {
    const { data } = await supabase
      .from('invitations')
      .select('id, invited_email, status')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })
    setInvitations(data ?? [])
  }

  async function handleInvite(e) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !userId) return

    if (invitations.some(inv => inv.invited_email.toLowerCase() === email)) {
      setInviteError('Cet email a déjà été invité.')
      return
    }

    setInviting(true)
    setInviteError(null)
    const { error } = await supabase
      .from('invitations')
      .insert({ event_id: event.id, invited_email: email, invited_by: userId })

    if (error) {
      setInviteError(error.code === '23505' ? 'Cet email a déjà été invité.' : 'Erreur lors de l\'invitation.')
    } else {
      setInviteEmail('')
      await fetchInvitations()
    }
    setInviting(false)
  }

  async function handleRsvp(status) {
    if (!userId || loading) return
    setLoading(true)
    const { error } = await supabase
      .from('rsvps')
      .upsert(
        { event_id: event.id, user_id: userId, status },
        { onConflict: 'event_id,user_id' }
      )
    if (!error) setRsvpStatus(status)
    setLoading(false)
  }

  if (!event) return null

  const emoji = typeEmoji[event.type] ?? '🎉'
  const visibility = visibilityLabel[event.visibility] ?? event.visibility ?? 'Sur invitation'

  const infoRows = [
    { icon: '📅', label: 'Date', value: formatDate(event.date) },
    { icon: '📍', label: 'Lieu', value: event.location || 'Lieu non précisé' },
    { icon: '🎭', label: 'Type', value: `${emoji} ${event.type || 'Autre'}` },
    { icon: '👁', label: 'Visibilité', value: visibility },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      {/* Hero gradient header */}
      <div style={{ background: 'linear-gradient(135deg,#e055aa,#f5a623)', padding: '52px 20px 28px', textAlign: 'center', color: '#fff', flexShrink: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 28px', fontSize: 12, fontWeight: 700, color: '#fff' }}>
          <span>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="17" height="12" viewBox="0 0 17 12" fill="white"><rect x="0" y="4" width="3" height="8" rx="0.6"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="0.6"/><rect x="9" y="0.5" width="3" height="11.5" rx="0.6"/><rect x="13.5" y="0" width="3" height="12" rx="0.6" opacity="0.5"/></svg>
            <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3" stroke="white" strokeOpacity=".6"/><rect x="1.5" y="1.5" width="18" height="9" rx="2.2" fill="white"/></svg>
          </div>
        </div>
        <div onClick={onBack} style={{ position: 'absolute', top: 40, left: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#fff' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontSize: 16 }}>Retour</span>
        </div>
        <div style={{ fontSize: 48, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 5, letterSpacing: -0.3 }}>{event.name}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{event.type}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Info card */}
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          {infoRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < infoRows.length - 1 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ fontSize: 17, width: 28, textAlign: 'center', flexShrink: 0 }}>{row.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{row.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        {event.description && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '14px', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: '#1C1C1E', lineHeight: 1.5 }}>{event.description}</div>
          </div>
        )}

        {/* Invite friends */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
            Inviter des amis
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, marginBottom: inviteError ? 6 : invitations.length ? 12 : 0 }}>
            <input
              type="email"
              placeholder="Email"
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteError(null) }}
              required
              style={{
                flex: 1, border: `1px solid ${inviteError ? '#FF3B30' : '#E5E5EA'}`, borderRadius: 10,
                padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E',
              }}
            />
            <button
              type="submit"
              disabled={inviting}
              style={{
                padding: '9px 14px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: inviting ? 'default' : 'pointer',
                opacity: inviting ? 0.6 : 1, whiteSpace: 'nowrap',
              }}
            >
              {inviting ? '…' : 'Inviter'}
            </button>
          </form>
          {inviteError && (
            <div style={{ fontSize: 12, color: '#FF3B30', marginBottom: invitations.length ? 10 : 0 }}>
              {inviteError}
            </div>
          )}
          {invitations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 13, color: '#1C1C1E', fontWeight: 500 }}>{inv.invited_email}</div>
                  <div style={{ fontSize: 15 }}>{statusIcon[inv.status] ?? '⏳'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participation buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <div
            onClick={() => handleRsvp('going')}
            style={{
              flex: 1, padding: '14px', borderRadius: 14, textAlign: 'center',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              background: rsvpStatus !== 'declined' ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
              color: rsvpStatus !== 'declined' ? '#fff' : '#8E8E93',
              boxShadow: rsvpStatus === 'going' ? '0 4px 16px rgba(224,85,170,0.35)' : 'none',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            ✓ Participer
          </div>
          <div
            onClick={() => handleRsvp('declined')}
            style={{
              flex: 1, padding: '14px', borderRadius: 14, textAlign: 'center',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              background: rsvpStatus === 'declined' ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
              color: rsvpStatus === 'declined' ? '#fff' : '#8E8E93',
              boxShadow: rsvpStatus === 'declined' ? '0 4px 16px rgba(224,85,170,0.35)' : 'none',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            ✕ Décliner
          </div>
        </div>
      </div>
    </div>
  )
}
