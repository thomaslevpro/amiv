import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function finishAuth() {
      const hash = new URLSearchParams(window.location.hash.substring(1))

      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })

        if (error) {
          console.error('setSession error:', error)
          return
        }
      }

      const { data } = await supabase.auth.getSession()

      if (data.session) {
        window.history.replaceState({}, document.title, '/auth/callback')
        setTimeout(() => navigate('/'), 3000)
      } else {
        console.error('No session found after email confirmation')
      }
    }

    finishAuth()
  }, [navigate])

  return <div>Confirmation de ton email...</div>
}
