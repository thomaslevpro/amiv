import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isBlockedByMe, unblockUser } from '../lib/safety'
import { useMessageGestures } from '../hooks/useMessageGestures'
import { useMessageReactions } from '../hooks/useMessageReactions'
import { ReportSheet, UserSafetySheet } from '../components/safety/SafetySheets'
import DirectFriendProfileSheet from '../components/messages/DirectFriendProfileSheet'
import { CloseFriendBadge } from '../components/messages/MessageUI'
import MessageActionOverlay, { copyText } from '../components/messages/MessageActionOverlay'
import { NO_NATIVE_PRESS, ReactionPills, ReplyBar, ReplyQuote } from '../components/messages/MessageReactions'
import { forgetSentMessage, recordSentMessage } from '../components/messages/utils'
import MessageComposer from '../components/messages/MessageComposer'
import { fullName } from '../utils/displayName'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'
const PAGE_BG = '#FFFFFF'
const BG = '#F5F5F5'
const WHITE = '#FFFFFF'
const BLACK = '#1C1C1E'
const GRAY = '#8E8E93'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
const GROUP_INTERVAL_MS = 2 * 60 * 1000
const ONLINE_INTERVAL_MS = 5 * 60 * 1000
const MESSAGE_COLUMNS = 'id, conversation_id, content, created_at, sender_id, reply_to_id'

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function friendName(friend) {
  return fullName(friend?.friend_first_name, friend?.friend_name) || friend?.full_name || friend?.name || friend?.email || 'Ami'
}

function friendAvatar(friend) {
  return friend?.friend_avatar || friend?.avatar_url || ''
}

function friendId(friend) {
  return friend?.friend_id || friend?.id || friend?.user_id || null
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a, b) {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  return startOfDay(da).getTime() === startOfDay(db).getTime()
}

function formatDateSeparator(ts) {
  const date = new Date(ts)
  const now = new Date()
  const today = startOfDay(now)
  const messageDay = startOfDay(date)
  const diffDays = Math.round((today.getTime() - messageDay.getTime()) / 86400000)

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) {
    return `Hier, à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function formatPresence(lastReadAt) {
  if (!lastReadAt) return 'Vu récemment'
  const diff = Date.now() - new Date(lastReadAt).getTime()
  if (diff <= ONLINE_INTERVAL_MS) return 'En ligne'
  const hours = Math.max(1, Math.floor(diff / 3600000))
  if (hours < 24) return `Vu il y a ${hours}h`
  const days = Math.max(1, Math.floor(hours / 24))
  return `Vu il y a ${days}j`
}

function buildMessageRows(messages, currentUserId) {
  return messages.flatMap((msg, index) => {
    const previous = messages[index - 1]
    const next = messages[index + 1]
    const previousGrouped = previous
      && previous.sender_id === msg.sender_id
      && Math.abs(new Date(msg.created_at) - new Date(previous.created_at)) < GROUP_INTERVAL_MS
    const nextGrouped = next
      && next.sender_id === msg.sender_id
      && Math.abs(new Date(next.created_at) - new Date(msg.created_at)) < GROUP_INTERVAL_MS
    const showDate = index === 0 || !isSameDay(previous?.created_at, msg.created_at)
    const rows = []

    if (showDate) {
      rows.push({
        id: `date-${msg.id}`,
        type: 'date',
        label: formatDateSeparator(msg.created_at),
      })
    }

    rows.push({
      id: msg.id,
      type: 'message',
      message: msg,
      isMine: msg.sender_id === currentUserId,
      isGroupedWithNext: Boolean(nextGrouped),
      showAvatar: msg.sender_id !== currentUserId && !nextGrouped,
      compactTop: Boolean(previousGrouped),
    })

    return rows
  })
}

function Avatar({ name, url, size = 28, isCloseFriend = false }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'block', flexShrink: 0 }}>
      {url ? (
        <img
          src={url}
          alt={name}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: GRADIENT,
          color: WHITE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size >= 38 ? 14 : 11,
          fontWeight: 700,
        }}>
          {getInitials(name)}
        </span>
      )}
      {isCloseFriend && <CloseFriendBadge size={Math.max(14, Math.round(size * 0.34))} />}
    </span>
  )
}

function bubbleStyle({ isMine, isOptimistic, receivedBubbleBg, receivedTextColor }) {
  return {
    padding: '9px 14px',
    borderRadius: isMine ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
    background: isMine ? GRADIENT : receivedBubbleBg,
    color: isMine ? WHITE : receivedTextColor,
    fontSize: 15,
    lineHeight: 1.38,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    opacity: isOptimistic ? 0.72 : 1,
    ...NO_NATIVE_PRESS,
    boxSizing: 'border-box',
  }
}

async function markAsRead(conversationId, userId) {
  if (!conversationId || !userId) return
  await supabase
    .from('direct_conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('amiv:unread-counts-refresh'))
  }
}

export default function ConversationScreen({ conversationId, friend, onBack, onFriendChange }) {
  const [messages, setMessages] = useState([])
  const [otherLastReadAt, setOtherLastReadAt] = useState(null)
  const [input, setInput] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  // Appui long : { message, isMine, rect } de la bulle mise en avant
  const [actionTarget, setActionTarget] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [isDark, setIsDark] = useState(false)
  const [showFriendProfile, setShowFriendProfile] = useState(false)
  const [isCloseFriend, setIsCloseFriend] = useState(friend?.is_close_friend === true || friend?.isCloseFriend === true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [showSafety, setShowSafety] = useState(false)
  const [reportMessageId, setReportMessageId] = useState(null)
  const [sendError, setSendError] = useState(null)
  const [notice, setNotice] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const otherUserId = friendId(friend)
  // Sans autre participant, l'interlocuteur a supprimé son compte
  const isDeletedUser = !otherUserId

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setIsDark(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!conversationId) return
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`last_seen_dm_${conversationId}`, new Date().toISOString())
    }

    supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data ?? []))

    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`direct_messages:${conversationId}:${suffix}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          const withoutOptimistic = prev.filter(m => !(m.isOptimistic && m.sender_id === payload.new.sender_id && m.content === payload.new.content))
          return [...withoutOptimistic, payload.new]
        })
      )
      // Message supprimé par son auteur (seul l'id arrive, sans filtre possible sur un DELETE)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const deletedId = payload.old?.id
          if (deletedId) removeMessageLocally(deletedId)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !currentUserId) return

    supabase
      .rpc('get_dm_other_last_read', { p_conversation_id: conversationId })
      .then(({ data }) => setOtherLastReadAt(data ?? null))
  }, [conversationId, currentUserId])

  useEffect(() => {
    if (!otherUserId) return undefined
    let cancelled = false
    isBlockedByMe(otherUserId).then(blocked => { if (!cancelled) setIsBlocked(blocked) })
    return () => { cancelled = true }
  }, [otherUserId])

  useEffect(() => {
    setIsCloseFriend(friend?.is_close_friend === true || friend?.isCloseFriend === true)
  }, [friend?.is_close_friend, friend?.isCloseFriend])

  useEffect(() => {
    if (!currentUserId || !otherUserId) return undefined
    let cancelled = false

    async function refreshFriendship() {
      const { data } = await supabase
        .from('friendships')
        .select('id, is_close_friend')
        .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${otherUserId}),and(addressee_id.eq.${currentUserId},requester_id.eq.${otherUserId})`)
        .eq('status', 'accepted')
        .maybeSingle()
      if (!cancelled) setIsCloseFriend(data?.is_close_friend === true)
    }

    refreshFriendship()
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`direct-friendship:${currentUserId}:${otherUserId}:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, payload => {
        const row = payload.new || payload.old
        if (
          (row?.requester_id === currentUserId && row?.addressee_id === otherUserId)
          || (row?.addressee_id === currentUserId && row?.requester_id === otherUserId)
        ) refreshFriendship()
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [currentUserId, otherUserId])

  useEffect(() => {
    if (typeof window === 'undefined' || !otherUserId) return undefined
    const handleCloseFriendUpdate = event => {
      if (event.detail?.friendId === otherUserId) setIsCloseFriend(event.detail.isCloseFriend === true)
    }
    window.addEventListener('amiv:close-friend-updated', handleCloseFriendUpdate)
    return () => window.removeEventListener('amiv:close-friend-updated', handleCloseFriendUpdate)
  }, [otherUserId])

  function handleCloseFriendChange(nextValue) {
    setIsCloseFriend(nextValue)
    onFriendChange?.({ ...friend, is_close_friend: nextValue, isCloseFriend: nextValue })
  }

  const { reactionsByMessage, myEmojis, toggleReaction, forgetMessage: forgetReactions, restore: restoreReactions, reactions } = useMessageReactions({
    table: 'message_reactions',
    messages,
    currentUserId,
    channelKey: conversationId,
  })
  const { bubbleHandlers } = useMessageGestures({
    onLongPress: (msg, element) => setActionTarget({ message: msg, isMine: msg.sender_id === currentUserId, rect: element.getBoundingClientRect() }),
    onDoubleTap: msg => toggleReaction(msg.id, '❤️'),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (conversationId && typeof window !== 'undefined') {
      window.localStorage.setItem(`last_seen_dm_${conversationId}`, new Date().toISOString())
    }
    markAsRead(conversationId, currentUserId)
  }, [messages, conversationId, currentUserId])

  async function handleSend() {
    const text = input.trim()
    if (!text || !currentUserId) return
    const quoted = replyTo
    const optimistic = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
      reply_to_id: quoted?.id ?? null,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }
    setInput('')
    setReplyTo(null)
    // Garde le clavier ouvert pour enchaîner (focus synchrone : iOS l'exige dans le geste)
    if (document.activeElement !== inputRef.current) inputRef.current?.focus()
    setMessages(prev => [...prev, optimistic])
    const { data: sent, error } = await supabase.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
      reply_to_id: optimistic.reply_to_id,
    }).select(MESSAGE_COLUMNS).maybeSingle()
    if (!error) recordSentMessage('direct_messages', sent ?? { ...optimistic, isOptimistic: undefined })
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setInput(text)
      setReplyTo(quoted)
      // Refusé en base si l'un de vous a bloqué l'autre (trigger guard_direct_message_block)
      showError("Impossible d'envoyer ce message.")
    }
  }

  function showError(text) {
    setSendError(text)
    window.setTimeout(() => setSendError(null), 2600)
  }

  function showNotice(text) {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 1600)
  }

  async function handleUnblock() {
    try {
      await unblockUser(otherUserId)
      setIsBlocked(false)
    } catch {
      showError('Impossible de débloquer pour le moment.')
    }
  }

  const rows = useMemo(
    () => buildMessageRows(messages, currentUserId),
    [messages, currentUserId]
  )

  // Retire un message (supprimé ici ou par l'autre) : ses réactions partent
  // avec en base, une réponse qui le citait perd sa citation.
  function removeMessageLocally(messageId) {
    setMessages(prev => (prev.some(m => m.id === messageId) ? prev.filter(m => m.id !== messageId) : prev))
    forgetReactions(messageId)
    setReplyTo(prev => (prev?.id === messageId ? null : prev))
    setActionTarget(prev => (prev?.message.id === messageId ? null : prev))
  }

  const closeActions = useCallback(() => setActionTarget(null), [])

  function handleReact(emoji) {
    const target = actionTarget
    setActionTarget(null)
    if (target) toggleReaction(target.message.id, emoji)
  }

  function handleReply() {
    const target = actionTarget
    setActionTarget(null)
    if (!target) return
    setReplyTo(target.message)
    // Synchrone, dans le geste : sinon iOS n'ouvre pas le clavier
    inputRef.current?.focus()
  }

  async function handleCopy() {
    const target = actionTarget
    setActionTarget(null)
    if (!target) return
    if (await copyText(target.message.content ?? '')) showNotice('Message copié')
    else showError('Impossible de copier ce message.')
  }

  function handleReport() {
    const target = actionTarget
    setActionTarget(null)
    if (target) setReportMessageId(target.message.id)
  }

  async function handleDelete() {
    const target = actionTarget
    setActionTarget(null)
    if (!target) return
    const removed = target.message
    const removedReactions = reactions.filter(r => r.message_id === removed.id)
    removeMessageLocally(removed.id)
    forgetSentMessage(removed.id)
    const { data, error } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', removed.id)
      .select('id')
    if (error || !data?.length) {
      setMessages(prev => [...prev, removed].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      restoreReactions(removedReactions)
      showError('Impossible de supprimer ce message.')
    }
  }

  const otherName = friendName(friend)
  const otherAvatar = friendAvatar(friend)
  const presence = formatPresence(otherLastReadAt)
  const receivedBubbleBg = isDark ? '#3A3A3C' : '#EBEBEB'
  const receivedTextColor = isDark ? WHITE : BLACK

  const messagesById = new Map(messages.map(m => [m.id, m]))
  const bubbleColors = { receivedBubbleBg, receivedTextColor }

  function renderBubbleContent(msg, isMine) {
    const quoted = msg.reply_to_id ? messagesById.get(msg.reply_to_id) : null
    return (
      <>
        {quoted && (
          <ReplyQuote
            quotedName={quoted.sender_id === currentUserId ? 'Toi' : otherName}
            content={quoted.content}
            isMine={isMine}
          />
        )}
        {msg.content}
      </>
    )
  }

  const actionMessage = actionTarget?.message
  const myEmojisOnAction = myEmojis(actionMessage?.id)

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: PAGE_BG, overflow: 'hidden', fontFamily: FONT }}
    >

      {/* Header : tap sur la personne → Voir le profil, Bloquer, Signaler */}
      <div style={{
        padding: '9px 12px', background: WHITE,
        borderBottom: '0.5px solid rgba(0,0,0,0.08)',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          style={{
            width: 34,
            height: 34,
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            color: BLACK,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={27} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          aria-label={`Options pour ${otherName}`}
          onClick={() => setShowSafety(true)}
          disabled={isDeletedUser}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            padding: 0,
            margin: 0,
            cursor: isDeletedUser ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
            fontFamily: FONT,
          }}
        >
          <Avatar name={otherName} url={otherAvatar} size={38} isCloseFriend={isCloseFriend} />
          <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 800, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {otherName}
            </span>
            <span style={{ display: 'block', marginTop: 1, fontSize: 12, color: GRAY, fontWeight: 500 }}>
              {isDeletedUser ? 'Compte supprimé' : presence}
            </span>
          </span>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 12px 16px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: GRAY, fontSize: 14, marginTop: 40 }}>
            Aucun message, dites bonjour
          </div>
        ) : (
          rows.map(row => {
            if (row.type === 'date') {
              return (
                <div
                  key={row.id}
                  style={{ textAlign: 'center', color: GRAY, fontSize: 11, fontWeight: 600, margin: '12px 0' }}
                >
                  {row.label}
                </div>
              )
            }

            const { message: msg, isMine, isGroupedWithNext, showAvatar, compactTop } = row
            const messageReactions = Object.values(reactionsByMessage[msg.id] ?? {})
            const isHighlighted = actionMessage?.id === msg.id
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end',
                  gap: 7,
                  marginTop: compactTop ? 2 : 7,
                  marginBottom: isGroupedWithNext ? 2 : 6,
                }}
              >
                {!isMine && (
                  showAvatar
                    ? <Avatar name={otherName} url={otherAvatar} size={28} isCloseFriend={isCloseFriend} />
                    : <div style={{ width: 28, flexShrink: 0 }} />
                )}
                <div
                  style={{
                    position: 'relative',
                    maxWidth: '72%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    data-message-id={msg.id}
                    {...bubbleHandlers(msg, !msg.isOptimistic)}
                    style={{
                      ...bubbleStyle({ isMine, isOptimistic: msg.isOptimistic, ...bubbleColors }),
                      // La copie mise en avant dans l'overlay la remplace à l'écran
                      visibility: isHighlighted ? 'hidden' : 'visible',
                    }}
                  >
                    {renderBubbleContent(msg, isMine)}
                  </div>
                  <ReactionPills
                    reactions={messageReactions}
                    isMine={isMine}
                    onToggle={emoji => toggleReaction(msg.id, emoji)}
                  />
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {sendError && (
        <div style={{ padding: '8px 16px', background: '#FFF2F1', color: '#FF3B30', fontSize: 13, fontWeight: 700, textAlign: 'center', flexShrink: 0 }}>
          {sendError}
        </div>
      )}
      {notice && !sendError && (
        <div role="status" style={{ padding: '8px 16px', background: BG, color: BLACK, fontSize: 13, fontWeight: 700, textAlign: 'center', flexShrink: 0 }}>
          {notice}
        </div>
      )}

      {/* Input */}
      {isDeletedUser ? (
        <div style={{ padding: '14px 16px max(20px, env(safe-area-inset-bottom))', background: WHITE, flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)', textAlign: 'center', fontSize: 13, color: GRAY }}>
          Cette personne a supprimé son compte.
        </div>
      ) : isBlocked ? (
        <div style={{ padding: '14px 16px max(20px, env(safe-area-inset-bottom))', background: WHITE, flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)', textAlign: 'center', fontSize: 13, color: GRAY }}>
          Tu as bloqué cette personne.{' '}
          <button type="button" onClick={handleUnblock} style={{ border: 'none', background: 'transparent', color: '#e055aa', fontWeight: 700, fontSize: 13, padding: 0, cursor: 'pointer', fontFamily: FONT }}>
            Débloquer
          </button>
        </div>
      ) : (
      <div style={{ background: WHITE, flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        {replyTo && (
          <ReplyBar
            label={replyTo.sender_id === currentUserId ? 'Réponse à toi-même' : `Réponse à ${otherName}`}
            content={replyTo.content}
            onCancel={() => setReplyTo(null)}
          />
        )}
        <div style={{ padding: '10px 16px max(20px, env(safe-area-inset-bottom))', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <MessageComposer ref={inputRef} value={input} onChange={setInput} onSend={handleSend} paddingX={14} buttonSize={36} iconSize={16} />
        </div>
      </div>
      )}
      {actionTarget && (
        <MessageActionOverlay
          rect={actionTarget.rect}
          isMine={actionTarget.isMine}
          myEmojis={myEmojisOnAction}
          onReact={handleReact}
          onReply={handleReply}
          onCopy={handleCopy}
          onReport={handleReport}
          onDelete={handleDelete}
          onClose={closeActions}
        >
          <div style={{ ...bubbleStyle({ isMine: actionTarget.isMine, ...bubbleColors }), width: '100%', height: '100%' }}>
            {renderBubbleContent(actionTarget.message, actionTarget.isMine)}
          </div>
        </MessageActionOverlay>
      )}
      {showSafety && !isDeletedUser && (
        <UserSafetySheet
          userId={otherUserId}
          userName={otherName}
          isBlocked={isBlocked}
          onViewProfile={() => { setShowSafety(false); setShowFriendProfile(true) }}
          onClose={() => setShowSafety(false)}
          onBlockedChange={setIsBlocked}
        />
      )}
      {reportMessageId && (
        <ReportSheet
          targetType="direct_message"
          targetId={reportMessageId}
          subjectLabel="ce message"
          onClose={() => setReportMessageId(null)}
        />
      )}
      {showFriendProfile && !isDeletedUser && (
        <DirectFriendProfileSheet
          friend={friend}
          currentUserId={currentUserId}
          onCloseFriendChange={handleCloseFriendChange}
          onClose={() => setShowFriendProfile(false)}
        />
      )}
    </div>
  )
}
