import { supabase } from './supabase'

export async function getOrCreateCalendarToken(userId: string, platform = 'apple'): Promise<{ token: string; platform: string }> {
  const { data, error } = await supabase
    .from('calendar_tokens')
    .upsert({ user_id: userId, platform }, { onConflict: 'user_id' })
    .select('token, platform')
    .single()
  if (error) throw error
  return data
}

export async function deleteCalendarToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_tokens')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}
