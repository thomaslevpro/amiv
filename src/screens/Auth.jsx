import { useEffect, useRef, useState } from 'react'
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
// Code reçu par email : longueur et durée de validité réglées dans Supabase
// (Authentication → Providers → Email : « Email OTP Length » et « Email OTP Expiration »).
const CODE_LENGTH = 6
const CODE_TTL_MS = 60 * 60 * 1000
const RESEND_DELAY_MS = 60 * 1000

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

// Écran centré commun aux étapes « code » et « nouveau mot de passe »
function StepLayout({ icon: Icon, title, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflowY: 'auto', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <OnboardingStyles />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon size={34} strokeWidth={1.8} color="#e055aa" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>{title}</div>
        <div style={{ width: '100%', maxWidth: 340 }}>{children}</div>
      </div>
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div role="alert" style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#FF3B30' }}>
      {children}
    </div>
  )
}

function PrimaryButton({ loading, disabled, children }) {
  return (
    <button type="submit" className="ob-press" disabled={disabled || loading} aria-busy={loading} style={{
      width: '100%', padding: 16, marginTop: 6, border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
      opacity: loading ? 0.75 : disabled ? 0.45 : 1,
      color: '#fff', fontFamily: 'inherit',
      borderRadius: 16, fontSize: 16, fontWeight: 700,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
    }}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}

// Supabase renvoie la même erreur (otp_expired) pour un code faux ou
// expiré : on les distingue grâce à l'heure d'envoi du dernier code.
function codeErrorMessage(e, sentAt) {
  const msg = (e?.message ?? '').toLowerCase()
  if (e?.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network') || navigator.onLine === false) {
    return 'Problème de connexion. Vérifie ton réseau et réessaie.'
  }
  if (e?.status === 429 || (e?.code ?? '').startsWith('over_')) return 'Trop de tentatives. Réessaie dans une minute.'
  if (Date.now() - sentAt > CODE_TTL_MS) return 'Ce code a expiré. Demande un nouveau code ci-dessous.'
  return 'Code incorrect. Vérifie les 6 chiffres du dernier email reçu.'
}

function VerifyCodeStep({ email, purpose, sentAt: initialSentAt, onChangeEmail }) {
  const isRecovery = purpose === 'recovery'
  const [code, setCode] = useState('')
  const [sentAt, setSentAt] = useState(initialSentAt)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const cooldown = Math.max(0, Math.ceil((sentAt + RESEND_DELAY_MS - now) / 1000))
  useEffect(() => {
    if (cooldown === 0) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown === 0])

  const verify = async token => {
    if (loading || token.length !== CODE_LENGTH) return
    setLoading(true)
    setError(null)
    // Succès : la session est ouverte. App.jsx prend le relais (suite de
    // l'inscription, ou écran « nouveau mot de passe » via PASSWORD_RECOVERY).
    const { error } = await supabase.auth.verifyOtp({ email, token, type: isRecovery ? 'recovery' : 'email' })
    if (!error) {
      track(isRecovery ? 'password_reset_code_verified' : 'signup_email_verified')
      return
    }
    track('auth_code_failed', { purpose, error_code: error.code, error_status: error.status })
    setError(codeErrorMessage(error, sentAt))
    setCode('')
    setLoading(false)
    inputRef.current?.focus()
  }

  const onChange = e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    if (error) setError(null)
    // Saisie complète (ou auto-remplissage iOS) : validation directe
    if (digits.length === CODE_LENGTH) verify(digits)
  }

  const resend = async () => {
    if (cooldown > 0 || resendLoading) return
    setResendLoading(true)
    setResendDone(false)
    setError(null)
    const { error } = isRecovery
      ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: AUTH_RESET_URL })
      : await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: AUTH_CALLBACK_URL } })
    setResendLoading(false)
    if (error) {
      if (error.status !== 429) captureSupabaseError(error, { operation: isRecovery ? 'resend_recovery_code' : 'resend_signup_code' })
      setError(error.status === 429 ? 'Trop de demandes. Réessaie dans une minute.' : authErrorMessage(error))
      return
    }
    track('auth_code_resent', { purpose })
    setSentAt(Date.now())
    setNow(Date.now())
    setCode('')
    setResendDone(true)
    inputRef.current?.focus()
  }

  return (
    <StepLayout icon={isRecovery ? KeyRound : Mail} title="Vérifie ta boîte mail">
      <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 6 }}>
        {isRecovery
          ? <>Si un compte existe pour <strong style={{ color: '#1C1C1E' }}>{email}</strong>, tu vas recevoir un code à 6 chiffres.</>
          : <>On a envoyé un code à 6 chiffres à <strong style={{ color: '#1C1C1E' }}>{email}</strong>.</>}
      </div>
      <div style={{ fontSize: 13, color: '#AEAEB2', marginBottom: 24 }}>Pense à vérifier tes spams.</div>

      <form onSubmit={e => { e.preventDefault(); verify(code) }} noValidate>
        <label htmlFor="auth-code" style={{ ...labelStyle, textAlign: 'center' }}>Code de vérification</label>
        <input
          ref={inputRef}
          id="auth-code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus
          maxLength={CODE_LENGTH}
          placeholder="••••••"
          value={code}
          onChange={onChange}
          disabled={loading}
          aria-invalid={error ? true : undefined}
          className={error ? 'ob-shake' : undefined}
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 12,
            background: '#F5F5F5', borderRadius: 14, border: error ? '1.5px solid #FF3B30' : '1.5px solid transparent',
            outline: 'none', padding: '14px 16px', textAlign: 'center',
            fontSize: 28, fontWeight: 700, letterSpacing: '0.4em', fontVariantNumeric: 'tabular-nums',
            color: '#1C1C1E', fontFamily: 'inherit',
          }}
        />

        {error && <ErrorBox>{error}</ErrorBox>}
        {resendDone && !error && (
          <div role="status" style={{ background: 'rgba(52,199,89,0.10)', color: '#34C759', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 10 }}>
            Nouveau code envoyé !
          </div>
        )}

        <PrimaryButton loading={loading} disabled={code.length !== CODE_LENGTH}>Valider</PrimaryButton>
      </form>

      <button type="button" onClick={resend} disabled={cooldown > 0 || resendLoading} style={{
        width: '100%', marginTop: 12, padding: 13, borderRadius: 12,
        background: 'transparent', border: '1.5px solid #E5E5EA', fontFamily: 'inherit',
        fontSize: 14, fontWeight: 600, color: cooldown > 0 ? '#AEAEB2' : '#1C1C1E',
        cursor: cooldown > 0 || resendLoading ? 'not-allowed' : 'pointer',
      }}>
        {resendLoading ? 'Envoi…' : cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : 'Renvoyer le code'}
      </button>

      <button type="button" onClick={onChangeEmail} style={{ ...switchLinkStyle, display: 'block', width: '100%', fontWeight: 400, fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 16 }}>
        {isRecovery ? 'Retour à la connexion' : 'Modifier mon adresse email'}
      </button>
    </StepLayout>
  )
}

// Après le code de récupération : l'utilisateur est connecté, il choisit
// son nouveau mot de passe avant d'entrer dans l'app.
function NewPasswordStep({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async e => {
    e.preventDefault()
    if (loading) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`)
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      captureSupabaseError(updateError, { operation: 'reset_password_update' })
      if (updateError.code === 'same_password') setError("Choisis un mot de passe différent de l'ancien.")
      else if (updateError.code === 'weak_password') setError('Mot de passe trop faible. Choisis-en un plus long ou plus varié.')
      else setError('Impossible de modifier le mot de passe. Réessaie dans un instant.')
      return
    }
    track('password_reset_completed')
    onDone?.()
  }

  const field = (id, label, value, onChange, autoFocus) => (
    <div style={fieldStyle}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="••••••••"
          value={value}
          autoFocus={autoFocus}
          onChange={e => { onChange(e.target.value); setError(null) }}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => setShowPassword(v => !v)}
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          style={{ background: 'none', border: 'none', padding: 0, marginLeft: 8, display: 'flex', color: '#8E8E93', cursor: 'pointer' }}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )

  return (
    <StepLayout icon={KeyRound} title="Nouveau mot de passe">
      <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 24 }}>{MIN_PASSWORD_LENGTH} caractères minimum.</div>
      <form onSubmit={submit} noValidate style={{ textAlign: 'left' }}>
        {field('new-password', 'Nouveau mot de passe', password, setPassword, true)}
        {field('new-password-confirm', 'Confirmer le mot de passe', confirm, setConfirm, false)}
        {error && <ErrorBox>{error}</ErrorBox>}
        <PrimaryButton loading={loading} disabled={!password || !confirm}>Enregistrer</PrimaryButton>
      </form>
    </StepLayout>
  )
}

// Étape 1 de l'onboarding (inscription) ou connexion. initialMode : 'login'
// (par défaut) ou 'signup'. onBack : retour à l'écran de bienvenue.
// recovering : code de récupération validé, il reste à choisir le nouveau mot
// de passe (onPasswordReset une fois enregistré).
export default function Auth({ initialMode = 'login', onBack, recovering = false, onPasswordReset }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login')
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Code à 6 chiffres envoyé par email : { purpose: 'signup' | 'recovery', sentAt }
  const [codeStep, setCodeStep] = useState(null)
  const [forgotMode, setForgotMode] = useState(false)

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
        // prend le relais ; sinon on demande le code reçu par email.
        if (!data.session) setCodeStep({ purpose: 'signup', sentAt: Date.now() })
      }
    } catch (e) {
      // Compte créé mais jamais confirmé (app fermée avant le code) : on
      // renvoie un code et on affiche l'écran de saisie plutôt qu'une erreur.
      if (isLogin && (e.code === 'email_not_confirmed' || (e.message ?? '').toLowerCase().includes('email not confirmed'))) {
        track('login_unconfirmed_email')
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: { emailRedirectTo: AUTH_CALLBACK_URL },
        })
        // Limite d'envoi atteinte : un code vient sans doute d'être envoyé
        if (resendError && resendError.status !== 429) captureSupabaseError(resendError, { operation: 'resend_signup_code' })
        setCodeStep({ purpose: 'signup', sentAt: Date.now() })
        setLoading(false)
        return
      }
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
      setCodeStep({ purpose: 'recovery', sentAt: Date.now() })
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
    setError(null)
  }

  const onSubmit = e => {
    e.preventDefault()
    if (forgotMode) handleResetRequest()
    else handle()
  }

  if (recovering) return <NewPasswordStep onDone={onPasswordReset} />

  if (codeStep) return (
    <VerifyCodeStep
      key={`${codeStep.purpose}-${codeStep.sentAt}`}
      email={email.trim()}
      purpose={codeStep.purpose}
      sentAt={codeStep.sentAt}
      onChangeEmail={() => {
        setCodeStep(null)
        setPassword('')
        setConfirm('')
        setTouched({})
        setSubmitted(false)
        setError(null)
      }}
    />
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
  const submitLabel = forgotMode ? 'Recevoir un code' : isLogin ? 'Se connecter' : 'Créer mon compte'

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
              <div style={{ fontSize: 13, color: '#8E8E93' }}>Entre ton email, on t'envoie un code pour en choisir un nouveau.</div>
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
