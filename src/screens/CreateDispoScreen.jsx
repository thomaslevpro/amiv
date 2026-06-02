import { useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAvailability } from '../hooks/useAvailability'

const moodOptions = [
  { id: 'cafe', label: 'café', emoji: '☕' },
  { id: 'jeux', label: 'jeux', emoji: '🎲' },
  { id: 'diner', label: 'dîner', emoji: '🍽️' },
  { id: 'cine', label: 'ciné', emoji: '🎬' },
  { id: 'apero', label: 'apéro', emoji: '🍻' },
  { id: 'balade', label: 'balade', emoji: '🚶' },
]

function weekendDates() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = today.getDay()
  const fridayOffset = (5 - day + 7) % 7
  const labels = ['Vendredi', 'Samedi', 'Dimanche']

  return labels.map((label, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + fridayOffset + index)
    const dayMonth = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
    return {
      id: date.toISOString().slice(0, 10),
      label,
      text: `${label} ${dayMonth}`,
    }
  })
}

export default function CreateDispoScreen({ onBack, userId, onManageCloseFriends }) {
  const textareaRef = useRef(null)
  const { createPost } = useAvailability(userId)
  const [message, setMessage] = useState('')
  const [moods, setMoods] = useState([])
  const [availableDates, setAvailableDates] = useState([])
  const [visibility, setVisibility] = useState('friends')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const dates = useMemo(() => weekendDates(), [])
  const disabled = !message.trim() || moods.length === 0 || loading

  function toggleMood(id) {
    setMoods(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  function toggleDate(id) {
    setAvailableDates(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  async function handleSubmit() {
    if (disabled) return
    setLoading(true)
    setError(null)
    try {
      await createPost(userId, {
        message: message.trim(),
        moods,
        available_dates: availableDates,
        visibility,
      })
      onBack?.()
    } catch (err) {
      console.error('[CreateDispo] submit error:', err)
      setError(err.message || 'Impossible de publier ta dispo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, background: '#faf9fb', overflowY: 'auto', padding: '14px 16px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: 'none',
            background: '#fff',
            color: '#1C1C1E',
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <div style={{ color: '#1C1C1E', fontSize: 24, fontWeight: 900, letterSpacing: '-0.2px' }}>Je suis dispo</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: 14, marginBottom: 18 }}>
        <textarea
          ref={textareaRef}
          autoFocus
          value={message}
          maxLength={120}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Dis à tes amis ce que tu as envie de faire…"
          style={{
            width: '100%',
            minHeight: 96,
            resize: 'none',
            border: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.35,
            color: '#1C1C1E',
            background: 'transparent',
          }}
        />
        <div style={{ textAlign: 'right', color: '#8E8E93', fontSize: 12, fontWeight: 700 }}>{message.length} / 120</div>
      </div>

      <SectionTitle label="Type de plan" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9, marginBottom: 20 }}>
        {moodOptions.map(option => {
          const selected = moods.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleMood(option.id)}
              style={{
                border: selected ? '1.5px solid #e055aa' : '1px solid rgba(0,0,0,0.06)',
                background: selected ? 'rgba(224,85,170,0.12)' : '#fff',
                color: selected ? '#e055aa' : '#1C1C1E',
                borderRadius: 16,
                padding: '13px 6px',
                fontSize: 13,
                fontWeight: 800,
                boxShadow: selected ? 'none' : '0 1px 8px rgba(0,0,0,0.05)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{option.emoji}</div>
              {option.label}
            </button>
          )
        })}
      </div>

      <SectionTitle label="Quand ?" />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, scrollbarWidth: 'none' }}>
        {dates.map(date => {
          const selected = availableDates.includes(date.id)
          return (
            <button
              key={date.id}
              type="button"
              onClick={() => toggleDate(date.id)}
              style={{
                flex: '1 0 0',
                minWidth: 112,
                border: selected ? '1.5px solid #e055aa' : '1px solid rgba(0,0,0,0.06)',
                background: selected ? 'rgba(224,85,170,0.12)' : '#fff',
                color: selected ? '#e055aa' : '#1C1C1E',
                borderRadius: 16,
                padding: '12px 10px',
                fontSize: 12,
                fontWeight: 800,
                boxShadow: selected ? 'none' : '0 1px 8px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {date.text}
            </button>
          )
        })}
      </div>

      <SectionTitle label="Visible par" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[
          { id: 'friends', label: 'Tous mes amis' },
          { id: 'close_friends', label: 'Amis proches' },
        ].map(option => {
          const selected = visibility === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setVisibility(option.id)}
              style={{
                border: selected ? 'none' : '1px solid rgba(0,0,0,0.06)',
                background: selected ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#fff',
                color: selected ? '#fff' : '#1C1C1E',
                borderRadius: 999,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 800,
                boxShadow: selected ? 'none' : '0 1px 8px rgba(0,0,0,0.05)',
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {visibility === 'close_friends' && (
        <div
          onClick={() => onManageCloseFriends?.()}
          style={{ fontSize: 13, fontWeight: 700, color: '#e055aa', cursor: 'pointer', margin: '10px 2px 0' }}
        >
          Gérer mes amis proches →
        </div>
      )}

      <div style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30', borderRadius: 16, padding: '12px 14px', fontSize: 13, fontWeight: 800, marginBottom: 18 }}>
        Expire automatiquement dimanche à 23h59
      </div>

      {error && <div style={{ color: '#FF3B30', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>}

      <button
        type="button"
        disabled={disabled}
        onClick={handleSubmit}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: 20,
          padding: '15px 18px',
          background: disabled ? '#D1D1D6' : 'linear-gradient(135deg,#e055aa,#f5a623)',
          color: '#fff',
          fontSize: 16,
          fontWeight: 900,
          boxShadow: disabled ? 'none' : '0 8px 22px rgba(224,85,170,0.25)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Publication…' : 'Publier ma dispo 🟢'}
      </button>
    </div>
  )
}

function SectionTitle({ label }) {
  return (
    <div style={{ color: '#8E8E93', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 2px 9px' }}>
      {label}
    </div>
  )
}
