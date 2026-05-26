import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function BirthdayEditModal({ birthday, onClose, onSaved, onToast }) {
  const amiv = birthday
  const nameParts = (amiv.name ?? '').trim().split(/\s+/).filter(Boolean)
  const initialFirstName = amiv.last_name ? amiv.name ?? '' : nameParts[0] ?? ''
  const initialLastName = amiv.last_name ?? nameParts.slice(1).join(' ')
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName]   = useState(initialLastName)
  const [date, setDate]           = useState(amiv.birthdate)
  const [saving, setSaving]       = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    const trimFirst = firstName.trim()
    if (!trimFirst || !date) return
    const trimLast  = lastName.trim()
    const birthdate = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10)
    const payload = { name: trimFirst, last_name: trimLast || null, birthdate }
    setSaving(true)
    const { error } = await supabase
      .from('birthdays')
      .update(payload)
      .eq('id', amiv.id)
    if (error) {
      onToast?.('Erreur lors de la mise à jour 😕', true)
    } else {
      onToast?.('Anniversaire modifié ✅')
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
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
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

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Prénom *"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            autoFocus
            style={{
              border: '1px solid #E5E5EA', borderRadius: 12, padding: '13px 14px',
              fontSize: 15, outline: 'none', color: '#1C1C1E', background: '#fff',
            }}
          />
          <input
            type="text"
            placeholder="Nom de famille"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            style={{
              border: '1px solid #E5E5EA', borderRadius: 12, padding: '13px 14px',
              fontSize: 15, outline: 'none', color: '#1C1C1E', background: '#fff',
            }}
          />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            style={{
              border: '1px solid #E5E5EA', borderRadius: 12, padding: '13px 14px',
              fontSize: 15, outline: 'none', color: '#1C1C1E', background: '#fff',
            }}
          />

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '14px', borderRadius: 14, border: 'none', marginTop: 6,
              background: 'linear-gradient(90deg, #e055aa, #f5a623)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              width: '100%',
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}
