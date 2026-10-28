import { supabase } from './supabase'

// Owner ou co-organisateur approuvé (même règle que les policies RLS) ;
// un guest_leader ou un co-organisateur en attente n'est pas organisateur.
export async function isOrganizer(eventId) {
  const { data, error } = await supabase.rpc('is_event_organizer', { p_event_id: eventId })
  if (error) return false
  return data === true
}

export async function getOrganizers(eventId) {
  const { data, error } = await supabase
    .from('event_organizers')
    .select(`role, profile:user_id (id, first_name, name, avatar_url, username)`)
    .eq('event_id', eventId)
    .order('created_at')

  if (error) throw error
  return data
}

export async function addCoOrganizerById(eventId, userId) {
  const { error } = await supabase
    .from('event_organizers')
    .insert({ event_id: eventId, user_id: userId, role: 'co_organizer' })
  if (error) throw error
}

export async function addCoOrganizer(eventId, email) {
  const { data: profile, error } = await supabase
    .rpc('search_profiles', { p_query: email })
    .select('id')
    .maybeSingle()

  if (error || !profile) throw new Error('Aucun compte Amiv trouvé pour cet email')

  const { error: insertError } = await supabase
    .from('event_organizers')
    .insert({ event_id: eventId, user_id: profile.id, role: 'co_organizer' })

  if (insertError) throw insertError
}

export async function removeCoOrganizer(eventId, userId) {
  const { error } = await supabase
    .from('event_organizers')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('role', 'co_organizer')

  if (error) throw error
}
