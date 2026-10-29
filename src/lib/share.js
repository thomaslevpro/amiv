import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

// Feuille de partage iOS dans l'app, navigator.share sur le web, sinon copie
// du lien. Renvoie 'shared' | 'copied' | 'cancelled' | 'failed'.
export async function shareLink({ title, text, url }) {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
      await Share.share({ title, text, url, dialogTitle: title })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return 'shared'
    }
  } catch (err) {
    // Fermeture de la feuille de partage sans choisir d'app
    const message = String(err?.message || err?.name || '')
    if (err?.name === 'AbortError' || /cancel/i.test(message)) return 'cancelled'
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
