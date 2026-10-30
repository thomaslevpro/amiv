// « Comment me payer » de la cagnotte : moyens de paiement du coordinateur.
// Mêmes règles que valid_cagnotte_payment_methods (migration 20261101210000).
// Amiv ne traite aucun paiement : on affiche, on copie, on ouvre un lien.
//
// Ouverture directe (vérifié en octobre 2026) :
//   PayPal : lien https://paypal.me/… → ouvre le site ou l'app.
//   Lydia  : aucun format public pour payer un numéro ; seul un lien Lydia
//            collé par le coordinateur (lydia.me / lydia-app.com) s'ouvre.
//   Wero   : aucun lien public à partir d'un numéro ou d'un e-mail
//            (les liens Wero sont des demandes créées dans l'app).
// Sinon : « Copier ».

export const PAYMENT_METHOD_TYPES = ['wero', 'lydia', 'paypal', 'virement', 'especes']

export const PAYMENT_METHOD_META = {
  wero: { label: 'Wero', placeholder: 'Numéro ou e-mail', color: '#1A1A1A', bg: '#FFF3B0' },
  lydia: { label: 'Lydia', placeholder: 'Numéro ou lien Lydia', color: '#0F5FB5', bg: '#E2EEFB' },
  paypal: { label: 'PayPal', placeholder: 'https://paypal.me/…', color: '#003087', bg: '#E5ECF8' },
  virement: { label: 'Virement', placeholder: 'IBAN', color: '#1E7A35', bg: '#E5F5EA' },
  especes: { label: 'Espèces', placeholder: '', color: '#8A5A00', bg: '#FFF1D6' },
}

// Moyens déclarables par un participant (« autre » en plus)
export const CONTRIBUTION_METHODS = [...PAYMENT_METHOD_TYPES, 'autre']
export const CONTRIBUTION_METHOD_LABELS = { ...Object.fromEntries(PAYMENT_METHOD_TYPES.map(type => [type, PAYMENT_METHOD_META[type].label])), autre: 'Autre' }

const PHONE_RE = /^\+?[0-9 .()-]{6,20}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const LYDIA_LINK_RE = /^https:\/\/([a-z0-9-]+\.)*(lydia\.me|lydia-app\.com)(\/\S*)?$/i
const PAYPAL_LINK_RE = /^https:\/\/(www\.)?paypal\.me\/[a-z0-9]{1,20}(\/\S*)?$/i
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/

export function normalizeIban(value) {
  return String(value || '').replace(/\s/g, '').toUpperCase()
}

// Clé de contrôle IBAN (ISO 13616, modulo 97) : attrape les fautes de frappe
export function ibanChecksumOk(value) {
  const iban = normalizeIban(value)
  if (!IBAN_RE.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function formatIban(value) {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim()
}

// « paypal.me/nico » → « https://paypal.me/nico »
function withHttps(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, 'https://')
  return /^(www\.)?(paypal\.me|[a-z0-9-.]*lydia\.me|[a-z0-9-.]*lydia-app\.com)\//i.test(trimmed) ? `https://${trimmed}` : trimmed
}

// Valeur saisie → valeur enregistrée, ou message d'erreur
export function cleanPaymentMethod(type, value = '', holder = '') {
  const trimmed = String(value || '').trim()
  if (type === 'especes') return { method: { type } }
  if (type === 'wero') {
    if (PHONE_RE.test(trimmed) || EMAIL_RE.test(trimmed)) return { method: { type, value: trimmed } }
    return { error: 'Wero : indique un numéro de téléphone ou un e-mail.' }
  }
  if (type === 'lydia') {
    const link = withHttps(trimmed)
    if (PHONE_RE.test(trimmed)) return { method: { type, value: trimmed } }
    if (LYDIA_LINK_RE.test(link)) return { method: { type, value: link } }
    return { error: 'Lydia : indique un numéro ou un lien Lydia.' }
  }
  if (type === 'paypal') {
    const link = withHttps(trimmed)
    if (PAYPAL_LINK_RE.test(link)) return { method: { type, value: link } }
    return { error: 'PayPal : indique ton lien paypal.me (ex. paypal.me/nicolas).' }
  }
  if (type === 'virement') {
    const iban = normalizeIban(trimmed)
    const name = String(holder || '').trim()
    if (!ibanChecksumOk(iban)) return { error: 'Virement : l’IBAN ne semble pas valide.' }
    if (name.length < 2) return { error: 'Virement : indique le nom du titulaire du compte.' }
    return { method: { type, value: formatIban(iban), holder: name } }
  }
  return { error: 'Moyen de paiement inconnu.' }
}

// Bouton à afficher pour un moyen : ouvrir un lien, copier, ou mention espèces
export function paymentAction(method) {
  if (method.type === 'especes') return { kind: 'cash' }
  if ((method.type === 'paypal' && PAYPAL_LINK_RE.test(method.value)) || (method.type === 'lydia' && LYDIA_LINK_RE.test(method.value))) {
    return { kind: 'link', href: method.value }
  }
  return { kind: 'copy', text: method.type === 'virement' ? normalizeIban(method.value) : method.value }
}

// Montant suggéré : fixé par le coordinateur, ou objectif ÷ participants
// (arrondi à l'euro supérieur).
export function suggestedAmount(info, goal, participantCount) {
  if (!info) return null
  if (info.suggested_amount) return { amount: Number(info.suggested_amount), split: false }
  if (info.split_goal && Number(goal) > 0 && participantCount > 0) {
    return { amount: Math.ceil(Number(goal) / participantCount), split: true, goal: Number(goal), count: participantCount }
  }
  return null
}

export function formatDeadline(value) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Repli (anciens WebView)
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(area)
    return ok
  }
}
