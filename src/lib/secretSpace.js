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

export async function fetchSecretSpaceSummary(eventId) {
  const [memories, gifts, cagnotte, contributions] = await Promise.all([
    supabase.from('collective_memories').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('gift_items').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('event_cagnottes').select('event_id').eq('event_id', eventId).maybeSingle(),
    supabase.from('cagnotte_contributions').select('amount').eq('event_id', eventId),
  ])
  const error = memories.error || gifts.error || cagnotte.error || contributions.error
  if (error) throw error
  return {
    memoryCount: memories.count ?? 0,
    giftCount: gifts.count ?? 0,
    hasCagnotte: !!cagnotte.data,
    cagnotteTotal: (contributions.data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  }
}

// « 3 souvenirs · 2 idées cadeaux · Cagnotte 120 € · Révélation J-22 » :
// seulement ce qui existe.
export function secretSummaryParts(summary, eventDate) {
  const parts = []
  if (summary?.memoryCount > 0) parts.push(`${summary.memoryCount} souvenir${summary.memoryCount > 1 ? 's' : ''}`)
  if (summary?.giftCount > 0) parts.push(`${summary.giftCount} idée${summary.giftCount > 1 ? 's' : ''} cadeau${summary.giftCount > 1 ? 'x' : ''}`)
  if (summary?.cagnotteTotal > 0) parts.push(`Cagnotte ${formatEuros(summary.cagnotteTotal)}`)
  else if (summary?.hasCagnotte) parts.push('Cagnotte ouverte')
  const days = daysUntil(secretRevealDate(eventDate))
  if (days !== null && days > 0) parts.push(`Révélation J-${days}`)
  return parts
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
