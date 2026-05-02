import { useState } from 'react'
import { Cake } from 'lucide-react'
import StatusBar from '../components/StatusBar'
import { supabase } from '../lib/supabase'

const types = [<><Cake size={13} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Anniversaire</>, '🥂 Soirée', '🍽️ Repas', '🎉 Autre']
const typeValues = ['Anniversaire', 'Soirée', 'Repas', 'Autre']
const visibilities = ['Privé 🔒', 'Sur invitation', 'Public 🌍']

const fieldStyle = {
  width: '100%', border: 'none', outline: 'none', fontSize: 15,
  color: '#1C1C1E', background: 'transparent', fontFamily: 'inherit',
}
const cardStyle = {
  background: '#fff', borderRadius: 16, padding: '14px 16px',
  marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
}
const labelStyle = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6,
}

export default function Create({ onBack }) {
  const [type, setType] = useState(0)
  const [vis, setVis] = useState(1)
  const [form, setForm] = useState({ name: '', date: '', location: '', desc: '' })
  const [usePoll, setUsePoll] = useState(false)
  const [pollDates, setPollDates] = useState([{ date: '', time: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function updatePollDate(i, field, value) {
    setPollDates(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  async function handleCreate() {
    setError(null)
    if (!form.name.trim()) {
      setError("Le nom de l'événement est obligatoire.")
      return
    }
    if (!usePoll && !form.date) {
      setError("Merci de sélectionner une date et heure.")
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const isoDate = form.date ? new Date(form.date).toISOString() : null
      const { data: eventData, error } = await supabase.from('events').insert({
        name: form.name,
        date: usePoll ? null : isoDate,
        location: form.location,
        description: form.desc,
        type: typeValues[type],
        visibility: visibilities[vis],
        user_id: user.id,
      }).select().single()
      if (error) throw error

      if (usePoll) {
        const validDates = pollDates.filter(d => d.date)
        if (validDates.length > 0) {
          const { error: optErr } = await supabase.from('event_date_options').insert(
            validDates.map(d => ({
              event_id: eventData.id,
              proposed_date: d.date,
              proposed_time: d.time || null,
            }))
          )
          if (optErr) console.error('Error inserting date options:', optErr)
        }
      }

      onBack()
    } catch (err) {
      console.error('Erreur lors de la création de l\'événement :', err)
      setError(err.message || 'Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

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
        <div style={cardStyle}>
          <div style={labelStyle}>Type d'événement</div>
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

        {/* Name */}
        <div style={cardStyle}>
          <div style={labelStyle}>Nom de l'événement</div>
          <input
            type="text"
            placeholder="Ex: Anniversaire de Sophie"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            style={fieldStyle}
          />
        </div>

        {/* Date — fixed or poll */}
        <div style={{ ...cardStyle, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: usePoll ? 12 : 0 }}>
            <div style={{ ...labelStyle, marginBottom: 0 }}>Date{usePoll ? ' — sondage 📊' : ' et heure'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>Sondage</span>
              <div
                onClick={() => setUsePoll(p => !p)}
                style={{
                  width: 44, height: 26, borderRadius: 13, position: 'relative',
                  cursor: 'pointer',
                  background: usePoll ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#E5E5EA',
                  transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: usePoll ? 21 : 3, width: 20, height: 20,
                  borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                }} />
              </div>
            </div>
          </div>

          {usePoll ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pollDates.map((pd, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="date"
                    value={pd.date}
                    onChange={e => updatePollDate(i, 'date', e.target.value)}
                    style={{
                      flex: 2, border: '1px solid #E5E5EA', borderRadius: 10,
                      padding: '8px 10px', fontSize: 13, color: '#1C1C1E', outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <input
                    type="time"
                    value={pd.time}
                    onChange={e => updatePollDate(i, 'time', e.target.value)}
                    style={{
                      flex: 1, border: '1px solid #E5E5EA', borderRadius: 10,
                      padding: '8px 10px', fontSize: 13, color: '#1C1C1E', outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  {pollDates.length > 1 && (
                    <div
                      onClick={() => setPollDates(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ fontSize: 18, color: '#FF3B30', cursor: 'pointer', padding: '0 4px', fontWeight: 700 }}
                    >
                      −
                    </div>
                  )}
                </div>
              ))}
              {pollDates.length < 4 && (
                <div
                  onClick={() => setPollDates(prev => [...prev, { date: '', time: '' }])}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '9px', borderRadius: 10,
                    border: '1.5px dashed #E5E5EA', color: '#8E8E93',
                    fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  + Ajouter une date proposée
                </div>
              )}
            </div>
          ) : (
            <input
              type="datetime-local"
              placeholder="Sélectionner une date..."
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              style={{ ...fieldStyle, marginTop: 6 }}
            />
          )}
        </div>

        {/* Location */}
        <div style={cardStyle}>
          <div style={labelStyle}>Lieu</div>
          <input
            type="text"
            placeholder="Adresse ou lieu"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
            style={fieldStyle}
          />
        </div>

        {/* Description */}
        <div style={cardStyle}>
          <div style={labelStyle}>Description (optionnel)</div>
          <input
            type="text"
            placeholder="Décrivez l'événement..."
            value={form.desc}
            onChange={e => setForm({ ...form, desc: e.target.value })}
            style={fieldStyle}
          />
        </div>

        {/* Visibility */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={labelStyle}>Visibilité</div>
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

        {/* Error */}
        {error && (
          <div style={{
            background: '#FFF0F0', border: '1px solid #FF3B30', borderRadius: 12,
            padding: '10px 14px', marginBottom: 10, color: '#FF3B30',
            fontSize: 13, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div onClick={loading ? undefined : handleCreate} style={{
          padding: 16, background: loading ? '#AEAEB2' : 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
          borderRadius: 16, fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}>
          {loading ? 'Création…' : 'Créer l\'événement 🎉'}
        </div>
      </div>
    </div>
  )
}
