import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react'
import { supabase, AUTH_CALLBACK_URL, AUTH_RESET_URL } from '../lib/supabase'
import { track } from '../lib/analytics'
import { captureSupabaseError } from '../lib/monitoring'
import { LEGAL_URLS, openExternalUrl } from '../lib/native'
import { getPendingInviteToken } from '../lib/onboarding'
import { OnboardingHeader, OnboardingStyles } from '../components/onboarding/OnboardingUI'
import AmivLogo from '../components/onboarding/AmivLogo'

const legalLinkStyle = { color: '#e055aa', fontWeight: 600, cursor: 'pointer' }
const fieldStyle = { background: '#F5F5F5', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }
const inputStyle = { flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit', padding: 0 }
const fieldErrorStyle = { fontSize: 12, color: '#FF3B30', margin: '-4px 4px 10px' }
const switchLinkStyle = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: '#e055aa', cursor: 'pointer' }

// Même minimum que l'écran de nouveau mot de passe (AuthReset). Supabase
// n'impose que 6 caractères (valeur par défaut), donc 8 reste compatible.
const MIN_PASSWORD_LENGTH = 8
const EMAIL_RE = /^\S+@\S+\.\S+$/

// Fondu + léger glissement au changement de mode, et repli en hauteur
// (grid-template-rows 0fr ↔ 1fr) pour les blocs qui apparaissent / disparaissent.
const AUTH_CSS = `
  @keyframes auth-swap { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .auth-swap { display: inline-block; animation: auth-swap 0.25s ease both; }
  .auth-collapse { display: grid; transition: grid-template-rows 0.25s ease, opacity 0.25s ease, transform 0.25s ease; }
  .auth-collapse > div { overflow: hidden; min-height: 0; }
  .auth-collapse[data-open="true"] { grid-template-rows: 1fr; opacity: 1; transform: none; }
  .auth-collapse[data-open="false"] { grid-template-rows: 0fr; opacity: 0; transform: translateY(-6px); }
  @media (prefers-reduced-motion: reduce) {
    .auth-swap { animation: none; }
    .auth-collapse { transition: none; }
  }
`

function Collapse({ open, children }) {
  return (
    <div className="auth-collapse" data-open={open} aria-hidden={!open}>
      <div>{children}</div>
    </div>
  )
}

// Traduit les erreurs Supabase courantes ; jamais de message technique brut.
function authErrorMessage(e) {
  const code = e?.code ?? ''
  const msg = (e?.message ?? '').toLowerCase()
  if (e?.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network') || navigator.onLine === false) {
    return 'Problème de connexion. Vérifie ton réseau et réessaie.'
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.'
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return "Ton email n'est pas encore confirmé. Vérifie ta boîte mail (et tes spams)."
  if (e?.status === 429 || code.startsWith('over_')) return 'Trop de tentatives. Réessaie dans une minute.'
  if (code === 'weak_password') return 'Mot de passe trop faible. Choisis-en un plus long ou plus varié.'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Adresse email invalide.'
  if (code === 'signup_disabled') return 'Les inscriptions sont momentanément fermées.'
  return 'Une erreur est survenue. Réessaie.'
}

function Spinner() {
  return (
    <span aria-hidden="true" style={{
      width: 16, height: 16, borderRadius: '50%', display: 'inline-block',
      border: '2px solid rgba(255,255,255,0.45)', borderTopColor: '#fff',
      animation: 'ob-spin 0.7s linear infinite',
    }} />
  )
}

// Étape 1 de l'onboarding (inscription) ou connexion. initialMode : 'login'
// (par défaut) ou 'signup'. onBack : retour à l'écran de bienvenue.
export default function Auth({ initialMode = 'login', onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login')
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const isLogin = mode === 'login'
  const isSignup = mode === 'signup' && !forgotMode

  const passwordError = isSignup && password.length < MIN_PASSWORD_LENGTH ? `Au moins ${MIN_PASSWORD_LENGTH} caractères.` : null
  const confirmError = isSignup && confirm !== password ? 'Les mots de passe ne correspondent pas.' : null
  const showPasswordError = passwordError && (touched.password || submitted)
  const showConfirmError = confirmError && (touched.confirm || submitted)
  const formValid = isSignup
    ? EMAIL_RE.test(email.trim()) && !passwordError && !confirmError
    : email.trim() !== '' && password !== ''

  const touch = field => () => setTouched(t => ({ ...t, [field]: true }))

  const switchMode = next => {
    setMode(next)
    setConfirm('')
    setTouched({})
    setSubmitted(false)
    setError(null)
  }

  const handle = async () => {
    setSubmitted(true)
    if (!formValid || loading) return
    setLoading(true)
    setError(null)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        // App.jsx détecte SIGNED_IN via son onAuthStateChange — rien à faire ici
      } else {
        track('signup_started')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: AUTH_CALLBACK_URL,
            // Lien d'invitation ouvert avant l'inscription (voir lib/onboarding)
            data: getPendingInviteToken() ? { pending_invite_token: getPendingInviteToken() } : undefined,
          },
        })
        if (error) throw error
        // Avec la confirmation par email activée, Supabase ne renvoie pas
        // d'erreur pour un email déjà inscrit mais un user sans identité.
        if (data.user && data.user.identities?.length === 0) throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' })
        track('signup_completed')
        // Sans confirmation par email, une session est ouverte et App.jsx
        // prend le relais ; sinon on demande de vérifier la boîte mail.
        if (!data.session) setSuccess(true)
      }
    } catch (e) {
      captureSupabaseError(e, { operation: isLogin ? 'sign_in' : 'sign_up' })
      track(isLogin ? 'login_failed' : 'signup_failed', {
        error_code: e.code,
        error_status: e.status,
      })
      setError(authErrorMessage(e))
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
        email: email.trim(),
        options: { emailRedirectTo: AUTH_CALLBACK_URL },
      })
      if (error) throw error
      setResendDone(true)
    } catch (e) {
      setError(authErrorMessage(e))
    }
    setResendLoading(false)
  }

  const onSubmit = e => {
    e.preventDefault()
    if (forgotMode) handleResetRequest()
    else handle()
  }

  if (success) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32, textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: 22, background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Mail size={34} strokeWidth={1.8} color="#e055aa" />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Vérifie ta boîte mail pour confirmer ton compte.</div>
      <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 8 }}>Un lien de confirmation t'a été envoyé à <strong>{email.trim()}</strong></div>
      <div style={{ fontSize: 13, color: '#AEAEB2', marginBottom: Capacitor.isNativePlatform() ? 12 : 32 }}>Pense à vérifier tes spams.</div>
      {Capacitor.isNativePlatform() && (
        <div style={{ fontSize: 14, color: '#1C1C1E', fontWeight: 600, marginBottom: 32 }}>Confirme ton email, puis reviens ici pour te connecter.</div>
      )}
      {resendDone && (
        <div style={{ background: 'rgba(52,199,89,0.10)', color: '#34C759', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          Email renvoyé !
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#FF3B30' }}>
          {error}
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
      <div onClick={() => { setSuccess(false); setEmail(''); setPassword(''); setConfirm(''); setError(null) }} style={{ fontSize: 13, color: '#8E8E93', marginTop: 14, cursor: 'pointer' }}>
        Utiliser un autre email
      </div>
      {Capacitor.isNativePlatform() && (
        <div onClick={() => { setSuccess(false); setPassword(''); switchMode('login') }} style={{ fontSize: 13, color: '#e055aa', fontWeight: 600, marginTop: 14, cursor: 'pointer' }}>
          Me connecter
        </div>
      )}
    </div>
  )

  if (resetSent) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32, textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: 22, background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <KeyRound size={34} strokeWidth={1.8} color="#e055aa" />
      </div>
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

  const eyeButton = visible => (
    <button
      type="button"
      tabIndex={visible ? 0 : -1}
      onClick={() => setShowPassword(v => !v)}
      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      style={{ background: 'none', border: 'none', padding: 0, marginLeft: 8, display: 'flex', color: '#8E8E93', cursor: 'pointer' }}
    >
      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )

  const submitDisabled = loading || (!forgotMode && !formValid)
  const submitLabel = forgotMode ? 'Envoyer le lien' : isLogin ? 'Se connecter' : 'Créer mon compte'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <OnboardingStyles />
      <style>{AUTH_CSS}</style>
      {onBack && (
        <div style={{ width: '100%', maxWidth: 430, margin: '0 auto' }}>
          <OnboardingHeader progressStep={isLogin || forgotMode ? null : 1} onBack={forgotMode ? leaveForgotMode : onBack} />
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', overflowY: 'auto' }}>

        {/* Logo */}
        <AmivLogo size={64} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 15, color: '#8E8E93', marginBottom: 40 }}>L'essentiel, c'est d'être ensemble</div>

        {/* Form */}
        <form onSubmit={onSubmit} noValidate style={{ width: '100%', maxWidth: 340 }}>
          {forgotMode && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>Mot de passe oublié</div>
              <div style={{ fontSize: 13, color: '#8E8E93' }}>Entre ton email, on t'envoie un lien pour en choisir un nouveau.</div>
            </div>
          )}

          {/* Email */}
          <div style={fieldStyle}>
            <label htmlFor="auth-email" style={labelStyle}>Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <Collapse open={!forgotMode}>
            <div style={fieldStyle}>
              <label htmlFor="auth-password" style={labelStyle}>Mot de passe</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  disabled={forgotMode}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={touch('password')}
                  aria-invalid={showPasswordError ? true : undefined}
                  aria-describedby={showPasswordError ? 'auth-password-error' : undefined}
                  style={inputStyle}
                />
                {eyeButton(!forgotMode)}
              </div>
            </div>
            {showPasswordError && <div id="auth-password-error" role="alert" style={fieldErrorStyle}>{passwordError}</div>}
          </Collapse>

          {/* Confirmation (inscription) */}
          <Collapse open={isSignup}>
            <div style={fieldStyle}>
              <label htmlFor="auth-password-confirm" style={labelStyle}>Confirmer le mot de passe</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  id="auth-password-confirm"
                  name="password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  disabled={!isSignup}
                  onChange={e => setConfirm(e.target.value)}
                  onBlur={touch('confirm')}
                  aria-invalid={showConfirmError ? true : undefined}
                  aria-describedby={showConfirmError ? 'auth-confirm-error' : undefined}
                  style={inputStyle}
                />
                {eyeButton(isSignup)}
              </div>
            </div>
            {showConfirmError && <div id="auth-confirm-error" role="alert" style={fieldErrorStyle}>{confirmError}</div>}
          </Collapse>

          <Collapse open={isLogin && !forgotMode}>
            <div style={{ textAlign: 'right', margin: '2px 4px 10px' }}>
              <button type="button" tabIndex={isLogin && !forgotMode ? 0 : -1} onClick={() => { setForgotMode(true); setError(null) }} style={{ ...switchLinkStyle, fontSize: 13 }}>
                Mot de passe oublié ?
              </button>
            </div>
          </Collapse>

          {/* Error */}
          {error && (
            <div role="alert" style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#FF3B30' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="ob-press" disabled={submitDisabled} aria-busy={loading} style={{
            width: '100%', padding: 16, marginTop: 6, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'linear-gradient(135deg,#e055aa,#f5a623)',
            opacity: loading ? 0.75 : submitDisabled ? 0.45 : 1,
            color: '#fff', fontFamily: 'inherit',
            borderRadius: 16, fontSize: 16, fontWeight: 700,
            cursor: submitDisabled ? 'not-allowed' : 'pointer',
          }}>
            {loading && <Spinner />}
            <span key={forgotMode ? 'forgot' : mode} className="auth-swap">{submitLabel}</span>
          </button>

          {!forgotMode && (
            <div style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 16 }}>
              <span key={mode} className="auth-swap">
                {isLogin ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
                <button type="button" onClick={() => switchMode(isLogin ? 'signup' : 'login')} style={switchLinkStyle}>
                  {isLogin ? "S'inscrire" : 'Se connecter'}
                </button>
              </span>
            </div>
          )}

          <Collapse open={isSignup}>
            <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              En créant un compte, tu acceptes les{' '}
              <span role="link" onClick={() => openExternalUrl(LEGAL_URLS.terms)} style={legalLinkStyle}>Conditions d'utilisation</span>
              {' '}et la{' '}
              <span role="link" onClick={() => openExternalUrl(LEGAL_URLS.privacy)} style={legalLinkStyle}>Politique de confidentialité</span>.
            </div>
          </Collapse>

          {forgotMode && (
            <button type="button" onClick={leaveForgotMode} style={{ ...switchLinkStyle, display: 'block', width: '100%', fontWeight: 400, fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 16 }}>
              Retour à la connexion
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
