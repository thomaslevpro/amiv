import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const APPROVED_RSVP_STATUSES = ['going', 'yes', 'accepted', 'confirmed']

function displayFirstName(profile, fallback = 'Quelqu’un') {
  return profile?.first_name || profile?.name?.split(' ')?.[0] || fallback
}

function normalizeOrganizer(row) {
  return {
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    profile: row.profile ?? null,
  }
}

export function useGuestLeader(eventId) {
  const [currentUser, setCurrentUser] = useState(null)
  const [event, setEvent] = useState(null)
  const [organizers, setOrganizers] = useState([])
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!eventId) return

    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      setCurrentUser(user ?? null)

      const [eventRes, organizersRes, rsvpRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, user_id')
          .eq('id', eventId)
          .maybeSingle(),
        supabase
          .from('event_organizers')
          .select('id, event_id, user_id, role, status, created_at, profile:user_id (id, first_name, name, avatar_url)')
          .eq('event_id', eventId)
          .in('role', ['owner', 'co_organizer', 'guest_leader'])
          .order('created_at', { ascending: true }),
        user
          ? supabase
            .from('rsvps')
            .select('status')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (eventRes.error) throw eventRes.error
      if (organizersRes.error) throw organizersRes.error
      if (rsvpRes.error) throw rsvpRes.error

      setEvent(eventRes.data ?? null)
      setOrganizers((organizersRes.data ?? []).map(normalizeOrganizer))
      setRsvpStatus(rsvpRes.data?.status ?? null)
    } catch (err) {
      console.error('[useGuestLeader] load error:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!eventId) return undefined

    const channel = supabase
      .channel(`guest-leaders:${eventId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_organizers',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          load()
        }
      )
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[useGuestLeader] Realtime error:', status)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, load])

  const guestLeaders = useMemo(
    () => organizers.filter(row => row.role === 'guest_leader' && row.status === 'approved'),
    [organizers]
  )
  const pendingCandidates = useMemo(
    () => organizers.filter(row => row.role === 'guest_leader' && row.status === 'pending'),
    [organizers]
  )

  const currentUserOrganizer = useMemo(() => {
    if (!currentUser?.id) return null
    return organizers.find(row => row.user_id === currentUser.id && row.status === 'approved') ?? null
  }, [currentUser?.id, organizers])

  const currentUserRole = useMemo(() => {
    if (!currentUser?.id || !event) return null
    if (event.user_id === currentUser.id) return 'owner'
    if (currentUserOrganizer?.role === 'co_organizer') return 'co_organizer'
    if (currentUserOrganizer?.role === 'guest_leader') return 'guest_leader'
    return 'guest'
  }, [currentUser?.id, currentUserOrganizer?.role, event])

  const isGuestLeader = currentUserRole === 'guest_leader'
  const hasPendingRequest = useMemo(
    () => pendingCandidates.some(row => row.user_id === currentUser?.id),
    [currentUser?.id, pendingCandidates]
  )
  const isConfirmedGuest = APPROVED_RSVP_STATUSES.includes(rsvpStatus)

  const insertNotification = useCallback(async notification => {
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({ ...notification, read: false })
    if (notificationError) throw notificationError
  }, [])

  const applyAsGuestLeader = useCallback(async () => {
    if (!eventId || !currentUser?.id || !event) throw new Error('Événement introuvable.')
    if (isGuestLeader) throw new Error('Tu es déjà coordinateur de cet anniversaire.')
    if (hasPendingRequest) throw new Error('Ta demande est déjà en attente.')

    const { data: existingRows, error: existingError } = await supabase
      .from('event_organizers')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('user_id', currentUser.id)
      .eq('role', 'guest_leader')

    if (existingError) throw existingError
    if ((existingRows ?? []).some(row => row.status === 'pending')) throw new Error('Ta demande est déjà en attente.')
    if ((existingRows ?? []).some(row => row.status === 'approved')) throw new Error('Tu es déjà coordinateur de cet anniversaire.')

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, name')
      .eq('id', currentUser.id)
      .maybeSingle()

    const { error: insertError } = await supabase
      .from('event_organizers')
      .insert({
        event_id: eventId,
        user_id: currentUser.id,
        role: 'guest_leader',
        status: 'pending',
      })

    if (insertError) throw insertError

    const name = displayFirstName(profile, 'Quelqu’un')
    await insertNotification({
      user_id: event.user_id,
      type: 'guest_leader_request',
      title: `${name} veut coordonner un anniversaire`,
      body: `${name} souhaite coordonner l'espace secret de ${event.name}`,
      data: { event_id: eventId, sender_id: currentUser.id },
    })

    await load()
  }, [currentUser?.id, event, eventId, hasPendingRequest, insertNotification, isGuestLeader, load])

  const approveCandidate = useCallback(async userId => {
    if (!eventId || !event || !currentUser?.id) throw new Error('Événement introuvable.')
    if (event.user_id !== currentUser.id) throw new Error('Seul l’organisateur peut valider une candidature.')

    const { error: updateError } = await supabase
      .from('event_organizers')
      .update({ status: 'approved' })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('role', 'guest_leader')
      .eq('status', 'pending')

    if (updateError) throw updateError

    await insertNotification({
      user_id: userId,
      type: 'guest_leader_approved',
      title: 'Tu es coordinateur ! ✦',
      body: `L'organisateur t'a confirmé comme coordinateur de ${event.name}`,
      data: { event_id: eventId, sender_id: currentUser.id },
    })

    await load()
  }, [currentUser?.id, event, eventId, insertNotification, load])

  const rejectCandidate = useCallback(async userId => {
    if (!eventId || !event || !currentUser?.id) throw new Error('Événement introuvable.')
    if (event.user_id !== currentUser.id) throw new Error('Seul l’organisateur peut refuser une candidature.')

    const { error: updateError } = await supabase
      .from('event_organizers')
      .update({ status: 'rejected' })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('role', 'guest_leader')
      .eq('status', 'pending')

    if (updateError) throw updateError

    await insertNotification({
      user_id: userId,
      type: 'guest_leader_rejected',
      title: 'Demande de coordination',
      body: `Ta demande pour ${event.name} n'a pas été retenue`,
      data: { event_id: eventId, sender_id: currentUser.id },
    })

    await load()
  }, [currentUser?.id, event, eventId, insertNotification, load])

  return {
    guestLeaders,
    pendingCandidates,
    currentUserRole,
    isGuestLeader,
    hasPendingRequest,
    isConfirmedGuest,
    loading,
    error,
    applyAsGuestLeader,
    approveCandidate,
    rejectCandidate,
    refreshGuestLeaders: load,
  }
}
