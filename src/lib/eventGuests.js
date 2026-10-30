import { supabase } from './supabase'
import { captureSupabaseError } from './monitoring'
import { profileFullName } from '../utils/displayName'

// Statuts renvoyés par get_event_guest_list / get_event_guest_counts, dans
// l'ordre d'affichage.
export const GUEST_STATUSES = ['confirmed', 'maybe', 'pending', 'declined']

export const GUEST_STATUS_META = {
  confirmed: { label: 'Confirmé', plural: 'Confirmés', color: '#34C759', bg: '#E8F8EC', text: '#1B7F3A' },
  maybe: { label: 'Peut-être', plural: 'Peut-être', color: '#FF9500', bg: '#FFF3E0', text: '#A35A00' },
  pending: { label: 'En attente', plural: 'En attente', color: '#D1D1D6', bg: '#F2F2F7', text: '#6B6B72' },
  declined: { label: 'Décliné', plural: 'Déclinés', color: '#FF3B30', bg: '#FDECEB', text: '#B42318' },
}

// Après une réponse à une invitation : la messagerie recharge sa liste (la
// conversation apparaît dès l'acceptation, disparaît au refus).
export const RSVP_CHANGED_EVENT = 'amiv:rsvp-changed'

export function announceRsvpChange(eventId) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(RSVP_CHANGED_EVENT, { detail: { eventId } }))
}

export const EMPTY_GUEST_COUNTS = { total: 0, confirmed: 0, maybe: 0, pending: 0, declined: 0, preview: [] }

const ROLE_RANK = { owner: 0 }
const STATUS_RANK = { confirmed: 1, maybe: 2, pending: 3, declined: 4 }

export function sortableName(name) {
  return (name || '').replace(/^@/, '')
}

// Organisateur, puis confirmés, peut-être, en attente, déclinés, puis par nom.
export function sortGuests(guests) {
  return [...guests].sort((a, b) =>
    (ROLE_RANK[a.role] ?? STATUS_RANK[a.status] ?? 5) - (ROLE_RANK[b.role] ?? STATUS_RANK[b.status] ?? 5)
    || sortableName(a.display_name).localeCompare(sortableName(b.display_name), 'fr', { sensitivity: 'base' }))
}

export function formatInvitedAgo(dateStr, now = Date.now()) {
  const time = dateStr ? new Date(dateStr).getTime() : NaN
  if (Number.isNaN(time)) return 'Invité'
  const minutes = Math.max(0, Math.floor((now - time) / 60000))
  if (minutes < 60) return minutes < 1 ? "Invité à l'instant" : `Invité il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Invité il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Invité il y a ${days} j`
  return `Invité il y a ${Math.floor(days / 30)} mois`
}

// Ligne grise sous le nom.
export function guestSubtitle(guest, now = Date.now()) {
  if (guest.role === 'owner') return 'Organisateur'
  if (guest.role === 'co_organizer') return 'Co-organisateur'
  if (guest.status === 'pending') return formatInvitedAgo(guest.invited_at, now)
  if (guest.role === 'link_guest') return 'Via le lien'
  if (guest.role === 'email_guest') return 'Invité par e-mail'
  return guest.username && !guest.display_name?.startsWith('@') ? `@${guest.username}` : ''
}

export function canRemindGuest(guest, now = Date.now()) {
  if (!guest.reminded_at) return true
  return now - new Date(guest.reminded_at).getTime() >= 24 * 60 * 60 * 1000
}

export async function fetchEventGuestList(eventId) {
  const { data, error } = await supabase.rpc('get_event_guest_list', { p_event_id: eventId })
  if (error) {
    captureSupabaseError(error, { operation: 'get_event_guest_list' })
    return null
  }
  return sortGuests(data ?? [])
}

// { [eventId]: { total, confirmed, maybe, pending, declined, preview } }
export async function fetchEventGuestCounts(eventIds) {
  const ids = [...new Set((eventIds ?? []).filter(Boolean))]
  if (ids.length === 0) return {}
  const { data, error } = await supabase.rpc('get_event_guest_counts', { p_event_ids: ids })
  if (error) {
    captureSupabaseError(error, { operation: 'get_event_guest_counts' })
    return {}
  }
  return Object.fromEntries((data ?? []).map(row => [row.event_id, row]))
}

export function countsFromGuests(guests) {
  const counts = { ...EMPTY_GUEST_COUNTS, total: guests.length }
  guests.forEach(guest => { if (guest.status in counts) counts[guest.status] += 1 })
  return counts
}

// Format attendu par les cartes (EventCard, mini-cartes de l'accueil, Tous mes événements).
export function toCardStats(counts) {
  const c = counts ?? EMPTY_GUEST_COUNTS
  return { yes: c.confirmed, maybe: c.maybe, pending: c.pending, no: c.declined, total: c.total }
}

// Même règle que get_event_guest_list : nom, sinon prénom, sinon @pseudo,
// sinon « Utilisateur Amiv » (un nom d'une lettre compte comme absent).
export function guestDisplayName(profile) {
  return profileFullName(profile, 'Utilisateur Amiv')
}
