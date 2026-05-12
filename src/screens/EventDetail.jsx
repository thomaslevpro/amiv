import { useState, useEffect } from 'react'
import { ChevronLeft, CheckCircle2, Clock, XCircle, MapPin, Calendar, ExternalLink, Cake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import InviteFriendsSheet from '../components/InviteFriendsSheet'

const typeEmoji = {
  'Anniversaire': <Cake size={20} strokeWidth={1.5} />,
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

function formatDateHero(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const cap = datePart.charAt(0).toUpperCase() + datePart.slice(1)
  return `${cap} · ${timePart}`
}

function countdownDays(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const diff = Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : null
}

function formatPollDate(dateStr, timeStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return timeStr ? `${datePart} à ${timeStr.slice(0, 5)}` : datePart
}

const AVATAR_COLORS = ['#e055aa', '#f5a623', '#34C759', '#007AFF', '#AF52DE', '#FF9500']
function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const rsvpStatusColor = { going: '#34C759', declined: '#FF3B30', pending: '#FF9500' }
const rsvpStatusLabel = { going: 'Confirmé', declined: 'Décliné', pending: 'En attente' }
const guestResponseIcon = { yes: <CheckCircle2 size={16} className="text-green-500" />, no: <XCircle size={16} className="text-red-500" />, maybe: '🤔' }

export default function EventDetail({ event, onBack, onMessagesClick }) {
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [guestRsvps, setGuestRsvps] = useState([])
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', date: '', description: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [eventOverrides, setEventOverrides] = useState({})

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [showInviteSheet, setShowInviteSheet] = useState(false)

  const [dateOptions, setDateOptions] = useState([])
  const [myVotes, setMyVotes] = useState({})
  const [allVoteCounts, setAllVoteCounts] = useState({})
  const [confirmingDate, setConfirmingDate] = useState(false)

  const [rsvpStats, setRsvpStats] = useState({ confirmed: 0, pending: 0, declined: 0 })
  const [participants, setParticipants] = useState([])
  const [organizerName, setOrganizerName] = useState(null)
  const [eventGuests, setEventGuests] = useState([])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function handleShare() {
    const url = `${window.location.origin}/invite/${event.invite_token}`
    const text = `Tu es invité(e) ! Rejoins l'événement sur Amiv : ${url}`
    if (navigator.share) {
      navigator.share({ title: event.name, text, url })
    } else {
      navigator.clipboard.writeText(url).then(() => showToast('Lien copié !'))
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/invite/${event.invite_token}`
    navigator.clipboard.writeText(url).then(() => showToast('Lien copié !'))
  }

  useEffect(() => {
    if (!event) return
    let cancelled = false

    setEventOverrides({})
    setEditing(false)
    setDateOptions([])
    setMyVotes({})
    setAllVoteCounts({})
    setRsvpStats({ confirmed: 0, pending: 0, declined: 0 })
    setParticipants([])
    setOrganizerName(null)
    setEventGuests([])

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)

      const isOrg = user.id === event.user_id

      const [rsvpRes, optRes, guestRes, allRsvpsRes] = await Promise.all([
        supabase.from('rsvps').select('status').eq('event_id', event.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('event_date_options').select('*').eq('event_id', event.id).order('proposed_date', { ascending: true }).order('proposed_time', { ascending: true }),
        isOrg
          ? supabase.from('guest_rsvps').select('id, guest_name, guest_email, response').eq('event_id', event.id).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase.from('rsvps').select('user_id, status').eq('event_id', event.id),
      ])

      if (cancelled) return

      setRsvpStatus(rsvpRes.data?.status ?? null)

      const guestsData = guestRes.data ?? []
      if (isOrg) setGuestRsvps(guestsData)

      const rsvpsData = allRsvpsRes.data ?? []

      // Stats
      const confirmed = rsvpsData.filter(r => r.status === 'going').length + guestsData.filter(g => g.response === 'yes').length
      const declined = rsvpsData.filter(r => r.status === 'declined').length + guestsData.filter(g => g.response === 'no').length
      const pending = rsvpsData.filter(r => r.status !== 'going' && r.status !== 'declined').length + guestsData.filter(g => !g.response || g.response === 'maybe').length
      setRsvpStats({ confirmed, pending, declined })

      // Fetch profile names for rsvp users
      const userIds = rsvpsData.map(r => r.user_id)
      let profileMap = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds)
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p.name })
      }

      if (!isOrg && event.user_id) {
        const { data: orgProfile } = await supabase.from('profiles').select('name').eq('id', event.user_id).maybeSingle()
        if (!cancelled && orgProfile?.name) setOrganizerName(orgProfile.name.split(' ')[0])
      }

      if (!isOrg) {
        const { data: inviteeGuests } = await supabase.rpc('get_event_guests', { p_event_id: event.id })
        if (!cancelled && inviteeGuests) setEventGuests(inviteeGuests)
      }

      if (cancelled) return

      const userParts = rsvpsData.map(r => ({
        id: r.user_id,
        name: profileMap[r.user_id] || 'Invité',
        status: r.status ?? 'pending',
      }))
      const guestParts = guestsData.map(g => ({
        id: `guest_${g.id}`,
        name: g.guest_name,
        status: g.response === 'yes' ? 'going' : g.response === 'no' ? 'declined' : 'pending',
      }))
      setParticipants([...userParts, ...guestParts])

      const optionsData = optRes.data ?? []
      setDateOptions(optionsData)

      if (optionsData.length > 0) {
        const optionIds = optionsData.map(o => o.id)
        const { data: votes } = await supabase
          .from('event_date_votes')
          .select('option_id, user_id, available')
          .in('option_id', optionIds)

        if (cancelled) return
        if (votes) {
          const mine = {}
          votes.filter(v => v.user_id === user.id).forEach(v => { mine[v.option_id] = v.available })
          setMyVotes(mine)
          const counts = {}
          votes.forEach(v => { if (v.available) counts[v.option_id] = (counts[v.option_id] || 0) + 1 })
          setAllVoteCounts(counts)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [event?.id])

  async function handleRsvp(status) {
    if (!userId || loading) return
    setLoading(true)
    const { error } = await supabase
      .from('rsvps')
      .upsert({ event_id: event.id, user_id: userId, status }, { onConflict: 'event_id,user_id' })
    if (!error) {
      setRsvpStatus(status)
      showToast('Réponse enregistrée ✓')
      if (status === 'going' && event.user_id && event.user_id !== userId) {
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle()
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

  async function handleDateVote(optionId, available) {
    if (!userId) return
    const { error } = await supabase
      .from('event_date_votes')
      .upsert({ option_id: optionId, user_id: userId, available }, { onConflict: 'option_id,user_id' })

    if (!error) {
      const prevAvailable = myVotes[optionId]
      setMyVotes(prev => ({ ...prev, [optionId]: available }))
      setAllVoteCounts(prev => {
        const counts = { ...prev }
        if (prevAvailable === true && !available) counts[optionId] = Math.max(0, (counts[optionId] || 0) - 1)
        if (prevAvailable !== true && available) counts[optionId] = (counts[optionId] || 0) + 1
        return counts
      })
    }
  }

  async function handleConfirmDate(option) {
    setConfirmingDate(true)
    const datetime = option.proposed_time
      ? `${option.proposed_date}T${option.proposed_time}`
      : `${option.proposed_date}T00:00`
    const { error } = await supabase.from('events').update({ date: datetime, poll_closed: true }).eq('id', event.id)
    if (!error) {
      setEventOverrides(prev => ({ ...prev, date: datetime, poll_closed: true }))
      showToast('Date confirmée ! 🎉')
    }
    setConfirmingDate(false)
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
    const { error } = await supabase.from('events').update({
      name: editForm.name,
      date: editForm.date || null,
      description: editForm.description,
      location: editForm.location,
    }).eq('id', event.id)
    if (!error) {
      setEventOverrides(prev => ({ ...prev, name: editForm.name, date: editForm.date, description: editForm.description, location: editForm.location }))
      setEditing(false)
      showToast('Événement modifié !')
    }
    setSaving(false)
  }

  async function handleDeleteEvent() {
    setDeleting(true)
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) {
      showToast('Erreur lors de la suppression')
      setDeleting(false)
      setShowDeleteModal(false)
    } else {
      onBack?.()
    }
  }

  async function handleAddFriend(inviteeId) {
    setEventGuests(prev => prev.map(g => g.invitee_id === inviteeId ? { ...g, friend_request_sent: true } : g))
    const { error } = await supabase.from('friendships').insert({
      requester_id: userId,
      addressee_id: inviteeId,
      status: 'pending',
    })
    if (error) {
      setEventGuests(prev => prev.map(g => g.invitee_id === inviteeId ? { ...g, friend_request_sent: false } : g))
      showToast('Erreur lors de la demande')
    }
  }

  if (!event) return null

  const isOrganizer = userId !== null && userId === event.user_id
  const displayName = eventOverrides.name ?? event.name
  const displayDate = eventOverrides.date ?? event.date
  const displayDescription = eventOverrides.description ?? event.description
  const displayLocation = eventOverrides.location ?? event.location
  const pollClosed = eventOverrides.poll_closed ?? event.poll_closed ?? false
  const isPollActive = dateOptions.length > 0 && !pollClosed

  const emoji = typeEmoji[event.type] ?? '🎉'
  const visibility = visibilityLabel[event.visibility] ?? event.visibility ?? 'Sur invitation'
  const heroDate = isPollActive ? null : formatDateHero(displayDate)
  const countdown = isPollActive ? null : countdownDays(displayDate)
  const maxVoteCount = isPollActive ? Math.max(0, ...dateOptions.map(o => allVoteCounts[o.id] || 0)) : 0

  const infoRows = [
    { icon: <MapPin size={16} strokeWidth={1.5} />, label: 'Lieu', value: displayLocation || 'Lieu non précisé', badge: false },
    { icon: null, label: 'Type', value: event.type || 'Autre', badge: true },
    { icon: null, label: 'Visibilité', value: visibility, badge: true },
    ...(!isOrganizer && organizerName ? [{ icon: null, label: 'Organisé par', value: organizerName, badge: false }] : []),
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(135deg,#e055aa,#f5a623)',
        padding: '58px 20px 24px',
        textAlign: 'center', color: '#fff', flexShrink: 0, position: 'relative',
      }}>
        {/* Top bar: back + modifier pills */}
        <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            onClick={onBack}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff' }}
          >
            <ChevronLeft size={14} strokeWidth={1.5} color="white" />
            Retour
          </div>
          {isOrganizer && (
            <div
              onClick={handleEditOpen}
              style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff' }}
            >
              Modifier ✏️
            </div>
          )}
        </div>

        {/* Emoji + title + subtitle */}
        <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: -0.3 }}>{displayName}</div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>{event.type} · {visibility}</div>

        {/* Date + countdown pills */}
        {heroDate && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {heroDate}
            </div>
            {countdown !== null && (
              <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 700, color: '#e055aa' }}>
                J-{countdown}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SHARE CTA BAR ── */}
      {isOrganizer && event.invite_token && (
        <div style={{
          background: '#fff', borderRadius: '0 0 20px 20px',
          padding: '12px 16px', display: 'flex', gap: 10, flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div
            onClick={() => setShowInviteSheet(true)}
            style={{
              flex: 1, background: 'linear-gradient(135deg,#e055aa,#f5a623)',
              borderRadius: 12, padding: '13px 16px', textAlign: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}
          >
            Inviter des amis
          </div>
          <div
            onClick={handleCopyLink}
            style={{
              width: 42, height: 42, borderRadius: 10, background: '#F2F2F7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ExternalLink size={18} strokeWidth={1.5} />
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── STATS ROW ── */}
        {isOrganizer ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {[
              { count: rsvpStats.confirmed, label: 'Confirmés' },
              { count: rsvpStats.pending, label: 'En attente' },
              { count: rsvpStats.declined, label: 'Déclinés' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '12px 8px', textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>{s.count}</div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── EDIT FORM ── */}
        {editing && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 12 }}>
              Modifier l'événement
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Titre</div>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Date</div>
                <input type="datetime-local" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Lieu</div>
                <input type="text" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Description</div>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#F2F2F7', color: '#8E8E93', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? '…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── INFO CARD ── */}
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          {infoRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < infoRows.length - 1 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{row.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{row.label}</div>
                {row.badge ? (
                  <div style={{ display: 'inline-block', background: '#F2F2F7', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: '#1C1C1E', marginTop: 2 }}>
                    {row.value}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{row.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── DESCRIPTION ── */}
        {displayDescription && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '14px', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: '#1C1C1E', lineHeight: 1.5 }}>{displayDescription}</div>
          </div>
        )}

        {/* ── GUESTS LIST (invitee view) ── */}
        {!isOrganizer && eventGuests.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 12 }}>
              Invités ({eventGuests.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {eventGuests.map(guest => {
                const chipBg = guest.rsvp_status === 'confirmed' ? 'rgba(52,199,89,0.10)' : guest.rsvp_status === 'declined' ? 'rgba(255,59,48,0.10)' : 'rgba(142,142,147,0.12)'
                const chipColor = guest.rsvp_status === 'confirmed' ? '#34C759' : guest.rsvp_status === 'declined' ? '#FF3B30' : '#8E8E93'
                const chipLabel = guest.rsvp_status === 'confirmed' ? 'Confirmé' : guest.rsvp_status === 'declined' ? 'Décliné' : 'En attente'
                const btnDisabled = guest.is_friend || guest.friend_request_sent
                const btnBg = guest.is_friend ? 'rgba(52,199,89,0.10)' : '#F2F2F7'
                const btnColor = guest.is_friend ? '#34C759' : guest.friend_request_sent ? '#8E8E93' : '#1C1C1E'
                const btnLabel = guest.is_friend ? 'Amis ✓' : guest.friend_request_sent ? 'Demande envoyée' : '+ Ajouter'
                return (
                  <div key={guest.invitee_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {guest.avatar_url ? (
                      <img src={guest.avatar_url} alt={guest.full_name} style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 18, background: '#FBBF9A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {(guest.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {guest.full_name}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 3, padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: chipBg, color: chipColor }}>
                        {chipLabel}
                      </div>
                    </div>
                    {guest.invitee_id !== userId && (
                      <div
                        onClick={() => !btnDisabled && handleAddFriend(guest.invitee_id)}
                        style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: btnDisabled ? 'default' : 'pointer', background: btnBg, color: btnColor, flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {btnLabel}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── DATE POLL: organizer results ── */}
        {isPollActive && isOrganizer && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 12 }}>
              Résultats du sondage 📊
            </div>
            {dateOptions.map(opt => {
              const count = allVoteCounts[opt.id] || 0
              const isWinner = maxVoteCount > 0 && count === maxVoteCount
              return (
                <div key={opt.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12, marginBottom: 8,
                  background: isWinner ? 'rgba(224,85,170,0.08)' : '#F2F2F7',
                  border: isWinner ? '1.5px solid rgba(224,85,170,0.3)' : '1.5px solid transparent',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>
                      {formatPollDate(opt.proposed_date, opt.proposed_time)}
                    </div>
                    <div style={{ fontSize: 11, color: isWinner ? '#e055aa' : '#8E8E93', marginTop: 2, fontWeight: isWinner ? 700 : 400 }}>
                      {count} disponible{count !== 1 ? 's' : ''}{isWinner && count > 0 ? ' 🏆' : ''}
                    </div>
                  </div>
                  <div
                    onClick={() => !confirmingDate && handleConfirmDate(opt)}
                    style={{
                      padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
                      cursor: confirmingDate ? 'default' : 'pointer',
                      opacity: confirmingDate ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {confirmingDate ? '…' : 'Confirmer'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── DATE POLL: invitee voting ── */}
        {isPollActive && !isOrganizer && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>
              Sondage de dates <Calendar size={14} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 12 }}>
              Indiquez vos disponibilités pour chaque date proposée.
            </div>
            {dateOptions.map((opt, i) => {
              const myVote = myVotes[opt.id]
              return (
                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>
                    {formatPollDate(opt.proposed_date, opt.proposed_time)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <div onClick={() => handleDateVote(opt.id, true)}
                      style={{ padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: myVote === true ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7', color: myVote === true ? '#fff' : '#8E8E93', cursor: 'pointer', transition: 'all 0.15s' }}>
                      ✓
                    </div>
                    <div onClick={() => handleDateVote(opt.id, false)}
                      style={{ padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: myVote === false ? '#FF3B30' : '#F2F2F7', color: myVote === false ? '#fff' : '#8E8E93', cursor: 'pointer', transition: 'all 0.15s' }}>
                      ✕
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── GUEST RSVPs VIA LINK (organizer only) ── */}
        {isOrganizer && guestRsvps.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
              Via lien public 🔗
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {guestRsvps.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#1C1C1E', fontWeight: 500 }}>{g.guest_name}</div>
                    <div style={{ fontSize: 11, color: '#8E8E93' }}>{g.guest_email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>{guestResponseIcon[g.response] ?? <Clock size={16} className="text-gray-400" />}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PARTICIPANTS LIST ── */}
        {isOrganizer && participants.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>Participants</div>
              {participants.length > 4 && (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e055aa', cursor: 'pointer' }}>
                  Voir tous
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {participants.slice(0, 4).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 18,
                    background: getAvatarColor(p.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{p.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: rsvpStatusColor[p.status] ?? '#8E8E93' }}>
                    {rsvpStatusLabel[p.status] ?? 'En attente'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BOTTOM ACTIONS ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div
            onClick={() => onMessagesClick?.(event)}
            style={{
              flex: 1, background: '#fff', border: '1.5px solid #E5E5EA',
              borderRadius: 14, padding: '14px', textAlign: 'center',
              fontSize: 14, fontWeight: 700, color: '#1C1C1E', cursor: 'pointer',
              boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
            }}
          >
            💬 Messages
          </div>
          {isOrganizer && (
            <div
              onClick={() => setShowDeleteModal(true)}
              style={{
                flex: 1, background: 'rgba(255,59,48,0.08)',
                borderRadius: 14, padding: '14px', textAlign: 'center',
                fontSize: 14, fontWeight: 700, color: '#FF3B30', cursor: 'pointer',
              }}
            >
              Supprimer
            </div>
          )}
        </div>

        {/* ── RSVP BUTTONS (guests only) ── */}
        {!isOrganizer && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[
              { status: 'going', label: "✓ J'y serai" },
              { status: 'maybe', label: 'Peut-être' },
              { status: 'declined', label: '✕ Je ne peux pas' },
            ].map(({ status, label }) => {
              const active = rsvpStatus === status
              return (
                <div
                  key={status}
                  onClick={() => !loading && handleRsvp(status)}
                  style={{
                    flex: 1, padding: '13px 6px', borderRadius: 14, textAlign: 'center',
                    fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                    background: active ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                    color: active ? '#fff' : '#8E8E93',
                    boxShadow: active ? '0 4px 16px rgba(224,85,170,0.35)' : 'none',
                    transition: 'all 0.15s', opacity: loading ? 0.6 : 1,
                  }}
                >
                  {label}
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* ── TOAST ── */}
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

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 20px' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 20px 16px', width: '100%', maxWidth: 430, boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', textAlign: 'center', marginBottom: 10 }}>
              Supprimer l'événement ?
            </div>
            <div style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 1.5, marginBottom: 24 }}>
              Cette action est irréversible. Tous les invités seront notifiés de l'annulation.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: '#F2F2F7', color: '#1C1C1E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleDeleteEvent} disabled={deleting}
                style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: '#FF3B30', color: '#fff', fontSize: 15, fontWeight: 700, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? '…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE FRIENDS SHEET ── */}
      {showInviteSheet && (
        <InviteFriendsSheet
          eventId={event.id}
          onClose={() => setShowInviteSheet(false)}
          onInvited={(count) => showToast(`${count} ami${count > 1 ? 's' : ''} invité${count > 1 ? 's' : ''} 🎉`)}
        />
      )}

    </div>
  )
}
