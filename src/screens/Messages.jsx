import { useEffect, useMemo, useRef, useState } from 'react'
import ConversationList from '../components/messages/ConversationList'
import MessageThread from '../components/messages/MessageThread'
import { typeEmoji } from '../components/messages/constants'
import { buildEventMessageRows, directProfileDisplayName, enrichMessagesWithProfiles, fetchProfilesByIds, firstName, isConversationHidden, notificationConversationId, readChannelLastRead, readHiddenConversations, readSeen, writeChannelLastRead, writeHiddenConversations, writeSeen } from '../components/messages/utils'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useGuestLeader } from '../hooks/useGuestLeader'
import { findOrCreateDirectConversation } from '../lib/conversations'
import { getFriends } from '../lib/friendships'
import { supabase } from '../lib/supabase'

export default function Messages({ event, onBack, onEventOpen, onDirectConvOpen, notifications = [], markAsRead }) {
  const [messages, setMessages] = useState([]), [input, setInput] = useState('')
  const [userId, setUserId] = useState(null), [isSecret, setIsSecret] = useState(false)
  const [birthdayPersonProfile, setBirthdayPersonProfile] = useState(null), [myRsvpStatus, setMyRsvpStatus] = useState(null)
  const [currentUsername, setCurrentUsername] = useState('')
  const [conversations, setConversations] = useState([]), [listLoading, setListLoading] = useState(true)
  const [friends, setFriends] = useState([]), [friendsLoading, setFriendsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all'), [showNewMessage, setShowNewMessage] = useState(false)
  const [hiddenConversations, setHiddenConversations] = useState({})
  const [closeFriendIds, setCloseFriendIds] = useState(() => new Set())
  const [hiddenEventIds, setHiddenEventIds] = useState(() => (typeof window === 'undefined' ? new Set() : new Set(Object.keys(window.localStorage).filter(k => k.startsWith('hidden_event_')).map(k => k.slice('hidden_event_'.length)))))
  const bottomRef = useRef(null)
  const appOpenedAtRef = useRef(null)
  const messageNotificationVersion = notifications.filter(n => n.type === 'message_received' && !n.read).length
  const { unreadByConversation, totalUnread: unreadTotal } = useUnreadCounts(userId)
  const { guestLeaders } = useGuestLeader(event?.id)
  const guestLeaderIds = useMemo(() => new Set(guestLeaders.map(guestLeader => guestLeader.user_id)), [guestLeaders])
  const canUseSecretChannel = !!event?.birthday_person_user_id && !!userId && userId !== event.birthday_person_user_id
  const birthdayPersonFirstName = event?.birthdayFirstName || event?.birthday_person?.first_name || event?.birthdayPerson?.first_name || birthdayPersonProfile?.first_name || (birthdayPersonProfile?.name ? firstName(birthdayPersonProfile.name) : null) || 'La personne fêtée'

  useEffect(() => {
    if (typeof window !== 'undefined' && !appOpenedAtRef.current) {
      appOpenedAtRef.current = window.localStorage.getItem('last_app_opened_at') || new Date(0).toISOString()
      window.localStorage.setItem('last_app_opened_at', new Date().toISOString())
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setHiddenConversations(readHiddenConversations(user.id))
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, first_name, name')
        .eq('id', user.id)
        .maybeSingle()
      setCurrentUsername(profile?.username || profile?.first_name || profile?.name || user.email?.split('@')[0] || 'amiv')
    })
  }, [])

  useEffect(() => {
    if (!event?.id) return
    writeSeen(`last_seen_event_${event.id}`)
    writeChannelLastRead(event.id, isSecret)
    notifications.filter(n => n.type === 'message_received' && !n.read && n.data?.event_id === event.id).map(n => n.id).forEach(id => markAsRead?.(id))
    fetchMessages()
  }, [event?.id, isSecret])

  useEffect(() => { if (event?.id) { setIsSecret(event.initialIsSecret === true); setBirthdayPersonProfile(null) } }, [event?.id, event?.initialIsSecret])

  useEffect(() => {
    if (!event?.birthday_person_user_id) { setBirthdayPersonProfile(null); return undefined }
    if (event?.birthdayFirstName || event?.birthday_person?.first_name || event?.birthdayPerson?.first_name) return undefined
    let cancelled = false
    supabase.from('profiles').select('id, name, first_name').eq('id', event.birthday_person_user_id).maybeSingle().then(({ data }) => { if (!cancelled) setBirthdayPersonProfile(data ?? null) })
    return () => { cancelled = true }
  }, [event?.birthday_person_user_id, event?.birthdayFirstName, event?.birthday_person?.first_name, event?.birthdayPerson?.first_name])

  useEffect(() => { if (!canUseSecretChannel && isSecret) setIsSecret(false) }, [canUseSecretChannel, isSecret])

  useEffect(() => {
    if (!event?.id || !userId) { setMyRsvpStatus(null); return undefined }
    let cancelled = false
    supabase.from('rsvps').select('status').eq('event_id', event.id).eq('user_id', userId).maybeSingle().then(({ data }) => { if (!cancelled) setMyRsvpStatus(data?.status ?? null) })
    return () => { cancelled = true }
  }, [event?.id, userId])

  useEffect(() => {
    if (!event?.id || !userId) return undefined
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase.channel(`messages:${event.id}:${isSecret ? 'secret' : 'general'}:${suffix}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `is_secret=eq.${isSecret}` }, async (payload) => {
      if (payload.new.event_id !== event.id) return
      const { data, error } = await supabase.from('messages').select('*, profiles(id, name, first_name, avatar_url)').eq('id', payload.new.id).eq('is_secret', isSecret).single()
      let message = null
      if (error) {
        const fallback = await supabase.from('messages').select('*').eq('id', payload.new.id).eq('is_secret', isSecret).single()
        if (!fallback.data) return
        message = (await enrichMessagesWithProfiles([fallback.data]))[0]
      } else message = { ...data, profile: data.profiles ?? null }
      if (!message) return
      setMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev
        const withoutOptimistic = prev.filter(m => !(m.isOptimistic && m.user_id === message.user_id && m.content === message.content))
        return [...withoutOptimistic, message]
      })
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event?.id, userId, isSecret])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (!event && userId) fetchAll() }, [event, userId, messageNotificationVersion])

  useEffect(() => {
    if (!userId) return undefined
    refreshCloseFriendIds()
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`messages-friendships:${userId}:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, payload => {
        const row = payload.new || payload.old
        if (row?.requester_id === userId || row?.addressee_id === userId) {
          refreshCloseFriendIds()
          if (!event) fetchAll()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [event, userId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleCloseFriendUpdate = event => {
      const { friendId, isCloseFriend } = event.detail ?? {}
      if (!friendId) return
      applyCloseFriendUpdate(friendId, isCloseFriend === true)
    }
    window.addEventListener('amiv:close-friend-updated', handleCloseFriendUpdate)
    return () => window.removeEventListener('amiv:close-friend-updated', handleCloseFriendUpdate)
  }, [])

  useEffect(() => {
    if (event || !userId) return undefined
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase.channel(`messages-list:${userId}:${suffix}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchAll()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => fetchAll()).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event, userId])

  async function fetchAll() {
    setListLoading(true); setFriendsLoading(true)
    const friendRows = await getFriends(userId)
    const convRows = await fetchConversations(friendRows.data ?? [])
    setConversations(convRows); setFriends(friendRows.data ?? []); setListLoading(false); setFriendsLoading(false)
    setCloseFriendIds(new Set((friendRows.data ?? []).filter(friend => friend.is_close_friend === true).map(friend => friend.friend_id)))
  }

  async function refreshCloseFriendIds() {
    if (!userId) return
    const { data } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id, is_close_friend')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted')

    setCloseFriendIds(new Set((data ?? [])
      .filter(row => row.is_close_friend === true)
      .map(row => row.requester_id === userId ? row.addressee_id : row.requester_id)
      .filter(Boolean)))
  }

  function applyCloseFriendUpdate(friendId, isCloseFriend) {
    setCloseFriendIds(prev => {
      const next = new Set(prev)
      if (isCloseFriend) next.add(friendId)
      else next.delete(friendId)
      return next
    })
    setFriends(prev => prev.map(friend => (
      friend.friend_id === friendId ? { ...friend, is_close_friend: isCloseFriend } : friend
    )))
    setConversations(prev => prev.map(conv => (
      conv.kind === 'direct' && conv.friend?.friend_id === friendId
        ? {
            ...conv,
            isCloseFriend,
            friend: { ...conv.friend, is_close_friend: isCloseFriend, isCloseFriend },
          }
        : conv
    )))
  }

  async function fetchMessages() {
    const { data, error } = await supabase.from('messages').select('*, profiles(id, name, first_name, avatar_url)').eq('event_id', event.id).eq('is_secret', isSecret).order('created_at', { ascending: true })
    if (error) {
      const fallback = await supabase.from('messages').select('*').eq('event_id', event.id).eq('is_secret', isSecret).order('created_at', { ascending: true })
      if (fallback.error || !fallback.data) { console.error('[Messages] fetch messages error:', error, fallback.error); return }
      setMessages(await enrichMessagesWithProfiles(fallback.data)); return
    }
    if (data) setMessages(await enrichMessagesWithProfiles(data))
  }

  async function fetchEventConversations() {
    const [rsvpResult, { data: ownRows }] = await Promise.all([supabase.from('rsvps').select('event_id, last_read_at').eq('user_id', userId), supabase.from('events').select('id').eq('user_id', userId)])
    let rsvpRows = rsvpResult.data ?? []
    if (rsvpResult.error) rsvpRows = (await supabase.from('rsvps').select('event_id').eq('user_id', userId)).data ?? []
    const allIds = [...new Set([...(rsvpRows?.map(r => r.event_id) ?? []), ...(ownRows?.map(e => e.id) ?? [])])]
    if (!allIds.length) return []
    const [{ data: eventsData }, { data: msgs }] = await Promise.all([supabase.from('events').select('id, name, emoji, type, date, birthday_person_user_id, user_id').in('id', allIds), supabase.from('messages').select('id, event_id, content, created_at, user_id, is_secret').in('event_id', allIds).order('created_at', { ascending: false }).limit(500)])
    const lastByEvent = {}, generalLastByEvent = {}, secretLastByEvent = {}, generalUnreadByEvent = {}, secretUnreadByEvent = {}
    const lastReadByEvent = Object.fromEntries((rsvpRows ?? []).map(row => [row.event_id, row.last_read_at]))
    ;(msgs ?? []).forEach(message => {
      if (!lastByEvent[message.event_id]) lastByEvent[message.event_id] = message
      if (message.is_secret && !secretLastByEvent[message.event_id]) secretLastByEvent[message.event_id] = message
      if (!message.is_secret && !generalLastByEvent[message.event_id]) generalLastByEvent[message.event_id] = message
      const dbSeenAt = lastReadByEvent[message.event_id] ? new Date(lastReadByEvent[message.event_id]).getTime() : 0
      const channelSeenAt = Math.max(dbSeenAt, readChannelLastRead(message.event_id, message.is_secret))
      const seenAt = channelSeenAt || (message.is_secret ? 0 : readSeen(`last_seen_event_${message.event_id}`))
      if (message.user_id !== userId && new Date(message.created_at).getTime() > seenAt) {
        if (message.is_secret) secretUnreadByEvent[message.event_id] = (secretUnreadByEvent[message.event_id] || 0) + 1
        else generalUnreadByEvent[message.event_id] = (generalUnreadByEvent[message.event_id] || 0) + 1
      }
    })
    return (eventsData ?? []).map(ev => {
      const generalUnreadCount = generalUnreadByEvent[ev.id] || 0
      const secretUnreadCount = secretUnreadByEvent[ev.id] || 0
      const lastMessage = lastByEvent[ev.id] || null
      return { id: `event-${ev.id}`, kind: 'event', event: ev, eventId: ev.id, title: ev.name || 'Événement', emoji: ev.emoji || typeEmoji[ev.type] || '🎉', lastMessage: lastMessage || { content: 'Aucun message', created_at: ev.date }, generalMessage: generalLastByEvent[ev.id] || null, secretMessage: secretLastByEvent[ev.id] || null, lastAt: lastMessage?.created_at || ev.date, unreadCount: generalUnreadCount + secretUnreadCount, generalUnreadCount, secretUnreadCount }
    })
  }

  async function fetchDirectConversations(friendRows = []) {
    let { data: myParticipants, error: participantsError } = await supabase.from('direct_conversation_participants').select('conversation_id, is_muted, direct_conversations(created_at)').eq('user_id', userId)
    if (participantsError) myParticipants = (await supabase.from('direct_conversation_participants').select('conversation_id, direct_conversations(created_at)').eq('user_id', userId)).data
    const convIds = (myParticipants ?? []).map(row => row.conversation_id)
    if (!convIds.length) return []
    const [{ data: otherParticipants }, { data: directMessages }] = await Promise.all([supabase.rpc('get_conversation_other_participants', { conv_ids: convIds }), supabase.from('direct_messages').select('id, conversation_id, content, created_at, sender_id').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(500)])
    const otherByConv = {}
    ;(otherParticipants ?? []).forEach(row => { otherByConv[row.conversation_id] = row.other_user_id })
    const profiles = await fetchProfilesByIds([...new Set(Object.values(otherByConv).filter(Boolean))])
    const profileById = Object.fromEntries((profiles ?? []).map(profile => [profile.id, profile]))
    const friendById = Object.fromEntries((friendRows ?? []).map(friend => [friend.friend_id, friend]))
    const lastByConv = {}
    ;(directMessages ?? []).forEach(message => { if (!lastByConv[message.conversation_id]) lastByConv[message.conversation_id] = message })
    const participantByConv = Object.fromEntries((myParticipants ?? []).map(row => [row.conversation_id, row]))
    return convIds.map(conversationId => {
      const otherUserId = otherByConv[conversationId]
      const profile = profileById[otherUserId] ?? null
      const friend = friendById[otherUserId]
      const displayName = directProfileDisplayName(profile)
      const createdAt = participantByConv[conversationId]?.direct_conversations?.created_at
      const isCloseFriend = friend?.is_close_friend === true
      return {
        id: `dm-${conversationId}`,
        kind: 'direct',
        conversationId,
        friend: { friend_id: profile?.id || friend?.friend_id || otherUserId, friend_name: displayName, friend_avatar: profile?.avatar_url || friend?.friend_avatar || '', is_close_friend: isCloseFriend, isCloseFriend },
        title: displayName,
        avatarUrl: profile?.avatar_url || friend?.friend_avatar || '',
        lastMessage: lastByConv[conversationId] || { content: 'Aucun message', created_at: createdAt },
        lastAt: lastByConv[conversationId]?.created_at || createdAt,
        unreadCount: 0,
        isMuted: participantByConv[conversationId]?.is_muted === true,
        isCloseFriend,
      }
    })
  }

  async function fetchConversations(friendRows = []) {
    const [eventRows, directRows] = await Promise.all([fetchEventConversations(), fetchDirectConversations(friendRows)])
    return [...eventRows, ...directRows].sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
  }

  const conversationsByFriendId = useMemo(() => {
    const map = new Map()
    conversations.filter(conv => conv.kind === 'direct' && !isConversationHidden(conv, hiddenConversations)).forEach(conv => { if (conv.friend?.friend_id) map.set(conv.friend.friend_id, conv) })
    return map
  }, [conversations, hiddenConversations])
  const inboxConversations = conversations.filter(conv => !isConversationHidden(conv, hiddenConversations))
  const visibleConversations = inboxConversations.filter(conv => {
    if (conv.kind === 'event' && hiddenEventIds.has(String(conv.eventId))) return false
    if (activeTab === 'events') return conv.kind === 'event'
    if (activeTab === 'directs') return conv.kind === 'direct'
    if (activeTab === 'unread') return conv.unreadCount > 0
    return true
  })
  const eventMessageRows = useMemo(() => buildEventMessageRows(messages, userId), [messages, userId])

  function hideConversation(conversation) {
    setHiddenConversations(prev => {
      const next = { ...prev, [conversation.id]: new Date().toISOString() }
      writeHiddenConversations(userId, next)
      return next
    })
  }
  function showConversation(conversationId) {
    setHiddenConversations(prev => {
      if (!prev[conversationId]) return prev
      const next = { ...prev }
      delete next[conversationId]
      writeHiddenConversations(userId, next)
      return next
    })
  }
  function hideEventCard(eventId) {
    window.localStorage.setItem(`hidden_event_${eventId}`, '1')
    setHiddenEventIds(prev => new Set([...prev, String(eventId)]))
  }
  function showAllHiddenEvents() {
    Object.keys(window.localStorage).filter(k => k.startsWith('hidden_event_')).forEach(k => window.localStorage.removeItem(k))
    setHiddenEventIds(new Set())
  }
  async function openFriend(friend) {
    if (!userId || !friend?.friend_id) return
    const { id, error } = await findOrCreateDirectConversation(userId, friend.friend_id)
    if (error) { console.error('[Messages] direct conversation error:', error); return }
    showConversation(`dm-${id}`)
    writeSeen(`last_seen_dm_${id}`)
    setShowNewMessage(false)
    onDirectConvOpen?.({ conversationId: id, friend })
  }
  function openNewMessage() {
    if (!friendsLoading) setShowNewMessage(true)
  }
  async function handleConversationTap(conv, secretChannel = false) {
    if (conv.kind === 'event') {
      writeSeen(`last_seen_event_${conv.eventId}`)
      writeChannelLastRead(conv.eventId, secretChannel)
      for (const id of notifications.filter(n => n.type === 'message_received' && !n.read && n.data?.event_id === conv.eventId).map(n => n.id)) markAsRead?.(id)
      onEventOpen?.({ ...conv.event, initialIsSecret: secretChannel })
      return
    }
    writeSeen(`last_seen_dm_${conv.conversationId}`)
    for (const id of notifications.filter(n => n.type === 'message_received' && !n.read && notificationConversationId(n) === conv.conversationId).map(n => n.id)) markAsRead?.(id)
    onDirectConvOpen?.({ conversationId: conv.conversationId, friend: conv.friend })
  }
  async function send() {
    if (!input.trim() || !userId || !event?.id) return
    const content = input.trim()
    const optimistic = { id: crypto.randomUUID(), event_id: event.id, user_id: userId, content, created_at: new Date().toISOString(), profile: null, is_secret: isSecret, isOptimistic: true }
    setInput('')
    setMessages(prev => [...prev, optimistic])
    const { error } = await supabase.from('messages').insert({ event_id: event.id, user_id: userId, content, is_secret: isSecret })
    if (error) { setMessages(prev => prev.filter(message => message.id !== optimistic.id)); console.log('Erreur Supabase:', JSON.stringify(error)); return }
    if (isSecret) return
    const { error: notifErr } = await supabase.rpc('notify_message_recipients', { p_event_id: event.id, p_sender_id: userId, p_title: `Nouveau message dans ${event.name ?? 'un événement'}`, p_body: content.length > 40 ? content.slice(0, 40) + '…' : content })
    if (notifErr) console.error('[Notif] rpc error:', notifErr)
  }

  if (!event) return <ConversationList currentUsername={currentUsername} unreadTotal={unreadTotal} openNewMessage={openNewMessage} friendsLoading={friendsLoading} friends={friends} conversationsByFriendId={conversationsByFriendId} appOpenedAtRef={appOpenedAtRef} currentUserId={userId} activeTab={activeTab} setActiveTab={setActiveTab} hiddenEventIds={hiddenEventIds} showAllHiddenEvents={showAllHiddenEvents} listLoading={listLoading} visibleConversations={visibleConversations} unreadByConversation={unreadByConversation} handleConversationTap={handleConversationTap} hideEventCard={hideEventCard} hideConversation={hideConversation} showNewMessage={showNewMessage} setShowNewMessage={setShowNewMessage} openFriend={openFriend} onFriendAdded={fetchAll} />
  return <MessageThread event={event} onBack={onBack} myRsvpStatus={myRsvpStatus} canUseSecretChannel={canUseSecretChannel} isSecret={isSecret} setIsSecret={setIsSecret} birthdayPersonFirstName={birthdayPersonFirstName} messages={messages} eventMessageRows={eventMessageRows} bottomRef={bottomRef} input={input} setInput={setInput} send={send} guestLeaderIds={guestLeaderIds} closeFriendIds={closeFriendIds} />
}
