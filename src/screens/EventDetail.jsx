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

export default function EventDetail({ event, onBack, onMessagesClick }) {
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [invitations, setInvitations] = useState([])
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', date: '', description: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [eventOverrides, setEventOverrides] = useState({})

  function handleShare() {
    const url = `${window.location.origin}/invite/${event.share_token}`
    if (navigator.share) {
      navigator.share({ title: event.name, url })
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setToast('Lien copié !')
        setTimeout(() => setToast(null), 2500)
      })
    }
  }

  useEffect(() => {
    if (!event) return
    let cancelled = false

    setEventOverrides({})
    setEditing(false)

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

      const [{ data: senderProfile }, { data: invitedProfile }] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('id', userId).maybeSingle(),
        supabase.from('profiles').select('id, name').eq('email', email).maybeSingle(),
      ])

      if (invitedProfile?.id) {
        await supabase.from('notifications').insert({
          user_id: invitedProfile.id,
          type: 'invitation_received',
          title: `Tu es invité(e) à ${event.name}`,
          body: 'Quelqu\'un t\'a invité à un événement',
          data: { event_id: event.id, sender_id: userId },
        })
      }

      const invitationPayload = {
        invitee_email: email,
        invitee_name: invitedProfile?.name ?? '',
        sender_name: senderProfile?.name ?? 'Quelqu\'un',
        event_title: event.name,
        event_date: formatDate(event.date),
        event_id: event.id,
      }
      console.log('invitation email payload', invitationPayload)
      await supabase.functions.invoke('send-invitation-email', { body: invitationPayload })
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
    if (!error) {
      setRsvpStatus(status)
      if (status === 'going' && event.user_id && event.user_id !== userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', userId)
          .maybeSingle()
        const name = profile?.name ?? 'Quelqu\'un'
        await supabase.from('notifications').insert({
          user_id: event.user_id,
          type: 'rsvp_received',
          title: `${name} participe à ${event.name}`,
          body: 'Nouvelle réponse à votre événement',
          data: { event_id: event.id, sender_id: userId },
        })
      }
    }
    setLoading(false)
  }

  function handleEditOpen() {
    setEditForm({
      name: event.name ?? '',
      date: event.date ? event.date.slice(0, 16) : '',
      description: event.description ?? '',
      location: event.location ?? '',
    })
    setEditing(true)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('events')
      .update({
        name: editForm.name,
        date: editForm.date || null,
        description: editForm.description,
        location: editForm.location,
      })
      .eq('id', event.id)
    if (!error) {
      setEventOverrides({
        name: editForm.name,
        date: editForm.date,
        description: editForm.description,
        location: editForm.location,
      })
      setEditing(false)
      setToast('Événement modifié !')
      setTimeout(() => setToast(null), 2500)
    }
    setSaving(false)
  }

  async function handleDeleteInvitation(invId) {
    await supabase.from('invitations').delete().eq('id', invId)
    setInvitations(prev => prev.filter(i => i.id !== invId))
  }

  if (!event) return null

  const isOrganizer = userId !== null && userId === event.user_id
  console.log('isOrganizer', isOrganizer, userId, event.user_id)
  const displayName = eventOverrides.name ?? event.name
  const displayDate = eventOverrides.date ?? event.date
  const displayDescription = eventOverrides.description ?? event.description
  const displayLocation = eventOverrides.location ?? event.location
  const acceptedCount = invitations.filter(i => i.status === 'accepted').length
  const declinedCount = invitations.filter(i => i.status === 'declined').length
  const pendingCount = invitations.filter(i => !i.status || i.status === 'pending').length

  const emoji = typeEmoji[event.type] ?? '🎉'
  const visibility = visibilityLabel[event.visibility] ?? event.visibility ?? 'Sur invitation'

  const infoRows = [
    { icon: '📅', label: 'Date', value: formatDate(displayDate) },
    { icon: '📍', label: 'Lieu', value: displayLocation || 'Lieu non précisé' },
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
        <div style={{ position: 'absolute', top: 40, right: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          {isOrganizer && (
            <div onClick={handleEditOpen} style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#fff' }}>
              Modifier ✏️
            </div>
          )}
          {event.share_token && (
            <div onClick={handleShare} style={{ cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#fff' }}>
              Partager 🔗
            </div>
          )}
        </div>
        <div style={{ fontSize: 48, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 5, letterSpacing: -0.3 }}>{displayName}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{event.type}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Edit form — organizer only, shown inline when editing */}
        {editing && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 12 }}>
              Modifier l'événement
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Titre</div>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Date</div>
                <input
                  type="datetime-local"
                  value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Lieu</div>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Description</div>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#F2F2F7', color: '#8E8E93', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        )}

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
        {displayDescription && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '14px', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: '#1C1C1E', lineHeight: 1.5 }}>{displayDescription}</div>
          </div>
        )}

        {/* Counters: visible to everyone when invitations exist */}
        {invitations.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
              Participants
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { icon: '✅', count: acceptedCount, label: 'confirmé' },
                { icon: '❌', count: declinedCount, label: 'décliné' },
                { icon: '⏳', count: pendingCount, label: 'en attente' },
              ].map(({ icon, count, label }) => (
                <div key={label} style={{ flex: 1, background: '#F2F2F7', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16 }}>{icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>{count}</div>
                  <div style={{ fontSize: 10, color: '#8E8E93' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organizer only: invite form + full list with emails */}
        {isOrganizer && (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 15 }}>{statusIcon[inv.status] ?? '⏳'}</div>
                      {(!inv.status || inv.status === 'pending') && (
                        <div
                          onClick={() => handleDeleteInvitation(inv.id)}
                          style={{ fontSize: 13, color: '#FF3B30', cursor: 'pointer', fontWeight: 700, padding: '2px 6px' }}
                        >
                          ✕
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages button */}
        <div
          onClick={() => onMessagesClick?.(event)}
          style={{
            background: '#fff', borderRadius: 14, padding: '14px', textAlign: 'center',
            fontSize: 14, fontWeight: 700, color: '#1C1C1E', cursor: 'pointer',
            boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 10,
          }}
        >
          💬 Messages
        </div>

        {/* RSVP buttons: guests only */}
        {!isOrganizer && (
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
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: '#fff', borderRadius: 20,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 999,
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
