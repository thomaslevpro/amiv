import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, Lock, MapPin, MessageCircle } from 'lucide-react'
import { BG, BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { DELETED_USER_LABEL, formatEventHeaderDate, profileDisplayName } from './utils'
import { Avatar, EventCover } from './MessageUI'
import MessageComposer, { canSend } from './MessageComposer'
import ChatMembersSheet from './ChatMembersSheet'
import DirectFriendProfileSheet from './DirectFriendProfileSheet'
import { getCoverUrl } from '../home/MyEventsSection'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'
import { ReportSheet, UserSafetySheet } from '../safety/SafetySheets'
import MessageActionOverlay, { copyText } from './MessageActionOverlay'
import { NO_NATIVE_PRESS, ReactionPills, ReplyBar, ReplyQuote } from './MessageReactions'
import { useMessageGestures } from '../../hooks/useMessageGestures'
import { secretConversationLabel, SECRET_ACCENT, SECRET_ACCENT_SOFT, secretTabForMessage } from '../../lib/secretSpace'

const NO_REACTIONS = { reactionsByMessage: {}, myEmojis: () => new Set(), toggleReaction() {} }

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
  reactions = NO_REACTIONS,
  onDeleteMessage,
}) {
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const keyboardOpen = useKeyboardOpen()
  const [showMembers, setShowMembers] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  // Appui long : { message, isMine, rect } de la bulle mise en avant
  const [actionTarget, setActionTarget] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [reportMessageId, setReportMessageId] = useState(null)
  // Tap sur le nom ou la photo d'un auteur : Voir le profil, Bloquer, Signaler
  const [safetyAuthor, setSafetyAuthor] = useState(null)
  const [notice, setNotice] = useState(null)
  const { reactionsByMessage, myEmojis, toggleReaction } = reactions
  const { bubbleHandlers } = useMessageGestures({
    onLongPress: (msg, element) => setActionTarget({ message: msg, isMine: msg.user_id === currentUserId, rect: element.getBoundingClientRect() }),
    onDoubleTap: msg => toggleReaction(msg.id, '❤️'),
  })
  const messagesById = new Map(messages.map(m => [m.id, m]))

  // Message supprimé (ici ou par son auteur) : plus de réponse ni de menu dessus
  useEffect(() => {
    const ids = new Set(messages.map(m => m.id))
    setReplyTo(prev => (prev && !ids.has(prev.id) ? null : prev))
    setActionTarget(prev => (prev && !ids.has(prev.message.id) ? null : prev))
  }, [messages])

  async function handleSend() {
    if (!canSend(input)) return
    // Garde le clavier ouvert pour enchaîner (focus synchrone : iOS l'exige dans le geste)
    if (document.activeElement !== inputRef.current) inputRef.current?.focus()
    const quoted = replyTo
    setReplyTo(null)
    const sent = await send({ replyToId: quoted?.id ?? null })
    if (sent === false && quoted) setReplyTo(quoted)
  }

  function showNotice(text) {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 2000)
  }

  const closeActions = useCallback(() => setActionTarget(null), [])

  // Lit le message visé et referme le menu
  function takeAction() {
    const target = actionTarget
    setActionTarget(null)
    return target?.message ?? null
  }

  function handleReact(emoji) {
    const msg = takeAction()
    if (msg) toggleReaction(msg.id, emoji)
  }

  function handleReply() {
    const msg = takeAction()
    if (!msg) return
    setReplyTo(msg)
    // Synchrone, dans le geste : sinon iOS n'ouvre pas le clavier
    inputRef.current?.focus()
  }

  async function handleCopy() {
    const msg = takeAction()
    if (msg) showNotice(await copyText(msg.content ?? '') ? 'Message copié' : 'Impossible de copier ce message.')
  }

  function handleReport() {
    const msg = takeAction()
    if (msg) setReportMessageId(msg.id)
  }

  async function handleDelete() {
    const msg = takeAction()
    if (msg && onDeleteMessage && !(await onDeleteMessage(msg))) showNotice('Impossible de supprimer ce message.')
  }

  function authorName(msg) {
    if (msg.user_id === currentUserId) return 'Toi'
    return msg.user_id ? profileDisplayName(msg.profile) : DELETED_USER_LABEL
  }

  function openAuthor(msg) {
    if (!msg.user_id || msg.user_id === currentUserId) return
    setSafetyAuthor({ id: msg.user_id, name: profileDisplayName(msg.profile), avatarUrl: msg.profile?.avatar_url || '', isBlocked: msg.is_hidden === true })
  }

  function bubbleStyle(msg, isMine) {
    return { padding: '9px 13px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMine ? GRADIENT : WHITE, color: isMine ? WHITE : msg.is_hidden ? GRAY1 : BLACK, fontStyle: msg.is_hidden ? 'italic' : 'normal', fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', whiteSpace: 'pre-wrap', opacity: msg.isOptimistic ? 0.7 : 1, boxShadow: isMine ? 'none' : '0 1px 6px rgba(0,0,0,0.08)', boxSizing: 'border-box', ...NO_NATIVE_PRESS }
  }

  function renderBubbleContent(msg, isMine) {
    if (msg.is_hidden) return 'Message masqué'
    const quoted = msg.reply_to_id ? messagesById.get(msg.reply_to_id) : null
    return (
      <>
        {quoted && <ReplyQuote quotedName={authorName(quoted)} content={quoted.is_hidden ? 'Message masqué' : quoted.content} isMine={isMine} />}
        {msg.content}
      </>
    )
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
            const canAct = !msg.isOptimistic && !msg.is_hidden
            const canOpenAuthor = !isMine && !!msg.user_id
            const showCoordinatorBadge = isSecret && guestLeaderIds.has(msg.profile?.id) && !isMine
            const authorButton = { border: 'none', background: 'transparent', padding: 0, margin: 0, fontFamily: FONT, cursor: canOpenAuthor ? 'pointer' : 'default' }
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: compactTop ? 2 : 10 }}>
                {!isMine && showName && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: GRAY1, marginBottom: 3, paddingLeft: 36, display: 'flex', alignItems: 'center' }}>
                    <button type="button" disabled={!canOpenAuthor} onClick={() => openAuthor(msg)} style={{ ...authorButton, fontSize: 11, fontWeight: 700, color: GRAY1 }}>
                      {senderName}
                    </button>
                    {showCoordinatorBadge && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#e055aa', background: 'rgba(224,85,170,0.10)', padding: '2px 7px', borderRadius: 20, marginLeft: 5 }}>
                        ✦ Coordinateur
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '78%' }}>
                  {!isMine && (showAvatar
                    ? (
                      <button type="button" disabled={!canOpenAuthor} onClick={() => openAuthor(msg)} aria-label={canOpenAuthor ? `Options pour ${senderName}` : undefined} style={{ ...authorButton, borderRadius: '50%', flexShrink: 0, alignSelf: 'flex-start', marginTop: 'auto' }}>
                        <Avatar name={senderName} url={msg.profile?.avatar_url} size={28} isCloseFriend={closeFriendIds.has(msg.profile?.id)} />
                      </button>
                    )
                    : <div style={{ width: 28, flexShrink: 0 }} />)}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', minWidth: 0 }}>
                    <div
                      data-message-id={msg.id}
                      {...bubbleHandlers(msg, canAct)}
                      style={{ ...bubbleStyle(msg, isMine), visibility: actionTarget?.message.id === msg.id ? 'hidden' : 'visible' }}
                    >
                      {renderBubbleContent(msg, isMine)}
                    </div>
                    <ReactionPills
                      reactions={Object.values(reactionsByMessage[msg.id] ?? {})}
                      isMine={isMine}
                      onToggle={emoji => toggleReaction(msg.id, emoji)}
                    />
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

      {notice && (
        <div role="status" style={{ padding: '8px 16px', background: BG, color: BLACK, fontSize: 13, fontWeight: 700, textAlign: 'center', flexShrink: 0 }}>
          {notice}
        </div>
      )}

      <div style={{ background: WHITE, flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        {replyTo && (
          <ReplyBar
            label={replyTo.user_id === currentUserId ? 'Réponse à toi-même' : `Réponse à ${authorName(replyTo)}`}
            content={replyTo.content}
            onCancel={() => setReplyTo(null)}
          />
        )}
        <div style={{ padding: keyboardOpen ? '8px 14px' : '10px 14px max(20px, env(safe-area-inset-bottom))', display: 'flex', gap: 9, alignItems: 'flex-end' }}>
          <MessageComposer ref={inputRef} value={input} onChange={setInput} onSend={handleSend} />
        </div>
      </div>

      {actionTarget && (
        <MessageActionOverlay
          rect={actionTarget.rect}
          isMine={actionTarget.isMine}
          myEmojis={myEmojis(actionTarget.message.id)}
          onReact={handleReact}
          onReply={handleReply}
          onCopy={handleCopy}
          onReport={handleReport}
          onDelete={handleDelete}
          onClose={closeActions}
        >
          <div style={{ ...bubbleStyle(actionTarget.message, actionTarget.isMine), width: '100%', height: '100%' }}>
            {renderBubbleContent(actionTarget.message, actionTarget.isMine)}
          </div>
        </MessageActionOverlay>
      )}
      {reportMessageId && (
        <ReportSheet targetType="event_message" targetId={reportMessageId} subjectLabel="ce message" onClose={() => setReportMessageId(null)} />
      )}
      {safetyAuthor && (
        <UserSafetySheet
          userId={safetyAuthor.id}
          userName={safetyAuthor.name}
          isBlocked={safetyAuthor.isBlocked}
          onViewProfile={() => {
            setSafetyAuthor(null)
            setSelectedMember({ user_id: safetyAuthor.id, display_name: safetyAuthor.name, avatar_url: safetyAuthor.avatarUrl })
          }}
          onClose={() => setSafetyAuthor(null)}
          onBlockedChange={() => onAuthorBlocked?.()}
        />
      )}

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
