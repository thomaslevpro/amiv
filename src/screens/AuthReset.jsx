import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase, INITIAL_AUTH_URL } from '../lib/supabase'
import { track } from '../lib/analytics'
import { captureSupabaseError } from '../lib/monitoring'

const EXPIRED_MESSAGE = "Ce lien a expiré ou a déjà été utilisé. Refais une demande depuis l'écran de connexion (« Mot de passe oublié ? »)."
// Délai max pour que supabase-js récupère la session de récupération depuis l'URL
const RECOVERY_TIMEOUT_MS = 6000

function PasswordField({ label, value, onChange, onEnter, autoFocus }) {
  return (
    <div style={{ background: '#F5F5F5', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <input
        type="password"
        placeholder="••••••••"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        autoFocus={autoFocus}
        autoComplete="new-password"
        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit' }}
      />
    </div>
  )
}

export default function AuthReset() {
  const navigate = useNavigate()
  // checking → ready → done, ou invalid si le lien est expiré / absent
  const [status, setStatus] = useState(INITIAL_AUTH_URL.errorCode ? 'invalid' : 'checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (status !== 'checking') return undefined

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // PASSWORD_RECOVERY peut avoir été émis avant le montage : dans ce cas
      // on reçoit INITIAL_SESSION avec la session de récupération.
      if (event === 'PASSWORD_RECOVERY' || (session && INITIAL_AUTH_URL.type === 'recovery')) {
        setStatus(current => current === 'checking' ? 'ready' : current)
      }
    })
    const timer = window.setTimeout(() => {
      setStatus(current => current === 'checking' ? 'invalid' : current)
    }, RECOVERY_TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'done' || Capacitor.isNativePlatform()) return undefined
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 3000)
    return () => window.clearTimeout(timer)
  }, [status, navigate])

  const handleSubmit = async () => {
    if (loading) return
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe sont différents.')
      return
    }

    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      captureSupabaseError(updateError, { operation: 'reset_password_update' })
      if (updateError.code === 'same_password') {
        setError("Choisis un mot de passe différent de l'ancien.")
      } else if (updateError.code === 'weak_password') {
        setError('Ce mot de passe est trop faible. Choisis-en un plus long ou plus varié.')
      } else if (updateError.name === 'AuthSessionMissingError' || updateError.status === 401 || updateError.status === 403) {
        setError(EXPIRED_MESSAGE)
      } else {
        setError('Impossible de modifier le mot de passe. Réessaie dans un instant.')
      }
      return
    }

    track('password_reset_completed')
    setStatus('done')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>

        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 32, lineHeight: 1 }}>
          Amiv
        </div>

        <div style={{ width: '100%', maxWidth: 340 }}>
          {status === 'checking' && (
            <div style={{ fontSize: 14, color: '#8E8E93' }}>Vérification du lien…</div>
          )}

          {status === 'invalid' && (
            <>
              <div style={{ fontSize: 52, marginBottom: 16 }}>⏳</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Lien expiré</div>
              <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 32 }}>{EXPIRED_MESSAGE}</div>
              {!Capacitor.isNativePlatform() && (
                <div onClick={() => navigate('/login', { replace: true })} style={{ fontSize: 13, color: '#e055aa', fontWeight: 600, cursor: 'pointer' }}>
                  Aller à la connexion
                </div>
              )}
            </>
          )}

          {status === 'done' && (
            <>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>C'est fait !</div>
              <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: 32 }}>Mot de passe modifié. Tu peux te connecter dans l'app ou sur le site.</div>
              {!Capacitor.isNativePlatform() && (
                <div onClick={() => navigate('/', { replace: true })} style={{ fontSize: 13, color: '#e055aa', fontWeight: 600, cursor: 'pointer' }}>
                  Aller à l'accueil
                </div>
              )}
            </>
          )}

          {status === 'ready' && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>Nouveau mot de passe</div>
                <div style={{ fontSize: 13, color: '#8E8E93' }}>8 caractères minimum.</div>
              </div>

              <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} autoFocus />
              <PasswordField label="Confirmation" value={confirmPassword} onChange={setConfirmPassword} onEnter={handleSubmit} />

              {error && (
                <div style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#FF3B30' }}>
                  {error}
                </div>
              )}

              <div onClick={handleSubmit} style={{
                width: '100%', padding: 16, marginTop: 6, boxSizing: 'border-box',
                background: loading ? '#F5F5F5' : 'linear-gradient(135deg,#e055aa,#f5a623)',
                color: loading ? '#8E8E93' : '#fff',
                borderRadius: 16, fontSize: 16, fontWeight: 700,
                textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}>
                {loading ? 'Chargement...' : 'Modifier le mot de passe'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
