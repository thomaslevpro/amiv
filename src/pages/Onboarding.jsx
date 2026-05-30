import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import OnboardingSlides from '../components/onboarding/OnboardingSlides'
import OnboardingProfile from '../components/onboarding/OnboardingProfile'
import OnboardingUsername from '../components/onboarding/OnboardingUsername'
import OnboardingBirthday from '../components/onboarding/OnboardingBirthday'
import OnboardingNotifications from '../components/onboarding/OnboardingNotifications'
import OnboardingDone from '../components/onboarding/OnboardingDone'

// step mapping:
//   0–1  → slides (welcome)
//   2    → profile form  (saved when profile submitted)
//   3    → username form (saved when username submitted)
//   4    → birthday form (saved when birthday submitted/skipped)
//   5    → notifications (no DB write per spec)
//   6    → done          (saved onboarding_completed=true)

export default function OnboardingFlow({ session, onComplete }) {
  const [step, setStep] = useState(null)
  const userId = session.user.id

  useEffect(() => {
    supabase
      .from('profiles')
      .select('onboarding_step')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setStep(data?.onboarding_step ?? 0)
      })
  }, [userId])

  // Slides → Profile: mark step=2 in DB so a refresh shows profile form, not slides
  const handleSlidesNext = async () => {
    await supabase.from('profiles').upsert({ id: userId, onboarding_step: 2 })
    setStep(2)
  }

  // Profile component upserts step=2 itself with the form data
  const handleProfileNext = () => setStep(3)

  const handleUsernameNext = () => setStep(4)

  // Birthday component upserts step=3 itself (or skip)
  const handleBirthdayNext = () => setStep(5)

  // Notifications: no DB write per spec — just advance locally
  const handleNotificationsNext = () => setStep(6)

  // Done: persist completion
  const handleDoneComplete = async () => {
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true, onboarding_step: 6 })
      .eq('id', userId)
    onComplete()
  }

  // Loading spinner while fetching DB step
  if (step === null) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: '#fff',
      }}>
        <div style={{
          fontSize: 52, fontWeight: 900,
          background: 'linear-gradient(135deg,#e055aa,#f5a623)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Amiv
        </div>
      </div>
    )
  }

  if (step <= 1) return <OnboardingSlides onNext={handleSlidesNext} />
  if (step === 2) return <OnboardingProfile userId={userId} onNext={handleProfileNext} />
  if (step === 3) return <OnboardingUsername userId={userId} onNext={handleUsernameNext} />
  if (step === 4) return <OnboardingBirthday userId={userId} onNext={handleBirthdayNext} />
  if (step === 5) return <OnboardingNotifications onNext={handleNotificationsNext} />
  return <OnboardingDone onComplete={handleDoneComplete} />
}
