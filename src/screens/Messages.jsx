import { useState, useEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriends } from '../lib/friendships'
import { findOrCreateDirectConversation } from '../lib/conversations'
import StatusBar from '../components/StatusBar'
import FriendProfileModal from '../components/FriendProfileModal'

function getInitials(name) {
  return (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatConvTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function SkeletonRow({ isLast }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
        <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#F2F2F7', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: '55%', height: 14, borderRadius: 7, background: '#F2F2F7', marginBottom: 8 }} />
          <div style={{ width: '80%', height: 12, borderRadius: 6, background: '#F2F2F7' }} />
        </div>
      </div>
      {!isLast && <div style={{ marginLeft: 78, height: '0.5px', background: 'rgba(0,0,0,0.08)' }} />}
    </>
  )
}

function EmptyState({ onCreateClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 32px', gap: 12 }}>
      <MessageCircle size={56} strokeWidth={1.5} color="#AEAEB2" />
      <div style={{ fontSize: 17, fontWeight: 600, color: '#1C1C1E', textAlign: 'center' }}>Aucune conversation</div>
      <div style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center' }}>Les discussions de tes événements apparaîtront ici</div>
      {onCreateClick && (
        <div
          onClick={onCreateClick}
          style={{
            marginTop: 8, padding: '12px 24px', borderRadius: 24,
            background: 'linear-gradient(135deg,#e055aa,#f5a623)',
            fontSize: 15, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}
        >
          Créer un événement
        </div>
      )}
    </div>
  )
}

export default function Messages({ event, onBack, onEventOpen, onDirectConvOpen, notifications = [], markAsRead, onCreateClick }) {
  // --- chat state ---
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState(null)
  const bottomRef = useRef(null)

  // --- conversations list state ---
  const [conversations, setConversations] = useState([])
  const [listLoading, setListLoading] = useState(true)

  // --- friends strip state ---
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState(null)

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

  useEffect(() => {
    if (event || !userId) return
    fetchConversations()
    fetchFriends()
  }, [event, userId])

  async function fetchFriends() {
    setFriendsLoading(true)
    const { data } = await getFriends(userId)
    if (data) setFriends(data)
    setFriendsLoading(false)
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function fetchConversations() {
    setListLoading(true)

    const [{ data: rsvpRows }, { data: ownRows }] = await Promise.all([
      supabase.from('rsvps').select('event_id').eq('user_id', userId),
      supabase.from('events').select('id').eq('organizer_id', userId),
    ])

    const allIds = [...new Set([
      ...(rsvpRows?.map(r => r.event_id) ?? []),
      ...(ownRows?.map(e => e.id) ?? []),
    ])]

    if (!allIds.length) { setConversations([]); setListLoading(false); return }

    const [{ data: eventsData }, { data: msgs }] = await Promise.all([
      supabase.from('events').select('id, name, date').in('id', allIds),
      supabase.from('messages').select('id, event_id, content, created_at, user_id')
        .in('event_id', allIds)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    const lastMsgByEvent = {}
    msgs?.forEach(m => { if (!lastMsgByEvent[m.event_id]) lastMsgByEvent[m.event_id] = m })

    const convList = (eventsData ?? [])
      .filter(e => lastMsgByEvent[e.id])
      .map(e => ({ event: e, lastMessage: lastMsgByEvent[e.id] }))
      .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at))

    setConversations(convList)
    setListLoading(false)
  }

  function getUnreadCount(eventId) {
    return notifications.filter(n =>
      n.type === 'message_received' && !n.read && n.data?.event_id === eventId
    ).length
  }

  async function handleConversationTap(conv) {
    const unreadIds = notifications
      .filter(n => n.type === 'message_received' && !n.read && n.data?.event_id === conv.event.id)
      .map(n => n.id)
    for (const id of unreadIds) markAsRead?.(id)
    onEventOpen?.(conv.event)
  }

  async function send() {
    if (!input.trim() || !userId || !event?.id) return
    const content = input.trim()
    const { error } = await supabase.from('messages').insert({ event_id: event.id, user_id: userId, content })
    if (error) { console.log('Erreur Supabase:', JSON.stringify(error)); return }
    setInput('')
    await fetchMessages()
    const { error: notifErr } = await supabase.rpc('notify_message_recipients', {
      p_event_id:  event.id,
      p_sender_id: userId,
      p_title:     `Nouveau message dans ${event.name ?? 'un événement'}`,
      p_body:      content.length > 40 ? content.slice(0, 40) + '…' : content,
    })
    if (notifErr) console.error('[Notif] rpc error:', notifErr)
  }

  function formatTime(ts) {
    const d = new Date(ts)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  // ── CONVERSATIONS LIST ──────────────────────────────────────────────────────
  if (!event) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
        <StatusBar />
        <div style={{ padding: '12px 16px 14px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E' }}>Messages</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
          {/* ── Friends strip ─────────────────────────────────────── */}
          {!friendsLoading && (
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#8E8E93',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
              }}>
                Amis
              </div>
              {friends.length === 0 ? (
                <div style={{
                  background: '#fff', borderRadius: 14, padding: 12,
                  fontSize: 13, color: '#8E8E93', lineHeight: 1.4,
                }}>
                  Aucun ami pour l'instant — retrouvez vos suggestions sur l'accueil 👋
                </div>
              ) : (
                <div style={{
                  display: 'flex', gap: 16,
                  overflowX: 'auto', paddingBottom: 4,
                  scrollbarWidth: 'none',
                }}>
                  {friends.map(friend => (
                    <div key={friend.friend_id} onClick={() => setSelectedFriend(friend)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 4, flexShrink: 0, cursor: 'pointer',
                    }}>
                      {friend.friend_avatar ? (
                        <img
                          src={friend.friend_avatar}
                          alt={friend.friend_name}
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: '#FBBF9A',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 700, color: '#fff',
                        }}>
                          {getInitials(friend.friend_name)}
                        </div>
                      )}
                      <span style={{ fontSize: 11, color: '#8E8E93', textAlign: 'center', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(friend.friend_name ?? '').split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ──────────────────────────────────────────────────────── */}

          {listLoading ? (
            <div style={{ background: '#fff', borderRadius: 20, margin: '12px 16px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow isLast />
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState onCreateClick={onCreateClick} />
          ) : (
            <div style={{ background: '#fff', borderRadius: 20, margin: '12px 16px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
              {conversations.map((conv, i) => {
                const unread = getUnreadCount(conv.event.id)
                const isLast = i === conversations.length - 1
                return (
                  <div key={conv.event.id}>
                    <div
                      onClick={() => handleConversationTap(conv)}
                      style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12, cursor: 'pointer' }}
                    >
                      <div style={{
                        width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 700, color: '#fff',
                      }}>
                        {getInitials(conv.event.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                          <span style={{
                            fontSize: 15, fontWeight: unread ? 700 : 600, color: '#1C1C1E',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8,
                          }}>
                            {conv.event.name}
                          </span>
                          <span style={{ fontSize: 12, color: unread ? '#e055aa' : '#8E8E93', fontWeight: unread ? 600 : 400, flexShrink: 0 }}>
                            {formatConvTime(conv.lastMessage.created_at)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: 14, color: unread ? '#1C1C1E' : '#8E8E93',
                            fontWeight: unread ? 500 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                          }}>
                            {conv.lastMessage.content.length > 40
                              ? conv.lastMessage.content.slice(0, 40) + '…'
                              : conv.lastMessage.content}
                          </span>
                          {unread > 0 && (
                            <div style={{
                              minWidth: 18, height: 18, borderRadius: 9, background: '#FF3B30',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, marginLeft: 8,
                              padding: '0 4px',
                            }}>
                              {unread > 9 ? '9+' : unread}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isLast && <div style={{ marginLeft: 78, height: '0.5px', background: 'rgba(0,0,0,0.08)' }} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      {selectedFriend && (
        <FriendProfileModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onSendMessage={async (friend) => {
            console.log('[Messages] onSendMessage appelé', { userId, friendId: friend.friend_id })
            const { id, error } = await findOrCreateDirectConversation(userId, friend.friend_id)
            console.log('[Messages] findOrCreateDirectConversation résultat', { id, error })
            if (error) { console.error('[Messages] erreur', error); return }
            setSelectedFriend(null)
            console.log('[Messages] appel onDirectConvOpen', { conversationId: id, friend })
            onDirectConvOpen?.({ conversationId: id, friend })
          }}
        />
      )}
      </div>
    )
  }

  // ── CHAT VIEW ───────────────────────────────────────────────────────────────
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
