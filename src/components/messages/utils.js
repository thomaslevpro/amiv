import { supabase } from '../../lib/supabase'

const GROUP_INTERVAL_MS = 2 * 60 * 1000

export function getInitials(name) {
  return (name ?? '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function firstName(name) {
  return (name ?? 'Ami').trim().split(/\s+/)[0] || 'Ami'
}

export function friendFirstName(friend, fallback = 'Ami') {
  const explicitFirstName = friend?.friend_first_name?.trim()
  if (explicitFirstName) return explicitFirstName

  const fullName = friend?.friend_name?.trim()
  if (fullName) return firstName(fullName)

  return friend?.friend_username || fallback
}

export function directProfileDisplayName(profile) {
  return profile?.first_name || profile?.name || profile?.email || 'Utilisateur'
}

export function profileDisplayName(profile, fallback = 'Ami') {
  return profile?.first_name || profile?.name || profile?.email || fallback
}

export function notificationConversationId(notification) {
  return notification?.data?.conversation_id || notification?.data?.direct_conversation_id
}

export function getAvatarColor(name) {
  const colors = ['#F7B7C8', '#BFD7FF', '#BDEBD0', '#FFD8A8', '#D8C7FF', '#BDE7F0']
  let hash = 0
  for (let i = 0; i < (name || '').length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function formatConvTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (msgDay.getTime() === yesterday.getTime()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
}

export function formatEventDateTime(ts) {
  if (!ts) return 'Date à définir'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'Date à définir'
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const time = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} · ${time}`
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

export function formatDateSeparator(ts) {
  const date = new Date(ts)
  const today = startOfDay(new Date())
  const msgDay = startOfDay(date)
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export function formatEventHeaderDate(ts) {
  if (!ts) return 'Date à définir'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'Date à définir'
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  const day = d.getDate()
  const month = d.toLocaleDateString('fr-FR', { month: 'long' })
  const h = d.getHours()
  const m = d.getMinutes()
  const time = m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
  return `${weekday} ${day} ${month} · ${time}`
}

export function buildEventMessageRows(messages, currentUserId) {
  return messages.flatMap((msg, index) => {
    const previous = messages[index - 1]
    const next = messages[index + 1]
    const isSystem = Boolean(msg.event)
    const showDate = index === 0 || !isSameDay(previous?.created_at, msg.created_at)
    const rows = []
    if (showDate) rows.push({ id: `date-${msg.id}`, type: 'date', label: formatDateSeparator(msg.created_at) })
    if (isSystem) {
      rows.push({ id: msg.id, type: 'system', message: msg })
      return rows
    }
    const prevGroupable = previous && !previous.event && previous.user_id === msg.user_id && Math.abs(new Date(msg.created_at) - new Date(previous.created_at)) < GROUP_INTERVAL_MS
    const nextGroupable = next && !next.event && next.user_id === msg.user_id && Math.abs(new Date(next.created_at) - new Date(msg.created_at)) < GROUP_INTERVAL_MS
    rows.push({
      id: msg.id,
      type: 'message',
      message: msg,
      isMine: msg.user_id === currentUserId,
      compactTop: Boolean(prevGroupable),
      showName: msg.user_id !== currentUserId && !prevGroupable,
      showAvatar: msg.user_id !== currentUserId && !nextGroupable,
    })
    return rows
  })
}

export function readSeen(key) {
  if (typeof window === 'undefined') return 0
  const value = window.localStorage.getItem(key)
  return value ? new Date(value).getTime() : 0
}

export function writeSeen(key) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, new Date().toISOString())
}

function channelLastReadKey(eventId, isSecret) {
  return `lastRead_${eventId}_${isSecret}`
}

export function readChannelLastRead(eventId, isSecret) {
  return readSeen(channelLastReadKey(eventId, isSecret))
}

export function writeChannelLastRead(eventId, isSecret) {
  if (!eventId) return
  writeSeen(channelLastReadKey(eventId, isSecret))
}

function hiddenConversationsKey(userId) {
  return `hidden_conversations_${userId}`
}

export function readHiddenConversations(userId) {
  if (typeof window === 'undefined' || !userId) return {}
  try {
    return JSON.parse(window.localStorage.getItem(hiddenConversationsKey(userId)) || '{}')
  } catch {
    return {}
  }
}

export function writeHiddenConversations(userId, hidden) {
  if (typeof window === 'undefined' || !userId) return
  window.localStorage.setItem(hiddenConversationsKey(userId), JSON.stringify(hidden))
}

export function isConversationHidden(conversation, hiddenConversations) {
  const hiddenAt = hiddenConversations[conversation.id]
  if (!hiddenAt) return false
  const hiddenTime = new Date(hiddenAt).getTime()
  const lastTime = new Date(conversation.lastAt || 0).getTime()
  return !lastTime || lastTime <= hiddenTime
}

export async function fetchProfilesByIds(ids) {
  if (!ids.length) return []
  const { data } = await supabase.from('profiles').select('id, name, first_name, avatar_url, email').in('id', ids)
  return data ?? []
}

export async function enrichMessagesWithProfiles(rows = []) {
  const userIds = [...new Set(rows.map(message => message.user_id).filter(Boolean))]
  const profiles = await fetchProfilesByIds(userIds)
  const profilesById = Object.fromEntries(profiles.map(profile => [profile.id, profile]))
  return rows.map(message => ({
    ...message,
    profile: message.profiles ?? profilesById[message.user_id] ?? null,
  }))
}

export function parseVoice(content) {
  const match = String(content || '').match(/^\[voice:(\d+):(\d+)\]/)
  if (!match) return null
  return `${Number(match[1])}:${String(match[2]).padStart(2, '0')}`
}

export function previewMessage(content) {
  const duration = parseVoice(content)
  if (duration) return { voice: true, text: `Message vocal · ${duration}` }
  return { voice: false, text: content || 'Aucun message' }
}
