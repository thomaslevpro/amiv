import { useState } from 'react'
import StatusBar from '../components/StatusBar'
import { conversations } from '../data/mockData'

function ConversationView({ conv, onBack }) {
  const [msg, setMsg] = useState('')
  const [messages, setMessages] = useState(conv.messages)

  const send = () => {
    if (!msg.trim()) return
    setMessages([...messages, { me: true, text: msg }])
    setMsg('')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', color: '#007AFF', cursor: 'pointer', minWidth: 60 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontSize: 16 }}>Retour</span>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>
          {conv.name.split(' ').slice(0, 2).join(' ')}
        </div>
        <div style={{ minWidth: 60 }}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            maxWidth: '72%', padding: '10px 14px', fontSize: 14, lineHeight: 1.4,
            background: m.me ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#fff',
            color: m.me ? '#fff' : '#1C1C1E',
            borderRadius: m.me ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            alignSelf: m.me ? 'flex-end' : 'flex-start',
            boxShadow: m.me ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 16px 20px', background: '#fff', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
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

export default function Messages() {
  const [activeConv, setActiveConv] = useState(null)

  if (activeConv !== null) {
    return <ConversationView conv={conversations[activeConv]} onBack={() => setActiveConv(null)}/>
  }

  const unreadCount = conversations.filter(c => c.unread > 0).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        <div style={{ padding: '6px 2px 0', marginBottom: 16 }}>
          <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>Messages</div>
          <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{unreadCount} non lus</div>
        </div>

        {conversations.map((c, i) => (
          <div key={c.id} onClick={() => setActiveConv(i)} style={{
            background: '#fff', borderRadius: 16, padding: '14px', display: 'flex',
            alignItems: 'center', gap: 12, marginBottom: 10,
            boxShadow: '0 1px 8px rgba(0,0,0,0.07)', cursor: 'pointer',
          }}>
            <div style={{ width: 46, height: 46, background: '#FBBF9A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {c.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginBottom: 2 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#8E8E93' }}>{c.time}</div>
              {c.unread > 0 && (
                <div style={{
                  width: 20, height: 20, background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                }}>
                  {c.unread}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
