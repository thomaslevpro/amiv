import { Cake } from 'lucide-react'

function formatBirthdate(birthdate) {
  const [y, m, d] = birthdate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export default function BirthdayContextMenu({ birthday, onEdit, onDelete, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, width: '100%', maxWidth: 320,
          overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.20)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '22px 20px 18px', textAlign: 'center',
          borderBottom: '1px solid #F2F2F7',
        }}>
          <div style={{ marginBottom: 8 }}><Cake size={20} strokeWidth={1.5} /></div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>{birthday.name}</div>
          <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3 }}>
            {formatBirthdate(birthday.birthdate)}
          </div>
        </div>

        {/* Edit */}
        <div
          onClick={onEdit}
          style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', borderBottom: '1px solid #F2F2F7',
          }}
        >
          <span style={{ fontSize: 20 }}>✏️</span>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1C1C1E' }}>Modifier</span>
        </div>

        {/* Delete */}
        <div
          onClick={onDelete}
          style={{
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 20 }}>🗑️</span>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#FF3B30' }}>Supprimer</span>
        </div>
      </div>
    </div>
  )
}
