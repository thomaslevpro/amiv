export const CARD_GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'

export function displayName(profile) {
  return profile?.full_name || profile?.name || profile?.first_name || profile?.email || 'Ami'
}

export function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

export function formatRevealDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function enrichMessagesWithProfiles(supabase, rows) {
  const userIds = [...new Set((rows || []).map(row => row.user_id).filter(Boolean))]
  if (userIds.length === 0) return rows || []

  let profileRes = await supabase
    .from('profiles')
    .select('id, full_name, first_name, name, email, avatar_url')
    .in('id', userIds)

  if (profileRes.error) {
    profileRes = await supabase
      .from('profiles')
      .select('id, first_name, name, email, avatar_url')
      .in('id', userIds)
  }

  const profilesById = Object.fromEntries((profileRes.data || []).map(profile => [profile.id, profile]))
  return (rows || []).map(row => ({ ...row, profile: profilesById[row.user_id] || null }))
}

export const cardStyles = {
  section: {
    background: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#8E8E93',
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: 800,
    color: '#1C1C1E',
  },
  muted: {
    fontSize: 13,
    lineHeight: 1.4,
    color: '#8E8E93',
  },
  input: {
    width: '100%',
    border: '1px solid #E5E5EA',
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    lineHeight: 1.4,
    color: '#1C1C1E',
    background: '#fff',
    boxSizing: 'border-box',
  },
  primaryButton: {
    border: 'none',
    borderRadius: 14,
    padding: '12px 16px',
    background: CARD_GRADIENT,
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: 'none',
    borderRadius: 14,
    padding: '10px 14px',
    background: 'rgba(224,85,170,0.10)',
    color: '#993556',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
}
