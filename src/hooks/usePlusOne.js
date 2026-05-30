import { supabase } from '../lib/supabase'

const ALLOWED_TABLES = ['rsvps', 'guest_rsvps']

function assertTable(table) {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error('Table RSVP invalide')
  }
}

async function getRequesterName(row, table, fallbackName) {
  if (table === 'guest_rsvps') return row?.guest_name || fallbackName || 'Un invité'
  if (!row?.user_id) return fallbackName || 'Un invité'

  const { data } = await supabase
    .from('profiles')
    .select('first_name, name')
    .eq('id', row.user_id)
    .maybeSingle()

  return data?.first_name || data?.name || fallbackName || 'Un invité'
}

export function usePlusOne() {
  async function requestPlusOne({ rsvpId, table, name, message }) {
    assertTable(table)

    const plusOneName = name?.trim()
    const plusOneMessage = message?.trim() || null
    if (!rsvpId || !plusOneName) throw new Error('Demande +1 incomplète')

    const selectFields = table === 'rsvps'
      ? 'id, event_id, user_id, plus_one_requested, plus_one_status, plus_one_name, plus_one_message'
      : 'id, event_id, guest_name, plus_one_requested, plus_one_status, plus_one_name, plus_one_message'

    const { data: updatedRsvp, error: updateError } = await supabase
      .from(table)
      .update({
        plus_one_requested: true,
        plus_one_status: 'pending',
        plus_one_name: plusOneName,
        plus_one_message: plusOneMessage,
      })
      .eq('id', rsvpId)
      .select(selectFields)
      .maybeSingle()

    if (updateError) throw updateError
    if (!updatedRsvp?.event_id) throw new Error('Événement introuvable pour cette demande')

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, user_id')
      .eq('id', updatedRsvp.event_id)
      .maybeSingle()

    if (eventError) throw eventError

    if (event?.user_id) {
      const requesterName = await getRequesterName(updatedRsvp, table, plusOneName)
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: event.user_id,
        type: 'plus_one_request',
        title: `${requesterName} veut amener un +1`,
        body: plusOneMessage,
        data: {
          event_id: event.id,
          rsvp_id: rsvpId,
          table,
          requester_name: requesterName,
        },
      })

      if (notificationError) throw notificationError
    }

    return updatedRsvp
  }

  async function respondPlusOne({ rsvpId, table, status, eventId, inviteeUserId }) {
    assertTable(table)
    if (!['accepted', 'declined'].includes(status)) throw new Error('Réponse +1 invalide')

    const { data: updatedRsvp, error: updateError } = await supabase
      .from(table)
      .update({ plus_one_status: status })
      .eq('id', rsvpId)
      .select('id, plus_one_status')
      .maybeSingle()

    if (updateError) throw updateError

    if (inviteeUserId) {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: inviteeUserId,
        type: 'plus_one_response',
        title: status === 'accepted' ? '🎉 +1 accepté !' : '+1 refusé',
        body: null,
        data: { event_id: eventId, status },
      })

      if (notificationError) throw notificationError
    }

    return updatedRsvp
  }

  async function cancelPlusOne({ rsvpId, table }) {
    assertTable(table)
    if (!rsvpId) throw new Error('Demande +1 introuvable')

    const { data, error } = await supabase
      .from(table)
      .update({
        plus_one_requested: false,
        plus_one_status: 'none',
        plus_one_name: null,
        plus_one_message: null,
      })
      .eq('id', rsvpId)
      .select('id, plus_one_requested, plus_one_status, plus_one_name, plus_one_message')
      .maybeSingle()

    if (error) throw error
    return data
  }

  return { requestPlusOne, respondPlusOne, cancelPlusOne }
}
