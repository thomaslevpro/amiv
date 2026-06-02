import { Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export function formatInvitationRelativeDate(dateStr) {
  if (!dateStr) return 'Date à définir'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'Date à définir'
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const current = new Date()
  current.setHours(0, 0, 0, 0)
  const days = Math.round((target - current) / (1000 * 60 * 60 * 24))
  const absDays = Math.abs(days)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  if (days === -1) return 'Hier'
  if (days > 0) return `Dans ${days} jours`
  return `Il y a ${absDays} jours`
}

export function normalizeStatus(status) {
  if (status === 'going' || status === 'yes' || status === 'accepted' || status === 'confirmed') return 'yes'
  if (status === 'maybe' || status === 'invited' || status === 'pending') return 'maybe'
  if (status === 'declined' || status === 'no' || status === 'not_going') return 'no'
  return status || null
}

async function handleAcceptInvitation({ eventId, userId, userEmail, onUpdate }) {
  if (!userId) return
  const orParts = [`invited_user_id.eq.${userId}`]
  if (userEmail) orParts.push(`invited_email.eq.${userEmail}`)
  const { count } = await supabase
    .from('invitations')
    .update({ status: 'accepted' }, { count: 'exact' })
    .eq('event_id', eventId)
    .or(orParts.join(','))
  if (count === 0) console.warn('RSVP update matched 0 rows — check invited_user_id or email match')

  const { error } = await supabase
    .from('rsvps')
    .upsert({ event_id: eventId, user_id: userId, status: 'going' }, { onConflict: 'event_id,user_id' })
  if (!error) onUpdate?.()
}

async function handleDeclineInvitation({ eventId, userId, userEmail, onUpdate }) {
  if (!userId) return
  const orParts = [`invited_user_id.eq.${userId}`]
  if (userEmail) orParts.push(`invited_email.eq.${userEmail}`)
  const { count } = await supabase
    .from('invitations')
    .update({ status: 'declined' }, { count: 'exact' })
    .eq('event_id', eventId)
    .or(orParts.join(','))
  if (count === 0) console.warn('RSVP update matched 0 rows — check invited_user_id or email match')

  const { error } = await supabase
    .from('rsvps')
    .upsert({ event_id: eventId, user_id: userId, status: 'declined' }, { onConflict: 'event_id,user_id' })
  if (!error) onUpdate?.()
}

export default function InvitationsSection({ invitations, userId, userEmail, onUpdate }) {
  if (invitations.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '0 2px' }}>
        <span style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--gray1)',
        }}>
          INVITATIONS EN ATTENTE
        </span>
        <span style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'rgba(224,85,170,0.16)',
          color: '#d82e86',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 800,
        }}>
          {invitations.length}
        </span>
      </div>
      {invitations.map(inv => {
        const ev = inv.events ?? {}
        const relativeDate = formatInvitationRelativeDate(ev.date)
        const organizerName = inv.isPending ? inv.organizerName : null
        return (
          <div key={inv.id} style={{
            background: '#fff',
            borderRadius: 20,
            padding: '18px 16px',
            marginBottom: 14,
            boxShadow: '0 2px 12px rgba(18,31,46,0.12)',
            border: '1px solid rgba(18,31,46,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: inv.isPending ? 'pulse-border 2s ease-in-out infinite' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#121827',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {ev.name ?? 'Événement'}
              </div>
              {organizerName && (
                <div style={{
                  fontSize: 12,
                  color: '#8E8E93',
                  marginTop: 4,
                  fontWeight: 500,
                  lineHeight: 1.15,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  Organisé par {organizerName}
                </div>
              )}
              <div style={{
                fontSize: 12,
                color: '#5f6f86',
                marginTop: 5,
                fontWeight: 600,
                lineHeight: 1.15,
              }}>
                {relativeDate}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => handleAcceptInvitation({ eventId: inv.event_id, userId, userEmail, onUpdate })}
                aria-label="Accepter l'invitation"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #f2368d 0%, #ff8b3d 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={23} color="#fff" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={() => handleDeclineInvitation({ eventId: inv.event_id, userId, userEmail, onUpdate })}
                aria-label="Refuser l'invitation"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: '#eef2f7',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={23} color="#536174" strokeWidth={2.3} />
              </button>
            </div>
          </div>
        )
      })}
    </>
  )
}
