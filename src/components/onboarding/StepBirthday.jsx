import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { captureSupabaseError } from '../../lib/monitoring'
import { hapticError, hapticSuccess } from '../../lib/haptics'
import { MIN_AGE, MONTHS, ageOn, daysInMonth, parseBirthday, toBirthdayValue } from '../../utils/birthday'
import DeleteAccountModal from '../profile/DeleteAccountModal'
import WheelPicker, { WheelColumn } from './WheelPicker'
import { BLACK, ErrorText, FONT, GRAY, OnboardingScreen, PrimaryButton, RED, StepTitle } from './OnboardingUI'

const CURRENT_YEAR = new Date().getFullYear()
const MONTH_OPTIONS = MONTHS.map((label, i) => ({ value: i + 1, label: label.charAt(0).toUpperCase() + label.slice(1) }))
const YEAR_OPTIONS = [
  { value: null, label: 'Année —' },
  ...Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => ({ value: CURRENT_YEAR - i, label: String(CURRENT_YEAR - i) })),
]

// Date à laquelle l'âge minimum sera atteint
function minAgeDate({ day, month, year }) {
  const date = new Date(year + MIN_AGE, month - 1, Math.min(day, daysInMonth(month, year + MIN_AGE)))
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Étape 3 : jour et mois obligatoires, année facultative. Sous l'âge
// minimum des CGU, l'inscription s'arrête là.
export default function StepBirthday({ userId, profile, header, direction, onDone, onSignOut }) {
  const initial = parseBirthday(profile?.birthday)
  const [day, setDay] = useState(initial?.day ?? 1)
  const [month, setMonth] = useState(initial?.month ?? 1)
  const [year, setYear] = useState(initial?.year ?? null)
  const [touched, setTouched] = useState(Boolean(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showDelete, setShowDelete] = useState(false)

  const maxDay = daysInMonth(month, year)
  const safeDay = Math.min(day, maxDay)
  const dayOptions = useMemo(() => Array.from({ length: maxDay }, (_, i) => ({ value: i + 1, label: String(i + 1) })), [maxDay])

  const parts = { day: safeDay, month, year }
  const age = ageOn(parts)
  const inFuture = year != null && age < 0
  const tooYoung = year != null && !inFuture && age < MIN_AGE

  const change = setter => value => { setTouched(true); setError(null); setter(value) }

  async function handleSave() {
    if (tooYoung || inFuture || saving) { hapticError(); return }
    setSaving(true)
    setError(null)
    const birthday = toBirthdayValue(parts)
    const { error: updateError } = await supabase.from('profiles').update({ birthday }).eq('id', userId)
    setSaving(false)
    if (updateError) {
      captureSupabaseError(updateError, { operation: 'save_own_birthday' })
      hapticError()
      setError('Impossible d\'enregistrer. Vérifie ta connexion et réessaie.')
      return
    }
    hapticSuccess()
    onDone({ birthday })
  }

  const summary = `${safeDay === 1 ? '1er' : safeDay} ${MONTHS[month - 1]}${year ? ` ${year}` : ''}`

  return (
    <OnboardingScreen
      header={header}
      direction={direction}
      screenKey="birthday"
      footer={(
        <PrimaryButton onClick={handleSave} disabled={tooYoung || inFuture || !touched} loading={saving}>
          {saving ? 'Enregistrement…' : touched ? `C'est le ${summary}` : 'Choisis ta date'}
        </PrimaryButton>
      )}
    >
      <StepTitle emoji="🎂" title="C'est quand, ton anniversaire ?" subtitle="Tes amis seront prévenus 7 jours avant." />

      <WheelPicker>
        <WheelColumn label="Jour" options={dayOptions} value={safeDay} onChange={change(setDay)} flex={0.7} />
        <WheelColumn label="Mois" options={MONTH_OPTIONS} value={month} onChange={change(setMonth)} flex={1.4} />
        <WheelColumn label="Année" options={YEAR_OPTIONS} value={year} onChange={change(setYear)} flex={1} />
      </WheelPicker>

      <div style={{ fontSize: 13, color: GRAY, lineHeight: 1.5, margin: '12px 4px 16px' }}>
        L'année est facultative : sans elle, ton âge n'apparaît nulle part.
      </div>

      {inFuture && <ErrorText>Cette date n'est pas encore passée. Vérifie l'année.</ErrorText>}

      {tooYoung && (
        <div role="alert" className="ob-rise" style={{ background: 'rgba(255,59,48,0.07)', borderRadius: 18, padding: '16px 16px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 750, color: RED, marginBottom: 6 }}>Amiv est réservé aux {MIN_AGE} ans et plus</div>
          <div style={{ fontSize: 14, color: BLACK, lineHeight: 1.5 }}>
            D'après cette date, tu as {age} an{age > 1 ? 's' : ''}. Tu pourras t'inscrire à partir du {minAgeDate(parts)}.
            Si tu t'es trompé d'année, corrige-la ci-dessus.
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowDelete(true)} style={linkStyle}>Supprimer mon compte</button>
            <button type="button" onClick={onSignOut} style={linkStyle}>Me déconnecter</button>
          </div>
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <DeleteAccountModal isOpen={showDelete} onClose={() => setShowDelete(false)} />
    </OnboardingScreen>
  )
}

const linkStyle = { border: 'none', background: 'none', padding: 0, color: RED, fontSize: 14, fontWeight: 650, textDecoration: 'underline', cursor: 'pointer', fontFamily: FONT }
