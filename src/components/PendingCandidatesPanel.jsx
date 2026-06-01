import { Check, X } from 'lucide-react'

const COLORS = {
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8E8E93',
  line: '#E5E5EA',
  green: '#34C759',
}

const AVATAR_COLORS = ['#FBBF9A', '#B5CAF0', '#C5E8C5', '#F9DDB3', '#E2C9F0', '#F0C5C5', '#A7D8F0', '#F3B7C4']

function hashIndex(value = '') {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash + value.charCodeAt(index) * (index + 1)) % 997
  }
  return hash % AVATAR_COLORS.length
}

function displayName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim() || profile?.name || 'Invité'
}

export default function PendingCandidatesPanel({
  pendingCandidates,
  currentUserRole,
  approveCandidate,
  rejectCandidate,
  onToast,
}) {
  if (!['owner', 'co_organizer'].includes(currentUserRole)) return null
  if (!pendingCandidates?.length) return null

  const canManage = currentUserRole === 'owner'

  async function handleDecision(action, userId) {
    try {
      await action(userId)
      onToast?.('Demande mise à jour ✓')
    } catch (error) {
      console.error('[PendingCandidatesPanel] decision error:', error)
      onToast?.(error.message ?? 'Impossible de traiter la demande', true)
    }
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, padding: '0 2px' }}>
        Demandes de coordination
      </div>
      <div style={{ background: COLORS.card, borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
        {pendingCandidates.map((candidate, index) => {
          const name = displayName(candidate.profile)
          const initial = name.charAt(0).toUpperCase()

          return (
            <div key={candidate.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
              {index > 0 && <div style={{ position: 'absolute', top: 0, left: 60, right: 0, height: 0.5, background: COLORS.line }} />}
              {candidate.profile?.avatar_url ? (
                <img src={candidate.profile.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 18, background: AVATAR_COLORS[hashIndex(candidate.user_id || name)], color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 850, flexShrink: 0 }}>
                  {initial}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 550, marginTop: 2 }}>souhaite coordonner</div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => handleDecision(approveCandidate, candidate.user_id)}
                  aria-label={`Approuver ${name}`}
                  style={{ width: 36, height: 36, borderRadius: 12, background: canManage ? COLORS.green : COLORS.line, color: '#fff', display: 'grid', placeItems: 'center', cursor: canManage ? 'pointer' : 'default' }}
                >
                  <Check size={17} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => handleDecision(rejectCandidate, candidate.user_id)}
                  aria-label={`Refuser ${name}`}
                  style={{ width: 36, height: 36, borderRadius: 12, background: '#F2F2F7', color: COLORS.muted, display: 'grid', placeItems: 'center', cursor: canManage ? 'pointer' : 'default' }}
                >
                  <X size={17} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
