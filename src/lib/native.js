import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Browser } from '@capacitor/browser'
import { Keyboard } from '@capacitor/keyboard'

export const isNative = Capacitor.isNativePlatform()

// Domaine public pour les liens partagés (sur natif, window.location.origin
// vaut capacitor://localhost).
export const APP_URL = 'https://amiv.app'

export function initNative() {
  initFieldReveal()
  if (!isNative) return
  // iOS zoome au focus de tout input < 16px, ce qui élargit la page et fait
  // sortir le header de l'écran. On fige l'échelle (app native, pas de pinch).
  document.querySelector('meta[name="viewport"]')?.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
  )
  // Style.Light = texte sombre, pour fond clair
  StatusBar.setStyle({ style: Style.Light }).catch(() => {})
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
}

// Champ actif caché par le clavier (ou sorti en haut d'une modale) : on le
// recentre dans la zone visible. Ne fait rien s'il est déjà visible, pour ne
// pas secouer les composeurs fixés en bas d'écran.
function revealFocusedField() {
  const field = document.activeElement
  if (!field?.matches?.('input, textarea, select, [contenteditable="true"]')) return
  const rect = field.getBoundingClientRect()
  const visibleHeight = window.visualViewport?.height ?? window.innerHeight
  if (rect.top >= 0 && rect.bottom <= visibleHeight) return
  field.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function initFieldReveal() {
  if (isNative) {
    // resize: 'native' : la WebView a déjà rétréci quand keyboardDidShow part
    Keyboard.addListener('keyboardDidShow', revealFocusedField).catch(() => {})
  } else {
    window.visualViewport?.addEventListener('resize', revealFocusedField)
  }
  // Passage d'un champ à l'autre clavier déjà ouvert : pas de nouvel évènement
  // clavier, on attend la fin de l'animation de la modale.
  document.addEventListener('focusin', () => setTimeout(revealFocusedField, 350))
}

export const LEGAL_URLS = {
  terms: `${APP_URL}/cgu`,
  privacy: `${APP_URL}/confidentialite`,
  legalNotice: `${APP_URL}/mentions-legales`,
}

// Lien externe : navigateur intégré (SFSafariViewController) sur natif,
// nouvel onglet sur le web.
export function openExternalUrl(url) {
  if (isNative) {
    Browser.open({ url }).catch(() => {})
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

// dark = texte clair, pour fond sombre
export function setStatusBarDark(dark) {
  if (!isNative) return
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
}

// amiv://auth/callback#… → { path: '/auth/callback', params }
// https://amiv.app/auth/callback?… (Universal Link) → idem
export function parseDeepLink(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  const path = url.protocol === 'amiv:'
    ? `/${url.host}${url.pathname}`.replace(/\/+$/, '') || '/'
    : url.pathname
  const params = new URLSearchParams(url.search)
  new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => params.set(key, value))
  return { path, search: url.search, params }
}
