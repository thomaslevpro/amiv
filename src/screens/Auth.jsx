import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase, AUTH_CALLBACK_URL, AUTH_RESET_URL } from '../lib/supabase'
import { track } from '../lib/analytics'
import { captureSupabaseError } from '../lib/monitoring'
import { LEGAL_URLS, openExternalUrl } from '../lib/native'
import { getPendingInviteToken } from '../lib/onboarding'
import { OnboardingHeader, OnboardingStyles } from '../components/onboarding/OnboardingUI'

const legalLinkStyle = { color: '#e055aa', fontWeight: 600, cursor: 'pointer' }

// Étape 1 de l'onboarding (inscription) ou connexion. onBack : retour à l'écran
// de bienvenue.
export default function Auth({ initialIsLogin = true, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(initialIsLogin)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handle = async () => {
    setLoading(true)
    setError(null)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // App.jsx détecte SIGNED_IN via son onAuthStateChange — rien à faire ici
      } else {
        track('signup_started')
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: AUTH_CALLBACK_URL,
            // Lien d'invitation ouvert avant l'inscription (voir lib/onboarding)
            data: getPendingInviteToken() ? { pending_invite_token: getPendingInviteToken() } : undefined,
          },
        })
        if (error) throw error
        track('signup_completed')
        setSuccess(true)
      }
    } catch (e) {
      captureSupabaseError(e, { operation: isLogin ? 'sign_in' : 'sign_up' })
      track(isLogin ? 'login_failed' : 'signup_failed', {
        error_code: e.code,
        error_status: e.status,
      })
      setError(e.message)
    }
    setLoading(false)
  }

  const handleResetRequest = async () => {
    if (!email.trim()) {
      setError('Entre ton adresse email.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_RESET_URL })
      if (error) throw error
      track('password_reset_requested')
      setResetSent(true)
    } catch (e) {
      captureSupabaseError(e, { operation: 'reset_password_request' })
      setError(e.status === 429
        ? 'Trop de demandes. Réessaie dans une minute.'
        : "Impossible d'envoyer l'email. Vérifie ton adresse et réessaie.")
    }
    setLoading(false)
  }

  const leaveForgotMode = () => {
    setForgotMode(false)
    setResetSent(false)
    setError(null)
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendDone(false)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: AUTH_CALLBACK_URL },
      })
      if (error) throw error
      setResendDone(true)
    } catch (e) {
      setError(e.message)
    }
    setResendLoading(false)
  }

  if (success) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Vérifie tes emails !</div>
      <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 8 }}>Un lien de confirmation t'a été envoyé à <strong>{email}</strong></div>
      <div style={{ fontSize: 13, color: '#AEAEB2', marginBottom: Capacitor.isNativePlatform() ? 12 : 32 }}>Pense à vérifier tes spams.</div>
      {Capacitor.isNativePlatform() && (
        <div style={{ fontSize: 14, color: '#1C1C1E', fontWeight: 600, marginBottom: 32 }}>Confirme ton email, puis reviens ici pour te connecter.</div>
      )}
      {resendDone && (
        <div style={{ background: 'rgba(52,199,89,0.10)', color: '#34C759', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          ✓ Email renvoyé !
        </div>
      )}
      <div onClick={handleResend} style={{
        background: 'transparent',
        border: '1.5px solid #E5E5EA',
        borderRadius: 12,
        padding: 13,
        fontSize: 14,
        fontWeight: 600,
        color: '#1C1C1E',
        cursor: 'pointer',
        width: '100%',
        maxWidth: 340,
      }}>
        {resendLoading ? 'Envoi…' : resendDone ? 'Renvoyer à nouveau' : "Renvoyer l'email"}
      </div>
      <div onClick={() => { setSuccess(false); setEmail(''); setPassword('') }} style={{ fontSize: 13, color: '#8E8E93', marginTop: 14, cursor: 'pointer' }}>
        Utiliser un autre email
      </div>
      {Capacitor.isNativePlatform() && (
        <div onClick={() => { setSuccess(false); setIsLogin(true); setPassword('') }} style={{ fontSize: 13, color: '#e055aa', fontWeight: 600, marginTop: 14, cursor: 'pointer' }}>
          Me connecter
        </div>
      )}
    </div>
  )

  if (resetSent) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🔑</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Vérifie tes emails !</div>
      <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 8 }}>Si un compte existe pour <strong>{email.trim()}</strong>, un lien pour choisir un nouveau mot de passe vient de lui être envoyé.</div>
      <div style={{ fontSize: 13, color: '#AEAEB2', marginBottom: Capacitor.isNativePlatform() ? 12 : 32 }}>Pense à vérifier tes spams.</div>
      {Capacitor.isNativePlatform() && (
        <div style={{ fontSize: 14, color: '#1C1C1E', fontWeight: 600, marginBottom: 32 }}>Ouvre le lien reçu par email, puis reviens ici pour te connecter.</div>
      )}
      <div onClick={() => { leaveForgotMode(); setPassword('') }} style={{ fontSize: 13, color: '#e055aa', fontWeight: 600, marginTop: 14, cursor: 'pointer' }}>
        Retour à la connexion
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <OnboardingStyles />
      {onBack && (
        <div style={{ width: '100%', maxWidth: 430, margin: '0 auto' }}>
          <OnboardingHeader progressStep={isLogin || forgotMode ? null : 1} onBack={forgotMode ? leaveForgotMode : onBack} />
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', overflowY: 'auto' }}>

        {/* Logo */}
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8, lineHeight: 1 }}>
          Amiv
        </div>
        <div style={{ fontSize: 15, color: '#8E8E93', marginBottom: 40 }}>Friends come first</div>

        {/* Form */}
        <div style={{ width: '100%', maxWidth: 340 }}>
          {forgotMode ? (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>Mot de passe oublié</div>
              <div style={{ fontSize: 13, color: '#8E8E93' }}>Entre ton email, on t'envoie un lien pour en choisir un nouveau.</div>
            </div>
          ) : (
          <div style={{ display: 'flex', background: '#F5F5F5', borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {['Connexion', 'Inscription'].map((t, i) => (
              <div key={i} onClick={() => { setIsLogin(i === 0); setError(null) }} style={{
                flex: 1, padding: '9px 0', borderRadius: 10, textAlign: 'center',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: isLogin === (i === 0) ? '#fff' : 'transparent',
                color: isLogin === (i === 0) ? '#1C1C1E' : '#8E8E93',
                boxShadow: isLogin === (i === 0) ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.15s',
              }}>
                {t}
              </div>
            ))}
          </div>
          )}

          {/* Email */}
          <div style={{ background: '#F5F5F5', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Email</div>
            <input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => forgotMode && e.key === 'Enter' && handleResetRequest()}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit' }}
            />
          </div>

          {/* Password */}
          {!forgotMode && (
          <div style={{ background: '#F5F5F5', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Mot de passe</div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit' }}
            />
          </div>
          )}

          {isLogin && !forgotMode && (
            <div onClick={() => { setForgotMode(true); setError(null) }} style={{ fontSize: 13, color: '#e055aa', fontWeight: 600, textAlign: 'right', margin: '2px 4px 10px', cursor: 'pointer' }}>
              Mot de passe oublié ?
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#FF3B30' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <div onClick={forgotMode ? handleResetRequest : handle} style={{
            width: '100%', padding: 16, marginTop: 6,
            background: loading ? '#F5F5F5' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: loading ? '#8E8E93' : '#fff',
            borderRadius: 16, fontSize: 16, fontWeight: 700,
            textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}>
            {loading ? 'Chargement...' : forgotMode ? 'Envoyer le lien' : isLogin ? 'Se connecter' : "S'inscrire"}
          </div>

          {!isLogin && !forgotMode && (
            <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              En créant un compte, tu acceptes les{' '}
              <span role="link" onClick={() => openExternalUrl(LEGAL_URLS.terms)} style={legalLinkStyle}>Conditions d'utilisation</span>
              {' '}et la{' '}
              <span role="link" onClick={() => openExternalUrl(LEGAL_URLS.privacy)} style={legalLinkStyle}>Politique de confidentialité</span>.
            </div>
          )}

          {forgotMode && (
            <div onClick={leaveForgotMode} style={{ fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 16, cursor: 'pointer' }}>
              Retour à la connexion
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
