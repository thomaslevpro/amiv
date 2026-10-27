import { supabase } from '../lib/supabase'

const ALLOWED_TABLES = ['rsvps', 'guest_rsvps']

function assertTable(table) {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error('Table RSVP invalide')
  }
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

    // Notification à l'organisateur : trigger notify_plus_one_change
    return updatedRsvp
  }

  async function respondPlusOne({ rsvpId, table, status }) {
    assertTable(table)
    if (!['accepted', 'declined'].includes(status)) throw new Error('Réponse +1 invalide')

    const { data: updatedRsvp, error: updateError } = await supabase
      .from(table)
      .update({ plus_one_status: status })
      .eq('id', rsvpId)
      .select('id, plus_one_status')
      .maybeSingle()

    if (updateError) throw updateError

    // Notification à l'invité : trigger notify_plus_one_change
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
