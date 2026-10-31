// Date et heure d'un événement (events.date, timestamptz = un instant précis).
//
// Règle unique : l'heure saisie ou affichée est l'heure locale du téléphone,
// l'instant enregistré est en UTC (ISO avec « Z »). Le changement d'heure
// (fin mars, fin octobre) est donc géré par le navigateur, jamais à la main.
// Côté serveur (SQL, e-mails), les jours et heures sont calculés en
// Europe/Paris.

const pad = n => String(n).padStart(2, '0')

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// Saisie locale 'YYYY-MM-DDTHH:mm' (champ datetime-local) → ISO UTC, ou null.
// Une chaîne sans fuseau est lue en heure locale (et non en UTC).
export function localInputToEventDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value ?? ''))
  if (!match) return null
  const [, y, m, d, h, min] = match.map(Number)
  return new Date(y, m - 1, d, h, min).toISOString()
}

// Date choisie dans un sondage : proposed_date 'YYYY-MM-DD' + proposed_time
// 'HH:mm[:ss]' facultatif (minuit sinon), en heure locale.
export function pollOptionToEventDate(proposedDate, proposedTime) {
  return localInputToEventDate(`${proposedDate}T${(proposedTime || '00:00').slice(0, 5)}`)
}

// Instant enregistré → valeur d'un champ datetime-local (heure locale).
export function eventDateToLocalInput(value) {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Jour local 'YYYY-MM-DD' d'un instant ou d'une Date (calendrier, filtres).
export function localDayKey(value) {
  const date = toDate(value)
  if (!date) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Instant → date iCalendar en UTC ('YYYYMMDDTHHmmssZ').
export function toIcsUtc(value) {
  const date = toDate(value)
  if (!date) return null
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
