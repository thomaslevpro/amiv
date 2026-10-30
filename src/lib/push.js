import { PushNotifications } from '@capacitor/push-notifications'
import { Preferences } from '@capacitor/preferences'
import { supabase } from './supabase'
import { isNative } from './native'
import { captureSupabaseError } from './monitoring'

// Notifications push iOS : le jeton APNs est enregistré dans device_tokens
// (register_device_token) à chaque lancement et supprimé à la déconnexion.
// L'envoi est fait par l'Edge Function send-push.

const TOKEN_KEY = 'push_device_token'
const PROMPT_DISMISSED_KEY = 'push_prompt_dismissed_at'
// « Plus tard » : on repropose l'écran d'explication une semaine après.
const PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

// Cible reçue d'un appui sur une notification, en attente que MainApp
// (session + onboarding chargés) l'ouvre.
let pendingTarget = null
const targetListeners = new Set()

export function takePendingPushTarget() {
  const target = pendingTarget
  pendingTarget = null
  return target
}

export function onPushTarget(listener) {
  targetListeners.add(listener)
  return () => targetListeners.delete(listener)
}

async function saveToken(token) {
  const { error } = await supabase.rpc('register_device_token', { p_token: token, p_platform: 'ios' })
  if (error) {
    captureSupabaseError(error, { operation: 'register_device_token' })
    return
  }
  await Preferences.set({ key: TOKEN_KEY, value: token }).catch(() => {})
}

// À appeler une seule fois, au démarrage, avant tout register().
// onOpen(target, notificationId) est appelé quand on appuie sur une notification.
export function initPushListeners(onOpen) {
  if (!isNative) return () => {}
  const handles = [
    PushNotifications.addListener('registration', ({ value }) => { saveToken(value) }),
    PushNotifications.addListener('registrationError', ({ error }) => {
      captureSupabaseError(new Error(error), { operation: 'push_registration' })
    }),
    PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const data = notification?.data ?? {}
      onOpen(data.target ?? null, data.notification_id ?? null)
    }),
  ]
  return () => { handles.forEach(handle => handle.then(listener => listener.remove())) }
}

export function setPendingPushTarget(target) {
  pendingTarget = target
  targetListeners.forEach(listener => listener())
}

async function permissionState() {
  try {
    return (await PushNotifications.checkPermissions()).receive
  } catch {
    return 'denied'
  }
}

// Lancement avec une session : si l'autorisation est déjà donnée, iOS
// renvoie le jeton (événement registration) et on met à jour updated_at.
export async function refreshPushRegistration() {
  if (!isNative) return
  if ((await permissionState()) !== 'granted') return
  await PushNotifications.register().catch(() => {})
}

// L'écran d'explication n'est proposé que si iOS n'a encore jamais posé la
// question (après un refus, seule l'app Réglages peut réactiver).
export async function shouldShowPushPrompt() {
  if (!isNative) return false
  const state = await permissionState()
  if (state !== 'prompt' && state !== 'prompt-with-rationale') return false
  const { value } = await Preferences.get({ key: PROMPT_DISMISSED_KEY }).catch(() => ({ value: null }))
  return !value || Date.now() - Number(value) > PROMPT_SNOOZE_MS
}

// Onboarding : l'étape « Notifications » n'a de sens que si iOS peut encore
// poser la question (sinon on la saute).
export async function canAskPushPermission() {
  if (!isNative) return false
  const state = await permissionState()
  return state === 'prompt' || state === 'prompt-with-rationale'
}

// Carte « Bien démarrer » : 'granted' | 'denied' | 'prompt' (ou null hors iPhone)
export async function pushPermissionState() {
  if (!isNative) return null
  const state = await permissionState()
  return state === 'prompt-with-rationale' ? 'prompt' : state
}

export async function snoozePushPrompt() {
  await Preferences.set({ key: PROMPT_DISMISSED_KEY, value: String(Date.now()) }).catch(() => {})
}

// Affiche la demande d'autorisation iOS ; true si acceptée.
export async function requestPushPermission() {
  if (!isNative) return false
  try {
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== 'granted') return false
    await PushNotifications.register()
    return true
  } catch {
    return false
  }
}

// Avant signOut : sans session, la ligne ne pourrait plus être supprimée (RLS).
export async function unregisterPushToken() {
  if (!isNative) return
  const { value: token } = await Preferences.get({ key: TOKEN_KEY }).catch(() => ({ value: null }))
  if (!token) return
  // register_device_token stocke le jeton en minuscules
  const { error } = await supabase.from('device_tokens').delete().eq('token', token.toLowerCase())
  if (error) captureSupabaseError(error, { operation: 'unregister_device_token' })
  await Preferences.remove({ key: TOKEN_KEY }).catch(() => {})
}
