import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth({ initialIsLogin = false }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(initialIsLogin)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  const handle = async () => {
    setLoading(true)
    setError(null)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // App.jsx détecte SIGNED_IN via son onAuthStateChange — rien à faire ici
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setSuccess(true)
      }
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendDone(false)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
      <div style={{ fontSize: 13, color: '#AEAEB2', marginBottom: 32 }}>Pense à vérifier tes spams.</div>
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
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>

        {/* Logo */}
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -2, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8, lineHeight: 1 }}>
          Amiv
        </div>
        <div style={{ fontSize: 15, color: '#8E8E93', marginBottom: 40 }}>Friends come first</div>

        {/* Form */}
        <div style={{ width: '100%', maxWidth: 340 }}>
          {/* Toggle */}
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

          {/* Email */}
          <div style={{ background: '#F5F5F5', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Email</div>
            <input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#1C1C1E', fontFamily: 'inherit' }}
            />
          </div>

          {/* Password */}
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

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#FF3B30' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <div onClick={handle} style={{
            width: '100%', padding: 16, marginTop: 6,
            background: loading ? '#F5F5F5' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: loading ? '#8E8E93' : '#fff',
            borderRadius: 16, fontSize: 16, fontWeight: 700,
            textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}>
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : "S'inscrire"}
          </div>
        </div>
      </div>
    </div>
  )
}
