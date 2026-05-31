import { useState } from 'react'
import { Cake, Link2 } from 'lucide-react'
import BirthdayBottomSheet from './BirthdayBottomSheet'
import BirthdayEditModal from './BirthdayEditModal'

function getLinkedProfile(birthday) {
  return birthday?.linked_profile ?? birthday?.profiles ?? null
}

function getBirthdayName(birthday) {
  const linkedProfile = getLinkedProfile(birthday)
  if (birthday?.linked_profile_id && linkedProfile) {
    return linkedProfile.first_name || linkedProfile.name || birthday.name || 'Amiv'
  }
  return birthday?.name || 'Amiv'
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function StripItem({ birthday, onAvatarTap }) {
  const { id, days } = birthday
  const linkedProfile = getLinkedProfile(birthday)
  const isLinked = Boolean(birthday.linked_profile_id)
  const name = getBirthdayName(birthday)
  const ringCircumference = 127.2
  const offset = Math.max(0, Math.min(ringCircumference, ringCircumference * days / 30))
  const isUrgent = days <= 7
  const isSoon = days <= 14

  const badgeBg = isUrgent ? '#FF3B30' : isSoon ? '#f5a623' : '#AEAEB2'
  const ringStroke = isUrgent ? `url(#grad_${id})` : isSoon ? '#f5a623' : '#AEAEB2'
  const badgeText = days === 0 ? 'Auj.' : `J-${days}`
  const displayName = name.length > 8 ? name.slice(0, 7) + '…' : name

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flexShrink: 0, width: 74,
        userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <div
        onClick={onAvatarTap}
        style={{ position: 'relative', width: 48, height: 48, marginBottom: 5, cursor: 'pointer' }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" style={{ position: 'absolute', inset: 0 }}>
          {isUrgent && (
            <defs>
              <linearGradient id={`grad_${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e055aa" />
                <stop offset="100%" stopColor="#f5a623" />
              </linearGradient>
            </defs>
          )}
          <circle cx="24" cy="24" r="20.25" fill="none" stroke="#E5E5EA" strokeWidth="2.25" />
          <circle
            cx="24" cy="24" r="20.25" fill="none"
            stroke={ringStroke}
            strokeWidth="2.25"
            strokeDasharray={ringCircumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
          />
        </svg>
        <div style={{
          position: 'absolute', top: 5.25, left: 5.25, right: 5.25, bottom: 5.25,
          background: isLinked ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#FBBF9A', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          fontSize: 13,
          fontWeight: 800,
          color: '#fff',
        }}>
          {isLinked && linkedProfile?.avatar_url ? (
            <img src={linkedProfile.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : isLinked ? (
            getInitials(name)
          ) : (
            <Cake size={15} strokeWidth={1.5} color="#1C1C1E" />
          )}
        </div>
        {isLinked && (
          <div
            aria-label="Profil lié"
            title="Profil lié"
            style={{
              position: 'absolute',
              right: 2,
              bottom: 3,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#e055aa,#f5a623)',
              border: '1.5px solid #fff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 1px 4px rgba(18,31,46,0.18)',
            }}
          >
            <Link2 size={8.5} color="#fff" strokeWidth={2.4} />
          </div>
        )}
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
  const [bottomSheet, setBottomSheet] = useState(null)
  const [editBirthday, setEditBirthday] = useState(null)

  if (birthdays.length === 0) {
    return (
      <div style={{ color: '#AEAEB2', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
        Aucun anniversaire
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
            onAvatarTap={() => setBottomSheet(b)}
          />
        ))}
      </div>

      {bottomSheet && (
        <BirthdayBottomSheet
          birthday={bottomSheet}
          onClose={() => setBottomSheet(null)}
          onEdit={() => setEditBirthday(bottomSheet)}
          onDeleted={() => onRefetch?.()}
          onToast={onToast}
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
