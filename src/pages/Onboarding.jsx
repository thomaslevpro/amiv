import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { captureSupabaseError } from '../lib/monitoring'
import { track } from '../lib/analytics'
import { canAskPushPermission, snoozePushPrompt } from '../lib/push'
import { OPTIONAL_STEPS, STEP, completeOnboarding, getPendingInviteToken, resumeStep, saveOnboardingStep } from '../lib/onboarding'
import { OnboardingHeader } from '../components/onboarding/OnboardingUI'
import StepIdentity from '../components/onboarding/StepIdentity'
import StepBirthday from '../components/onboarding/StepBirthday'
import StepPhoto from '../components/onboarding/StepPhoto'
import StepFriends from '../components/onboarding/StepFriends'
import StepBirthdays from '../components/onboarding/StepBirthdays'
import StepNotifications from '../components/onboarding/StepNotifications'
import StepDone from '../components/onboarding/StepDone'

// Onboarding après la création du compte (étapes 2 à 8 ; 0 et 1 sont
// l'écran de bienvenue et l'inscription, avant la session).
// Chaque étape validée ou passée est enregistrée tout de suite
// (profiles.onboarding_step) : en rouvrant l'app, on reprend à la première
// étape non faite.
// Arrivée par un lien d'invitation : après l'étape 3, l'onboarding est
// terminé et l'app ouvre l'événement ; les étapes 4 à 7 restent proposées
// par la carte « Bien démarrer » de l'accueil.
export default function OnboardingFlow({ session, onComplete }) {
  const userId = session.user.id
  const [profile, setProfile] = useState(null)
  const [step, setStep] = useState(null)
  const [direction, setDirection] = useState('next')
  const [pushAskable, setPushAskable] = useState(false)
  const completing = useRef(false)
  // Étape la plus avancée enregistrée (on ne revient jamais en arrière)
  const savedStep = useRef(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.rpc('get_my_profile').select('first_name, username, birthday, avatar_url, onboarding_step').maybeSingle(),
      canAskPushPermission(),
    ]).then(async ([{ data, error }, askable]) => {
      if (cancelled) return
      if (error) captureSupabaseError(error, { operation: 'load_onboarding_profile' })
      let resume = resumeStep(data)
      if (resume === STEP.NOTIFICATIONS && !askable) resume = STEP.DONE
      if (resume === STEP.DONE) await completeOnboarding(userId)
      if (cancelled) return
      savedStep.current = Math.max(data?.onboarding_step ?? 0, resume)
      setProfile(data ?? {})
      setPushAskable(askable)
      setStep(resume)
    })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (step != null) track('onboarding_step_viewed', { step })
  }, [step])

  // Prochaine étape affichée (l'étape Notifications est sautée hors iPhone
  // ou si iOS a déjà eu la réponse)
  const nextOf = current => {
    const next = current + 1
    return next === STEP.NOTIFICATIONS && !pushAskable ? STEP.DONE : next
  }
  const previousOf = current => {
    const previous = current - 1
    return previous === STEP.NOTIFICATIONS && !pushAskable ? previous - 1 : previous
  }

  async function finish(completedStep) {
    if (completing.current) return
    completing.current = true
    const { error } = await completeOnboarding(userId, completedStep)
    completing.current = false
    return !error
  }

  async function advance(patch = {}) {
    const merged = { ...profile, ...patch }
    setProfile(merged)
    setDirection('next')

    // Lien d'invitation : l'événement d'abord, le reste plus tard
    if (step === STEP.BIRTHDAY && getPendingInviteToken(session)) {
      track('onboarding_invite_shortcut')
      if (await finish(STEP.PHOTO)) onComplete()
      return
    }

    const next = nextOf(step)
    if (next === STEP.DONE) {
      if (!(await finish(STEP.DONE))) return
    } else if (next > savedStep.current) {
      savedStep.current = next
      saveOnboardingStep(userId, next)
    }
    setStep(next)
  }

  function skip() {
    track('onboarding_step_skipped', { step })
    if (step === STEP.NOTIFICATIONS) snoozePushPrompt()
    advance()
  }

  function back() {
    setDirection('back')
    setStep(previousOf(step))
  }

  if (step === null) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <div style={{ fontSize: 52, fontWeight: 900, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Amiv</div>
      </div>
    )
  }

  if (step === STEP.DONE) return <StepDone firstName={profile?.first_name} onFinish={() => onComplete()} />

  const header = (
    <OnboardingHeader
      progressStep={step}
      onBack={step > STEP.IDENTITY ? back : undefined}
      onLater={OPTIONAL_STEPS.includes(step) ? skip : undefined}
    />
  )
  const props = { userId, profile, header, direction, onDone: advance }

  switch (step) {
    case STEP.IDENTITY: return <StepIdentity {...props} />
    case STEP.BIRTHDAY: return <StepBirthday {...props} onSignOut={() => supabase.auth.signOut()} />
    case STEP.PHOTO: return <StepPhoto {...props} />
    case STEP.FRIENDS: return <StepFriends {...props} />
    case STEP.BIRTHDAYS: return <StepBirthdays {...props} />
    case STEP.NOTIFICATIONS: return <StepNotifications {...props} />
    default: return null
  }
}
