import OnboardingSlides from '../components/onboarding/OnboardingSlides'

// Pre-auth onboarding: shown to visitors who haven't signed in yet.
// onFinish(false) → go to signup, onFinish(true) → go to login.
export default function Onboarding({ onFinish }) {
  return (
    <OnboardingSlides
      onNext={() => onFinish(false)}
      onLogin={() => onFinish(true)}
    />
  )
}
