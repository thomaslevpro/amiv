import { useEffect, useRef, useState } from 'react'
import { CalendarHeart, Check, Link2, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { captureSupabaseError } from '../../lib/monitoring'
import { hapticError, hapticSuccess } from '../../lib/haptics'
import { BIRTHDAYS_GOAL } from '../../lib/onboarding'
import { daysInMonth, formatBirthday, toBirthdayValue } from '../../utils/birthday'
import AskBirthdaySheet from '../AskBirthdaySheet'
import { BLACK, ErrorText, FONT, GRADIENT, GRAY, GREEN, LIGHT, OnboardingScreen, PrimaryButton, StepTitle } from './OnboardingUI'

const SHORT_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const selectStyle = { border: 'none', background: LIGHT, borderRadius: 12, padding: '0 8px', height: 48, fontSize: 16, color: BLACK, fontFamily: FONT, WebkitAppearance: 'none', appearance: 'none', textAlign: 'center', flexShrink: 0 }

// Étape 6 (facultative) : prénom + jour/mois, ligne après ligne. Objectif 3.
export default function StepBirthdays({ userId, header, direction, onDone }) {
  const [existingCount, setExistingCount] = useState(0)
  const [added, setAdded] = useState([])
  const [name, setName] = useState('')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showAsk, setShowAsk] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    supabase.from('birthdays').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count }) => setExistingCount(count ?? 0))
  }, [userId])

  const total = existingCount + added.length
  const remaining = Math.max(0, BIRTHDAYS_GOAL - total)
  const maxDay = month ? daysInMonth(Number(month), null) : 31
  const canAdd = name.trim() && day && month && Number(day) <= maxDay

  async function handleAdd(event) {
    event?.preventDefault()
    if (!canAdd || saving) return
    setSaving(true)
    setError(null)
    // Année inconnue : 2000, comme l'ajout manuel depuis l'accueil
    const birthdate = toBirthdayValue({ day: Number(day), month: Number(month), year: 2000 })
    const { data, error: insertError } = await supabase
      .from('birthdays')
      .insert({ user_id: userId, name: name.trim().slice(0, 60), birthdate, reminder_days: [7] })
      .select('id')
      .single()
    setSaving(false)
    if (insertError) {
      captureSupabaseError(insertError, { operation: 'onboarding_add_birthday' })
      hapticError()
      setError('Impossible d\'ajouter cet anniversaire. Réessaie.')
      return
    }
    hapticSuccess()
    setAdded(prev => [...prev, { id: data.id, name: name.trim(), birthdate }])
    setName('')
    setDay('')
    setMonth('')
    nameRef.current?.focus()
  }

  return (
    <OnboardingScreen
      header={header}
      direction={direction}
      screenKey="birthdays"
      footer={<PrimaryButton onClick={() => onDone({ birthdaysAdded: added.length })} disabled={saving}>Continuer</PrimaryButton>}
    >
      <StepTitle icon={CalendarHeart} title="Les anniversaires que tu connais" subtitle="Amiv te les rappellera, même si tes proches ne sont pas sur l'app." />

      <div style={{ background: '#FFF6E8', borderRadius: 18, padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 750, color: BLACK }}>
            {remaining === 0 ? 'Objectif atteint' : `Ajoute ${BIRTHDAYS_GOAL} anniversaires`}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: GRAY }}>{Math.min(total, BIRTHDAYS_GOAL)}/{BIRTHDAYS_GOAL}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: BIRTHDAYS_GOAL }, (_, i) => (
            <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < total ? GRADIENT : 'rgba(0,0,0,0.08)', transition: 'background 0.3s ease' }} />
          ))}
        </div>
      </div>

      {added.map(item => (
        <div key={item.id} className="ob-rise" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 14, background: '#F2FBF4', marginBottom: 8 }}>
          <div className="ob-pop" style={{ width: 24, height: 24, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Check size={15} color="#fff" strokeWidth={3} />
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 650, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <div style={{ fontSize: 14, color: GRAY }}>{formatBirthday(item.birthdate, { withYear: false })}</div>
        </div>
      ))}

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: added.length ? 6 : 0 }}>
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Prénom"
          aria-label="Prénom"
          autoCapitalize="words"
          maxLength={60}
          style={{ flex: 1, minWidth: 0, height: 48, border: 'none', background: LIGHT, borderRadius: 12, padding: '0 14px', fontSize: 16, color: BLACK, outline: 'none', fontFamily: FONT }}
        />
        <select value={day} onChange={e => setDay(e.target.value)} aria-label="Jour" style={{ ...selectStyle, width: 58, color: day ? BLACK : GRAY }}>
          <option value="">Jour</option>
          {Array.from({ length: maxDay }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)} aria-label="Mois" style={{ ...selectStyle, width: 74, color: month ? BLACK : GRAY }}>
          <option value="">Mois</option>
          {SHORT_MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
        </select>
        <button
          type="submit"
          aria-label="Ajouter cet anniversaire"
          disabled={!canAdd || saving}
          className="ob-press"
          style={{ width: 48, height: 48, borderRadius: 12, border: 'none', flexShrink: 0, background: canAdd ? GRADIENT : '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canAdd ? 'pointer' : 'default' }}
        >
          <Plus size={22} color="#fff" strokeWidth={2.6} />
        </button>
      </form>

      <div style={{ marginTop: 12 }}><ErrorText>{error}</ErrorText></div>

      <button
        type="button"
        onClick={() => setShowAsk(true)}
        className="ob-press"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, padding: '14px 16px', border: '1.5px dashed #E5E5EA', borderRadius: 16, background: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}
      >
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Link2 size={18} color="#e055aa" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: BLACK }}>Demander son anniversaire</div>
          <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>Envoie un lien, la date s'ajoute toute seule.</div>
        </div>
      </button>

      {showAsk && <AskBirthdaySheet onClose={() => setShowAsk(false)} />}
    </OnboardingScreen>
  )
}
