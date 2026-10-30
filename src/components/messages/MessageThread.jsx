import { useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Lock, MapPin, MessageCircle, MoreHorizontal } from 'lucide-react'
import { BG, BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { DELETED_USER_LABEL, formatEventHeaderDate, profileDisplayName } from './utils'
import { Avatar, EventCover } from './MessageUI'
import MessageComposer, { canSend } from './MessageComposer'
import ChatMembersSheet from './ChatMembersSheet'
import DirectFriendProfileSheet from './DirectFriendProfileSheet'
import { getCoverUrl } from '../home/MyEventsSection'
import { MessageSafetySheet } from '../safety/SafetySheets'
import { hiddenFromLabel, SECRET_ACCENT, SECRET_ACCENT_SOFT, secretTabForMessage } from '../../lib/secretSpace'

const LONG_PRESS_MS = 450

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageThread({
  event,
  onBack,
  myRsvpStatus,
  canUseSecretChannel,
  isSecret,
  setIsSecret,
  birthdayPersonFirstName,
  messages,
  eventMessageRows,
  bottomRef,
  input,
  setInput,
  send,
  guestLeaderIds = new Set(),
  closeFriendIds = new Set(),
  onAuthorBlocked,
  secretSummaryParts = null,
  onOpenSecretSpace = null,
  currentUserId = null,
  onOpenEvent,
  onSendDirectMessage,
}) {
  const inputRef = useRef(null)
  const longPressRef = useRef(null)
  const [actionMessage, setActionMessage] = useState(null)
  const [showMembers, setShowMembers] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  function startLongPress(msg) {
    clearLongPress()
    longPressRef.current = setTimeout(() => setActionMessage(msg), LONG_PRESS_MS)
  }

  function handleSend() {
    // Garde le clavier ouvert pour enchaîner (focus synchrone : iOS l'exige dans le geste)
    if (canSend(input) && document.activeElement !== inputRef.current) inputRef.current?.focus()
    send()
  }

  const rsvpPill = myRsvpStatus === 'going'
    ? { label: 'Présent ✓', bg: 'rgba(52,199,89,0.22)', color: '#fff' }
    : myRsvpStatus === 'declined'
      ? { label: 'Décliné', bg: 'rgba(255,59,48,0.22)', color: '#fff' }
      : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ background: 'linear-gradient(160deg, #e055aa 0%, #f5a623 100%)', flexShrink: 0, paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
          <button type="button" onClick={onBack} aria-label="Retour" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
            <ChevronLeft size={18} color={WHITE} strokeWidth={2.5} />
          </button>
          <button type="button" aria-label="Plus d'options" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
            <MoreHorizontal size={18} color={WHITE} strokeWidth={2.5} />
          </button>
        </div>

        <button type="button" onClick={() => setShowMembers(true)} aria-label={`Participants de ${event.name}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '10px 16px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT }}>
          <span style={{ display: 'block', marginBottom: 8, borderRadius: 14, boxShadow: '0 0 0 2px rgba(255,255,255,0.55)' }}>
            <EventCover coverUrl={getCoverUrl(event.cover_image)} />
          </span>
          <span style={{ fontSize: 19, fontWeight: 800, color: WHITE, textAlign: 'center', lineHeight: 1.2 }}>
            {event.name}
          </span>
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 16px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '5px 11px', fontSize: 12, color: WHITE, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <CalendarIcon size={12} strokeWidth={2} color={WHITE} />
            {formatEventHeaderDate(event.date)}
          </div>
          {event.location && (
            <div style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '5px 11px', fontSize: 12, color: WHITE, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <MapPin size={12} strokeWidth={2} color={WHITE} />
              {event.location}
            </div>
          )}
          {rsvpPill && (
            <div style={{ background: rsvpPill.bg, borderRadius: 20, padding: '5px 11px', fontSize: 12, color: rsvpPill.color, fontWeight: 700, flexShrink: 0 }}>
              {rsvpPill.label}
            </div>
          )}
        </div>

        {canUseSecretChannel && (
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 16, background: 'rgba(255,255,255,0.18)' }}>
              <button type="button" onClick={() => setIsSecret(false)} style={{ flex: 1, minHeight: 32, border: 'none', borderRadius: 13, background: !isSecret ? 'rgba(255,255,255,0.90)' : 'transparent', color: !isSecret ? BLACK : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer' }}>
                <MessageCircle size={13} strokeWidth={2} />
                Général
              </button>
              <button type="button" onClick={() => setIsSecret(true)} style={{ flex: 1, minHeight: 32, border: 'none', borderRadius: 13, background: isSecret ? 'rgba(255,255,255,0.90)' : 'transparent', color: isSecret ? SECRET_ACCENT : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer' }}>
                <Lock size={13} strokeWidth={2.2} />
                Secret
              </button>
            </div>
          </div>
        )}
      </div>

      {isSecret && (
        <div style={{ background: SECRET_ACCENT_SOFT, color: SECRET_ACCENT, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          <Lock size={14} strokeWidth={2.2} color={SECRET_ACCENT} />
          {hiddenFromLabel(birthdayPersonFirstName)}
          <span style={{ fontWeight: 500, opacity: 0.8 }}>· ces messages ne lui sont jamais montrés</span>
        </div>
      )}

      {isSecret && onOpenSecretSpace && (
        <button type="button" onClick={() => onOpenSecretSpace()} style={{ margin: '10px 14px 0', padding: '10px 12px', border: 'none', borderRadius: 14, background: WHITE, boxShadow: '0 1px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', flexShrink: 0, fontFamily: FONT }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: SECRET_ACCENT_SOFT, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Lock size={16} strokeWidth={2.2} color={SECRET_ACCENT} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: BLACK }}>Espace secret</span>
            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, lineHeight: 1.35, color: GRAY1, fontWeight: 500, marginTop: 1 }}>
              {secretSummaryParts?.length ? secretSummaryParts.join(' · ') : 'Flashback · Cadeaux · Cagnotte'}
            </span>
          </span>
          <ChevronRight size={16} strokeWidth={2.4} color={SECRET_ACCENT} style={{ flexShrink: 0 }} />
        </button>
      )}

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: GRAY1, fontSize: 14, marginTop: 40 }}>
            Aucun message pour l'instant
          </div>
        ) : (
          eventMessageRows.map(row => {
            if (row.type === 'date') return <div key={row.id} style={{ textAlign: 'center', color: GRAY1, fontSize: 11, fontWeight: 600, margin: '12px 0 4px' }}>{row.label}</div>
            if (row.type === 'system' && row.message.system_type) {
              // Activité de l'espace secret : discrète, avec un lien vers l'élément
              const { message: sm } = row
              if (sm.is_hidden) return null
              const tab = secretTabForMessage(sm)
              const canOpen = !!(onOpenSecretSpace && tab)
              return (
                <div key={sm.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <button type="button" disabled={!canOpen} onClick={() => canOpen && onOpenSecretSpace(tab, sm.system_data?.item_id ?? null)} style={{ border: 'none', background: 'transparent', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '86%', fontSize: 11.5, fontWeight: 600, color: GRAY1, fontFamily: FONT, cursor: canOpen ? 'pointer' : 'default', textAlign: 'center' }}>
                    <Lock size={11} strokeWidth={2.4} color={SECRET_ACCENT} style={{ flexShrink: 0 }} />
                    <span>{sm.content}</span>
                    {canOpen && <span style={{ color: SECRET_ACCENT, fontWeight: 700, flexShrink: 0 }}>Voir</span>}
                  </button>
                </div>
              )
            }
            if (row.type === 'system') {
              const { message: sm } = row
              return (
                <div key={sm.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <div style={{ background: 'rgba(0,122,255,0.09)', color: '#007AFF', borderRadius: 14, padding: '5px 14px', fontSize: 12, fontWeight: 600, textAlign: 'center', maxWidth: '82%' }}>
                    {sm.content || 'Mise à jour'}
                  </div>
                </div>
              )
            }
            const { message: msg, isMine, compactTop, showName, showAvatar } = row
            const senderName = msg.user_id ? profileDisplayName(msg.profile) : DELETED_USER_LABEL
            const canReport = !isMine && !msg.isOptimistic && !msg.is_hidden
            const showCoordinatorBadge = isSecret && guestLeaderIds.has(msg.profile?.id) && !isMine
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: compactTop ? 2 : 10 }}>
                {!isMine && showName && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRAY1, marginBottom: 3, paddingLeft: 36, display: 'flex', alignItems: 'center' }}>
                    {senderName}
                    {showCoordinatorBadge && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#e055aa', background: 'rgba(224,85,170,0.10)', padding: '2px 7px', borderRadius: 20, marginLeft: 5 }}>
                        ✦ Coordinateur
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '78%' }}>
                  {!isMine && (showAvatar ? <Avatar name={senderName} url={msg.profile?.avatar_url} size={28} isCloseFriend={closeFriendIds.has(msg.profile?.id)} /> : <div style={{ width: 28, flexShrink: 0 }} />)}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', minWidth: 0 }}>
                    <div
                      onMouseDown={() => canReport && startLongPress(msg)}
                      onMouseUp={clearLongPress}
                      onMouseLeave={clearLongPress}
                      onTouchStart={() => canReport && startLongPress(msg)}
                      onTouchEnd={clearLongPress}
                      onTouchMove={clearLongPress}
                      onTouchCancel={clearLongPress}
                      onContextMenu={e => { if (canReport) { e.preventDefault(); setActionMessage(msg) } }}
                      style={{ padding: '9px 13px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMine ? GRADIENT : WHITE, color: isMine ? WHITE : msg.is_hidden ? GRAY1 : BLACK, fontStyle: msg.is_hidden ? 'italic' : 'normal', fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap', opacity: msg.isOptimistic ? 0.7 : 1, boxShadow: isMine ? 'none' : '0 1px 6px rgba(0,0,0,0.08)', userSelect: canReport ? 'none' : 'auto', WebkitUserSelect: canReport ? 'none' : 'auto', WebkitTouchCallout: 'none' }}
                    >
                      {msg.is_hidden ? 'Message masqué' : msg.content}
                    </div>
                    <div style={{ fontSize: 10, color: GRAY1, marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {actionMessage && (
        <MessageSafetySheet
          targetType="event_message"
          messageId={actionMessage.id}
          authorId={actionMessage.user_id}
          authorName={profileDisplayName(actionMessage.profile)}
          onClose={() => setActionMessage(null)}
          onBlockedChange={() => onAuthorBlocked?.()}
        />
      )}

      <div style={{ padding: '10px 14px max(20px, env(safe-area-inset-bottom))', background: WHITE, display: 'flex', gap: 9, alignItems: 'flex-end', flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <MessageComposer ref={inputRef} value={input} onChange={setInput} onSend={handleSend} />
      </div>

      {showMembers && (
        <ChatMembersSheet
          event={event}
          currentUserId={currentUserId}
          isSecret={isSecret}
          birthdayPersonFirstName={birthdayPersonFirstName}
          onClose={() => setShowMembers(false)}
          onSelectMember={guest => setSelectedMember(guest)}
          onOpenEvent={() => { setShowMembers(false); onOpenEvent?.(event) }}
        />
      )}
      {selectedMember && (
        <DirectFriendProfileSheet
          friend={{ friend_id: selectedMember.user_id, friend_name: selectedMember.display_name, friend_avatar: selectedMember.avatar_url || '' }}
          currentUserId={currentUserId}
          onClose={() => setSelectedMember(null)}
          onSendMessage={onSendDirectMessage}
        />
      )}
    </div>
  )
}
