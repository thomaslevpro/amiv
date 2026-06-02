import { useCallback, useEffect, useState } from 'react'
import { countStatuses } from '../components/home/MyEventsSection'
import { supabase } from '../lib/supabase'

export function useHomeData(userId, userEmail) {
  const [invitations, setInvitations] = useState([])
  const [myEvents, setMyEvents] = useState([])
  const [profileName, setProfileName] = useState('')

  const refetchInvitations = useCallback(async () => {
    if (!userId) {
      setInvitations([])
      return
    }

    const { data: invitationRows, error: invitationError } = await supabase
      .from('invitations')
      .select('id, event_id, invited_user_id, status')
      .eq('invited_user_id', userId)
      .neq('status', 'declined')
    if (invitationError) { console.error('Erreur invitations reçues :', invitationError); return }
    if (!invitationRows?.length) { setInvitations([]); return }

    const invitedEventIds = invitationRows.map(invitation => invitation.event_id).filter(Boolean)
    if (!invitedEventIds.length) { setInvitations([]); return }

    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('id, name, date, emoji, location, birthday_person_user_id, user_id')
      .in('id', invitedEventIds)
    if (eventsError) { console.error('Erreur invitations (events):', eventsError); return }

    const organizerIds = [...new Set((eventsData ?? []).map(event => event.user_id).filter(Boolean))]
    let organizersById = {}
    if (organizerIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', organizerIds)
      if (profilesError) { console.error('Erreur organisateurs invitations :', profilesError); return }
      organizersById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile.name]))
    }

    const { data: rsvps, error: rsvpError } = await supabase
      .from('rsvps')
      .select('event_id, status')
      .eq('user_id', userId)
      .in('event_id', invitedEventIds)
    if (rsvpError) { console.error('Erreur invitations (rsvps):', rsvpError); return }

    const rsvpsByEventId = Object.fromEntries((rsvps ?? []).map(rsvp => [rsvp.event_id, rsvp]))
    const eventsById = Object.fromEntries((eventsData ?? []).map(e => [e.id, e]))
    const pendingInvitations = invitationRows
      .map(invitation => {
        const event = eventsById[invitation.event_id] ?? null
        const rsvp = rsvpsByEventId[invitation.event_id] ?? null
        const isPending = !rsvp || rsvp.status === 'pending' || rsvp.status === 'invited'
        return {
          ...invitation,
          rsvp,
          isPending,
          organizerName: event?.user_id ? organizersById[event.user_id] ?? null : null,
          events: event,
        }
      })
      .filter(invitation => invitation.isPending)

    setInvitations(pendingInvitations)
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
      .from('profiles')
      .select('first_name, name, email')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfileName(data?.first_name || data?.name || data?.email?.split('@')[0] || '')
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
      const [organizedRes, invitationsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, date, location, user_id, cover_image, birthday_person_user_id')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .limit(5),
        supabase
          .from('invitations')
          .select('status, events(id, name, date, location, user_id, cover_image, birthday_person_user_id)')
          .eq('invited_user_id', userId)
          .neq('status', 'declined')
      ])

      if (cancelled) return

      if (organizedRes.error) console.error('Erreur événements organisés :', organizedRes.error)
      if (invitationsRes.error) console.error('Erreur invitations événements participés :', invitationsRes.error)

      const guestEvents = (invitationsRes.data ?? [])
        .filter(item => item.events)
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

      const eventIds = [...byId.keys()]
      let rsvpRows = []
      let profilesById = {}
      if (eventIds.length > 0) {
        const { data: rsvps } = await supabase
          .from('rsvps')
          .select('event_id, user_id, status')
          .in('event_id', eventIds)
        rsvpRows = rsvps ?? []
        const rsvpUserIds = [...new Set(rsvpRows.map(row => row.user_id).filter(Boolean))]
        if (rsvpUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, first_name, avatar_url, email')
            .in('id', rsvpUserIds)
          profilesById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
        }
      }

      const merged = [...byId.values()]
        .map(event => {
          const eventRsvps = rsvpRows.filter(row => row.event_id === event.id)
          const mine = eventRsvps.find(row => row.user_id === userId)
          return {
            ...event,
            myStatus: event.role === 'organise' ? 'going' : (mine?.status || event.status),
            rsvpStats: countStatuses(eventRsvps),
            memberProfiles: eventRsvps.map(row => profilesById[row.user_id]).filter(Boolean),
          }
        })
        .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'))
        .slice(0, 3)

      setMyEvents(merged)
    }

    fetchMyEvents()
    return () => { cancelled = true }
  }, [userId])

  return { invitations, refetchInvitations, myEvents, profileName }
}
