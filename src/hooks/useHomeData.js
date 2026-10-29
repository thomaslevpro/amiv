import { useCallback, useEffect, useState } from 'react'
import { fetchEventGuestCounts, toCardStats } from '../lib/eventGuests'
import { supabase } from '../lib/supabase'

// Réponse effective d'un invité : le RSVP fait foi, l'invitation sert de repli.
export function getInviteeResponse(invitation, rsvp) {
  if (rsvp?.status === 'going' || rsvp?.status === 'declined') return rsvp.status
  if (invitation?.status === 'accepted') return 'going'
  if (invitation?.status === 'declined') return 'declined'
  return 'pending'
}

// Invitations sans réponse (ni acceptées ni refusées). Renvoie null en cas d'erreur.
export async function fetchPendingInvitations(userId) {
  if (!userId) return []

  const { data: invitationRows, error: invitationError } = await supabase
    .from('invitations')
    .select('id, event_id, invited_user_id, status')
    .eq('invited_user_id', userId)
    .neq('status', 'declined')
  if (invitationError) { console.error('Erreur invitations reçues :', invitationError); return null }
  if (!invitationRows?.length) return []

  const invitedEventIds = invitationRows.map(invitation => invitation.event_id).filter(Boolean)
  if (!invitedEventIds.length) return []

  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('id, name, date, emoji, location, birthday_person_user_id, user_id, cover_image')
    .in('id', invitedEventIds)
  if (eventsError) { console.error('Erreur invitations (events):', eventsError); return null }

  const organizerIds = [...new Set((eventsData ?? []).map(event => event.user_id).filter(Boolean))]
  let organizersById = {}
  if (organizerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', organizerIds)
    if (profilesError) { console.error('Erreur organisateurs invitations :', profilesError); return null }
    organizersById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile.name]))
  }

  const { data: rsvps, error: rsvpError } = await supabase
    .from('rsvps')
    .select('event_id, status')
    .eq('user_id', userId)
    .in('event_id', invitedEventIds)
  if (rsvpError) { console.error('Erreur invitations (rsvps):', rsvpError); return null }

  const rsvpsByEventId = Object.fromEntries((rsvps ?? []).map(rsvp => [rsvp.event_id, rsvp]))
  const eventsById = Object.fromEntries((eventsData ?? []).map(e => [e.id, e]))
  return invitationRows
    .map(invitation => {
      const event = eventsById[invitation.event_id] ?? null
      const rsvp = rsvpsByEventId[invitation.event_id] ?? null
      return {
        ...invitation,
        rsvp,
        isPending: getInviteeResponse(invitation, rsvp) === 'pending',
        organizerName: event?.user_id ? organizersById[event.user_id] ?? null : null,
        events: event,
      }
    })
    .filter(invitation => invitation.isPending && invitation.events)
}

export function useHomeData(userId, userEmail) {
  const [invitations, setInvitations] = useState([])
  const [myEvents, setMyEvents] = useState([])
  const [profileName, setProfileName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')

  const refetchInvitations = useCallback(async () => {
    const pending = await fetchPendingInvitations(userId)
    if (pending) setInvitations(pending)
  }, [userId, userEmail])

  useEffect(() => {
    refetchInvitations()
  }, [refetchInvitations])

  useEffect(() => {
    if (!userId) {
      setProfileName('')
      return
    }

    supabase
      .rpc('get_my_profile')
      .select('first_name, name, email, avatar_url')
      .maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.first_name || data?.name || data?.email?.split('@')[0] || '')
        setProfileAvatar(data?.avatar_url || '')
      })
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setMyEvents([])
      return
    }

    let cancelled = false

    async function fetchMyEvents() {
      const now = new Date().toISOString()
      const [organizedRes, invitationsRes, myRsvpsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, date, location, user_id, cover_image, birthday_person_user_id')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .limit(5),
        supabase
          .from('invitations')
          .select('status, event_id, events(id, name, date, location, user_id, cover_image, birthday_person_user_id)')
          .eq('invited_user_id', userId)
          .neq('status', 'declined'),
        supabase
          .from('rsvps')
          .select('event_id, status')
          .eq('user_id', userId)
      ])

      if (cancelled) return

      if (organizedRes.error) console.error('Erreur événements organisés :', organizedRes.error)
      if (invitationsRes.error) console.error('Erreur invitations événements participés :', invitationsRes.error)
      if (myRsvpsRes.error) console.error('Erreur rsvps événements participés :', myRsvpsRes.error)

      const myRsvpsByEventId = Object.fromEntries((myRsvpsRes.data ?? []).map(rsvp => [rsvp.event_id, rsvp]))
      const guestEvents = (invitationsRes.data ?? [])
        .filter(item => item.events && getInviteeResponse(item, myRsvpsByEventId[item.event_id]) === 'going')
        .map(item => ({
          ...item.events,
          role: 'participe',
        }))

      const byId = new Map()
      ;(organizedRes.data ?? []).filter(event => !event.date || new Date(event.date) >= new Date()).forEach(event => {
        if (event?.id) byId.set(event.id, { ...event, role: 'organise' })
      })
      guestEvents.filter(event => !event.date || new Date(event.date) >= new Date(now)).forEach(event => {
        if (event?.id && !byId.has(event.id)) byId.set(event.id, event)
      })

      const countsByEvent = await fetchEventGuestCounts([...byId.keys()])
      if (cancelled) return

      const merged = [...byId.values()]
        .map(event => ({
          ...event,
          myStatus: 'going',
          rsvpStats: toCardStats(countsByEvent[event.id]),
          memberProfiles: countsByEvent[event.id]?.preview ?? [],
        }))
        .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'))
        .slice(0, 3)

      setMyEvents(merged)
    }

    fetchMyEvents()
    return () => { cancelled = true }
  }, [userId])

  return { invitations, refetchInvitations, myEvents, profileName, profileAvatar }
}
