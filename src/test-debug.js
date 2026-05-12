import { supabase } from './lib/supabase'

const { data: { session } } = await supabase.auth.getSession()
const uid = session?.user?.id
console.log('Mon user ID:', uid)

const { data: rsvps, error: rsvpsError } = await supabase
  .from('rsvps')
  .select('event_id, status, events!inner(id, name, date, user_id)')
  .eq('user_id', uid)
  .eq('status', 'going')

console.log('Mes RSVPs going:', rsvps)
console.log('Erreur RSVPs:', rsvpsError)
