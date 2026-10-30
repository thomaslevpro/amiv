import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { birthdayRequestUrl, createBirthdayRequest, shareBirthdayRequest } from '../lib/birthdayRequests'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'

export default function AskBirthdaySheet({ onClose }) {
  const [visible, setVisible] = useState(false)
  const [friendName, setFriendName] = useState('')
  // Lien déjà créé : un nouvel appui le repartage au lieu d'en créer un autre.
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [manualUrl, setManualUrl] = useState(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  async function handleShare(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)

    let current = request
    if (!current) {
      const { data, error: createError } = await createBirthdayRequest(friendName)
      if (createError) {
        setError(createError)
        setBusy(false)
        return
      }
      current = data
      setRequest(data)
    }

    const result = await shareBirthdayRequest({ code: current.code, friendName: current.friend_name })
    setBusy(false)
    if (result === 'shared') close()
    else if (result === 'copied') setCopied(true)
    else if (result === 'failed') setManualUrl(birthdayRequestUrl(current.code))
  }

  return (
    <>
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 301,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        padding: '0 20px calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', textAlign: 'center', margin: '16px 0 6px' }}>
          Demander son anniversaire
        </div>
        <div style={{ fontSize: 13, color: '#8E8E93', textAlign: 'center', lineHeight: 1.45, marginBottom: 20 }}>
          Ton ami reçoit un lien pour te donner sa date, sans créer de compte. Le rappel s'ajoute tout seul.
        </div>

        <form onSubmit={handleShare}>
          <input
            type="text"
            placeholder="Prénom de ton ami (facultatif)"
            value={friendName}
            onChange={e => setFriendName(e.target.value)}
            maxLength={60}
            disabled={!!request}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #F5F5F5', borderRadius: 12,
              padding: '13px 14px', fontSize: 15, outline: 'none',
              color: '#1C1C1E', background: '#FAFAFA',
              fontFamily: 'inherit', WebkitAppearance: 'none',
              marginBottom: 14,
            }}
          />

          {error && (
            <div style={{ color: '#FF3B30', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>{error}</div>
          )}
          {copied && (
            <div style={{ color: '#248A3D', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>
              Message copié. Colle-le dans une conversation.
            </div>
          )}
          {manualUrl && (
            <div style={{ fontSize: 13, color: '#1C1C1E', textAlign: 'center', marginBottom: 12, userSelect: 'text', WebkitUserSelect: 'text', overflowWrap: 'anywhere' }}>
              Copie ce lien : {manualUrl}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
              cursor: busy ? 'default' : 'pointer',
              background: GRADIENT, color: '#fff', fontSize: 16, fontWeight: 700,
              opacity: busy ? 0.7 : 1,
              boxShadow: '0 4px 18px rgba(224,85,170,0.32)',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Send size={17} strokeWidth={2.2} />
            {busy ? 'Préparation…' : request ? 'Partager à nouveau' : 'Envoyer le lien'}
          </button>
          <button
            type="button"
            onClick={close}
            style={{
              width: '100%', padding: '12px 0', marginTop: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8E8E93', fontSize: 15, fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            {copied || manualUrl ? 'Terminé' : 'Annuler'}
          </button>
        </form>
      </div>
    </>
  )
}
