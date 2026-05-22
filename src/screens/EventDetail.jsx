import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, CheckCircle2, Clock, XCircle, MapPin, Calendar, Cake, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import CardContribute from '../components/card/CardContribute'
import CardManage from '../components/card/CardManage'
import CardView from '../components/card/CardView'


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

function birthdayFriendName(friend) {
  return friend?.first_name || friend?.name || 'Ami'
}

function birthdayFriendInitial(friend) {
  return birthdayFriendName(friend).charAt(0).toUpperCase()
}

export default function EventDetail({ event, onBack, onMessagesClick }) {
  const coverInputRef = useRef(null)
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [guestRsvps, setGuestRsvps] = useState([])
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', date: '', description: '', location: '' })
  const [birthdayPersonId, setBirthdayPersonId] = useState(event?.birthday_person_user_id ?? null)
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [eventOverrides, setEventOverrides] = useState({})

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [friends, setFriends] = useState([])
  const [invitedIds, setInvitedIds] = useState(new Set())
  const [copySuccess, setCopySuccess] = useState(false)

  const [dateOptions, setDateOptions] = useState([])
  const [myVotes, setMyVotes] = useState({})
  const [allVoteCounts, setAllVoteCounts] = useState({})
  const [confirmingDate, setConfirmingDate] = useState(false)

  const [rsvpStats, setRsvpStats] = useState({ confirmed: 0, pending: 0, declined: 0 })
  const [participants, setParticipants] = useState([])
  const [organizerName, setOrganizerName] = useState(null)
  const [eventGuests, setEventGuests] = useState([])
  const [isInvitedGuest, setIsInvitedGuest] = useState(false)

  const navigate = useNavigate()

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

  async function handleCopyLink() {
    await navigator.clipboard.writeText(
      `https://amiv.app/invite/${event.invite_token}`
    )
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
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
    setIsInvitedGuest(false)
    setFriends([])
    setInvitedIds(new Set())
    setBirthdayPersonId(event?.birthday_person_user_id ?? null)

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)
      setUserEmail(user.email)

      const isOrg = user.id === event.user_id

      const [rsvpRes, optRes, guestRes, allRsvpsRes, eventInfoRes] = await Promise.all([
        supabase.from('rsvps').select('status').eq('event_id', event.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('event_date_options').select('*').eq('event_id', event.id).order('proposed_date', { ascending: true }).order('proposed_time', { ascending: true }),
        isOrg
          ? supabase.from('guest_rsvps').select('id, guest_name, guest_email, response').eq('event_id', event.id).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase.from('rsvps').select('user_id, status').eq('event_id', event.id),
        supabase.from('events').select('birthday_person_user_id').eq('id', event.id).maybeSingle(),
      ])

      if (cancelled) return
      setBirthdayPersonId(eventInfoRes.data?.birthday_person_user_id ?? event?.birthday_person_user_id ?? null)

      const { data: isGuestResult } = await supabase.rpc(
        'is_invited_to_event',
        { p_event_id: event.id, p_user_id: user.id }
      );
      setIsInvitedGuest(!!isGuestResult);

      console.log('DEBUG event.user_id:', event?.user_id);
      console.log('DEBUG user.id:', user?.id);
      console.log('DEBUG isOrganizer:', isOrganizer);
      console.log('DEBUG isInvitedGuest:', isInvitedGuest);

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

      const { data: friendshipsData } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted')

      const friendIds = (friendshipsData || []).map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      )

      let friendList = []
      if (friendIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, name, avatar_url')
          .in('id', friendIds)
        friendList = profilesData || []
      }
      if (!cancelled) setFriends(friendList)

      const { data: existingInvites } = await supabase
        .from('invitations')
        .select('invited_user_id')
        .eq('event_id', event.id)
        .not('invited_user_id', 'is', null)

      if (!cancelled) setInvitedIds(new Set((existingInvites || []).map(i => i.invited_user_id)))
    }

    init()
    return () => { cancelled = true }
  }, [event?.id])

  async function handleRsvp(status) {
    if (!userId || loading) return
    setLoading(true)

    // Les invitations utilisent accepted/declined, les rsvps utilisent going/not_going
    const invitationStatus = status === 'going' ? 'accepted'
      : status === 'not_going' ? 'declined'
      : status // 'maybe' reste 'maybe', 'pending' reste 'pending'

    // Étape 1 : retrouver l'invitation par event_id + user
    const orParts = [`invited_user_id.eq.${userId}`]
    if (userEmail) orParts.push(`invited_email.eq.${userEmail}`)

    const { data: inv, error: selErr } = await supabase
      .from('invitations')
      .select('id')
      .eq('event_id', event.id)
      .or(orParts.join(','))
      .maybeSingle()

    if (selErr) console.error('SELECT invitation error:', selErr)
    if (!inv) {
      console.warn('Invitation introuvable — userId:', userId, '/ event.id:', event.id)
    } else {
      // Étape 2 : update par clé primaire
      const { error: updErr } = await supabase
        .from('invitations')
        .update({ status: invitationStatus })
        .eq('id', inv.id)
      if (updErr) console.error('UPDATE invitation error:', updErr)
    }

    // Keep rsvps in sync
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
    setBirthdayPersonId(eventOverrides.birthday_person_user_id ?? birthdayPersonId ?? event?.birthday_person_user_id ?? null)
    setCoverFile(null)
    setCoverPreview(null)
    setEditing(true)
  }

  function toggleBirthdayPerson(id) {
    setBirthdayPersonId(prev => prev === id ? null : id)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setSaving(true)

    let coverImagePath = event.cover_image ?? null

    if (coverFile) {
      const ext = coverFile.name.split('.').pop()
      const filePath = `${event.id}/cover_${Date.now()}.${ext}`
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('event-covers')
        .upload(filePath, coverFile, { upsert: true })

      console.log('Upload result:', { uploadError, uploadData })
      if (uploadError) {
        console.log('Upload error details:', JSON.stringify(uploadError))
        showToast('Erreur upload photo')
        setSaving(false)
        return
      }
      coverImagePath = filePath
    }

    const { error } = await supabase.from('events').update({
      name: editForm.name,
      date: editForm.date || null,
      description: editForm.description,
      location: editForm.location,
      cover_image: coverImagePath,
      birthday_person_user_id: birthdayPersonId,
    }).eq('id', event.id)
    if (!error) {
      setEventOverrides(prev => ({
        ...prev,
        name: editForm.name,
        date: editForm.date,
        description: editForm.description,
        location: editForm.location,
        cover_image: coverImagePath,
        birthday_person_user_id: birthdayPersonId,
      }))
      setEditing(false)
      showToast('Événement modifié !')
    }
    setSaving(false)
  }

  async function handleHeroCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file || !event?.id || userId !== event.user_id) return

    const ext = file.name.split('.').pop()
    const filePath = `${event.id}/cover_${Date.now()}.${ext}`
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('event-covers')
      .upload(filePath, file, { upsert: true })

    console.log('Upload result:', { uploadError, uploadData })
    if (uploadError) {
      console.log('Upload error details:', JSON.stringify(uploadError))
      showToast('Erreur upload photo')
      e.target.value = ''
      return
    }

    const { error } = await supabase.from('events').update({
      cover_image: filePath,
    }).eq('id', event.id)

    if (!error) {
      setEventOverrides(prev => ({
        ...prev,
        cover_image: filePath,
      }))
      showToast('Photo de couverture modifiée !')
    } else {
      showToast('Erreur upload photo')
    }
    e.target.value = ''
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

  async function handleInviteFriend(friendId) {
    if (invitedIds.has(friendId)) return
    await supabase.from('invitations').insert({
      event_id: event.id,
      invited_user_id: friendId,
      invited_by: userId,
      status: 'pending',
    })
    setInvitedIds(prev => new Set([...prev, friendId]))
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

  const rawCoverImage = eventOverrides.cover_image !== undefined ? eventOverrides.cover_image : event.cover_image
  const coverUrl = rawCoverImage
    ? supabase.storage.from('event-covers').getPublicUrl(rawCoverImage).data.publicUrl
    : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', overflow: 'hidden' }}>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative',
        height: coverUrl ? '38vh' : 'auto',
        minHeight: coverUrl ? 180 : 'auto',
        flexShrink: 0,
        overflow: 'hidden',
        background: coverUrl ? '#000' : 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)',
        ...(coverUrl ? {} : { padding: '58px 20px 24px', textAlign: 'center', color: '#fff' }),
      }}>

        {/* Photo de couverture */}
        {coverUrl && (
          <img
            src={coverUrl}
            alt="cover"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
              opacity: 0.85,
            }}
          />
        )}

        {/* Overlay gradient (sombre en bas pour la lisibilité du texte) */}
        {coverUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.62) 100%)',
          }} />
        )}

        {/* Boutons Retour + Modifier — toujours en haut */}
        <div style={{
          position: 'absolute', top: 14, left: 16, right: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 2,
        }}>
          <div
            onClick={onBack}
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.25)', borderRadius: 20,
              padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff',
              backdropFilter: 'blur(6px)',
            }}
          >
            <ChevronLeft size={14} strokeWidth={1.5} color="white" />
            Retour
          </div>
          {isOrganizer && (
            <div
              onClick={handleEditOpen}
              style={{
                cursor: 'pointer', background: 'rgba(255,255,255,0.25)', borderRadius: 20,
                padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff',
                backdropFilter: 'blur(6px)',
                marginRight: 44,
              }}
            >
              Modifier ✏️
            </div>
          )}
        </div>

        {isOrganizer && (
          <>
            <button
              type="button"
              aria-label="Changer la photo de couverture"
              onClick={() => coverInputRef.current?.click()}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.85)',
                color: '#1C1C1E',
                border: 'none',
                boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                zIndex: 3,
              }}
            >
              <ImageIcon size={18} strokeWidth={1.8} />
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleHeroCoverChange}
              style={{ display: 'none' }}
            />
          </>
        )}

        {/* Contenu superposé — en bas si cover, centré si gradient */}
        <div style={{
          position: coverUrl ? 'absolute' : 'relative',
          ...(coverUrl
            ? { bottom: 0, left: 0, right: 0, padding: '0 20px 20px', zIndex: 2 }
            : { paddingTop: 58, textAlign: 'center', color: '#fff' }
          ),
          color: '#fff',
          textAlign: coverUrl ? 'left' : 'center',
        }}>
          {!coverUrl && (
            <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>
          )}
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: -0.3, lineHeight: 1.2 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: heroDate ? 10 : 0 }}>
            {event.type} · {visibility}
          </div>
          {heroDate && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: coverUrl ? 'flex-start' : 'center' }}>
              <div style={{
                background: 'rgba(255,255,255,0.25)', borderRadius: 20,
                padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#fff',
                backdropFilter: 'blur(4px)',
              }}>
                {heroDate}
              </div>
              {countdown !== null && (
                <div style={{
                  background: 'rgba(255,255,255,0.95)', borderRadius: 20,
                  padding: '7px 14px', fontSize: 13, fontWeight: 700, color: '#e055aa',
                }}>
                  J-{countdown}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

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

        {/* ── ORGANIZER SPACE ENTRY ── */}
        {isOrganizer && (
          <div
            onClick={() => navigate(`/events/${event.id}/organizer-space`)}
            style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex',
              alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 14,
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(0,122,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="4" width="16" height="13" rx="2" stroke="#007AFF" strokeWidth="1.5" />
                <path d="M6 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" stroke="#007AFF" strokeWidth="1.5" />
                <path d="M6 9h8M6 12.5h5" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Mon espace organisateur</div>
              <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Checklist & suivi</div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1l6 6-6 6" stroke="#AEAEB2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* ── SECRET SPACE ENTRY ── */}
        {!isOrganizer && isInvitedGuest && (
          <div
            onClick={() => navigate(`/events/${event.id}/secret-space`)}
            style={{
              background: '#fff', borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex',
              alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 14,
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(224,85,170,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="9" width="16" height="12" rx="2.5" stroke="#e055aa" strokeWidth="1.5" />
                <path d="M5 9V6a4 4 0 0 1 8 0v3" stroke="#e055aa" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="9" cy="15" r="1.5" fill="#e055aa" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Espace secret</div>
              <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Cadeaux · Cagnotte · Carte</div>
              {organizerName && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', marginTop: 6,
                  padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(224,85,170,0.08)',
                  border: '1px solid rgba(224,85,170,0.20)',
                  fontSize: 10, fontWeight: 600, color: '#993556',
                }}>
                  🔒 Caché de {organizerName}
                </div>
              )}
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1l6 6-6 6" stroke="#AEAEB2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

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
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 6 }}>
                  Personne fêtée <span style={{ color: '#AEAEB2' }}>(optionnel)</span>
                </div>
                {friends.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#8E8E93' }}>Ajoute des amis pour les sélectionner ici</div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 2px' }}>
                    {friends.map(friend => {
                      const selected = birthdayPersonId === friend.id
                      const name = birthdayFriendName(friend)
                      return (
                        <div
                          key={friend.id}
                          onClick={() => toggleBirthdayPerson(friend.id)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0, width: 58 }}
                        >
                          <div style={{ position: 'relative' }}>
                            {friend.avatar_url ? (
                              <img
                                src={friend.avatar_url}
                                alt={name}
                                style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: selected ? '0 0 0 2px #e055aa' : 'none' }}
                              />
                            ) : (
                              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FBBF9A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, boxShadow: selected ? '0 0 0 2px #e055aa' : 'none' }}>
                                {birthdayFriendInitial(friend)}
                              </div>
                            )}
                            {selected && (
                              <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                                ✓
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#1C1C1E', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 8 }}>
                  Photo de couverture
                </div>
                {(coverPreview || event.cover_image) && (
                  <img
                    src={coverPreview || supabase.storage.from('event-covers').getPublicUrl(event.cover_image).data.publicUrl}
                    alt="cover preview"
                    style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }}
                  />
                )}
                <label style={{
                  display: 'block', width: '100%', padding: '11px', borderRadius: 10,
                  background: '#F2F2F7', textAlign: 'center', fontSize: 13, fontWeight: 600,
                  color: '#1C1C1E', cursor: 'pointer', boxSizing: 'border-box',
                }}>
                  {coverPreview ? '🖼 Changer la photo' : event.cover_image ? '🖼 Remplacer la photo' : '📷 Ajouter une photo'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setCoverFile(file)
                      setCoverPreview(URL.createObjectURL(file))
                    }}
                  />
                </label>
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

        {/* ── GROUP CARD ── */}
        {userId && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
              Carte collective
            </div>
            {isOrganizer ? (
              <>
                <CardManage eventId={event.id} currentUserId={userId} />
                <CardView eventId={event.id} currentUserId={userId} />
              </>
            ) : (
              <CardContribute eventId={event.id} currentUserId={userId} />
            )}
          </div>
        )}

        {/* ── INVITE FRIENDS (organizer only) ── */}
        {isOrganizer && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
              Inviter des amis
            </div>

            {friends.length === 0 ? (
              <div style={{ background: '#F2F2F7', borderRadius: 16, padding: '20px', textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: '#8E8E93' }}>Aucun ami à inviter pour l'instant</div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 10, overflow: 'hidden' }}>
                {friends.map((friend, i) => (
                  <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18, background: '#e055aa',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {(friend.first_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>
                      {friend.first_name}
                    </div>
                    {invitedIds.has(friend.id) ? (
                      <div style={{
                        background: 'rgba(52,199,89,0.10)', color: '#34C759',
                        borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                      }}>
                        Invité ✓
                      </div>
                    ) : (
                      <div
                        onClick={() => handleInviteFriend(friend.id)}
                        style={{
                          background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
                          borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Inviter
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', marginBottom: 8 }}>
                Ou partage le lien
              </div>
              <div
                onClick={handleCopyLink}
                style={{
                  width: '100%', borderRadius: 12, padding: 12, textAlign: 'center',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: copySuccess ? 'rgba(52,199,89,0.10)' : '#F2F2F7',
                  color: copySuccess ? '#34C759' : '#1C1C1E',
                  boxSizing: 'border-box',
                }}
              >
                {copySuccess ? '✓ Lien copié !' : '🔗 Copier le lien d\'invitation'}
              </div>
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



    </div>
  )
}
