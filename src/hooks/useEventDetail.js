import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_URL } from '../lib/native'
import { addCoOrganizerById, isOrganizer } from '../lib/organizers'
import { track } from '../lib/analytics'
import { captureSupabaseError } from '../lib/monitoring'
import { uploadEventCover } from '../lib/eventCover'
import { keepsBirthdayPerson } from '../components/event/eventUtils'
import { announceRsvpChange, fetchEventGuestList } from '../lib/eventGuests'
import { shareLink } from '../lib/share'

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
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', type: '', date: '', description: '', location: '' })
  const [birthdayPersonId, setBirthdayPersonId] = useState(event?.birthday_person_user_id ?? null)
  const [birthdayPersonName, setBirthdayPersonName] = useState(null)
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [eventOverrides, setEventOverrides] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Personne fêtée possible : moi ou un de mes amis (formulaire de modification)
  const [friends, setFriends] = useState([])
  const [guests, setGuests] = useState([])
  const [guestsLoading, setGuestsLoading] = useState(true)
  const [dateOptions, setDateOptions] = useState([])
  const [myVotes, setMyVotes] = useState({})
  const [allVoteCounts, setAllVoteCounts] = useState({})
  const [confirmingDate, setConfirmingDate] = useState(false)
  const [isInvitedGuest, setIsInvitedGuest] = useState(false)
  const [canAccessSecretSpace, setCanAccessSecretSpace] = useState(false)
  const [canAccessEventChat, setCanAccessEventChat] = useState(false)
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

  const currentType = eventOverrides.type ?? event?.type ?? null
  // Une override à null (personne fêtée retirée) ne doit pas retomber sur la valeur d'origine.
  const savedBirthdayPersonId = 'birthday_person_user_id' in eventOverrides
    ? eventOverrides.birthday_person_user_id
    : birthdayPersonId ?? event?.birthday_person_user_id ?? null

  const eventForMessages = {
    ...event,
    type: currentType,
    birthday_person_user_id: savedBirthdayPersonId,
  }

  async function refreshGuests() {
    const list = await fetchEventGuestList(event.id)
    if (list) setGuests(list)
    setGuestsLoading(false)
  }

  async function handleShare() {
    const url = `${APP_URL}/invite/${event.invite_token}`
    const result = await shareLink({ title: eventOverrides.name ?? event.name, text: `Tu es invité(e) ! Rejoins l'événement sur Amiv : ${url}`, url })
    if (result === 'copied') showToast('Lien copié !')
    else if (result === 'failed') showToast('Impossible de partager le lien')
  }

  useEffect(() => {
    if (!event) return
    let cancelled = false

    setEventOverrides({})
    setEditing(false)
    setDateOptions([])
    setMyVotes({})
    setAllVoteCounts({})
    setMyRsvp(null)
    setCurrentUserName('')
    setCanManage(false)
    setOrganizers([])
    setGuests([])
    setGuestsLoading(true)
    setIsInvitedGuest(false)
    setCanAccessSecretSpace(false)
    setCanAccessEventChat(false)
    setFriends([])
    setBirthdayPersonId(event?.birthday_person_user_id ?? null)

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)
      setUserEmail(user.email)

      const userCanManage = await isOrganizer(event.id)
      if (!cancelled) setCanManage(userCanManage)

      refreshGuests()

      const [rsvpRes, optRes, myInvitationRes, eventInfoRes] = await Promise.all([
        supabase.from('rsvps').select('id, status, plus_one_requested, plus_one_status, plus_one_name, plus_one_message').eq('event_id', event.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('event_date_options').select('*').eq('event_id', event.id).order('proposed_date', { ascending: true }).order('proposed_time', { ascending: true }),
        supabase.from('invitations').select('status').eq('event_id', event.id).eq('invited_user_id', user.id).maybeSingle(),
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
      refreshSecretSpaceAccess()
      refreshEventChatAccess()
      // « Peut-être » : RSVP pending + invitation maybe
      const myRsvpStatus = rsvpRes.data?.status ?? null
      setRsvpStatus(myRsvpStatus !== 'going' && myRsvpStatus !== 'declined' && myInvitationRes.data?.status === 'maybe' ? 'maybe' : myRsvpStatus)
      setMyRsvp(rsvpRes.data ?? null)

      if (cancelled) return

      // Dates affichées avec mes votes, pour que le bandeau « sondage en
      // attente » n'apparaisse pas avant leur chargement.
      const optionsData = optRes.data ?? []

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
      setDateOptions(optionsData)

      const { data: friendshipsData } = await supabase.from('friendships').select('requester_id, addressee_id').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted')
      const friendIds = (friendshipsData || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)

      let friendList = []
      if (friendIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('id, first_name, name, avatar_url').in('id', friendIds)
        friendList = profilesData || []
      }
      const { data: selfProfile } = await supabase.from('profiles').select('id, first_name, name, avatar_url').eq('id', user.id).single()
      if (!cancelled) setCurrentUserName(selfProfile?.first_name || selfProfile?.name || user.email || '')

      const birthdayCandidates = [
        ...(selfProfile ? [{ ...selfProfile, first_name: `${selfProfile.first_name || selfProfile.name || 'Moi'} (moi)` }] : []),
        ...friendList,
      ]
      if (!cancelled) setFriends(birthdayCandidates)
    }

    init()
    return () => { cancelled = true }
  }, [event?.id])

  useEffect(() => {
    if (!birthdayPersonId) {
      setBirthdayPersonName(null)
      return undefined
    }
    let cancelled = false
    supabase.from('profiles').select('first_name, name').eq('id', birthdayPersonId).maybeSingle().then(({ data }) => {
      if (!cancelled) setBirthdayPersonName(data?.first_name || data?.name?.split(' ')[0] || null)
    })
    return () => { cancelled = true }
  }, [birthdayPersonId])

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

  async function refreshEventChatAccess() {
    const { data, error } = await supabase.rpc('can_access_event_chat', { p_event_id: event.id })
    if (error) captureSupabaseError(error, { operation: 'can_access_event_chat' })
    setCanAccessEventChat(!!data)
  }

  async function refreshSecretSpaceAccess() {
    const { data, error } = await supabase.rpc('can_access_secret_space', { p_event_id: event.id })
    if (error) captureSupabaseError(error, { operation: 'can_access_secret_space' })
    setCanAccessSecretSpace(!!data)
  }

  async function handleRsvp(status) {
    if (!userId || loading) return
    const rsvpStatusValue = status === 'maybe' ? 'pending' : status
    setLoading(true)
    const invitationStatus = rsvpStatusValue === 'going' ? 'accepted' : rsvpStatusValue === 'declined' ? 'declined' : 'maybe'
    const orParts = [`invited_user_id.eq.${userId}`]
    if (userEmail) orParts.push(`invited_email.eq.${userEmail}`)

    const { data: inv, error: selErr } = await supabase.from('invitations').select('id').eq('event_id', event.id).or(orParts.join(',')).maybeSingle()
    if (selErr) {
      console.error('SELECT invitation error:', selErr)
      captureSupabaseError(selErr, { operation: 'select_invitation_for_rsvp' })
    }
    if (!inv) {
      console.warn('Invitation introuvable — userId:', userId, '/ event.id:', event.id)
    } else {
      const { error: updErr } = await supabase.from('invitations').update({ status: invitationStatus }).eq('id', inv.id)
      if (updErr) {
        console.error('UPDATE invitation error:', updErr)
        captureSupabaseError(updErr, { operation: 'update_invitation_rsvp_status' })
      }
    }

    const { data, error } = await supabase.from('rsvps').upsert({ event_id: event.id, user_id: userId, status: rsvpStatusValue }, { onConflict: 'event_id,user_id' }).select('id, status, plus_one_requested, plus_one_status, plus_one_name, plus_one_message').maybeSingle()
    if (!error) {
      track('rsvp_updated', {
        event_id: event.id,
        status: rsvpStatusValue,
      })
      setRsvpStatus(rsvpStatusValue === 'pending' ? 'maybe' : data?.status ?? rsvpStatusValue)
      setMyRsvp(data ?? { ...myRsvp, status: rsvpStatusValue })
      showToast('Réponse enregistrée ✓')
      announceRsvpChange(event.id)
      refreshSecretSpaceAccess()
      refreshEventChatAccess()
      refreshGuests()
    } else {
      captureSupabaseError(error, { operation: 'upsert_rsvp' })
      track('rsvp_update_failed', {
        event_id: event.id,
        status: rsvpStatusValue,
        error_code: error.code,
        error_status: error.status,
      })
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
    setEditForm({ name: event.name ?? '', type: currentType ?? 'Autre', date: event.date ? event.date.slice(0, 16) : '', description: event.description ?? '', location: event.location ?? '' })
    setBirthdayPersonId(savedBirthdayPersonId)
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
      const { path: filePath, error: uploadError } = await uploadEventCover(event.id, coverFile)
      if (uploadError) {
        console.log('Upload error details:', JSON.stringify(uploadError))
        captureSupabaseError(uploadError, { operation: 'upload_event_cover' })
        track('event_update_failed', {
          event_id: event.id,
          reason: 'cover_upload',
          error_code: uploadError.code,
          error_status: uploadError.status,
        })
        showToast('Erreur upload photo')
        setSaving(false)
        return
      }
      coverImagePath = filePath
    }

    // Quitter le type Anniversaire retire la personne fêtée : l'espace secret est
    // alors fermé (can_access_secret_space), son contenu est conservé.
    const nextBirthdayPersonId = keepsBirthdayPerson(editForm.type, currentType, birthdayPersonId) ? birthdayPersonId : null
    const { error } = await supabase.from('events').update({ name: editForm.name, type: editForm.type, date: editForm.date || null, description: editForm.description, location: editForm.location, cover_image: coverImagePath, birthday_person_user_id: nextBirthdayPersonId }).eq('id', event.id)
    if (!error) {
      track('event_updated', {
        event_id: event.id,
        changed_cover_image: Boolean(coverFile),
        changed_type: editForm.type !== currentType,
        has_date: Boolean(editForm.date),
        has_birthday_person: Boolean(nextBirthdayPersonId),
      })
      setBirthdayPersonId(nextBirthdayPersonId)
      setEventOverrides(prev => ({ ...prev, name: editForm.name, type: editForm.type, date: editForm.date, description: editForm.description, location: editForm.location, cover_image: coverImagePath, birthday_person_user_id: nextBirthdayPersonId }))
      setEditing(false)
      showToast('Événement modifié !')
      refreshSecretSpaceAccess()
    } else {
      captureSupabaseError(error, { operation: 'update_event' })
      track('event_update_failed', {
        event_id: event.id,
        reason: 'event_update',
        error_code: error.code,
        error_status: error.status,
      })
    }
    setSaving(false)
  }

  async function handleHeroCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file || !event?.id || !canManage) return
    const { path: filePath, error: uploadError } = await uploadEventCover(event.id, file)
    if (uploadError) {
      console.log('Upload error details:', JSON.stringify(uploadError))
      captureSupabaseError(uploadError, { operation: 'upload_event_hero_cover' })
      showToast('Erreur upload photo')
      e.target.value = ''
      return
    }

    const { error } = await supabase.from('events').update({ cover_image: filePath }).eq('id', event.id)
    if (!error) {
      track('event_updated', {
        event_id: event.id,
        changed_cover_image: true,
      })
      setEventOverrides(prev => ({ ...prev, cover_image: filePath }))
      showToast('Photo de couverture modifiée !')
    } else {
      captureSupabaseError(error, { operation: 'update_event_hero_cover' })
      track('event_update_failed', {
        event_id: event.id,
        reason: 'hero_cover_update',
        error_code: error.code,
        error_status: error.status,
      })
      showToast('Erreur upload photo')
    }
    e.target.value = ''
  }

  async function handleDeleteEvent() {
    setDeleting(true)
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) {
      captureSupabaseError(error, { operation: 'delete_event' })
      track('event_delete_failed', {
        event_id: event.id,
        error_code: error.code,
        error_status: error.status,
      })
      showToast('Erreur lors de la suppression')
      setDeleting(false)
      setShowDeleteModal(false)
    } else {
      track('event_deleted', { event_id: event.id })
      onBack?.()
    }
  }

  async function handleRemindGuest(guest) {
    if (!guest.invitation_id) return
    const { data: notified, error } = await supabase.rpc('remind_invitations', { p_invitation_ids: [guest.invitation_id], p_message: null })
    if (error) {
      captureSupabaseError(error, { operation: 'remind_invitation' })
      showToast('Erreur lors de la relance')
      return
    }
    showToast(notified > 0 ? 'Relance envoyée ✓' : 'Déjà relancé il y a moins de 24 h')
    refreshGuests()
  }

  async function handleRemoveInvitation(guest) {
    if (!guest.invitation_id) return
    const { error } = await supabase.rpc('remove_event_invitation', { p_invitation_id: guest.invitation_id })
    if (error) {
      captureSupabaseError(error, { operation: 'remove_event_invitation' })
      showToast("Erreur lors du retrait de l'invitation")
      return
    }
    setGuests(prev => prev.filter(g => g.guest_key !== guest.guest_key))
    showToast('Invitation retirée')
    refreshGuests()
  }

  async function handleOpenCoOrgModal() {
    setCoOrgError('')
    setConfirmedParticipants([])
    setShowCoOrgModal(true)
    setCoOrgLoading(true)
    const orgIds = new Set(organizers.map(o => o.profile?.id).filter(Boolean))
    // rsvps.user_id référence auth.users : pas d'embed possible vers profiles
    const { data: rsvpsData, error: rsvpsError } = await supabase.from('rsvps').select('user_id').eq('event_id', event.id).eq('status', 'going')
    const candidateIds = (rsvpsData || []).map(r => r.user_id).filter(id => id && !orgIds.has(id))
    const { data: profilesData, error: profilesError } = candidateIds.length > 0
      ? await supabase.from('profiles').select('id, first_name, name, avatar_url').in('id', candidateIds)
      : { data: [], error: null }
    const loadError = rsvpsError || profilesError
    if (loadError) {
      captureSupabaseError(loadError, { operation: 'select_co_organizer_candidates' })
      setCoOrgError('Impossible de charger les participants')
    }
    setConfirmedParticipants(profilesData || [])
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
    toast,
    editing,
    editForm,
    setEditForm,
    birthdayPersonId,
    currentType,
    saving,
    coverPreview,
    setCoverFile,
    setCoverPreview,
    eventOverrides,
    showDeleteModal,
    setShowDeleteModal,
    deleting,
    friends,
    guests,
    guestsLoading,
    dateOptions,
    myVotes,
    allVoteCounts,
    confirmingDate,
    birthdayPersonName,
    isInvitedGuest,
    canAccessSecretSpace,
    canAccessEventChat,
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
    refreshGuests,
    handleRemindGuest,
    handleRemoveInvitation,
    handleOpenCoOrgModal,
    handleAddCoOrganizer,
    handleAddToCalendar,
    handleShare,
    setEditing,
  }
}
