import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

function getInitials(name) {
  return (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function friendName(friend) {
  return friend?.friend_name || friend?.full_name || friend?.name || friend?.email || 'Ami'
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
  const [input, setInput] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null)
    })
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px', background: '#fff',
        borderBottom: '0.5px solid rgba(0,0,0,0.08)',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', color: '#007AFF', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontSize: 16 }}>Retour</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {friend?.friend_avatar ? (
            <img
              src={friend.friend_avatar}
              alt={friendName(friend)}
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg,#e055aa,#f5a623)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {getInitials(friendName(friend))}
            </div>
          )}
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>
            {friendName(friend)}
          </span>
        </div>

        <div style={{ width: 68, flexShrink: 0 }} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, marginTop: 40 }}>
            Aucun message, dites bonjour 👋
          </div>
        ) : (
          messages.map(msg => {
            const isMine = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '72%',
                  padding: '9px 14px',
                  borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: isMine
                    ? 'linear-gradient(135deg,#e055aa,#f5a623)'
                    : '#fff',
                  color: isMine ? '#fff' : '#1C1C1E',
                  fontSize: 15,
                  lineHeight: 1.4,
                  boxShadow: isMine ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px 20px', background: '#fff', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Message..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20, background: '#F2F2F7',
            fontSize: 14, color: '#1C1C1E', border: 'none', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <div
          onClick={handleSend}
          style={{
            width: 36, height: 36,
            background: input.trim() ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#D1D1D6',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" />
          </svg>
        </div>
      </div>
    </div>
  )
}
