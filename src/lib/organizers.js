import { supabase } from './supabase'

export async function isOrganizer(eventId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('event_organizers')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  return !!data
}

export async function getOrganizers(eventId) {
  const { data, error } = await supabase
    .from('event_organizers')
    .select(`role, profile:user_id (id, first_name, name, email, avatar_url, username)`)
    .eq('event_id', eventId)
    .order('created_at')

  if (error) throw error
  return data
}

export async function addCoOrganizer(eventId, email) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
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
