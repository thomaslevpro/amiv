// Codes à 6 chiffres reçus par email (inscription, mot de passe oublié,
// changement d'adresse). Longueur et durée de validité réglées dans Supabase
// (Authentication → Providers → Email : « Email OTP Length » et « Email OTP Expiration »).
export const CODE_LENGTH = 6
export const CODE_TTL_MS = 60 * 60 * 1000
export const RESEND_DELAY_MS = 60 * 1000

// Doit correspondre à « Secure email change » dans Supabase (même onglet) :
// activé, un code part vers l'ancienne adresse ET un vers la nouvelle.
export const SECURE_EMAIL_CHANGE = true

export const onlyDigits = value => value.replace(/\D/g, '').slice(0, CODE_LENGTH)

// Supabase renvoie la même erreur (otp_expired) pour un code faux ou
// expiré : on les distingue grâce à l'heure d'envoi du dernier code.
export function codeErrorMessage(e, sentAt) {
  const msg = (e?.message ?? '').toLowerCase()
  if (e?.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network') || navigator.onLine === false) {
    return 'Problème de connexion. Vérifie ton réseau et réessaie.'
  }
  if (e?.status === 429 || (e?.code ?? '').startsWith('over_')) return 'Trop de tentatives. Réessaie dans une minute.'
  if (Date.now() - sentAt > CODE_TTL_MS) return 'Ce code a expiré. Demande un nouveau code ci-dessous.'
  return 'Code incorrect. Vérifie les 6 chiffres du dernier email reçu.'
}
