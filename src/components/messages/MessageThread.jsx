import { useEffect, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, Lock, MapPin, MessageCircle } from 'lucide-react'
import { BG, BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { DELETED_USER_LABEL, formatEventHeaderDate, profileDisplayName } from './utils'
import { Avatar, EventCover } from './MessageUI'
import MessageComposer, { canSend } from './MessageComposer'
import ChatMembersSheet from './ChatMembersSheet'
import DirectFriendProfileSheet from './DirectFriendProfileSheet'
import { getCoverUrl } from '../home/MyEventsSection'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { MessageSafetySheet } from '../safety/SafetySheets'
import { secretConversationLabel, SECRET_ACCENT, SECRET_ACCENT_SOFT, secretTabForMessage } from '../../lib/secretSpace'

const LONG_PRESS_MS = 450

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageThread({
  event,
  onBack,
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
  onOpenSecretSpace = null,
  currentUserId = null,
  onOpenEvent,
  onSendDirectMessage,
}) {
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const keyboardOpen = useKeyboardOpen()
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

  // Clavier ouvert : la WebView rétrécit (resize: 'native'), la liste aussi.
  // On la recolle en bas pour garder les derniers messages sous les yeux.
  useEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return undefined
    let lastHeight = list.clientHeight
    const observer = new ResizeObserver(() => {
      if (list.clientHeight < lastHeight) list.scrollTop = list.scrollHeight
      lastHeight = list.clientHeight
    })
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  const roundButton = { width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }
  const chip = { background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '2px 8px', fontSize: 11, color: WHITE, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ background: 'linear-gradient(160deg, #e055aa 0%, #f5a623 100%)', flexShrink: 0, padding: keyboardOpen ? '6px 12px' : '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBack} aria-label="Retour" style={roundButton}>
            <ChevronLeft size={18} color={WHITE} strokeWidth={2.5} />
          </button>

          <button type="button" onClick={() => setShowMembers(true)} aria-label={`Participants de ${event.name}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
            {!keyboardOpen && (
              <span style={{ display: 'block', borderRadius: 11, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.55)', flexShrink: 0 }}>
                <EventCover coverUrl={getCoverUrl(event.cover_image)} size={40} />
              </span>
            )}
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: WHITE, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {event.name}
              </span>
              {!keyboardOpen && (
                <span style={{ display: 'flex', gap: 5, minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ ...chip, flexShrink: 0 }}>
                    <CalendarIcon size={11} strokeWidth={2} color={WHITE} />
                    {formatEventHeaderDate(event.date)}
                  </span>
                  {event.location && (
                    <span style={{ ...chip, minWidth: 0, overflow: 'hidden' }}>
                      <MapPin size={11} strokeWidth={2} color={WHITE} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.location}</span>
                    </span>
                  )}
                </span>
              )}
            </span>
          </button>

          {/* Jamais rendu pour la personne fêtée : onOpenSecretSpace est null pour elle (canLinkSecretSpace) */}
          {onOpenSecretSpace
            ? (
              <button type="button" onClick={() => onOpenSecretSpace()} aria-label="Ouvrir l'espace secret" style={roundButton}>
                <Lock size={16} color={WHITE} strokeWidth={2.5} />
              </button>
            )
            : <span aria-hidden="true" style={{ width: 32, flexShrink: 0 }} />}
        </div>

        {canUseSecretChannel && !keyboardOpen && (
          <div style={{ display: 'flex', gap: 4, padding: 3, marginTop: 10, borderRadius: 14, background: 'rgba(255,255,255,0.18)' }}>
            <button type="button" onClick={() => setIsSecret(false)} style={{ flex: 1, minHeight: 28, border: 'none', borderRadius: 11, background: !isSecret ? 'rgba(255,255,255,0.90)' : 'transparent', color: !isSecret ? BLACK : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer' }}>
              <MessageCircle size={13} strokeWidth={2} />
              Général
            </button>
            <button type="button" onClick={() => setIsSecret(true)} style={{ flex: 1, minHeight: 28, border: 'none', borderRadius: 11, background: isSecret ? 'rgba(255,255,255,0.90)' : 'transparent', color: isSecret ? SECRET_ACCENT : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer' }}>
              <Lock size={13} strokeWidth={2.2} />
              Secret
            </button>
          </div>
        )}
      </div>

      {isSecret && (
        <div style={{ background: SECRET_ACCENT_SOFT, color: SECRET_ACCENT, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <Lock size={12} strokeWidth={2.4} color={SECRET_ACCENT} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{secretConversationLabel(birthdayPersonFirstName)}</span>
        </div>
      )}

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column' }}>
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

      <div style={{ padding: keyboardOpen ? '8px 14px' : '10px 14px max(20px, env(safe-area-inset-bottom))', background: WHITE, display: 'flex', gap: 9, alignItems: 'flex-end', flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
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
