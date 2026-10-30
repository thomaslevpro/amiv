import { useEffect, useRef, useState } from 'react'
import { Check, Mail } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { track } from '../../lib/analytics'
import { captureSupabaseError } from '../../lib/monitoring'
import { CODE_LENGTH, RESEND_DELAY_MS, codeErrorMessage, onlyDigits } from '../../lib/authCode'

const linkButtonStyle = { border: 'none', background: 'none', padding: 4, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }

// Erreurs de supabase.auth.updateUser({ email }) (demande ou renvoi du code)
export function emailChangeErrorMessage(e) {
  const code = e?.code ?? ''
  if (code === 'email_exists' || code === 'user_already_exists') return 'Cette adresse est déjà utilisée par un autre compte.'
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Adresse email invalide.'
  if (e?.status === 429 || code.startsWith('over_')) return 'Attends une minute avant de redemander un code.'
  return "Impossible d'envoyer le code. Réessaie dans un instant."
}

function CodeField({ id, label, hint, value, onChange, verified, error, disabled, autoFocus, inputRef }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 2 }}>{label}</label>
      <div style={{ fontSize: 13, color: '#1C1C1E', fontWeight: 600, marginBottom: 8, overflowWrap: 'anywhere' }}>{hint}</div>
      {verified ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: 14, background: 'rgba(52,199,89,0.10)', color: '#248A3D', fontSize: 14, fontWeight: 600 }}>
          <Check size={18} strokeWidth={2.4} /> Code validé
        </div>
      ) : (
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          maxLength={CODE_LENGTH}
          placeholder="••••••"
          value={value}
          onChange={e => onChange(onlyDigits(e.target.value))}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={error ? 'ob-shake' : undefined}
          style={{
            width: '100%', boxSizing: 'border-box', borderRadius: 14,
            border: error ? '1.5px solid #FF3B30' : '1px solid #E5E5EA', background: '#fff', outline: 'none',
            padding: '12px 14px', textAlign: 'center', fontFamily: 'inherit',
            fontSize: 24, fontWeight: 700, letterSpacing: '0.4em', fontVariantNumeric: 'tabular-nums', color: '#1C1C1E',
          }}
        />
      )}
      {error && <div id={`${id}-error`} role="alert" style={{ color: '#FF3B30', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

// Après supabase.auth.updateUser({ email }) : saisie du ou des codes reçus.
// secure : un code à l'adresse actuelle ET un à la nouvelle (les deux sont
// exigés par Supabase, dans n'importe quel ordre) ; sinon un seul code.
export default function EmailChangeCodeStep({ currentEmail, newEmail, secure, sentAt: initialSentAt, onDone, onCancel }) {
  const fields = secure ? ['current', 'new'] : ['new']
  const addressOf = field => (field === 'current' ? currentEmail : newEmail)
  const [codes, setCodes] = useState({ current: '', new: '' })
  const [verified, setVerified] = useState({ current: false, new: false })
  const [errors, setErrors] = useState({})
  const [sentAt, setSentAt] = useState(initialSentAt)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [done, setDone] = useState(false)
  const inputRefs = { current: useRef(null), new: useRef(null) }

  const cooldown = Math.max(0, Math.ceil((sentAt + RESEND_DELAY_MS - now) / 1000))
  useEffect(() => {
    if (cooldown === 0) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown === 0])

  const pending = fields.filter(field => !verified[field])

  const verify = async nextCodes => {
    if (loading) return
    const missing = pending.find(field => nextCodes[field].length !== CODE_LENGTH)
    if (missing) {
      setErrors({ [missing]: `Saisis les ${CODE_LENGTH} chiffres reçus.` })
      inputRefs[missing].current?.focus()
      return
    }
    setLoading(true)
    setErrors({})
    const nextVerified = { ...verified }
    for (const field of pending) {
      const { error } = await supabase.auth.verifyOtp({ email: addressOf(field), token: nextCodes[field], type: 'email_change' })
      if (error) {
        track('email_change_code_failed', { field, error_code: error.code, error_status: error.status })
        setVerified(nextVerified)
        setErrors({ [field]: codeErrorMessage(error, sentAt) })
        setCodes(c => ({ ...c, [field]: '' }))
        setLoading(false)
        window.setTimeout(() => inputRefs[field].current?.focus(), 0)
        return
      }
      nextVerified[field] = true
    }
    setVerified(nextVerified)
    setLoading(false)
    track('email_change_completed', { secure })
    setDone(true)
  }

  const onCodeChange = field => value => {
    const nextCodes = { ...codes, [field]: value }
    setCodes(nextCodes)
    if (errors[field]) setErrors({})
    setResendDone(false)
    // Tous les codes attendus sont saisis : validation directe
    if (value.length === CODE_LENGTH && pending.every(f => nextCodes[f].length === CODE_LENGTH)) verify(nextCodes)
    // Sinon, passe au champ suivant encore vide
    else if (value.length === CODE_LENGTH) {
      const next = pending.find(f => f !== field && nextCodes[f].length !== CODE_LENGTH)
      if (next) inputRefs[next].current?.focus()
    }
  }

  // Un nouvel envoi remplace les deux codes : tout est à ressaisir
  const resend = async () => {
    if (cooldown > 0 || resendLoading) return
    setResendLoading(true)
    setResendDone(false)
    setErrors({})
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setResendLoading(false)
    if (error) {
      if (error.status !== 429) captureSupabaseError(error, { operation: 'resend_email_change_code' })
      setErrors({ [pending[0] ?? 'new']: emailChangeErrorMessage(error) })
      return
    }
    track('email_change_code_resent')
    setSentAt(Date.now())
    setNow(Date.now())
    setCodes({ current: '', new: '' })
    setVerified({ current: false, new: false })
    setResendDone(true)
    inputRefs[fields[0]].current?.focus()
  }

  if (done) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 4px 4px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Check size={30} strokeWidth={2.4} color="#34C759" />
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>Adresse modifiée</div>
      <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 20, overflowWrap: 'anywhere' }}>
        Tu te connectes maintenant avec <strong style={{ color: '#1C1C1E' }}>{newEmail}</strong>.
      </div>
      <button type="button" className="ob-press" onClick={onDone} style={{ width: '100%', padding: 15, border: 'none', borderRadius: 16, background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
        Terminé
      </button>
    </div>
  )

  return (
    <form onSubmit={e => { e.preventDefault(); verify(codes) }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 4 }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Mail size={26} strokeWidth={1.8} color="#e055aa" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>
          {secure ? 'Saisis les deux codes reçus' : 'Saisis le code reçu'}
        </div>
        <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.45 }}>
          {secure
            ? 'Pour ta sécurité, on a envoyé un code à ton adresse actuelle et un autre à la nouvelle. Pense à vérifier tes spams.'
            : 'On a envoyé un code à ta nouvelle adresse. Pense à vérifier tes spams.'}
        </div>
      </div>

      {fields.map((field, index) => (
        <CodeField
          key={field}
          id={`email-change-code-${field}`}
          label={field === 'current' ? 'Code reçu sur ton adresse actuelle' : 'Code reçu sur ta nouvelle adresse'}
          hint={addressOf(field)}
          value={codes[field]}
          onChange={onCodeChange(field)}
          verified={verified[field]}
          error={errors[field]}
          disabled={loading}
          autoFocus={index === 0}
          inputRef={inputRefs[field]}
        />
      ))}

      {resendDone && (
        <div role="status" style={{ background: 'rgba(52,199,89,0.10)', color: '#248A3D', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
          {secure ? 'Nouveaux codes envoyés aux deux adresses.' : 'Nouveau code envoyé.'}
        </div>
      )}

      <button type="submit" className="ob-press" disabled={loading} aria-busy={loading} style={{
        width: '100%', padding: 15, border: 'none', borderRadius: 16, fontFamily: 'inherit',
        background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 16, fontWeight: 700,
        opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? 'Vérification…' : 'Valider'}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ ...linkButtonStyle, color: '#8E8E93' }}>
          Annuler
        </button>
        <button type="button" onClick={resend} disabled={cooldown > 0 || resendLoading} style={{ ...linkButtonStyle, fontWeight: 600, color: cooldown > 0 ? '#AEAEB2' : '#e055aa', cursor: cooldown > 0 ? 'not-allowed' : 'pointer' }}>
          {resendLoading ? 'Envoi…' : cooldown > 0 ? `Renvoyer ${secure ? 'les codes' : 'le code'} (${cooldown} s)` : `Renvoyer ${secure ? 'les codes' : 'le code'}`}
        </button>
      </div>
    </form>
  )
}
