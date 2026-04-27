import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const typeEmoji = {
  'Anniversaire': '🎂',
  'Soirée': '🥂',
  'Repas': '🍽️',
  'Autre': '🎉',
}

const responseOptions = [
  { value: 'yes',   label: 'Oui 🎉',       active: 'linear-gradient(135deg,#34C759,#30D158)' },
  { value: 'maybe', label: 'Peut-être 🤔',  active: 'linear-gradient(135deg,#FF9500,#FFCC00)' },
  { value: 'no',    label: 'Non ❌',         active: 'linear-gradient(135deg,#FF3B30,#FF6B6B)' },
]

function formatDate(dateStr) {
  if (!dateStr) return 'Date non précisée'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function GuestRsvpPage({ token }) {
  const [event, setEvent] = useState(null)
  const [organizerName, setOrganizerName] = useState(null)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({ name: '', email: '', response: 'yes' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    supabase.functions.invoke('submit-guest-rsvp', {
      body: { action: 'get_event', token },
    }).then(({ data, error: err }) => {
      if (err || data?.error) {
        setError('Événement introuvable.')
      } else {
        setEvent(data.event)
        setOrganizerName(data.organizer_name)
        setConfirmedCount(data.confirmed_count ?? 0)
      }
      setLoading(false)
    })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    const { data, error: err } = await supabase.functions.invoke('submit-guest-rsvp', {
      body: {
        action: 'submit',
        invite_token: token,
        guest_name: form.name.trim(),
        guest_email: form.email.trim().toLowerCase(),
        response: form.response,
      },
    })
    if (err || data?.error) {
      setSubmitError('Une erreur est survenue. Réessayez.')
    } else {
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F7', minHeight: '100dvh' }}>
      <div style={{ fontSize: 48, fontWeight: 900, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Amiv
      </div>
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F2F2F7', gap: 12, minHeight: '100dvh' }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E' }}>{error}</div>
    </div>
  )

  const emoji = typeEmoji[event.type] ?? '🎉'

  const infoRows = [
    { icon: '📅', label: 'Date', value: formatDate(event.date) },
    { icon: '📍', label: 'Lieu', value: event.location || 'Lieu non précisé' },
    organizerName ? { icon: '👤', label: 'Organisateur', value: organizerName } : null,
    { icon: '✅', label: 'Confirmés', value: `${confirmedCount} participant${confirmedCount !== 1 ? 's' : ''}` },
  ].filter(Boolean)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', minHeight: '100dvh' }}>
      {/* Hero header */}
      <div style={{ background: 'linear-gradient(135deg,#e055aa,#f5a623)', padding: '60px 20px 32px', textAlign: 'center', color: '#fff', flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 20, opacity: 0.95 }}>Amiv</div>
        <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4, marginBottom: 6 }}>{event.name}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Tu es invité(e) !</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, maxWidth: 430, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Event info card */}
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          {infoRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < infoRows.length - 1 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
              <div style={{ fontSize: 17, width: 28, textAlign: 'center', flexShrink: 0 }}>{row.icon}</div>
              <div>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{row.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {event.description && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 13, color: '#1C1C1E', lineHeight: 1.5 }}>{event.description}</div>
          </div>
        )}

        {/* RSVP form or confirmation */}
        {submitted ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>
              {form.response === 'yes' ? '🎉' : form.response === 'maybe' ? '🤔' : '😢'}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E', marginBottom: 6 }}>
              {form.response === 'yes' ? 'À bientôt !' : form.response === 'maybe' ? 'Réponse enregistrée !' : 'Dommage !'}
            </div>
            <div style={{ fontSize: 13, color: '#8E8E93' }}>
              {form.response === 'yes'
                ? 'Ton RSVP a bien été enregistré.'
                : form.response === 'maybe'
                ? 'L\'organisateur a été notifié de ta réponse.'
                : 'Ton absence a été notée.'}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 14 }}>
              Répondre à l'invitation
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Ton prénom</div>
                <input
                  type="text"
                  placeholder="Ex: Sophie"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Ton email</div>
                <input
                  type="email"
                  placeholder="ton@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 8 }}>Ta réponse</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {responseOptions.map(opt => (
                    <div
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, response: opt.value }))}
                      style={{
                        flex: 1, padding: '10px 6px', borderRadius: 12, textAlign: 'center',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: form.response === opt.value ? opt.active : '#F2F2F7',
                        color: form.response === opt.value ? '#fff' : '#8E8E93',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>

              {submitError && (
                <div style={{ fontSize: 12, color: '#FF3B30' }}>{submitError}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '14px', borderRadius: 14, border: 'none',
                  background: submitting ? '#AEAEB2' : 'linear-gradient(135deg,#e055aa,#f5a623)',
                  color: '#fff', fontSize: 15, fontWeight: 800,
                  cursor: submitting ? 'default' : 'pointer',
                  marginTop: 4,
                }}
              >
                {submitting ? '…' : 'Envoyer ma réponse'}
              </button>
            </form>
          </div>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}
