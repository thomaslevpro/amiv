import { useEffect, useState } from 'react'
import { Share, UserPlus } from 'lucide-react'
import useLongPress from '../../hooks/useLongPress'
import { GUEST_STATUSES, GUEST_STATUS_META, canRemindGuest, countsFromGuests, guestSubtitle } from '../../lib/eventGuests'
import GuestAvatar from './GuestAvatar'
import GuestStatusPill from './GuestStatusPill'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'
const SEPARATOR = '0.5px solid rgba(60,60,67,0.18)'

function GuestRow({ guest, isFirst, isMe, onLongPress }) {
  const longPress = useLongPress(() => onLongPress?.(guest), 450)
  const handlers = onLongPress ? longPress : {}
  const subtitle = guestSubtitle(guest)

  return (
    <li
      {...handlers}
      onContextMenu={onLongPress ? e => { e.preventDefault(); onLongPress(guest) } : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, listStyle: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    >
      <GuestAvatar name={guest.display_name} avatarUrl={guest.avatar_url} seed={guest.guest_key} />
      <div style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 10, borderTop: isFirst ? 'none' : SEPARATOR }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {guest.display_name}{isMe && <span style={{ fontWeight: 400, color: '#8E8E93' }}> (toi)</span>}
          </div>
          {subtitle && <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>}
        </div>
        <GuestStatusPill status={guest.status} />
      </div>
    </li>
  )
}

function GuestActionSheet({ guest, onClose, onRemind, onRemove }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const remindable = guest.role !== 'email_guest'
  const canRemind = remindable && canRemindGuest(guest)
  const buttonStyle = { width: '100%', minHeight: 56, border: 'none', background: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 8px max(8px, env(safe-area-inset-bottom))' }}>
      <div role="dialog" aria-label={`Actions pour ${guest.display_name}`} onClick={e => e.stopPropagation()} style={{ maxWidth: 430, width: '100%', margin: '0 auto' }}>
        <div style={{ borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#8E8E93', borderBottom: SEPARATOR }}>
            {guest.display_name} n'a pas encore répondu
          </div>
          {remindable && (
            <button type="button" disabled={!canRemind} onClick={() => { onRemind(guest); onClose() }} style={{ ...buttonStyle, color: canRemind ? '#007AFF' : '#AEAEB2', cursor: canRemind ? 'pointer' : 'default', borderBottom: SEPARATOR }}>
              Relancer
              {!canRemind && <span style={{ fontSize: 12, color: '#AEAEB2' }}>Déjà relancé il y a moins de 24 h</span>}
            </button>
          )}
          <button type="button" onClick={() => { if (!confirmRemove) { setConfirmRemove(true); return } onRemove(guest); onClose() }} style={{ ...buttonStyle, color: '#FF3B30', fontWeight: confirmRemove ? 600 : 400 }}>
            {confirmRemove ? 'Confirmer le retrait' : "Retirer l'invitation"}
          </button>
        </div>
        <button type="button" onClick={onClose} style={{ ...buttonStyle, marginTop: 8, borderRadius: 14, fontWeight: 600, color: '#007AFF' }}>Annuler</button>
      </div>
    </div>
  )
}

export default function EventGuestsSection({ guests, loading, canManage, userId, onInvite, onShare, onRemind, onRemove }) {
  const [filter, setFilter] = useState('all')
  const [actionGuest, setActionGuest] = useState(null)
  const counts = countsFromGuests(guests)
  const total = counts.total

  // Le filtre actif disparaît quand il n'y a plus personne dedans.
  useEffect(() => {
    if (filter !== 'all' && counts[filter] === 0) setFilter('all')
  }, [filter, counts[filter]])

  const visibleGuests = filter === 'all' ? guests : guests.filter(g => g.status === filter)
  const filters = [{ key: 'all', label: 'Tous', count: total }, ...GUEST_STATUSES.map(key => ({ key, label: GUEST_STATUS_META[key].plural, count: counts[key] })).filter(f => f.count > 0)]
  const canAct = guest => canManage && guest.status === 'pending' && !!guest.invitation_id && guest.role !== 'owner'

  return (
    <section aria-labelledby="event-guests-title" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 id="event-guests-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1C1C1E', letterSpacing: -0.3 }}>Invités</h2>
        <div style={{ fontSize: 14, color: '#8E8E93' }}>{loading && total === 0 ? '…' : `${total} invité${total > 1 ? 's' : ''}`}</div>
      </div>

      <div role="img" aria-label={GUEST_STATUSES.map(key => `${counts[key]} ${GUEST_STATUS_META[key].plural.toLowerCase()}`).join(', ')} style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', background: '#F2F2F7' }}>
        {total > 0 && GUEST_STATUSES.filter(key => counts[key] > 0).map(key => (
          <div key={key} style={{ flexGrow: counts[key], flexBasis: 0, background: GUEST_STATUS_META[key].color, transition: 'flex-grow 0.3s ease' }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 12 }}>
        {GUEST_STATUSES.map(key => (
          <div key={key} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', fontVariantNumeric: 'tabular-nums' }}>{counts[key]}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8E8E93', marginTop: 1, whiteSpace: 'nowrap' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: GUEST_STATUS_META[key].color, flexShrink: 0 }} />
              {GUEST_STATUS_META[key].plural}
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div role="tablist" aria-label="Filtrer les invités" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', margin: '18px -16px 6px', padding: '0 16px' }}>
          {filters.map(f => {
            const active = filter === f.key
            return (
              <button key={f.key} type="button" role="tab" aria-selected={active} onClick={() => setFilter(f.key)} style={{ flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 17, border: 'none', background: active ? '#1C1C1E' : '#F2F2F7', color: active ? '#fff' : '#1C1C1E', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {f.label} <span style={{ fontWeight: 500, opacity: active ? 0.7 : 0.55 }}>{f.count}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading && total === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: '#8E8E93' }}>Chargement…</div>
      ) : visibleGuests.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: '#8E8E93' }}>Personne pour l'instant</div>
      ) : (
        <ul style={{ margin: 0, padding: 0 }}>
          {visibleGuests.map((guest, index) => (
            <GuestRow key={guest.guest_key} guest={guest} isFirst={index === 0} isMe={!!userId && guest.user_id === userId} onLongPress={canAct(guest) ? setActionGuest : undefined} />
          ))}
        </ul>
      )}

      {canManage && counts.pending > 0 && (
        <div style={{ fontSize: 12, color: '#AEAEB2', textAlign: 'center', marginTop: 6 }}>Appui long sur un invité en attente pour le relancer</div>
      )}

      {canManage && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onInvite} style={{ flex: 1, height: 48, border: 'none', borderRadius: 14, background: GRADIENT, color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' }}>
            <UserPlus size={18} strokeWidth={2.2} /> Inviter des amis
          </button>
          <button type="button" onClick={onShare} style={{ flex: 1, height: 48, border: 'none', borderRadius: 14, background: '#F2F2F7', color: '#1C1C1E', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' }}>
            <Share size={18} strokeWidth={2.2} /> Partager le lien
          </button>
        </div>
      )}

      {actionGuest && <GuestActionSheet guest={actionGuest} onClose={() => setActionGuest(null)} onRemind={onRemind} onRemove={onRemove} />}
    </section>
  )
}
