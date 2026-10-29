import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

// Feuille de partage iOS dans l'app, navigator.share sur le web, sinon copie
// du lien. Renvoie 'shared' | 'copied' | 'cancelled' | 'failed'.
// Sans url (lien déjà dans le texte), le texte entier est copié en secours.
export async function shareLink({ title, text, url }) {
  const payload = url ? { title, text, url } : { title, text }
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
      await Share.share({ ...payload, dialogTitle: title })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share(payload)
      return 'shared'
    }
  } catch (err) {
    // Fermeture de la feuille de partage sans choisir d'app
    const message = String(err?.message || err?.name || '')
    if (err?.name === 'AbortError' || /cancel/i.test(message)) return 'cancelled'
  }

  try {
    await navigator.clipboard.writeText(url || text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
