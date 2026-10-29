import { useEffect, useMemo, useRef, useState } from 'react'
import ConversationList from '../components/messages/ConversationList'
import MessageThread from '../components/messages/MessageThread'
import { typeEmoji } from '../components/messages/constants'
import { applyIncomingMessage, buildEventMessageRows, DELETED_USER_LABEL, directProfileDisplayName, enrichMessagesWithProfiles, fetchProfilesByIds, firstName, applySentMessages, isConversationHidden, notificationConversationId, recordSentMessage, readChannelLastRead, readHiddenConversations, readSeen, sortConversationsByActivity, sortConversationsForInbox, writeChannelLastRead, writeHiddenConversations, writeSeen } from '../components/messages/utils'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { useGuestLeader } from '../hooks/useGuestLeader'
import { findOrCreateDirectConversation } from '../lib/conversations'
import { getFriends } from '../lib/friendships'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import { captureSupabaseError } from '../lib/monitoring'

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
  const [deletedEventConversationIds, setDeletedEventConversationIds] = useState(() => (typeof window === 'undefined' ? new Set() : new Set(Object.keys(window.localStorage).filter(k => k.startsWith('deleted_event_conversation_')).map(k => k.slice('deleted_event_conversation_'.length)))))
  const bottomRef = useRef(null)
  const appOpenedAtRef = useRef(null)
  const listLoadedRef = useRef(false), fetchAllRequestRef = useRef(0)
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
    const handleMessageSent = sentEvent => {
      const { table, message } = sentEvent.detail ?? {}
      if (table && message) setConversations(prev => applyIncomingMessage(prev, table, message))
    }
    window.addEventListener('amiv:message-sent', handleMessageSent)
    return () => window.removeEventListener('amiv:message-sent', handleMessageSent)
  }, [])

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
    const channel = supabase.channel(`messages-list:${userId}:${suffix}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => onListMessage('messages', payload.new)).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => onListMessage('direct_messages', payload.new)).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event, userId])

  // Squelette au premier chargement seulement : les rechargements (message
  // reçu, ami ajouté…) remplacent la liste sans la faire clignoter. Une
  // réponse plus ancienne que la dernière demandée est ignorée.
  async function fetchAll() {
    const requestId = ++fetchAllRequestRef.current
    if (!listLoadedRef.current) { setListLoading(true); setFriendsLoading(true) }
    const friendRows = await getFriends(userId)
    const convRows = await fetchConversations(friendRows.data ?? [])
    if (requestId !== fetchAllRequestRef.current) return
    listLoadedRef.current = true
    setConversations(applySentMessages(convRows)); setFriends(friendRows.data ?? []); setListLoading(false); setFriendsLoading(false)
    setCloseFriendIds(new Set((friendRows.data ?? []).filter(friend => friend.is_close_friend === true).map(friend => friend.friend_id)))
  }

  function onListMessage(table, message) {
    setConversations(prev => applyIncomingMessage(prev, table, message))
    fetchAll()
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
    // Les messages des personnes que j'ai bloquées arrivent sans contenu (is_hidden)
    const { data, error } = await supabase.rpc('get_event_messages', { p_event_id: event.id, p_is_secret: isSecret })
    if (error) { console.error('[Messages] fetch messages error:', error); captureSupabaseError(error, { operation: 'fetch_event_messages' }); return }
    setMessages(await enrichMessagesWithProfiles(data ?? []))
  }

  async function fetchEventConversations() {
    const [rsvpResult, { data: ownRows }] = await Promise.all([supabase.from('rsvps').select('event_id, status, last_read_at').eq('user_id', userId), supabase.from('events').select('id').eq('user_id', userId)])
    let rsvpRows = rsvpResult.data ?? []
    if (rsvpResult.error) rsvpRows = (await supabase.from('rsvps').select('event_id, status').eq('user_id', userId)).data ?? []
    // Invitation refusée : la conversation disparaît (elle revient si j'accepte)
    const joinedIds = rsvpRows.filter(r => r.status !== 'declined').map(r => r.event_id)
    const allIds = [...new Set([...joinedIds, ...(ownRows?.map(e => e.id) ?? [])])]
    if (!allIds.length) return []
    const [{ data: eventsData }, { data: msgs }] = await Promise.all([supabase.from('events').select('id, name, emoji, type, date, location, cover_image, created_at, birthday_person_user_id, user_id').in('id', allIds), supabase.from('messages').select('id, event_id, content, created_at, user_id, is_secret').in('event_id', allIds).order('created_at', { ascending: false }).limit(500)])
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
      return { id: `event-${ev.id}`, kind: 'event', event: ev, eventId: ev.id, title: ev.name || 'Événement', emoji: ev.emoji || typeEmoji[ev.type] || '🎉', lastMessage: lastMessage || { content: 'Aucun message', created_at: ev.created_at }, generalMessage: generalLastByEvent[ev.id] || null, secretMessage: secretLastByEvent[ev.id] || null, lastAt: lastMessage?.created_at || ev.created_at, unreadCount: generalUnreadCount + secretUnreadCount, generalUnreadCount, secretUnreadCount }
    })
  }

  async function fetchDirectConversations(friendRows = []) {
    let { data: myParticipants, error: participantsError } = await supabase.from('direct_conversation_participants').select('conversation_id, is_muted, direct_conversations(created_at)').eq('user_id', userId)
    if (participantsError) myParticipants = (await supabase.from('direct_conversation_participants').select('conversation_id, direct_conversations(created_at)').eq('user_id', userId)).data
    const convIds = (myParticipants ?? []).map(row => row.conversation_id)
    if (!convIds.length) return []
    const [{ data: otherParticipants, error: otherParticipantsError }, { data: directMessages }] = await Promise.all([supabase.rpc('get_conversation_other_participants', { conv_ids: convIds }), supabase.from('direct_messages').select('id, conversation_id, content, created_at, sender_id').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(500)])
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
      // Plus d'autre participant : il a supprimé son compte
      const displayName = !otherUserId && !otherParticipantsError ? DELETED_USER_LABEL : directProfileDisplayName(profile)
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
    return sortConversationsByActivity([...eventRows, ...directRows])
  }

  const conversationsByFriendId = useMemo(() => {
    const map = new Map()
    conversations.filter(conv => conv.kind === 'direct' && !isConversationHidden(conv, hiddenConversations)).forEach(conv => { if (conv.friend?.friend_id) map.set(conv.friend.friend_id, conv) })
    return map
  }, [conversations, hiddenConversations])
  const inboxConversations = sortConversationsForInbox(conversations
    .filter(conv => !isConversationHidden(conv, hiddenConversations))
    .map(conv => conv.kind === 'direct' ? { ...conv, unreadCount: unreadByConversation.get(conv.conversationId) ?? 0 } : conv))
  const visibleConversations = inboxConversations.filter(conv => {
    if (conv.kind === 'event' && hiddenEventIds.has(String(conv.eventId))) return false
    if (conv.kind === 'event' && deletedEventConversationIds.has(String(conv.eventId))) return false
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
  async function deleteEventConversation(conversation) {
    if (!conversation?.eventId) return
    const confirmed = window.confirm('Supprimer définitivement cette conversation ? Tous les messages général et secret de cet événement seront supprimés.')
    if (!confirmed) return
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('event_id', conversation.eventId)
    if (error) {
      console.error('[Messages] delete event conversation error:', error)
      window.alert("Impossible de supprimer cette conversation pour le moment.")
      return
    }
    hideEventCard(conversation.eventId)
    window.localStorage.setItem(`deleted_event_conversation_${conversation.eventId}`, '1')
    setDeletedEventConversationIds(prev => new Set([...prev, String(conversation.eventId)]))
    setConversations(prev => prev.filter(conv => conv.id !== conversation.id))
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
      setConversations(prev => prev.map(c => {
        if (c.id !== conv.id) return c
        const generalUnreadCount = secretChannel ? c.generalUnreadCount : 0
        const secretUnreadCount = secretChannel ? 0 : c.secretUnreadCount
        return { ...c, generalUnreadCount, secretUnreadCount, unreadCount: generalUnreadCount + secretUnreadCount }
      }))
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
    const { data: sent, error } = await supabase.from('messages').insert({ event_id: event.id, user_id: userId, content, is_secret: isSecret }).select('id, event_id, content, created_at, user_id, is_secret').maybeSingle()
    if (error) {
      setMessages(prev => prev.filter(message => message.id !== optimistic.id))
      console.log('Erreur Supabase:', JSON.stringify(error))
      captureSupabaseError(error, { operation: 'send_event_message' })
      track('message_send_failed', {
        event_id: event.id,
        is_secret: isSecret,
        error_code: error.code,
        error_status: error.status,
      })
      return
    }
    recordSentMessage('messages', sent ?? { ...optimistic, isOptimistic: undefined })
    track('message_sent', {
      event_id: event.id,
      is_secret: isSecret,
    })
    // Notifications créées par le trigger notify_event_message
  }

  if (!event) return <ConversationList currentUsername={currentUsername} unreadTotal={unreadTotal} openNewMessage={openNewMessage} friendsLoading={friendsLoading} friends={friends} conversationsByFriendId={conversationsByFriendId} appOpenedAtRef={appOpenedAtRef} currentUserId={userId} activeTab={activeTab} setActiveTab={setActiveTab} hiddenEventIds={hiddenEventIds} showAllHiddenEvents={showAllHiddenEvents} listLoading={listLoading} visibleConversations={visibleConversations} unreadByConversation={unreadByConversation} handleConversationTap={handleConversationTap} hideEventCard={hideEventCard} deleteEventConversation={deleteEventConversation} hideConversation={hideConversation} showNewMessage={showNewMessage} setShowNewMessage={setShowNewMessage} openFriend={openFriend} onFriendAdded={fetchAll} />
  return <MessageThread event={event} onBack={onBack} myRsvpStatus={myRsvpStatus} canUseSecretChannel={canUseSecretChannel} isSecret={isSecret} setIsSecret={setIsSecret} birthdayPersonFirstName={birthdayPersonFirstName} messages={messages} eventMessageRows={eventMessageRows} bottomRef={bottomRef} input={input} setInput={setInput} send={send} guestLeaderIds={guestLeaderIds} closeFriendIds={closeFriendIds} onAuthorBlocked={fetchMessages} />
}
