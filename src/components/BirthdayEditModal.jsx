import { useState } from 'react'
import { supabase } from '../lib/supabase'

const EMOJIS = ['🎉', '🎈', '🥳', '🌟', '💫', '🎊', '🦋', '🌸', '💝', '🎁', '🎀']

const REMINDER_OPTIONS = [
  { label: 'J-30', value: 30 },
  { label: 'J-14', value: 14 },
  { label: 'J-7',  value: 7  },
  { label: 'J-3',  value: 3  },
  { label: 'J-1',  value: 1  },
]

export default function BirthdayEditModal({ birthday, onClose, onSaved, onToast }) {
  const [emoji, setEmoji] = useState('🎉')
  const [name, setName] = useState(birthday.name)
  const [date, setDate] = useState(birthday.birthdate)
  const [reminderDays, setReminderDays] = useState(birthday.reminder_days ?? [7])
  const [saving, setSaving] = useState(false)

  function toggleReminder(value) {
    setReminderDays(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || !date) return
    setSaving(true)
    const { error } = await supabase
      .from('birthdays')
      .update({ name: name.trim(), birthdate: date, reminder_days: reminderDays })
      .eq('id', birthday.id)
    if (error) {
      console.error('Birthday update failed:', error)
      onToast('Erreur lors de la mise à jour 😕', true)
    } else {
      onToast('Anniversaire modifié ✅')
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.40)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#F2F2F7',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          padding: '24px 20px',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Modifier l'anniversaire</span>
          <button
            onClick={onClose}
            style={{
              background: '#E5E5EA', border: 'none', borderRadius: '50%',
              width: 28, height: 28, cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1C1C1E',
            }}
          >
            ✕
          </button>
        </div>

        {/* Selected emoji preview */}
        <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 12, lineHeight: 1 }}>
          {emoji}
        </div>

        {/* Emoji picker */}
        <div style={{
          overflowX: 'auto', display: 'flex', gap: 8,
          padding: '2px 0 16px', WebkitOverflowScrolling: 'touch',
        }}>
          {EMOJIS.map(em => (
            <button
              key={em}
              type="button"
              onClick={() => setEmoji(em)}
              style={{
                flexShrink: 0, width: 46, height: 46, borderRadius: 12, border: 'none',
                fontSize: 22, cursor: 'pointer',
                background: emoji === em ? 'rgba(224,85,170,0.12)' : '#fff',
                boxShadow: emoji === em
                  ? '0 0 0 2px #e055aa'
                  : '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {em}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Nom"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              border: '1px solid #E5E5EA', borderRadius: 12, padding: '12px 14px',
              fontSize: 15, outline: 'none', color: '#1C1C1E', background: '#fff',
            }}
          />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            style={{
              border: '1px solid #E5E5EA', borderRadius: 12, padding: '12px 14px',
              fontSize: 15, outline: 'none', color: '#1C1C1E', background: '#fff',
            }}
          />

          {/* Reminder timing */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8E8E93', marginBottom: 10 }}>
              Rappels
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {REMINDER_OPTIONS.map(({ label, value }) => {
                const active = reminderDays.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleReminder(value)}
                    style={{
                      padding: '7px 14px', borderRadius: 20, border: 'none',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: active ? 'linear-gradient(135deg,#e055aa,#f5a623)' : 'var(--gray3, #E5E5EA)',
                      color: active ? '#fff' : '#1C1C1E',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '14px', borderRadius: 14, border: 'none', marginTop: 4,
              background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}
