import { Calendar } from 'lucide-react'
import PlusOneRequest from '../PlusOneRequest'

export default function EventRsvpButtons({ rsvpStatus, myRsvp, loading, currentUserName, eventId, onRsvp, onAddToCalendar, embedded = false }) {
  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', margin: embedded ? '16px 0 10px' : '6px 0 10px' }}>
        Votre réponse
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {[
          { status: 'going', label: "✓ J'y serai !" },
          { status: 'maybe', label: 'Peut-être' },
          { status: 'declined', label: 'Non' },
        ].map(({ status, label }) => {
          const active = rsvpStatus === status
          return (
            <div key={status} onClick={() => !loading && onRsvp(status)} style={{ flex: 1, minHeight: 44, padding: '11px 8px', borderRadius: active ? 14 : 12, textAlign: 'center', fontSize: 13, fontWeight: 800, cursor: loading ? 'default' : 'pointer', background: active ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F5F5F5', color: active ? '#fff' : '#1C1C1E', boxShadow: 'none', transition: 'all 0.15s', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {status === 'declined' && <span style={{ fontSize: 18, lineHeight: 0.8, fontWeight: 500 }}>×</span>}
              {label}
            </div>
          )
        })}
      </div>
      {myRsvp?.id && (
        <PlusOneRequest
          rsvpId={myRsvp.id}
          table="rsvps"
          currentStatus={myRsvp.plus_one_status || 'none'}
          currentName={myRsvp.plus_one_name || ''}
          eventId={eventId}
          requesterName={currentUserName}
          variant="pill"
        />
      )}
      <button type="button" onClick={onAddToCalendar} style={{ width: '100%', minHeight: 54, borderRadius: 16, border: '1.5px dashed #B5B5BC', background: 'transparent', color: '#1C1C1E', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, marginBottom: embedded ? 0 : 10 }}>
        <Calendar size={18} strokeWidth={1.8} color="#A8A8AF" />
        Ajouter à mon calendrier
      </button>
    </>
  )
}
