import { supabase } from './supabase'
import { shareLink } from './share'

export const BIRTHDAY_REQUEST_BASE_URL = 'https://amiv.app/anniv/'

export function birthdayRequestUrl(code) {
  return `${BIRTHDAY_REQUEST_BASE_URL}${code}`
}

// 20 liens par 24 h : l'erreur 'rate_limited' remonte avec un message clair.
export async function createBirthdayRequest(friendName) {
  const { data, error } = await supabase.rpc('create_birthday_request', {
    p_friend_name: friendName?.trim() || null,
  })
  if (error) {
    const rateLimited = /rate_limited/.test(error.message || '')
    return {
      data: null,
      error: rateLimited
        ? 'Tu as envoyé 20 demandes en 24 h. Réessaie demain.'
        : 'Impossible de créer le lien. Réessaie.',
    }
  }
  return { data, error: null }
}

export function shareBirthdayRequest({ code, friendName }) {
  const hello = friendName?.trim() ? `Hello ${friendName.trim()} !` : 'Hello !'
  const url = birthdayRequestUrl(code)
  return shareLink({
    title: 'Ton anniversaire',
    text: `${hello} Je ne veux plus jamais rater ton anniversaire 🎂\nTu me donnes la date ? → ${url}`,
  })
}

// pending | received | expired
export function birthdayRequestStatus(request) {
  if (request.status === 'received') return 'received'
  return new Date(request.expires_at) <= new Date() ? 'expired' : 'pending'
}

export async function listBirthdayRequests() {
  return supabase
    .from('birthday_requests')
    .select('id, code, friend_name, status, created_at, expires_at, responded_at, responder_name, birthday:birthdays(birthdate)')
    .order('created_at', { ascending: false })
    .limit(50)
}
