import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import StatusBar from '../StatusBar'

export default function OnboardingBirthday({ userId, onNext }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const updateStep = () =>
    supabase.from('profiles').update({ onboarding_step: 3 }).eq('id', userId)

  const handleSave = async () => {
    if (!name.trim() || !date) { setError('Prénom et date requis'); return }
    setSaving(true)
    setError(null)
    try {
      const { error: insertErr } = await supabase.from('birthdays').insert({
        user_id: userId,
        name: name.trim(),
        birthdate: date,
      })
      if (insertErr) throw insertErr

      const { error: updateErr } = await updateStep()
      if (updateErr) throw updateErr

      onNext()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    await updateStep()
    onNext()
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#F2F2F7' }}>
      <StatusBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 0' }}>

        <div style={{ paddingTop: 12, marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🎂</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1C1C1E', letterSpacing: -0.5, marginBottom: 8 }}>
            Premier anniversaire
          </div>
          <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.55 }}>
            Ajoutez l'anniversaire d'un proche pour ne jamais l'oublier
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 7, paddingLeft: 4, fontWeight: 500 }}>Prénom du proche</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Sophie, Lucas…"
            style={{
              width: '100%', padding: '15px 16px', borderRadius: 14, border: 'none',
              background: '#fff', fontSize: 16, color: '#1C1C1E', outline: 'none',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Date */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 7, paddingLeft: 4, fontWeight: 500 }}>Date d'anniversaire</div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{
              width: '100%', padding: '15px 16px', borderRadius: 14, border: 'none',
              background: '#fff', fontSize: 16, color: date ? '#1C1C1E' : '#C7C7CC', outline: 'none',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16, paddingLeft: 4 }}>{error}</div>
        )}
      </div>

      <div style={{ padding: '0 24px 48px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: 16, borderRadius: 16, border: 'none',
            background: saving ? '#C7C7CC' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff', fontSize: 17, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 18px rgba(224,85,170,0.35)',
            marginBottom: 12, fontFamily: 'inherit',
          }}
        >
          {saving ? 'Enregistrement…' : 'Ajouter →'}
        </button>

        <button
          onClick={handleSkip}
          style={{
            width: '100%', padding: 14, background: 'none', border: 'none',
            color: '#8E8E93', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Passer
        </button>
      </div>
    </div>
  )
}
