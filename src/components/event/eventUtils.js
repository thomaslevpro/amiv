export const AVATAR_COLORS = ['#e055aa', '#f5a623', '#34C759', '#007AFF', '#AF52DE', '#FF9500']

export function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function formatPollDate(dateStr, timeStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return timeStr ? `${datePart} à ${timeStr.slice(0, 5)}` : datePart
}

export function birthdayFriendName(friend) {
  return friend?.first_name || friend?.name || 'Ami'
}

export function birthdayFriendInitial(friend) {
  return birthdayFriendName(friend).charAt(0).toUpperCase()
}
