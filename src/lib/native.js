import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNative = Capacitor.isNativePlatform()

export function initNative() {
  if (!isNative) return
  // Style.Light = texte sombre, pour fond clair
  StatusBar.setStyle({ style: Style.Light }).catch(() => {})
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
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
