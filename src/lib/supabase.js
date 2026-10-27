import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lien de confirmation email : toujours le domaine web, y compris sur natif
// (window.location.origin y vaut capacitor://localhost).
export const AUTH_CALLBACK_URL = 'https://amiv.app/auth/callback'

// iOS peut vider le localStorage de la WebView : sur natif, la session
// est stockée via @capacitor/preferences (UserDefaults).
const nativeStorage = {
  getItem: async key => (await Preferences.get({ key })).value,
  setItem: async (key, value) => { await Preferences.set({ key, value }) },
  removeItem: async key => { await Preferences.remove({ key }) },
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  Capacitor.isNativePlatform()
    ? { auth: { storage: nativeStorage, detectSessionInUrl: false } }
    : undefined
)
