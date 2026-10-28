import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import packageJson from '../../../package.json'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

export default function SupportMessageModal({ category, onClose, onSuccess }) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const isBug = category === 'bug'

  async function submit(event) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) {
      setError('Écris ton message avant de l’envoyer.')
      return
    }
    setSending(true)
    setError('')
    try {
      const { error: invokeError } = await supabase.functions.invoke('app-email', {
        body: {
          action: 'support_message',
          category,
          message: trimmed,
          ...(isBug ? {
            app_version: packageJson.version,
            platform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web',
            screen: window.location.pathname,
          } : {}),
        },
      })
      if (invokeError) {
        let errorMessage = 'L’envoi a échoué. Vérifie ta connexion et réessaie.'
        try {
          const payload = await invokeError.context?.json()
          if (payload?.error) errorMessage = payload.error
        } catch { /* Keep the fallback if the response has no JSON body. */ }
        setError(errorMessage)
        return
      }
      onSuccess()
    } catch {
      setError('Impossible de joindre le service. Vérifie ta connexion et réessaie.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT }}>
      <form onSubmit={submit} onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: '22px 22px 0 0', padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, margin: 0, color: '#1C1C1E' }}>{isBug ? 'Signaler un bug' : 'Nous contacter'}</h2>
          <button type="button" aria-label="Fermer" onClick={onClose} style={{ border: 0, background: '#F2F2F7', width: 34, height: 34, borderRadius: 17, color: '#636366', display: 'grid', placeItems: 'center' }}><X size={18} /></button>
        </div>
        {isBug && <p style={{ margin: '0 0 14px', color: '#636366', fontSize: 13, lineHeight: 1.45 }}>Les informations techniques utiles (version, plateforme et écran) seront jointes automatiquement.</p>}
        <label htmlFor="support-message" style={{ display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 7, color: '#1C1C1E' }}>Ton message</label>
        <textarea id="support-message" autoFocus required maxLength={5000} value={message} onChange={event => setMessage(event.target.value)} placeholder={isBug ? 'Décris ce qui s’est passé…' : 'Comment peut-on t’aider ?'} rows={5} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid #D1D1D6', borderRadius: 12, padding: 12, font: `15px ${FONT}`, outlineColor: '#e055aa' }} />
        {error && <p role="alert" style={{ color: '#C62828', fontSize: 13, lineHeight: 1.4, margin: '9px 0 0' }}>{error}</p>}
        <button type="submit" disabled={sending} style={{ width: '100%', marginTop: 16, height: 48, border: 0, borderRadius: 13, background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 15, fontWeight: 800, opacity: sending ? 0.65 : 1 }}>
          {sending ? 'Envoi…' : 'Envoyer'}
        </button>
      </form>
    </div>
  )
}
