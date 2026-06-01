import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addCoOrganizerById, isOrganizer } from '../lib/organizers'

function readSeen(key) {
  if (typeof window === 'undefined') return 0
  const value = window.localStorage.getItem(key)
  return value ? new Date(value).getTime() : 0
}

export default function useEventDetail(event, onBack) {
  const coverInputRef = useRef(null)
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [myRsvp, setMyRsvp] = useState(null)
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [currentUserName, setCurrentUserName] = useState('')
  const [canManage, setCanManage] = useState(false)
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
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [organizers, setOrganizers] = useState([])
  const [showCoOrgModal, setShowCoOrgModal] = useState(false)
  const [coOrgSubmitting, setCoOrgSubmitting] = useState(false)
  const [coOrgError, setCoOrgError] = useState('')
  const [confirmedParticipants, setConfirmedParticipants] = useState([])
  const [coOrgLoading, setCoOrgLoading] = useState(false)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const eventForMessages = {
    ...event,
    birthday_person_user_id: eventOverrides.birthday_person_user_id ?? birthdayPersonId ?? event?.birthday_person_user_id ?? null,
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
    await navigator.clipboard.writeText(`https://amiv.app/invite/${event.invite_token}`)
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
    setMyRsvp(null)
    setCurrentUserName('')
    setCanManage(false)
    setParticipants([])
    setOrganizerName(null)
    setOrganizers([])
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

      const userCanManage = await isOrganizer(event.id)
      if (!cancelled) setCanManage(userCanManage)

      const [rsvpRes, optRes, guestRes, allRsvpsRes, eventInfoRes] = await Promise.all([
        supabase.from('rsvps').select('id, status, plus_one_requested, plus_one_status, plus_one_name, plus_one_message').eq('event_id', event.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('event_date_options').select('*').eq('event_id', event.id).order('proposed_date', { ascending: true }).order('proposed_time', { ascending: true }),
        userCanManage ? supabase.from('guest_rsvps').select('id, guest_name, guest_email, response').eq('event_id', event.id).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('rsvps').select('user_id, status').eq('event_id', event.id),
        supabase.from('events').select('birthday_person_user_id').eq('id', event.id).maybeSingle(),
      ])

      if (cancelled) return
      setBirthdayPersonId(eventInfoRes.data?.birthday_person_user_id ?? event?.birthday_person_user_id ?? null)

      const { data: orgsData } = await supabase.from('event_organizers').select('role, profile:user_id (id, first_name, name, avatar_url)').eq('event_id', event.id)
      if (!cancelled) setOrganizers(orgsData || [])
      const hasOwner = (orgsData || []).some(o => o.role === 'owner' && o.profile?.id === event.user_id)
      if (!hasOwner && event.user_id) {
        const { data: ownerProfile } = await supabase.from('profiles').select('id, first_name, name, avatar_url').eq('id', event.user_id).maybeSingle()
        if (ownerProfile && !cancelled) setOrganizers([{ role: 'owner', profile: ownerProfile }, ...(orgsData || [])])
      }

      const { data: isGuestResult } = await supabase.rpc('is_invited_to_event', { p_event_id: event.id, p_user_id: user.id })
      setIsInvitedGuest(!!isGuestResult)
      setRsvpStatus(rsvpRes.data?.status ?? null)
      setMyRsvp(rsvpRes.data ?? null)

      const guestsData = guestRes.data ?? []
      if (userCanManage) setGuestRsvps(guestsData)

      const rsvpsData = allRsvpsRes.data ?? []
      const confirmed = rsvpsData.filter(r => r.status === 'going').length + guestsData.filter(g => g.response === 'yes').length
      const declined = rsvpsData.filter(r => r.status === 'declined').length + guestsData.filter(g => g.response === 'no').length
      const pending = rsvpsData.filter(r => r.status !== 'going' && r.status !== 'declined').length + guestsData.filter(g => !g.response || g.response === 'maybe').length
      setRsvpStats({ confirmed, pending, declined })

      const userIds = rsvpsData.map(r => r.user_id)
      let profileMap = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds)
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p.name })
      }

      if (event.user_id) {
        const { data: orgProfile } = await supabase.from('profiles').select('first_name, name').eq('id', event.user_id).maybeSingle()
        if (!cancelled) setOrganizerName(orgProfile?.name || orgProfile?.first_name || 'Organisateur')
      }

      if (!userCanManage) {
        const { data: inviteeGuests } = await supabase.rpc('get_event_guests', { p_event_id: event.id })
        if (!cancelled && inviteeGuests) setEventGuests(inviteeGuests)
      }

      if (cancelled) return

      const userParts = rsvpsData.map(r => ({ id: r.user_id, name: profileMap[r.user_id] || 'Invité', status: r.status ?? 'pending' }))
      const guestParts = guestsData.map(g => ({ id: `guest_${g.id}`, name: g.guest_name, status: g.response === 'yes' ? 'going' : g.response === 'no' ? 'declined' : 'pending' }))
      setParticipants([...userParts, ...guestParts])

      const optionsData = optRes.data ?? []
      setDateOptions(optionsData)

      if (optionsData.length > 0) {
        const optionIds = optionsData.map(o => o.id)
        const { data: votes } = await supabase.from('event_date_votes').select('option_id, user_id, available').in('option_id', optionIds)

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

      const { data: friendshipsData } = await supabase.from('friendships').select('requester_id, addressee_id').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted')
      const friendIds = (friendshipsData || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)

      let friendList = []
      if (friendIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, first_name, name, avatar_url').in('id', friendIds)
        friendList = profilesData || []
      }
      const { data: selfProfile } = await supabase.from('profiles').select('id, first_name, name, avatar_url').eq('id', user.id).single()
      if (!cancelled) setCurrentUserName(selfProfile?.first_name || selfProfile?.name || user.email || '')

      const allPickerProfiles = [
        ...(selfProfile ? [{ ...selfProfile, first_name: `${selfProfile.first_name || selfProfile.name || 'Moi'} (moi)` }] : []),
        ...friendList,
      ]
      if (!cancelled) setFriends(allPickerProfiles)

      const { data: existingInvites } = await supabase.from('invitations').select('invited_user_id').eq('event_id', event.id).not('invited_user_id', 'is', null)
      if (!cancelled) setInvitedIds(new Set((existingInvites || []).map(i => i.invited_user_id)))
    }

    init()
    return () => { cancelled = true }
  }, [event?.id])

  useEffect(() => {
    if (!event?.id || !userId) {
      setChatUnreadCount(0)
      return undefined
    }

    let cancelled = false

    async function fetchChatUnreadCount() {
      const seenAt = readSeen(`last_seen_event_${event.id}`)
      const { data, error } = await supabase.from('messages').select('id, created_at, user_id').eq('event_id', event.id).eq('is_secret', false).neq('user_id', userId).order('created_at', { ascending: false })

      if (cancelled) return
      if (error) {
        console.error('Erreur messages non lus événement :', error)
        setChatUnreadCount(0)
        return
      }

      setChatUnreadCount((data ?? []).filter(message => new Date(message.created_at).getTime() > seenAt).length)
    }

    fetchChatUnreadCount()
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase.channel(`event-detail-chat:${event.id}:${suffix}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${event.id}` }, fetchChatUnreadCount).subscribe()
    const handleRefresh = () => fetchChatUnreadCount()
    window.addEventListener('amiv:unread-counts-refresh', handleRefresh)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      window.removeEventListener('amiv:unread-counts-refresh', handleRefresh)
    }
  }, [event?.id, userId])

  async function handleRsvp(status) {
    if (!userId || loading) return
    setLoading(true)
    const invitationStatus = status === 'going' ? 'accepted' : status === 'not_going' ? 'declined' : status
    const orParts = [`invited_user_id.eq.${userId}`]
    if (userEmail) orParts.push(`invited_email.eq.${userEmail}`)

    const { data: inv, error: selErr } = await supabase.from('invitations').select('id').eq('event_id', event.id).or(orParts.join(',')).maybeSingle()
    if (selErr) console.error('SELECT invitation error:', selErr)
    if (!inv) {
      console.warn('Invitation introuvable — userId:', userId, '/ event.id:', event.id)
    } else {
      const { error: updErr } = await supabase.from('invitations').update({ status: invitationStatus }).eq('id', inv.id)
      if (updErr) console.error('UPDATE invitation error:', updErr)
    }

    const { data, error } = await supabase.from('rsvps').upsert({ event_id: event.id, user_id: userId, status }, { onConflict: 'event_id,user_id' }).select('id, status, plus_one_requested, plus_one_status, plus_one_name, plus_one_message').maybeSingle()
    if (!error) {
      setRsvpStatus(data?.status ?? status)
      setMyRsvp(data ?? { ...myRsvp, status })
      showToast('Réponse enregistrée ✓')
      if (status === 'going' && event.user_id && event.user_id !== userId) {
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle()
        const name = profile?.name ?? 'Quelqu\'un'
        await supabase.from('notifications').insert({ user_id: event.user_id, type: 'rsvp_received', title: `${name} participe à ${event.name}`, body: 'Nouvelle réponse à votre événement', data: { event_id: event.id, sender_id: userId } })
      }
    }
    setLoading(false)
  }

  async function handleDateVote(optionId, available) {
    if (!userId) return
    const { error } = await supabase.from('event_date_votes').upsert({ option_id: optionId, user_id: userId, available }, { onConflict: 'option_id,user_id' })

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
    const datetime = option.proposed_time ? `${option.proposed_date}T${option.proposed_time}` : `${option.proposed_date}T00:00`
    const { error } = await supabase.from('events').update({ date: datetime, poll_closed: true }).eq('id', event.id)
    if (!error) {
      setEventOverrides(prev => ({ ...prev, date: datetime, poll_closed: true }))
      showToast('Date confirmée ! 🎉')
    }
    setConfirmingDate(false)
  }

  function handleEditOpen() {
    setEditForm({ name: event.name ?? '', date: event.date ? event.date.slice(0, 16) : '', description: event.description ?? '', location: event.location ?? '' })
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
      const { error: uploadError, data: uploadData } = await supabase.storage.from('event-covers').upload(filePath, coverFile, { upsert: true })
      console.log('Upload result:', { uploadError, uploadData })
      if (uploadError) {
        console.log('Upload error details:', JSON.stringify(uploadError))
        showToast('Erreur upload photo')
        setSaving(false)
        return
      }
      coverImagePath = filePath
    }

    const { error } = await supabase.from('events').update({ name: editForm.name, date: editForm.date || null, description: editForm.description, location: editForm.location, cover_image: coverImagePath, birthday_person_user_id: birthdayPersonId }).eq('id', event.id)
    if (!error) {
      setEventOverrides(prev => ({ ...prev, name: editForm.name, date: editForm.date, description: editForm.description, location: editForm.location, cover_image: coverImagePath, birthday_person_user_id: birthdayPersonId }))
      setEditing(false)
      showToast('Événement modifié !')
    }
    setSaving(false)
  }

  async function handleHeroCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file || !event?.id || !canManage) return
    const ext = file.name.split('.').pop()
    const filePath = `${event.id}/cover_${Date.now()}.${ext}`
    const { error: uploadError, data: uploadData } = await supabase.storage.from('event-covers').upload(filePath, file, { upsert: true })

    console.log('Upload result:', { uploadError, uploadData })
    if (uploadError) {
      console.log('Upload error details:', JSON.stringify(uploadError))
      showToast('Erreur upload photo')
      e.target.value = ''
      return
    }

    const { error } = await supabase.from('events').update({ cover_image: filePath }).eq('id', event.id)
    if (!error) {
      setEventOverrides(prev => ({ ...prev, cover_image: filePath }))
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
    await supabase.from('invitations').insert({ event_id: event.id, invited_user_id: friendId, invited_by: userId, status: 'pending' })
    setInvitedIds(prev => new Set([...prev, friendId]))
  }

  async function handleAddFriend(inviteeId) {
    setEventGuests(prev => prev.map(g => g.invitee_id === inviteeId ? { ...g, friend_request_sent: true } : g))
    const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: inviteeId, status: 'pending' })
    if (error) {
      setEventGuests(prev => prev.map(g => g.invitee_id === inviteeId ? { ...g, friend_request_sent: false } : g))
      showToast('Erreur lors de la demande')
    }
  }

  async function handleOpenCoOrgModal() {
    setCoOrgError('')
    setConfirmedParticipants([])
    setShowCoOrgModal(true)
    setCoOrgLoading(true)
    const orgIds = new Set(organizers.map(o => o.profile?.id).filter(Boolean))
    const { data: rsvpsData } = await supabase.from('rsvps').select('user_id, profile:user_id (id, first_name, name, avatar_url)').eq('event_id', event.id).eq('status', 'going')
    const participants = (rsvpsData || []).filter(r => r.profile && !orgIds.has(r.profile.id)).map(r => r.profile)
    setConfirmedParticipants(participants)
    setCoOrgLoading(false)
  }

  async function handleAddCoOrganizer(participantId) {
    setCoOrgSubmitting(true)
    setCoOrgError('')
    try {
      await addCoOrganizerById(event.id, participantId)
      const { data: orgsData } = await supabase.from('event_organizers').select('role, profile:user_id (id, first_name, name, avatar_url)').eq('event_id', event.id)
      setOrganizers(orgsData || [])
      setConfirmedParticipants(prev => prev.filter(p => p.id !== participantId))
      showToast('Co-organisateur ajouté ✓')
    } catch (err) {
      setCoOrgError(err.message || "Erreur lors de l'ajout")
    } finally {
      setCoOrgSubmitting(false)
    }
  }

  function handleAddToCalendar() {
    if (!event?.date) {
      showToast('Date non précisée')
      return
    }
    const start = new Date(eventOverrides.date ?? event.date)
    if (isNaN(start)) {
      showToast('Date non précisée')
      return
    }

    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
    const formatIcsDate = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const clean = value => String(value || '').replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n')
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Amiv//Event//FR', 'BEGIN:VEVENT', `UID:${event.id}@amiv.app`, `DTSTAMP:${formatIcsDate(new Date())}`, `DTSTART:${formatIcsDate(start)}`, `DTEND:${formatIcsDate(end)}`, `SUMMARY:${clean(eventOverrides.name ?? event.name)}`, `DESCRIPTION:${clean(eventOverrides.description ?? event.description ?? '')}`, `LOCATION:${clean(eventOverrides.location ?? event.location ?? '')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(eventOverrides.name ?? event.name ?? 'evenement').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.ics`
    link.click()
    URL.revokeObjectURL(url)
  }

  return {
    coverInputRef,
    rsvpStatus,
    myRsvp,
    userId,
    currentUserName,
    canManage,
    loading,
    guestRsvps,
    toast,
    editing,
    editForm,
    setEditForm,
    birthdayPersonId,
    saving,
    coverPreview,
    setCoverFile,
    setCoverPreview,
    eventOverrides,
    showDeleteModal,
    setShowDeleteModal,
    deleting,
    friends,
    invitedIds,
    copySuccess,
    dateOptions,
    myVotes,
    allVoteCounts,
    confirmingDate,
    rsvpStats,
    participants,
    organizerName,
    eventGuests,
    isInvitedGuest,
    chatUnreadCount,
    organizers,
    showCoOrgModal,
    setShowCoOrgModal,
    coOrgSubmitting,
    coOrgError,
    confirmedParticipants,
    coOrgLoading,
    eventForMessages,
    showToast,
    handleRsvp,
    handleDateVote,
    handleConfirmDate,
    handleEditOpen,
    toggleBirthdayPerson,
    handleEditSubmit,
    handleHeroCoverChange,
    handleDeleteEvent,
    handleInviteFriend,
    handleAddFriend,
    handleOpenCoOrgModal,
    handleAddCoOrganizer,
    handleAddToCalendar,
    handleShare,
    handleCopyLink,
    setEditing,
  }
}
