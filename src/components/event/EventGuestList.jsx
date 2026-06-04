import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { getAvatarColor } from './eventUtils'

const rsvpStatusColor = { going: '#34C759', declined: '#FF3B30', pending: '#FF9500' }
const rsvpStatusLabel = { going: 'Confirmé', declined: 'Décliné', pending: 'En attente' }
const guestResponseIcon = { yes: <CheckCircle2 size={16} className="text-green-500" />, no: <XCircle size={16} className="text-red-500" />, maybe: '🤔' }

export default function EventGuestList({ participants, guestRsvps, eventGuests, canManage, userId, invitedIds, onInvite, onAddFriend, embedded = false }) {
  void invitedIds
  void onInvite

  const visibleEventGuests = !canManage
    ? [...eventGuests].sort((a, b) => {
      if (a.invitee_id === userId) return -1
      if (b.invitee_id === userId) return 1
      return 0
    })
    : eventGuests

  const guestListContent = (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 12 }}>
        Invités ({visibleEventGuests.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibleEventGuests.map(guest => {
          const isCurrentUser = guest.invitee_id === userId
          const guestName = isCurrentUser ? 'Moi' : guest.full_name
          const chipBg = guest.rsvp_status === 'confirmed' ? 'rgba(52,199,89,0.10)' : guest.rsvp_status === 'declined' ? 'rgba(255,59,48,0.10)' : 'rgba(142,142,147,0.12)'
          const chipColor = guest.rsvp_status === 'confirmed' ? '#34C759' : guest.rsvp_status === 'declined' ? '#FF3B30' : '#8E8E93'
          const chipLabel = guest.rsvp_status === 'confirmed' ? 'Confirmé' : guest.rsvp_status === 'declined' ? 'Décliné' : 'En attente'
          const btnDisabled = guest.is_friend || guest.friend_request_sent
          const btnBg = guest.is_friend ? 'rgba(52,199,89,0.10)' : '#F5F5F5'
          const btnColor = guest.is_friend ? '#34C759' : guest.friend_request_sent ? '#8E8E93' : '#1C1C1E'
          const btnLabel = guest.is_friend ? 'Amis ✓' : guest.friend_request_sent ? 'Demande envoyée' : '+ Ajouter'
          return (
            <div key={guest.invitee_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {guest.avatar_url ? (
                <img src={guest.avatar_url} alt={guestName} style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#FBBF9A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {(guestName || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guestName}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 3, padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: chipBg, color: chipColor }}>
                  {chipLabel}
                </div>
              </div>
              {!isCurrentUser && (
                <div onClick={() => !btnDisabled && onAddFriend(guest.invitee_id)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: btnDisabled ? 'default' : 'pointer', background: btnBg, color: btnColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {btnLabel}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )

  return (
    <>
      {!canManage && visibleEventGuests.length > 0 && (embedded ? guestListContent : (
        <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          {guestListContent}
        </div>
      ))}

      {canManage && guestRsvps.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 10 }}>
            Via lien public 🔗
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {guestRsvps.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#1C1C1E', fontWeight: 500 }}>{g.guest_name}</div>
                  <div style={{ fontSize: 11, color: '#8E8E93' }}>{g.guest_email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>{guestResponseIcon[g.response] ?? <Clock size={16} className="text-gray-400" />}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManage && participants.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>Participants</div>
            {participants.length > 4 && <div style={{ fontSize: 13, fontWeight: 600, color: '#e055aa', cursor: 'pointer' }}>Voir tous</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {participants.slice(0, 4).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: getAvatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {(p.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{p.name}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: rsvpStatusColor[p.status] ?? '#8E8E93' }}>
                  {rsvpStatusLabel[p.status] ?? 'En attente'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
