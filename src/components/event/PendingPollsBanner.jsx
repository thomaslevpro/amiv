import { useEffect, useState } from 'react'
import { Check, ChevronDown, Vote } from 'lucide-react'
import EventDatePoll from './EventDatePoll'
import { formatPollDate } from './eventUtils'

const CONFIRMATION_MS = 2500

// Un sondage est répondu quand chacune de ses dates a mon vote.
function isAnswered(poll, myVotes) {
  return poll.options.every(option => myVotes[option.id] !== undefined)
}

// Bandeau en haut de la page d'un événement : se déplie pour voter sur place
// (mêmes votes que le sondage plus bas), affiche une confirmation avec les
// résultats, puis se replie et disparaît. onVisibleChange prévient la page,
// qui masque le sondage du bas tant que le bandeau est là (pas de doublon).
export default function PendingPollsBanner({ polls, myVotes, allVoteCounts, onVote, onVisibleChange }) {
  const [openKeys, setOpenKeys] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  const pending = polls.filter(poll => !isAnswered(poll, myVotes))
  const shownPolls = openKeys ? polls.filter(poll => openKeys.includes(poll.key)) : []
  const allShownAnswered = shownPolls.length > 0 && shownPolls.every(poll => isAnswered(poll, myVotes))

  useEffect(() => {
    if (openKeys && allShownAnswered) setConfirmed(true)
  }, [openKeys, allShownAnswered])

  useEffect(() => {
    if (!confirmed) return undefined
    const timer = setTimeout(() => { setOpenKeys(null); setConfirmed(false) }, CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [confirmed])

  const visible = pending.length > 0 || !!openKeys

  useEffect(() => {
    onVisibleChange?.(visible)
  }, [visible, onVisibleChange])

  if (!visible) return null

  const isOpen = !!openKeys
  const count = openKeys ? openKeys.length : pending.length
  const title = count > 1 ? `${count} sondages attendent ta réponse` : 'Un sondage attend ta réponse'

  function toggle() {
    if (confirmed) return
    setOpenKeys(isOpen ? null : pending.map(poll => poll.key))
  }

  return (
    <div style={{ borderRadius: 16, marginBottom: 14, background: 'rgba(224,85,170,0.10)', border: '1.5px solid rgba(224,85,170,0.35)', overflow: 'hidden' }}>
      <div role="button" aria-expanded={isOpen} onClick={toggle} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: confirmed ? 'default' : 'pointer' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#e055aa,#f5a623)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {confirmed ? <Check size={18} strokeWidth={2.4} color="#fff" /> : <Vote size={18} strokeWidth={2} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1E' }}>{confirmed ? 'Merci, ta réponse est enregistrée' : title}</div>
          <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{confirmed ? 'Voici les disponibilités de chacun' : 'Indique tes disponibilités pour choisir la date'}</div>
        </div>
        {!confirmed && <ChevronDown size={18} strokeWidth={2.5} color="#e055aa" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />}
      </div>

      <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 10px' }}>
            {shownPolls.map(poll => (
              confirmed
                ? <PollResults key={poll.key} poll={poll} myVotes={myVotes} allVoteCounts={allVoteCounts} />
                : <EventDatePoll key={poll.key} dateOptions={poll.options} myVotes={myVotes} allVoteCounts={allVoteCounts} canManage={false} onVote={onVote} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PollResults({ poll, myVotes, allVoteCounts }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
      {poll.options.map((option, i) => {
        const count = allVoteCounts[option.id] || 0
        const mine = myVotes[option.id]
        return (
          <div key={option.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{formatPollDate(option.proposed_date, option.proposed_time)}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: mine ? '#e055aa' : '#8E8E93', whiteSpace: 'nowrap' }}>
              {count} disponible{count !== 1 ? 's' : ''}{mine ? ' · toi' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
