import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock, Mail } from 'lucide-react'
import { supabase, INITIAL_AUTH_URL } from '../lib/supabase'
import { captureSupabaseError } from '../lib/monitoring'

// Arrivée depuis un lien d'email (anciens emails, ou lien de secours des
// versions de l'app sans écran de code). Ne reste jamais bloquée sur le
// chargement : lien expiré, première moitié d'un changement d'email
// sécurisé (message sans session) ou confirmation sans session ouverte.
const SCREENS = {
  invalid: { icon: Clock, title: 'Lien expiré', text: "Ce lien a expiré ou a déjà été utilisé. Refais la demande depuis l'app." },
  partial: { icon: Mail, title: 'Plus qu’une étape', text: "Première confirmation acceptée. Ouvre maintenant le lien reçu sur ton autre adresse email." },
  confirmed: { icon: Check, title: "C'est confirmé !", text: "Tu peux revenir dans l'app ou te connecter sur le site." },
  done: { icon: Check, title: "C'est confirmé !", text: 'Redirection…' },
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState(() => (INITIAL_AUTH_URL.errorCode ? 'invalid' : 'checking'))

  useEffect(() => {
    if (status !== 'checking') return undefined
    let cancelled = false
    async function finishAuth() {
      const hash = new URLSearchParams(window.location.hash.substring(1))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (error) {
          captureSupabaseError(error, { operation: 'auth_callback_set_session' })
          if (!cancelled) setStatus('invalid')
          return
        }
      }

      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      window.history.replaceState({}, document.title, '/auth/callback')
      if (data.session && !INITIAL_AUTH_URL.message) setStatus('done')
      else setStatus(INITIAL_AUTH_URL.message ? 'partial' : 'confirmed')
    }
    finishAuth()
    return () => { cancelled = true }
  }, [status])

  useEffect(() => {
    if (status !== 'done') return undefined
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 2000)
    return () => window.clearTimeout(timer)
  }, [status, navigate])

  const screen = SCREENS[status]
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '32px 24px', textAlign: 'center', paddingTop: 'max(32px, env(safe-area-inset-top, 0px))' }}>
      {!screen ? (
        <div style={{ fontSize: 14, color: '#8E8E93' }}>Vérification du lien…</div>
      ) : (
        <>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <screen.icon size={34} strokeWidth={1.8} color="#e055aa" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>{screen.title}</div>
          <div style={{ fontSize: 14, color: '#8E8E93', maxWidth: 340, marginBottom: 24 }}>{screen.text}</div>
          {status !== 'done' && (
            <div onClick={() => navigate('/', { replace: true })} style={{ fontSize: 14, color: '#e055aa', fontWeight: 600, cursor: 'pointer' }}>
              Aller sur Amiv
            </div>
          )}
        </>
      )}
    </div>
  )
}
