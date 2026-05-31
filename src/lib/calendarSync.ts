import { supabase } from './supabase'

export async function getOrCreateCalendarToken(userId: string): Promise<string> {
  const token = crypto.randomUUID()
  const { data, error } = await supabase
    .from('calendar_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('token')
    .maybeSingle()

  if (error) throw error
  if (data?.token) return data.token

  const { data: existing, error: selectError } = await supabase
    .from('calendar_tokens')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) throw selectError
  if (!existing?.token) throw new Error('Impossible de créer le lien calendrier.')

  return existing.token
}

export async function deleteCalendarToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}
