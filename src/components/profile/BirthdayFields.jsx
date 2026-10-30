import { useEffect, useState } from 'react'
import { MONTHS, daysInMonth, parseBirthday, toBirthdayValue } from '../../utils/birthday'

const CURRENT_YEAR = new Date().getFullYear()

// Anniversaire du profil : jour, mois, année facultative.
// value / onChange : 'YYYY-MM-DD' (année inconnue : voir utils/birthday) ou ''.
export default function BirthdayFields({ value, onChange, selectStyle, firstRef }) {
  const [parts, setParts] = useState(() => parseBirthday(value) ?? { day: '', month: '', year: null })

  useEffect(() => {
    const parsed = parseBirthday(value)
    if (parsed) setParts(parsed)
  }, [value])

  const update = patch => {
    const next = { ...parts, ...patch }
    const max = next.month ? daysInMonth(Number(next.month), next.year) : 31
    if (next.day && Number(next.day) > max) next.day = max
    setParts(next)
    onChange(next.day && next.month ? toBirthdayValue({ day: Number(next.day), month: Number(next.month), year: next.year }) : '')
  }

  const maxDay = parts.month ? daysInMonth(Number(parts.month), parts.year) : 31
  const style = { ...selectStyle, color: '#1C1C1E', WebkitAppearance: 'none', appearance: 'none' }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select ref={firstRef} aria-label="Jour" value={parts.day || ''} onChange={e => update({ day: e.target.value ? Number(e.target.value) : '' })} style={{ ...style, flex: 0.8, color: parts.day ? '#1C1C1E' : '#C7C7CC' }}>
        <option value="">Jour</option>
        {Array.from({ length: maxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <select aria-label="Mois" value={parts.month || ''} onChange={e => update({ month: e.target.value ? Number(e.target.value) : '' })} style={{ ...style, flex: 1.4, color: parts.month ? '#1C1C1E' : '#C7C7CC' }}>
        <option value="">Mois</option>
        {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
      </select>
      <select aria-label="Année (facultative)" value={parts.year ?? ''} onChange={e => update({ year: e.target.value ? Number(e.target.value) : null })} style={{ ...style, flex: 1, color: parts.year ? '#1C1C1E' : '#C7C7CC' }}>
        <option value="">Année</option>
        {Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i).map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}
