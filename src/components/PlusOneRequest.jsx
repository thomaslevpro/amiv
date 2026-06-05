import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { usePlusOne } from '../hooks/usePlusOne'

const CARD = {
  background: 'var(--white)',
  borderRadius: 12,
  padding: 14,
  marginBottom: 10,
  boxShadow: 'var(--shadow-sm)',
  fontFamily: 'var(--font)',
}

const inputStyle = {
  width: '100%',
  border: '1px solid #E5E5EA',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--black)',
  background: '#fff',
}

const compactPanelStyle = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 260,
  zIndex: 20,
  ...CARD,
  marginBottom: 0,
  boxShadow: '0 14px 34px rgba(0,0,0,0.18)',
}

function Badge({ tone, children }) {
  const colors = {
    amber: ['rgba(255,149,0,0.12)', 'var(--orange)'],
    green: ['rgba(52,199,89,0.12)', 'var(--green)'],
    red: ['rgba(255,59,48,0.12)', 'var(--red)'],
  }
  const [bg, color] = colors[tone]

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 20, padding: '7px 11px', background: bg, color, fontSize: 13, fontWeight: 800 }}>
      {children}
    </div>
  )
}

export default function PlusOneRequest({
  rsvpId,
  table,
  currentStatus,
  currentName,
  eventId,
  requesterName,
  variant = 'card',
}) {
  const { requestPlusOne, cancelPlusOne } = usePlusOne()
  const [status, setStatus] = useState(currentStatus || 'none')
  const [name, setName] = useState(currentName || '')
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setStatus(currentStatus || 'none')
    setName(currentName || '')
    setOpen(false)
    setError('')
  }, [currentStatus, currentName, rsvpId])

  async function handleSubmit(event) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return

    setSaving(true)
    setError('')
    try {
      await requestPlusOne({ rsvpId, table, name: cleanName, message })
      setStatus('pending')
      setOpen(false)
    } catch (err) {
      console.error('Erreur demande +1 :', err)
      setError("Impossible d'envoyer la demande")
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    setSaving(true)
    setError('')
    try {
      await cancelPlusOne({ rsvpId, table })
      setStatus('none')
      setName('')
      setMessage('')
    } catch (err) {
      console.error('Erreur annulation +1 :', err)
      setError("Impossible d'annuler la demande")
    } finally {
      setSaving(false)
    }
  }

  if (!rsvpId || !eventId) return null

  if (variant === 'compact') {
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {open && (
          <div style={compactPanelStyle}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Prénom du +1"
                required
                style={inputStyle}
              />
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value.slice(0, 200))}
                placeholder="Message pour l'organisateur"
                maxLength={200}
                rows={3}
                style={{ ...inputStyle, resize: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => { setOpen(false); setError('') }} style={{ color: 'var(--gray1)', fontSize: 13, fontWeight: 700, padding: '9px 0' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving || !name.trim()} style={{ borderRadius: 12, padding: '9px 12px', background: 'var(--gradient)', color: '#fff', fontSize: 13, fontWeight: 800, opacity: saving || !name.trim() ? 0.55 : 1 }}>
                  {saving ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: error ? 'var(--red)' : 'var(--gray1)', fontSize: 11, fontWeight: 600 }}>
                <span>{error || requesterName || ''}</span>
                <span>{message.length}/200</span>
              </div>
            </form>
          </div>
        )}

        {status === 'none' && (
          <button type="button" onClick={() => setOpen(true)} style={{ border: 'none', borderRadius: 20, padding: '6px 10px', background: '#F5F5F5', color: '#1C1C1E', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <UserPlus size={14} strokeWidth={2} color="#8E8E93" />
            Demander un +1
          </button>
        )}

        {status === 'pending' && (
          <button type="button" onClick={handleCancel} disabled={saving} style={{ border: 'none', borderRadius: 20, padding: '6px 10px', background: 'rgba(255,149,0,0.12)', color: 'var(--orange)', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', opacity: saving ? 0.55 : 1 }}>
            +1 en attente
          </button>
        )}

        {status === 'accepted' && (
          <div style={{ borderRadius: 20, padding: '6px 10px', background: 'rgba(52,199,89,0.12)', color: 'var(--green)', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
            +1 accepté
          </div>
        )}

        {status === 'declined' && (
          <button type="button" onClick={() => setOpen(true)} style={{ border: 'none', borderRadius: 20, padding: '6px 10px', background: 'rgba(255,59,48,0.10)', color: 'var(--red)', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
            Redemander +1
          </button>
        )}
      </div>
    )
  }

  if (open || status === 'none') {
    return (
      <div style={open || variant !== 'pill' ? CARD : { marginBottom: 10 }}>
        {open ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Prénom du +1"
              required
              style={inputStyle}
            />
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value.slice(0, 200))}
              placeholder="Message pour l'organisateur"
              maxLength={200}
              rows={3}
              style={{ ...inputStyle, resize: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setOpen(false); setError('') }}
                style={{ color: 'var(--gray1)', fontSize: 13, fontWeight: 700, padding: '10px 0' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                style={{
                  borderRadius: 12,
                  padding: '10px 14px',
                  background: 'var(--gradient)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  opacity: saving || !name.trim() ? 0.55 : 1,
                }}
              >
                {saving ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: error ? 'var(--red)' : 'var(--gray1)', fontSize: 11, fontWeight: 600 }}>
              <span>{error || requesterName || ''}</span>
              <span>{message.length}/200</span>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={variant === 'pill'
              ? {
                  width: '100%',
                  minHeight: 56,
                  borderRadius: 16,
                  border: 'none',
                  padding: '13px 14px',
                  background: '#fff',
                  color: 'var(--black)',
                  fontSize: 14,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: 'none',
                }
              : { width: '100%', borderRadius: 12, padding: '12px 14px', background: '#F5F5F5', color: 'var(--black)', fontSize: 14, fontWeight: 800 }}
          >
            {variant === 'pill' && <UserPlus size={18} strokeWidth={1.8} color="#A8A8AF" />}
            Demander un +1
          </button>
        )}
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div style={{ ...CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Badge tone="amber">⏳ Demande en attente</Badge>
        <button type="button" onClick={handleCancel} disabled={saving} style={{ color: 'var(--gray1)', fontSize: 13, fontWeight: 700, opacity: saving ? 0.5 : 1 }}>
          Annuler la demande
        </button>
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div style={CARD}>
        <Badge tone="green">✅ +1 accepté</Badge>
      </div>
    )
  }

  return (
    <div style={{ ...CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <Badge tone="red">❌ +1 refusé</Badge>
      <button type="button" onClick={() => setOpen(true)} style={{ borderRadius: 12, padding: '9px 12px', background: '#F5F5F5', color: 'var(--black)', fontSize: 13, fontWeight: 800 }}>
        Redemander
      </button>
    </div>
  )
}
