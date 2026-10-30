import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pushPermissionState } from '../../lib/push'
import { track } from '../../lib/analytics'
import { BIRTHDAYS_GOAL, dismissGettingStarted, loadGettingStarted } from '../../lib/onboarding'
import { OnboardingHeader } from '../onboarding/OnboardingUI'
import StepBirthday from '../onboarding/StepBirthday'
import StepPhoto from '../onboarding/StepPhoto'
import StepFriends from '../onboarding/StepFriends'
import StepBirthdays from '../onboarding/StepBirthdays'
import StepNotifications from '../onboarding/StepNotifications'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'

const STEP_SCREENS = {
  birthday: StepBirthday,
  photo: StepPhoto,
  birthdays: StepBirthdays,
  friend: StepFriends,
  notifications: StepNotifications,
}

// Étapes de « Bien démarrer » à partir de l'état du compte. L'anniversaire
// n'apparaît que s'il manque (comptes créés avant le nouvel onboarding), ou
// s'il manquait à l'ouverture de l'accueil (il reste alors coché).
export function gettingStartedItems({ profile, birthdaysCount, friendsCount, pushState }, { showBirthday = false } = {}) {
  const items = []
  if (!profile?.birthday || showBirthday) items.push({ key: 'birthday', label: 'Ajoute ton anniversaire', done: Boolean(profile?.birthday) })
  items.push(
    { key: 'photo', label: 'Ajoute une photo de profil', done: Boolean(profile?.avatar_url) },
    { key: 'birthdays', label: `Ajoute ${BIRTHDAYS_GOAL} anniversaires`, detail: `${Math.min(birthdaysCount, BIRTHDAYS_GOAL)}/${BIRTHDAYS_GOAL}`, done: birthdaysCount >= BIRTHDAYS_GOAL },
    { key: 'friend', label: 'Ajoute 1 ami', done: friendsCount >= 1 },
  )
  // Notifications push : iPhone seulement
  if (pushState) {
    items.push({
      key: 'notifications',
      label: 'Active les notifications',
      detail: pushState === 'denied' ? 'Réglages › Amiv › Notifications' : null,
      done: pushState === 'granted',
    })
  }
  return items
}

// Carte « Bien démarrer » en haut de l'accueil : étapes non faites,
// progression, croix pour la masquer. Disparaît quand tout est fait.
export default function GettingStartedCard({ userId, onChanged }) {
  const [state, setState] = useState(null)
  const [openStep, setOpenStep] = useState(null)
  const [hidden, setHidden] = useState(false)
  const [birthdayWasMissing, setBirthdayWasMissing] = useState(false)

  const refresh = useCallback(async () => {
    const [data, pushState] = await Promise.all([loadGettingStarted(userId), pushPermissionState()])
    if (data.profile && !data.profile.birthday) setBirthdayWasMissing(true)
    setState({ ...data, pushState })
  }, [userId])

  useEffect(() => { if (userId) refresh() }, [userId, refresh])

  if (!state?.profile || hidden || state.profile.getting_started_dismissed_at) return null
  const items = gettingStartedItems(state, { showBirthday: birthdayWasMissing })
  const doneCount = items.filter(item => item.done).length
  if (doneCount === items.length) return null

  async function dismiss() {
    setHidden(true)
    track('getting_started_dismissed', { done: doneCount, total: items.length })
    const { error } = await dismissGettingStarted(userId)
    if (error) setHidden(false)
  }

  function open(item) {
    if (item.done || (item.key === 'notifications' && state.pushState === 'denied')) return
    track('getting_started_opened', { step: item.key })
    setOpenStep(item.key)
  }

  async function closeStep(changed) {
    setOpenStep(null)
    await refresh()
    if (changed) onChanged?.()
  }

  const Screen = openStep ? STEP_SCREENS[openStep] : null

  return (
    <>
      <section aria-label="Bien démarrer" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: '16px 16px 6px', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E' }}>Bien démarrer</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{doneCount}/{items.length} étapes faites</div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Masquer « Bien démarrer »"
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}
          >
            <X size={16} strokeWidth={2.2} color="#8E8E93" />
          </button>
        </div>

        <div role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount} aria-label="Progression" style={{ height: 6, borderRadius: 3, background: '#EFEFF4', overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${(doneCount / items.length) * 100}%`, height: '100%', background: GRADIENT, borderRadius: 3, transition: 'width 0.45s ease' }} />
        </div>

        {items.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => open(item)}
            disabled={item.done}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', border: 'none', borderTop: '0.5px solid rgba(0,0,0,0.06)', background: 'none', cursor: item.done ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.done ? '#34C759' : 'transparent', border: item.done ? 'none' : '2px solid #D1D1D6', boxSizing: 'border-box' }}>
              {item.done && <Check size={14} color="#fff" strokeWidth={3} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: item.done ? '#AEAEB2' : '#1C1C1E', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</div>
              {item.detail && !item.done && <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{item.detail}</div>}
            </div>
            {!item.done && !(item.key === 'notifications' && state.pushState === 'denied') && <ChevronRight size={18} color="#C7C7CC" />}
          </button>
        ))}
      </section>

      {Screen && (
        // Contexte d'empilement au-dessus de la barre du bas (z-index 100)
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <Screen
            userId={userId}
            profile={state.profile}
            header={<OnboardingHeader onBack={() => closeStep(false)} />}
            direction="next"
            onDone={() => closeStep(true)}
            onSignOut={() => supabase.auth.signOut()}
          />
        </div>
      )}
    </>
  )
}
