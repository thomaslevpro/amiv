import { supabase } from './supabase'
import { captureSupabaseError } from './monitoring'

// Écrans de l'onboarding. profiles.onboarding_step garde la prochaine étape
// à faire (jamais en arrière) : en rouvrant l'app, on reprend là.
// 0 et 1 (bienvenue, inscription) se passent avant d'avoir un compte.
export const STEP = {
  WELCOME: 0,
  SIGNUP: 1,
  IDENTITY: 2,
  BIRTHDAY: 3,
  PHOTO: 4,
  FRIENDS: 5,
  BIRTHDAYS: 6,
  NOTIFICATIONS: 7,
  DONE: 8,
}

// Présentation animée avant le compte : vue une fois par appareil
const INTRO_SEEN_KEY = 'amiv_onboarding_seen'

export function hasSeenIntro() {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    // Stockage indisponible : la présentation reviendra au prochain lancement
  }
}

// Barre de progression : étapes 1 à 7
export const PROGRESS_STEPS = 7

// Étapes que « Plus tard » permet de passer
export const OPTIONAL_STEPS = [STEP.PHOTO, STEP.FRIENDS, STEP.BIRTHDAYS, STEP.NOTIFICATIONS]

// Objectif de l'étape « Les anniversaires que tu connais »
export const BIRTHDAYS_GOAL = 3

// Étape où reprendre. Prénom, pseudo et anniversaire sont obligatoires :
// s'ils manquent (compte créé avec l'ancien onboarding), on y revient.
export function resumeStep(profile) {
  if (!profile?.first_name?.trim() || !profile?.username) return STEP.IDENTITY
  if (!profile.birthday) return STEP.BIRTHDAY
  return Math.min(Math.max(profile.onboarding_step ?? 0, STEP.PHOTO), STEP.DONE)
}

// L'appelant ne fait jamais reculer l'étape (onboarding_step n'est pas
// lisible directement : pas de filtre possible dessus côté client).
export async function saveOnboardingStep(userId, step) {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_step: step })
    .eq('id', userId)
  if (error) captureSupabaseError(error, { operation: 'save_onboarding_step', step })
}

export async function completeOnboarding(userId, step = STEP.DONE) {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true, onboarding_step: step })
    .eq('id', userId)
  if (error) captureSupabaseError(error, { operation: 'complete_onboarding' })
  return { error }
}

// ── Pseudo ───────────────────────────────────────────────────────────────────

export const USERNAME_REGEX = /^[a-z0-9-]{3,30}$/
export const USERNAME_RULES = '3 à 30 caractères : lettres minuscules, chiffres et tirets'

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 30)
}

// Pendant la saisie, un tiret final reste permis (« marie- » → « marie-lou »)
export function cleanUsername(value) {
  return slugify(value).replace(/-+$/, '')
}

export async function usernameTaken(username, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return Boolean(data && data.id !== userId)
}

// « Élodie » → elodie, sinon elodie2, elodie3…
export async function suggestUsername(firstName, userId) {
  const base = cleanUsername(firstName) || 'amiv'
  const root = USERNAME_REGEX.test(base) ? base : `${base}-amiv`.slice(0, 30)
  if (!(await usernameTaken(root, userId))) return root
  for (let index = 2; index < 100; index += 1) {
    const suffix = String(index)
    const candidate = `${root.slice(0, 30 - suffix.length)}${suffix}`
    if (!(await usernameTaken(candidate, userId))) return candidate
  }
  return `${root.slice(0, 24)}${Date.now().toString().slice(-6)}`
}

// ── Invitation en attente ────────────────────────────────────────────────────
// Lien /invite/<token> ouvert sans compte, puis « Créer mon compte » : le
// jeton est gardé dans le navigateur et dans les métadonnées du compte (le
// lien de confirmation peut s'ouvrir dans un autre navigateur). Après les
// étapes 1 à 3, l'app ouvre l'événement.

const INVITE_KEY = 'amiv_pending_invite'
const INVITE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function savePendingInvite(token) {
  if (!UUID_REGEX.test(token ?? '')) return
  try {
    localStorage.setItem(INVITE_KEY, JSON.stringify({ token, savedAt: Date.now() }))
  } catch {
    // Stockage indisponible (navigation privée) : les métadonnées du compte prennent le relais
  }
}

function storedInviteToken() {
  try {
    const stored = JSON.parse(localStorage.getItem(INVITE_KEY) ?? 'null')
    if (stored?.token && Date.now() - stored.savedAt < INVITE_MAX_AGE_MS) return stored.token
  } catch {
    // ignoré
  }
  return null
}

export function getPendingInviteToken(session) {
  const token = storedInviteToken() ?? session?.user?.user_metadata?.pending_invite_token ?? null
  return UUID_REGEX.test(token ?? '') ? token : null
}

export async function clearPendingInvite(session) {
  try {
    localStorage.removeItem(INVITE_KEY)
  } catch {
    // ignoré
  }
  if (session?.user?.user_metadata?.pending_invite_token) {
    const { error } = await supabase.auth.updateUser({ data: { pending_invite_token: null } })
    if (error) captureSupabaseError(error, { operation: 'clear_pending_invite' })
  }
}

// Rattache le compte à l'événement (invitation et réponse « en attente ») et
// renvoie l'événement à ouvrir, où l'invité choisit sa réponse.
export async function joinPendingInvite(session) {
  const token = getPendingInviteToken(session)
  if (!token) return null
  const { data: eventId, error } = await supabase.rpc('accept_invite_by_token', { p_token: token, p_status: 'pending' })
  await clearPendingInvite(session)
  if (error || !eventId) {
    if (error) captureSupabaseError(error, { operation: 'join_pending_invite' })
    return null
  }
  const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle()
  if (eventError) captureSupabaseError(eventError, { operation: 'load_pending_invite_event' })
  return event ?? null
}

// ── Carte « Bien démarrer » ──────────────────────────────────────────────────

export async function loadGettingStarted(userId) {
  const [profileRes, birthdaysRes, friendsRes] = await Promise.all([
    supabase.rpc('get_my_profile').select('first_name, username, birthday, avatar_url, getting_started_dismissed_at').maybeSingle(),
    supabase.from('birthdays').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    // Ami ajouté = amitié acceptée, ou demande envoyée en attente de réponse
    supabase.from('friendships').select('id', { count: 'exact', head: true })
      .or(`and(status.eq.accepted,requester_id.eq.${userId}),and(status.eq.accepted,addressee_id.eq.${userId}),and(status.eq.pending,requester_id.eq.${userId})`),
  ])
  if (profileRes.error) captureSupabaseError(profileRes.error, { operation: 'load_getting_started_profile' })
  return {
    profile: profileRes.data ?? null,
    birthdaysCount: birthdaysRes.count ?? 0,
    friendsCount: friendsRes.count ?? 0,
  }
}

export async function dismissGettingStarted(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ getting_started_dismissed_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) captureSupabaseError(error, { operation: 'dismiss_getting_started' })
  return { error }
}
