import { useState } from 'react'
import StatusBar from '../components/StatusBar'

const types = ['🎂 Anniversaire', '🥂 Soirée', '🍽️ Repas', '🎉 Autre']
const visibilities = ['Privé 🔒', 'Sur invitation', 'Public 🌍']

export default function Create({ onBack }) {
  const [type, setType] = useState(0)
  const [vis, setVis] = useState(1)
  const [form, setForm] = useState({ name: '', date: '', location: '', desc: '' })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', color: '#007AFF', cursor: 'pointer', minWidth: 60 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize: 16 }}>Retour</span>
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Nouvel événement</div>
          <div style={{ minWidth: 60 }}/>
        </div>

        {/* Type */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>Type d'événement</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {types.map((t, i) => (
              <div key={i} onClick={() => setType(i)} style={{
                padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                background: i === type ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                color: i === type ? '#fff' : '#8E8E93', cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s',
              }}>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Fields */}
        {[
          { key: 'name', label: "Nom de l'événement", placeholder: 'Ex: Anniversaire de Sophie', type: 'text' },
          { key: 'date', label: 'Date et heure', placeholder: 'Sélectionner une date...', type: 'datetime-local' },
          { key: 'location', label: 'Lieu', placeholder: 'Adresse ou lieu', type: 'text' },
          { key: 'desc', label: 'Description (optionnel)', placeholder: "Décrivez l'événement...", type: 'text' },
        ].map(f => (
          <div key={f.key} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>{f.label}</div>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, color: '#1C1C1E', background: 'transparent', fontFamily: 'inherit' }}
            />
          </div>
        ))}

        {/* Visibility */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>Visibilité</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {visibilities.map((v, i) => (
              <div key={i} onClick={() => setVis(i)} style={{
                flex: 1, padding: 10, borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: i === vis ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                color: i === vis ? '#fff' : '#8E8E93', cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.15s',
              }}>
                {v}
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div onClick={onBack} style={{
          padding: 16, background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
          borderRadius: 16, fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: 'pointer',
        }}>
          Créer l'événement 🎉
        </div>
      </div>
    </div>
  )
}
