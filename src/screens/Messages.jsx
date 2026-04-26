import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import StatusBar from '../components/StatusBar'

export default function Messages({ event, onBack }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!event?.id) return
    fetchMessages()
  }, [event?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function send() {
    if (!input.trim() || !userId || !event?.id) return
    const content = input.trim()
    const { error } = await supabase.from('messages').insert({
      event_id: event.id,
      user_id: userId,
      content,
    })
    if (error) {
      console.log('Erreur Supabase:', JSON.stringify(error))
      return
    }
    setInput('')
    await fetchMessages()
    const { data: rsvps } = await supabase
      .from('rsvps')
      .select('user_id')
      .eq('event_id', event.id)
      .neq('user_id', userId)
    if (rsvps?.length) {
      await supabase.from('notifications').insert(
        rsvps.map(r => ({
          user_id: r.user_id,
          type: 'message_received',
          title: `Nouveau message dans ${event.name ?? 'un événement'}`,
          body: content.length > 60 ? content.slice(0, 57) + '…' : content,
          data: { event_id: event.id, sender_id: userId },
        }))
      )
    }
  }

  function formatTime(ts) {
    const d = new Date(ts)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ padding: '10px 16px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {onBack && (
          <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', color: '#007AFF', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize: 16 }}>Retour</span>
          </div>
        )}
        <div style={{ flex: 1, textAlign: onBack ? 'center' : 'left', fontSize: 18, fontWeight: 700, color: '#1C1C1E' }}>{event?.name ?? 'Messages'}</div>
        {onBack && <div style={{ width: 68 }} />}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, marginTop: 40 }}>
            Aucun message pour l'instant
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.user_id === userId
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '72%', padding: '10px 14px', fontSize: 14, lineHeight: 1.4,
                  background: isMe ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#fff',
                  color: isMe ? '#fff' : '#1C1C1E',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  boxShadow: isMe ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                }}>
                  {m.content}
                </div>
                <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
                  {formatTime(m.created_at)}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '10px 16px 20px', background: '#fff', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20, background: '#F2F2F7',
            fontSize: 14, color: '#1C1C1E', border: 'none', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <div onClick={send} style={{
          width: 36, height: 36, background: 'linear-gradient(135deg,#e055aa,#f5a623)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
