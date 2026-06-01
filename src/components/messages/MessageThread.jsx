import { Calendar as CalendarIcon, ChevronLeft, Lock, MapPin, MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import { BG, BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { formatEventHeaderDate, profileDisplayName } from './utils'
import { Avatar } from './MessageUI'

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageThread({
  event,
  onBack,
  myRsvpStatus,
  canUseSecretChannel,
  isSecret,
  setIsSecret,
  birthdayPersonFirstName,
  messages,
  eventMessageRows,
  bottomRef,
  input,
  setInput,
  send,
}) {
  const rsvpPill = myRsvpStatus === 'going'
    ? { label: 'Présent ✓', bg: 'rgba(52,199,89,0.22)', color: '#fff' }
    : myRsvpStatus === 'declined'
      ? { label: 'Décliné', bg: 'rgba(255,59,48,0.22)', color: '#fff' }
      : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ background: 'linear-gradient(160deg, #e055aa 0%, #f5a623 100%)', flexShrink: 0, paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
          <button type="button" onClick={onBack} aria-label="Retour" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
            <ChevronLeft size={18} color={WHITE} strokeWidth={2.5} />
          </button>
          <button type="button" aria-label="Plus d'options" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
            <MoreHorizontal size={18} color={WHITE} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 16px 0' }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 8 }}>
            {event.emoji || '🎉'}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: WHITE, textAlign: 'center', lineHeight: 1.2 }}>
            {event.name}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 16px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '5px 11px', fontSize: 12, color: WHITE, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <CalendarIcon size={12} strokeWidth={2} color={WHITE} />
            {formatEventHeaderDate(event.date)}
          </div>
          {event.location && (
            <div style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 20, padding: '5px 11px', fontSize: 12, color: WHITE, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <MapPin size={12} strokeWidth={2} color={WHITE} />
              {event.location}
            </div>
          )}
          {rsvpPill && (
            <div style={{ background: rsvpPill.bg, borderRadius: 20, padding: '5px 11px', fontSize: 12, color: rsvpPill.color, fontWeight: 700, flexShrink: 0 }}>
              {rsvpPill.label}
            </div>
          )}
        </div>

        {canUseSecretChannel && (
          <div style={{ padding: '12px 16px 0' }}>
            <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 16, background: 'rgba(255,255,255,0.18)' }}>
              <button type="button" onClick={() => setIsSecret(false)} style={{ flex: 1, minHeight: 32, border: 'none', borderRadius: 13, background: !isSecret ? 'rgba(255,255,255,0.90)' : 'transparent', color: !isSecret ? BLACK : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer' }}>
                <MessageCircle size={13} strokeWidth={2} />
                Général
              </button>
              <button type="button" onClick={() => setIsSecret(true)} style={{ flex: 1, minHeight: 32, border: 'none', borderRadius: 13, background: isSecret ? 'rgba(255,255,255,0.90)' : 'transparent', color: isSecret ? '#534AB7' : 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 800, fontFamily: FONT, cursor: 'pointer' }}>
                <Lock size={13} strokeWidth={2.2} />
                Secret
              </button>
            </div>
          </div>
        )}
      </div>

      {isSecret && (
        <div style={{ background: '#EEEDFE', color: '#534AB7', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          <Lock size={14} strokeWidth={2.2} color="#534AB7" />
          {birthdayPersonFirstName} ne peut pas voir ces messages
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 14px 14px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: GRAY1, fontSize: 14, marginTop: 40 }}>
            Aucun message pour l'instant
          </div>
        ) : (
          eventMessageRows.map(row => {
            if (row.type === 'date') return <div key={row.id} style={{ textAlign: 'center', color: GRAY1, fontSize: 11, fontWeight: 600, margin: '12px 0 4px' }}>{row.label}</div>
            if (row.type === 'system') {
              const { message: sm } = row
              return (
                <div key={sm.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <div style={{ background: 'rgba(0,122,255,0.09)', color: '#007AFF', borderRadius: 14, padding: '5px 14px', fontSize: 12, fontWeight: 600, textAlign: 'center', maxWidth: '82%' }}>
                    {sm.content || 'Mise à jour'}
                  </div>
                </div>
              )
            }
            const { message: msg, isMine, compactTop, showName, showAvatar } = row
            const senderName = profileDisplayName(msg.profile)
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: compactTop ? 2 : 10 }}>
                {!isMine && showName && <div style={{ fontSize: 11, fontWeight: 700, color: GRAY1, marginBottom: 3, paddingLeft: 36 }}>{senderName}</div>}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, maxWidth: '78%' }}>
                  {!isMine && (showAvatar ? <Avatar name={senderName} url={msg.profile?.avatar_url} size={28} /> : <div style={{ width: 28, flexShrink: 0 }} />)}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ padding: '9px 13px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMine ? GRADIENT : WHITE, color: isMine ? WHITE : BLACK, fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word', opacity: msg.isOptimistic ? 0.7 : 1, boxShadow: isMine ? 'none' : '0 1px 6px rgba(0,0,0,0.08)' }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: 10, color: GRAY1, marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '10px 14px 20px', background: WHITE, display: 'flex', gap: 9, alignItems: 'center', flexShrink: 0, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
          style={{ flex: 1, padding: '10px 16px', borderRadius: 20, background: BG, fontSize: 14, color: BLACK, border: 'none', outline: 'none', fontFamily: FONT }}
        />
        <button type="button" aria-label="Envoyer" onClick={send} style={{ width: 32, height: 32, background: input.trim() ? GRADIENT : '#D1D1D6', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', transition: 'background 0.15s', flexShrink: 0, padding: 0 }}>
          <Send size={14} color={WHITE} fill={WHITE} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
