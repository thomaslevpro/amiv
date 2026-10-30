// Anniversaire du profil (profiles.birthday, colonne date). L'année est
// facultative : sans année, on enregistre UNKNOWN_BIRTH_YEAR, année
// bissextile (le 29 février reste possible) et antérieure à 1900, donc
// jamais prise pour un âge (EventDetail ignore déjà les années < 1900).
// Les anniversaires ajoutés à la main (table birthdays) gardent 2000.

export const UNKNOWN_BIRTH_YEAR = 1896

// Âge minimum fixé par les CGU (section « 2. Âge minimum »)
export const MIN_AGE = 15

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// 'YYYY-MM-DD' → { day, month (1-12), year | null }
export function parseBirthday(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  if (!match) return null
  const year = Number(match[1])
  return { day: Number(match[3]), month: Number(match[2]), year: year >= 1900 ? year : null }
}

export function hasBirthYear(value) {
  return parseBirthday(value)?.year != null
}

export function toBirthdayValue({ day, month, year }) {
  const yyyy = String(year ?? UNKNOWN_BIRTH_YEAR).padStart(4, '0')
  return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function daysInMonth(month, year) {
  // Année inconnue : février a 29 jours
  return new Date(year ?? 2000, month, 0).getDate()
}

// Âge atteint à la date `ref` (aujourd'hui par défaut)
export function ageOn({ day, month, year }, ref = new Date()) {
  if (year == null) return null
  const hadBirthday = ref.getMonth() + 1 > month || (ref.getMonth() + 1 === month && ref.getDate() >= day)
  return ref.getFullYear() - year - (hadBirthday ? 0 : 1)
}

// « 2 décembre » ou « 2 décembre 1996 »
export function formatBirthday(value, { withYear = true } = {}) {
  const parts = parseBirthday(value)
  if (!parts) return null
  const day = parts.day === 1 ? '1er' : String(parts.day)
  const base = `${day} ${MONTHS[parts.month - 1]}`
  return withYear && parts.year ? `${base} ${parts.year}` : base
}

// Message d'erreur pour l'anniversaire de son propre profil, ou null
export function ownBirthdayError(value) {
  const parts = parseBirthday(value)
  if (!parts || parts.year == null) return null
  const age = ageOn(parts)
  if (age < 0) return 'Cette date n\'est pas encore passée. Vérifie l\'année.'
  if (age < MIN_AGE) return `Amiv est réservé aux personnes de ${MIN_AGE} ans et plus.`
  return null
}
