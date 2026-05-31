import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const gradient = 'linear-gradient(135deg, #e055aa, #f5a623)'
const fontFamily = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let mounted = true
    let redirectTimer

    const finishAuth = async () => {
      try {
        const queryParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const code = queryParams.get('code') ?? hashParams.get('code')
        const urlError = queryParams.get('error_description')
          ?? hashParams.get('error_description')
          ?? queryParams.get('error')
          ?? hashParams.get('error')

        if (urlError) throw new Error(urlError)

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          if (!data.session && !hashParams.get('access_token')) {
            throw new Error('Missing auth token')
          }
        }

        if (!mounted) return
        setStatus('success')
        redirectTimer = window.setTimeout(() => navigate('/', { replace: true }), 3000)
      } catch {
        if (mounted) setStatus('error')
      }
    }

    finishAuth()

    return () => {
      mounted = false
      if (redirectTimer) window.clearTimeout(redirectTimer)
    }
  }, [navigate])

  if (status === 'loading') {
    return (
      <AuthCallbackLayout>
        <style>{spinnerStyles}</style>
        <div style={logoStyle}>Amiv</div>
        <div style={spinnerStyle} />
        <p style={subtitleStyle}>Vérification en cours…</p>
      </AuthCallbackLayout>
    )
  }

  if (status === 'success') {
    return (
      <AuthCallbackLayout>
        <div style={emojiStyle}>🎉</div>
        <h1 style={titleStyle}>Email confirmé !</h1>
        <p style={subtitleStyle}>Bienvenue sur Amiv, ton compte est activé.</p>
        <button type="button" onClick={() => navigate('/', { replace: true })} style={primaryButtonStyle}>
          Ouvrir Amiv →
        </button>
      </AuthCallbackLayout>
    )
  }

  return (
    <AuthCallbackLayout>
      <div style={emojiStyle}>❌</div>
      <h1 style={titleStyle}>Lien invalide ou expiré</h1>
      <p style={subtitleStyle}>Ce lien de confirmation a déjà été utilisé ou a expiré.</p>
      <button type="button" onClick={() => navigate('/', { replace: true })} style={primaryButtonStyle}>
        Retourner à l'accueil
      </button>
    </AuthCallbackLayout>
  )
}

function AuthCallbackLayout({ children }) {
  return (
    <div style={pageStyle}>
      <div style={contentStyle}>{children}</div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  padding: 32,
  fontFamily,
  textAlign: 'center',
}

const contentStyle = {
  width: '100%',
  maxWidth: 340,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

const logoStyle = {
  fontSize: 52,
  fontWeight: 900,
  lineHeight: 1,
  marginBottom: 24,
  background: gradient,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const spinnerStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '3px solid #F2F2F7',
  borderTopColor: '#e055aa',
  animation: 'amiv-spin 0.8s linear infinite',
  marginBottom: 16,
}

const emojiStyle = {
  fontSize: 64,
  lineHeight: 1,
  marginBottom: 20,
}

const titleStyle = {
  margin: '0 0 10px',
  color: '#1C1C1E',
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1.2,
}

const subtitleStyle = {
  margin: '0 0 24px',
  color: '#8E8E93',
  fontSize: 15,
  lineHeight: 1.45,
}

const primaryButtonStyle = {
  width: '100%',
  border: 'none',
  borderRadius: 12,
  padding: '15px 18px',
  background: gradient,
  color: '#fff',
  fontFamily,
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
}

const spinnerStyles = `
  @keyframes amiv-spin {
    to { transform: rotate(360deg); }
  }
`
