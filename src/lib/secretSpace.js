import { supabase } from './supabase'
import { readChannelLastRead } from '../components/messages/utils'

// Espace secret (Flashback / Cadeaux / Cagnotte) et chat Secret d'un
// anniversaire : même cadenas, même couleur, même phrase des deux côtés.
export const SECRET_ACCENT = '#534AB7'
export const SECRET_ACCENT_SOFT = '#EEEDFE'
// Sur fond sombre (en-tête de l'espace secret)
export const SECRET_ACCENT_ON_DARK = '#AFA9EC'

export const SECRET_SPACE_TABS = ['flashback', 'gifts', 'cagnotte']

export function hiddenFromLabel(firstName) {
  return `Caché de ${firstName}`
}

export function secretConversationLabel(firstName) {
  return `Conversation cachée de ${firstName}`
}

// Les liens n'existent que pour un anniversaire avec une personne fêtée,
// et jamais pour elle (le serveur applique la même règle).
export function canLinkSecretSpace(event, userId) {
  return !!event?.birthday_person_user_id && !!userId && userId !== event.birthday_person_user_id
}

// Révélation le lendemain de l'anniversaire, à minuit
export function secretRevealDate(eventDate) {
  if (!eventDate) return null
  const date = new Date(eventDate)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + 1)
  date.setHours(0, 0, 0, 0)
  return date
}

export function daysUntil(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date - today) / 86400000)
}

export function formatEuros(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return `${numeric.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`
}

// Total et nombre de participants (les montants individuels ne sont lisibles
// que par la personne elle-même et les coordinateurs)
export async function fetchCagnotteSummary(eventId) {
  const { data, error } = await supabase.rpc('get_cagnotte_summary', { p_event_id: eventId }).maybeSingle()
  if (error) throw error
  return { participants: data?.participants ?? 0, total: Number(data?.total) || 0 }
}

// Onglet de l'espace secret lié à un message système du chat Secret
export function secretTabForMessage(message) {
  const tab = message?.system_data?.tab
  return SECRET_SPACE_TABS.includes(tab) ? tab : null
}

// Onglet à ouvrir depuis le chat : celui de la dernière activité, sinon Flashback
export function mostRelevantSecretTab(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.system_type && message.system_type !== 'secret_reminder') {
      const tab = secretTabForMessage(message)
      if (tab) return tab
    }
  }
  return 'flashback'
}

// Messages non lus du chat Secret (mêmes repères que la messagerie). Les
// messages système sont discrets : ils ne comptent pas.
export async function fetchSecretUnreadCount(eventId, userId) {
  if (!eventId || !userId) return 0
  const seenAt = readChannelLastRead(eventId, true)
  let query = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('is_secret', true)
    .is('system_type', null)
    .neq('user_id', userId)
  if (seenAt) query = query.gt('created_at', new Date(seenAt).toISOString())
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}
