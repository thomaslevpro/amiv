import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Retour haptique iPhone. Absent du web et des builds antérieurs au plugin :
// on ne fait rien.
const available = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics')

// Validation d'une étape (« Continuer », ajout réussi)
export function hapticSuccess() {
  if (!available) return
  Haptics.notification({ type: NotificationType.Success }).catch(() => {})
}

// Petit tic : sélection dans une roue, ajout d'un élément
export function hapticLight() {
  if (!available) return
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

// Saisie refusée (âge minimum, pseudo pris)
export function hapticError() {
  if (!available) return
  Haptics.notification({ type: NotificationType.Error }).catch(() => {})
}
