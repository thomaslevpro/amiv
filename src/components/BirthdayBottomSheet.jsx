import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatBirthdate(birthdate) {
  const [y, m, d] = birthdate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function calcAge(birthdate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = birthdate.split('-').map(Number)
  const next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return next.getFullYear() - y
}

export default function BirthdayBottomSheet({ birthday, onClose, onEdit, onDeleted, onToast }) {
  const [visible, setVisible] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  function handleEdit() {
    setVisible(false)
    setTimeout(() => { onClose(); onEdit() }, 280)
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('birthdays').delete().eq('id', birthday.id)
    if (error) {
      console.error('Birthday delete failed:', error)
      onToast?.('Erreur lors de la suppression 😕', true)
      setDeleting(false)
    } else {
      onToast?.('Anniversaire supprimé 🗑️')
      setVisible(false)
      setTimeout(() => { onClose(); onDeleted?.() }, 280)
    }
  }

  const dateStr = formatBirthdate(birthday.birthdate)
  const age = calcAge(birthday.birthdate)

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#F2F2F7',
          borderRadius: '20px 20px 0 0',
          padding: '12px 20px 0',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div style={{ width: 36, height: 4, background: '#C7C7CC', borderRadius: 2, margin: '0 auto 20px' }} />

        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>
          {birthday.name}
        </div>

        <div style={{ textAlign: 'center', fontSize: 14, color: '#8E8E93', marginBottom: 28 }}>
          {dateStr} · {age} ans
        </div>

        <button
          onClick={handleEdit}
          style={{
            width: '100%', padding: 14, borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
            display: 'block',
          }}
        >
          Modifier
        </button>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              width: '100%', padding: 14, borderRadius: 14, border: 'none',
              background: '#E5E5EA', color: '#FF3B30',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'block',
              marginBottom: 8,
            }}
          >
            Supprimer
          </button>
        ) : (
          <div style={{ marginBottom: 8 }}>
            <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1C1C1E', marginBottom: 10 }}>
              Confirmer ?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: 13, borderRadius: 12, border: 'none',
                  background: '#FF3B30', color: '#fff',
                  fontSize: 14, fontWeight: 700,
                  cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                Oui, supprimer
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1, padding: 13, borderRadius: 12, border: 'none',
                  background: '#E5E5EA', color: '#1C1C1E',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
