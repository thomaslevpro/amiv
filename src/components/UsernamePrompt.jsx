import OnboardingUsername from './onboarding/OnboardingUsername'

export default function UsernamePrompt({ session, onComplete }) {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center',
        padding: '64px 24px 0',
      }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 20 }}>🔗</div>
        <div style={{
          fontSize: 32, fontWeight: 800,
          background: 'linear-gradient(135deg,#e055aa,#f5a623)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 10, lineHeight: 1.1,
        }}>
          Votre lien Amiv
        </div>
        <div style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.6, maxWidth: 300, marginBottom: 48 }}>
          Choisissez votre identifiant unique pour que vos amis vous retrouvent facilement
        </div>

        <div style={{ width: '100%', maxWidth: 430, textAlign: 'left' }}>
          <OnboardingUsername userId={session.user.id} onNext={onComplete} variant="embedded" />
        </div>
      </div>
    </div>
  )
}
