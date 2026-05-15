import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'
const PAGE_BG = '#faf9fb'
const BG = '#F2F2F7'
const WHITE = '#FFFFFF'
const BLACK = '#1C1C1E'
const GRAY = '#8E8E93'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
const LONG_PRESS_MS = 400
const GROUP_INTERVAL_MS = 2 * 60 * 1000
const ONLINE_INTERVAL_MS = 5 * 60 * 1000
const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🎉']

function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function friendName(friend) {
  return friend?.friend_name || friend?.full_name || friend?.name || friend?.email || 'Ami'
}

function friendAvatar(friend) {
  return friend?.friend_avatar || friend?.avatar_url || ''
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

function aggregateReactions(reactions, currentUserId) {
  return reactions.reduce((acc, reaction) => {
    if (!acc[reaction.message_id]) acc[reaction.message_id] = {}
    if (!acc[reaction.message_id][reaction.emoji]) {
      acc[reaction.message_id][reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        reactedByMe: false,
      }
    }
    acc[reaction.message_id][reaction.emoji].count += 1
    if (reaction.user_id === currentUserId) {
      acc[reaction.message_id][reaction.emoji].reactedByMe = true
    }
    return acc
  }, {})
}

function Avatar({ name, url, size = 28 }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }}
      />
    )
  }

  return (
    <div style={{
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
      flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  )
}

function EmojiPicker({ onSelect }) {
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      bottom: 'calc(100% + 8px)',
      transform: 'translateX(-50%)',
      zIndex: 5,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '7px 8px',
      borderRadius: 24,
      background: WHITE,
      boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
      border: '0.5px solid rgba(0,0,0,0.08)',
    }}>
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          style={{
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            fontSize: 19,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

function ReactionPill({ reaction, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: reaction.reactedByMe ? '1.5px solid transparent' : '1px solid rgba(0,0,0,0.06)',
        background: reaction.reactedByMe
          ? `linear-gradient(${WHITE}, ${WHITE}) padding-box, ${GRADIENT} border-box`
          : WHITE,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        borderRadius: 14,
        padding: '2px 7px',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 12,
        lineHeight: 1.2,
        color: BLACK,
        cursor: 'pointer',
        fontFamily: FONT,
      }}
    >
      <span>{reaction.emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{reaction.count}</span>
    </button>
  )
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

export default function ConversationScreen({ conversationId, friend, onBack }) {
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState([])
  const [otherLastReadAt, setOtherLastReadAt] = useState(null)
  const [input, setInput] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  const [activePicker, setActivePicker] = useState(null)
  const [isDark, setIsDark] = useState(false)
  const bottomRef = useRef(null)
  const longPressRef = useRef(null)
  const messageIdsRef = useRef(new Set())

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
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !currentUserId) return

    supabase
      .from('direct_conversation_participants')
      .select('user_id, last_read_at')
      .eq('conversation_id', conversationId)
      .neq('user_id', currentUserId)
      .maybeSingle()
      .then(({ data }) => setOtherLastReadAt(data?.last_read_at ?? null))
  }, [conversationId, currentUserId])

  const messageIds = useMemo(
    () => messages.filter(msg => !msg.isOptimistic).map(msg => msg.id),
    [messages]
  )
  const messageIdsKey = messageIds.join(',')

  useEffect(() => {
    messageIdsRef.current = new Set(messageIds)
    if (!messageIds.length) {
      setReactions([])
      return
    }

    supabase
      .from('message_reactions')
      .select('id, message_id, user_id, emoji, created_at')
      .in('message_id', messageIds)
      .then(({ data }) => setReactions(data ?? []))
  }, [messageIdsKey])

  useEffect(() => {
    if (!conversationId) return undefined

    const refreshReactions = () => {
      const ids = Array.from(messageIdsRef.current)
      if (!ids.length) {
        setReactions([])
        return
      }
      supabase
        .from('message_reactions')
        .select('id, message_id, user_id, emoji, created_at')
        .in('message_id', ids)
        .then(({ data }) => setReactions(data ?? []))
    }

    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`message_reactions:${conversationId}:${suffix}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const messageId = payload.new?.message_id || payload.old?.message_id
          if (!messageId || messageIdsRef.current.has(messageId)) refreshReactions()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

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
    const optimistic = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }
    setInput('')
    setMessages(prev => [...prev, optimistic])
    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
    })
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    }
  }

  const rows = useMemo(
    () => buildMessageRows(messages, currentUserId),
    [messages, currentUserId]
  )
  const reactionsByMessage = useMemo(
    () => aggregateReactions(reactions, currentUserId),
    [reactions, currentUserId]
  )

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  function startLongPress(messageId) {
    clearLongPress()
    longPressRef.current = setTimeout(() => {
      setActivePicker(messageId)
    }, LONG_PRESS_MS)
  }

  async function toggleReaction(messageId, emoji) {
    if (!messageId || !currentUserId) return
    setActivePicker(null)

    const existing = reactions.find(reaction => (
      reaction.message_id === messageId
      && reaction.user_id === currentUserId
      && reaction.emoji === emoji
    ))

    if (existing) {
      setReactions(prev => prev.filter(reaction => reaction.id !== existing.id))
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existing.id)
      if (error) {
        setReactions(prev => [...prev, existing])
      }
      return
    }

    const optimistic = {
      id: `optimistic-${crypto.randomUUID()}`,
      message_id: messageId,
      user_id: currentUserId,
      emoji,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }
    setReactions(prev => [...prev, optimistic])
    const { data, error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: currentUserId, emoji })
      .select('id, message_id, user_id, emoji, created_at')
      .single()

    if (error) {
      setReactions(prev => prev.filter(reaction => reaction.id !== optimistic.id))
    } else if (data) {
      setReactions(prev => prev.map(reaction => reaction.id === optimistic.id ? data : reaction))
    }
  }

  const otherName = friendName(friend)
  const otherAvatar = friendAvatar(friend)
  const presence = formatPresence(otherLastReadAt)
  const receivedBubbleBg = isDark ? '#3A3A3C' : '#EBEBEB'
  const receivedTextColor = isDark ? WHITE : BLACK

  return (
    <div
      onClick={() => setActivePicker(null)}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: PAGE_BG, overflow: 'hidden', fontFamily: FONT }}
    >

      {/* Header */}
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

        <Avatar name={otherName} url={otherAvatar} size={38} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {otherName}
          </div>
          <div style={{ marginTop: 1, fontSize: 12, color: GRAY, fontWeight: 500 }}>
            {presence}
          </div>
        </div>

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
                    ? <Avatar name={otherName} url={otherAvatar} size={28} />
                    : <div style={{ width: 28, flexShrink: 0 }} />
                )}
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'relative',
                    maxWidth: '72%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
                  {activePicker === msg.id && !msg.isOptimistic && (
                    <EmojiPicker onSelect={emoji => toggleReaction(msg.id, emoji)} />
                  )}
                  <div
                    onMouseDown={() => !msg.isOptimistic && startLongPress(msg.id)}
                    onMouseUp={clearLongPress}
                    onMouseLeave={clearLongPress}
                    onTouchStart={() => !msg.isOptimistic && startLongPress(msg.id)}
                    onTouchEnd={clearLongPress}
                    onTouchCancel={clearLongPress}
                    style={{
                      padding: '9px 14px',
                      borderRadius: isMine ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
                      background: isMine ? GRADIENT : receivedBubbleBg,
                      color: isMine ? WHITE : receivedTextColor,
                      fontSize: 15,
                      lineHeight: 1.38,
                      wordBreak: 'break-word',
                      opacity: msg.isOptimistic ? 0.72 : 1,
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      cursor: msg.isOptimistic ? 'default' : 'pointer',
                    }}
                  >
                    {msg.content}
                  </div>
                  {messageReactions.length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                      gap: 4,
                      marginTop: 4,
                      paddingLeft: isMine ? 0 : 4,
                      paddingRight: isMine ? 4 : 0,
                    }}>
                      {messageReactions.map(reaction => (
                        <ReactionPill
                          key={reaction.emoji}
                          reaction={reaction}
                          onClick={() => toggleReaction(msg.id, reaction.emoji)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px 20px', background: WHITE, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Message..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20, background: BG,
            fontSize: 14, color: BLACK, border: 'none', outline: 'none', fontFamily: FONT,
          }}
        />
        <button
          type="button"
          aria-label="Envoyer"
          onClick={handleSend}
          style={{
            width: 36, height: 36,
            background: input.trim() ? GRADIENT : '#D1D1D6',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'default',
            transition: 'background 0.15s',
            border: 'none',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <Send size={16} color={WHITE} fill={WHITE} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
