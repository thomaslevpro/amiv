import { useState } from 'react'
import { Check, HelpCircle, X } from 'lucide-react'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'

const OPTIONS = [
  { status: 'going', label: "J'y serai", summary: 'Tu y seras', Icon: Check, color: '#34C759' },
  { status: 'maybe', label: 'Peut-être', summary: 'Peut-être', Icon: HelpCircle, color: '#FF9500' },
  { status: 'declined', label: 'Non', summary: 'Tu ne viens pas', Icon: X, color: '#FF3B30' },
]

// « Peut-être » : invitation maybe (RSVP pending). Un RSVP pending seul =
// pas encore répondu.
function answeredOption(rsvpStatus) {
  return OPTIONS.find(option => option.status === rsvpStatus) ?? null
}

// Réponse à l'invitation : résumé + « Modifier », ou les trois boutons si
// je n'ai pas encore répondu.
export default function EventRsvpButtons({ rsvpStatus, loading, onRsvp, canChange = true }) {
  const [editing, setEditing] = useState(false)
  const current = answeredOption(rsvpStatus)

  if (!current && !canChange) return null

  async function choose(status) {
    if (loading) return
    await onRsvp(status)
    setEditing(false)
  }

  if (current && !editing) {
    const { Icon } = current
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 8px 0 14px', borderRadius: 14, border: '1px solid #E5E5EA' }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: current.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon size={16} strokeWidth={2.6} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#8E8E93' }}>Ta réponse</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>{current.summary}</div>
        </div>
        {canChange && (
          <button type="button" onClick={() => setEditing(true)} disabled={loading} style={{ height: 36, padding: '0 14px', borderRadius: 18, border: 'none', background: '#F2F2F7', color: '#1C1C1E', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Modifier
          </button>
        )}
      </div>
    )
  }

  return (
    <div role="group" aria-label="Ta réponse" style={{ display: 'flex', gap: 8 }}>
      {OPTIONS.map(({ status, label }) => {
        const active = current?.status === status
        return (
          <button key={status} type="button" disabled={loading} onClick={() => choose(status)} style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 14, border: 'none', background: active ? GRADIENT : status === 'going' && !current ? '#1C1C1E' : '#F2F2F7', color: active || (status === 'going' && !current) ? '#fff' : '#1C1C1E', fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
