import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function frenchDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d) - today) / 86400000)
}

export default function OrganizerSpacePage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [items, setItems] = useState([])
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('id, label, done, position')
      .eq('event_id', eventId)
      .order('position', { ascending: true })
    if (!error) setItems(data ?? [])
  }, [eventId])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }

      const { data, error } = await supabase
        .from('events')
        .select('id, name, user_id, date')
        .eq('id', eventId)
        .maybeSingle()

      if (error || !data) { navigate('/'); return }
      if (data.user_id !== user.id) { navigate('/'); return }

      setEvent(data)
    }
    init()
    fetchItems()
  }, [eventId, navigate, fetchItems])

  const toggleItem = async (item) => {
    await supabase
      .from('checklist_items')
      .update({ done: !item.done })
      .eq('id', item.id)
    fetchItems()
  }

  const addItem = async () => {
    const label = inputValue.trim()
    if (!label) return
    const maxPosition = items.reduce((max, i) => Math.max(max, i.position ?? 0), 0)
    await supabase.from('checklist_items').insert({
      event_id: eventId,
      label,
      position: maxPosition + 1,
      done: false,
    })
    setInputValue('')
    setShowInput(false)
    fetchItems()
  }

  if (!event) return null

  const doneCount = items.filter((i) => i.done).length
  const totalCount = items.length
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0
  const days = daysUntil(event.date)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', minHeight: '100dvh' }}>
      <div style={{ background: '#fff', padding: '16px 16px 16px', borderBottom: '1px solid #F2F2F7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px 4px 0', display: 'flex', alignItems: 'center' }}
          >
            <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
              <path d="M8.5 1.5L1.5 8.5L8.5 15.5" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Mon anniversaire</div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 1 }}>
              {frenchDate(event.date)} · J-{days}
            </div>
          </div>
        </div>

        <div style={{ height: 5, borderRadius: 3, background: '#F2F2F7', overflow: 'hidden', marginBottom: 5 }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #e055aa, #f5a623)',
            borderRadius: 3,
            transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ fontSize: 11, color: '#8E8E93' }}>
          {doneCount} / {totalCount} tâches complètes
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
          {items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => toggleItem(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 14px',
                borderBottom: idx < items.length - 1 ? '1px solid #F2F2F7' : 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: item.done ? 'linear-gradient(135deg, #e055aa, #f5a623)' : 'transparent',
                border: item.done ? 'none' : '1.5px solid #AEAEB2',
              }}>
                {item.done && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: 15,
                color: item.done ? '#8E8E93' : '#1C1C1E',
                textDecoration: item.done ? 'line-through' : 'none',
              }}>
                {item.label}
              </span>
            </div>
          ))}

          {showInput ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderTop: items.length > 0 ? '1px solid #F2F2F7' : 'none',
            }}>
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="Nouvelle tâche…"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  color: '#1C1C1E',
                  background: 'transparent',
                }}
              />
              <button
                onClick={addItem}
                style={{
                  background: 'linear-gradient(135deg, #e055aa, #f5a623)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ajouter
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              style={{
                width: '100%',
                padding: '13px 14px',
                background: 'transparent',
                border: 'none',
                borderTop: items.length > 0 ? '1px solid #F2F2F7' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 15,
                color: '#007AFF',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              Ajouter une tâche
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
