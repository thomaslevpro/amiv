import { Calendar } from 'lucide-react'
import { formatPollDate } from './eventUtils'

export default function EventDatePoll({ dateOptions, myVotes, allVoteCounts, canManage, confirmingDate, onVote, onConfirmDate }) {
  const maxVoteCount = Math.max(0, ...dateOptions.map(o => allVoteCounts[o.id] || 0))

  if (canManage) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 12 }}>
          Résultats du sondage 📊
        </div>
        {dateOptions.map(opt => {
          const count = allVoteCounts[opt.id] || 0
          const isWinner = maxVoteCount > 0 && count === maxVoteCount
          return (
            <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, marginBottom: 8, background: isWinner ? 'rgba(224,85,170,0.08)' : '#F5F5F5', border: isWinner ? '1.5px solid rgba(224,85,170,0.3)' : '1.5px solid transparent' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{formatPollDate(opt.proposed_date, opt.proposed_time)}</div>
                <div style={{ fontSize: 11, color: isWinner ? '#e055aa' : '#8E8E93', marginTop: 2, fontWeight: isWinner ? 700 : 400 }}>
                  {count} disponible{count !== 1 ? 's' : ''}{isWinner && count > 0 ? ' 🏆' : ''}
                </div>
              </div>
              <div onClick={() => !confirmingDate && onConfirmDate(opt)} style={{ padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', cursor: confirmingDate ? 'default' : 'pointer', opacity: confirmingDate ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {confirmingDate ? '…' : 'Confirmer'}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>
        Sondage de dates <Calendar size={14} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 12 }}>Indiquez vos disponibilités pour chaque date proposée.</div>
      {dateOptions.map((opt, i) => {
        const myVote = myVotes[opt.id]
        return (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{formatPollDate(opt.proposed_date, opt.proposed_time)}</div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <div onClick={() => onVote(opt.id, true)} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: myVote === true ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F5F5F5', color: myVote === true ? '#fff' : '#8E8E93', cursor: 'pointer', transition: 'all 0.15s' }}>✓</div>
              <div onClick={() => onVote(opt.id, false)} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: myVote === false ? '#FF3B30' : '#F5F5F5', color: myVote === false ? '#fff' : '#8E8E93', cursor: 'pointer', transition: 'all 0.15s' }}>✕</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
