import { useState } from 'react'
import { supabase } from '../lib/supabase'
import useLongPress from '../hooks/useLongPress'
import BirthdayContextMenu from './BirthdayContextMenu'
import BirthdayEditModal from './BirthdayEditModal'

function StripItem({ birthday, onLongPress }) {
  const { id, name, days } = birthday
  const offset = Math.max(0, Math.min(169.6, 169.6 * days / 30))
  const isUrgent = days <= 7
  const isSoon = days <= 14

  const badgeBg = isUrgent ? '#FF3B30' : isSoon ? '#f5a623' : '#AEAEB2'
  const ringStroke = isUrgent ? `url(#grad_${id})` : isSoon ? '#f5a623' : '#AEAEB2'
  const badgeText = days === 0 ? 'Auj.' : `J-${days}`
  const displayName = name.length > 8 ? name.slice(0, 7) + '…' : name

  const longPressHandlers = useLongPress(onLongPress)

  return (
    <div
      {...longPressHandlers}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flexShrink: 0, width: 74,
        userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 5 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0 }}>
          {isUrgent && (
            <defs>
              <linearGradient id={`grad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e055aa" />
                <stop offset="100%" stopColor="#f5a623" />
              </linearGradient>
            </defs>
          )}
          <circle cx="32" cy="32" r="27" fill="none" stroke="#E5E5EA" strokeWidth="3" />
          <circle
            cx="32" cy="32" r="27" fill="none"
            stroke={ringStroke}
            strokeWidth="3"
            strokeDasharray="169.6"
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div style={{
          position: 'absolute', top: 7, left: 7, right: 7, bottom: 7,
          background: '#FBBF9A', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          🎂
        </div>
      </div>

      <div style={{
        fontSize: 11, fontWeight: 600, color: '#1C1C1E', textAlign: 'center',
        maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {displayName}
      </div>

      <div style={{
        marginTop: 3, padding: '2px 7px', borderRadius: 10,
        fontSize: 10, fontWeight: 700, color: '#fff',
        background: badgeBg, whiteSpace: 'nowrap',
      }}>
        {badgeText}
      </div>
    </div>
  )
}

export default function BirthdayStrip({ birthdays, onRefetch, onToast }) {
  const [contextMenu, setContextMenu] = useState(null)
  const [editBirthday, setEditBirthday] = useState(null)

  async function handleDelete(birthday) {
    const confirmed = window.confirm(`Supprimer l'anniversaire de ${birthday.name} ?`)
    if (!confirmed) return
    const { error } = await supabase
      .from('birthdays')
      .delete()
      .eq('id', birthday.id)
    if (error) {
      console.error('Birthday delete failed:', error)
      onToast?.('Erreur lors de la suppression 😕', true)
    } else {
      onToast?.('Anniversaire supprimé 🗑️')
      onRefetch?.()
    }
  }

  if (birthdays.length === 0) {
    return (
      <div style={{ color: '#AEAEB2', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
        Aucun anniversaire ce mois-ci
      </div>
    )
  }

  return (
    <>
      <div style={{
        overflowX: 'auto', display: 'flex', gap: 10,
        padding: '4px 0 12px', WebkitOverflowScrolling: 'touch',
      }}>
        {birthdays.map(b => (
          <StripItem
            key={b.id}
            birthday={b}
            onLongPress={() => setContextMenu(b)}
          />
        ))}
      </div>

      {contextMenu && (
        <BirthdayContextMenu
          birthday={contextMenu}
          onEdit={() => { setEditBirthday(contextMenu); setContextMenu(null) }}
          onDelete={() => { const b = contextMenu; setContextMenu(null); handleDelete(b) }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {editBirthday && (
        <BirthdayEditModal
          birthday={editBirthday}
          onClose={() => setEditBirthday(null)}
          onSaved={() => { setEditBirthday(null); onRefetch?.() }}
          onToast={onToast}
        />
      )}
    </>
  )
}
