import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Lock } from 'lucide-react'
import { BG, BLACK, FONT, GRAY1, WHITE } from './constants'
import GuestAvatar from '../event/GuestAvatar'
import { fetchEventGuestList, GUEST_STATUS_META } from '../../lib/eventGuests'
import { hiddenFromLabel, SECRET_ACCENT, SECRET_ACCENT_SOFT } from '../../lib/secretSpace'

// Membres du chat, même règle que is_event_chat_member : organisateur,
// co-organisateurs, invités confirmés. En attente, peut-être, refusé : pas
// d'accès au chat, donc pas listés. Les invités sans compte non plus.
export function chatMembers(guests, { birthdayPersonId = null, isSecret = false } = {}) {
  const members = (guests ?? []).filter(guest => guest.user_id && (guest.role === 'owner' || guest.role === 'co_organizer' || guest.status === 'confirmed'))
  if (!birthdayPersonId) return members
  const birthdayPerson = members.find(guest => guest.user_id === birthdayPersonId)
  const others = members.filter(guest => guest.user_id !== birthdayPersonId)
  // Canal Secret : la personne fêtée ne le voit pas, elle n'y apparaît jamais
  if (isSecret || !birthdayPerson) return others
  return [birthdayPerson, ...others]
}

function memberLabel(guest, birthdayPersonId) {
  if (guest.user_id === birthdayPersonId) return '🎂 Personne fêtée'
  if (guest.role === 'owner') return 'Organisateur'
  if (guest.role === 'co_organizer') return 'Co-organisateur'
  return GUEST_STATUS_META[guest.status]?.label ?? ''
}

export default function ChatMembersSheet({ event, currentUserId, isSecret, birthdayPersonFirstName, onClose, onSelectMember, onOpenEvent }) {
  const [visible, setVisible] = useState(false)
  const [guests, setGuests] = useState(null)
  const [failed, setFailed] = useState(false)
  const birthdayPersonId = event.birthday_person_user_id ?? null

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    let cancelled = false
    fetchEventGuestList(event.id).then(list => {
      if (cancelled) return
      if (list === null) setFailed(true)
      setGuests(list ?? [])
    })
    return () => { cancelled = true }
  }, [event.id])

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const members = guests ? chatMembers(guests, { birthdayPersonId, isSecret }) : []
  const countLabel = guests ? `${members.length} participant${members.length > 1 ? 's' : ''}` : 'Participants'

  return createPortal(
    <div onClick={dismiss} style={{ position: 'fixed', inset: 0, zIndex: 650, background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)', transition: 'background 0.28s ease', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT }}>
      <div
        role="dialog"
        aria-label="Participants"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 430, maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: WHITE, borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.16)', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, background: '#C7C7CC', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '8px 20px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: BLACK }}>Participants</div>
          <div style={{ marginTop: 2, fontSize: 14, color: GRAY1, fontWeight: 500 }}>{countLabel}</div>
          {isSecret && (
            <div style={{ marginTop: 10, background: SECRET_ACCENT_SOFT, color: SECRET_ACCENT, borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700 }}>
              <Lock size={14} strokeWidth={2.2} color={SECRET_ACCENT} />
              {hiddenFromLabel(birthdayPersonFirstName)}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {!guests && [0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: BG }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: '50%', height: 14, borderRadius: 7, background: BG, marginBottom: 6 }} />
                <div style={{ width: '30%', height: 12, borderRadius: 6, background: BG }} />
              </div>
            </div>
          ))}
          {guests && failed && (
            <div style={{ padding: '16px 20px', fontSize: 14, color: GRAY1, textAlign: 'center' }}>Impossible de charger les participants.</div>
          )}
          {members.map(guest => {
            const isMe = guest.user_id === currentUserId
            return (
              <button
                key={guest.guest_key}
                type="button"
                disabled={isMe}
                onClick={() => onSelectMember(guest)}
                style={{ width: '100%', border: 'none', background: WHITE, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: isMe ? 'default' : 'pointer', fontFamily: FONT }}
              >
                <GuestAvatar name={guest.display_name} avatarUrl={guest.avatar_url} seed={guest.guest_key} size={44} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {guest.display_name}{isMe ? ' (toi)' : ''}
                  </span>
                  <span style={{ display: 'block', marginTop: 1, fontSize: 13, color: GRAY1 }}>{memberLabel(guest, birthdayPersonId)}</span>
                </span>
                {!isMe && <ChevronRight size={18} strokeWidth={2} color="#C7C7CC" style={{ flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '10px 16px 0', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
          <button type="button" onClick={onOpenEvent} style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: BG, color: BLACK, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
            Voir l'événement
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
