import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessageCircle } from 'lucide-react'
import CardView from '../components/card/CardView'
import EventDatePoll from '../components/event/EventDatePoll'
import EventEditForm from '../components/event/EventEditForm'
import EventGuestList from '../components/event/EventGuestList'
import EventHero from '../components/event/EventHero'
import EventInfoCard from '../components/event/EventInfoCard'
import EventInviteSection from '../components/event/EventInviteSection'
import EventRsvpButtons from '../components/event/EventRsvpButtons'
import EventStatsRow from '../components/event/EventStatsRow'
import { getAvatarColor } from '../components/event/eventUtils'
import PlusOneReviewList from '../components/PlusOneReviewList'
import useEventDetail from '../hooks/useEventDetail'

export default function EventDetail({ event, onBack, onChat, onMessagesClick }) {
  const navigate = useNavigate()
  const detail = useEventDetail(event, onBack)

  if (!event) return null

  const {
    coverInputRef, rsvpStatus, myRsvp, userId, currentUserName, canManage, loading,
    guestRsvps, toast, editing, editForm, setEditForm, birthdayPersonId, saving,
    coverPreview, setCoverFile, setCoverPreview, eventOverrides, showDeleteModal,
    setShowDeleteModal, deleting, friends, invitedIds, copySuccess, dateOptions,
    myVotes, allVoteCounts, confirmingDate, rsvpStats, participants, organizerName,
    eventGuests, isInvitedGuest, chatUnreadCount, organizers, showCoOrgModal,
    setShowCoOrgModal, coOrgSubmitting, coOrgError, confirmedParticipants, coOrgLoading,
    eventForMessages, handleRsvp, handleDateVote, handleConfirmDate, handleEditOpen,
    toggleBirthdayPerson, handleEditSubmit, handleHeroCoverChange, handleDeleteEvent,
    handleInviteFriend, handleAddFriend, handleOpenCoOrgModal, handleAddCoOrganizer,
    handleAddToCalendar, handleCopyLink, setEditing,
  } = detail

  const displayDescription = eventOverrides.description ?? event.description
  const displayLocation = eventOverrides.location ?? event.location
  const pollClosed = eventOverrides.poll_closed ?? event.poll_closed ?? false
  const isPollActive = dateOptions.length > 0 && !pollClosed
  const heroEvent = { ...event, __isPollActive: isPollActive }
  void onMessagesClick

  function renderChatBanner() {
    const subtitle = chatUnreadCount > 0
      ? `${chatUnreadCount} message${chatUnreadCount > 1 ? 's' : ''} non lu${chatUnreadCount > 1 ? 's' : ''}`
      : "Aucun message pour l'instant"

    return (
      <div onClick={() => onChat?.(eventForMessages)} style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, padding: 14, marginBottom: 12, background: 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: 50, background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <MessageCircle size={20} strokeWidth={1.8} color="#fff" />
        </div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Chat de l'événement</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <ChevronRight size={14} strokeWidth={2.5} color="#fff" />
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}>
      <EventHero event={heroEvent} eventOverrides={eventOverrides} canManage={canManage} onBack={onBack} onEdit={handleEditOpen} onCoverChange={handleHeroCoverChange} coverInputRef={coverInputRef} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {canManage && <EventStatsRow rsvpStats={rsvpStats} />}

        {canManage && (
          <div style={{ marginBottom: 14 }}>
            <div onClick={() => navigate(`/events/${event.id}/organizer-space`)} style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'rgba(0,122,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="16" height="13" rx="2" stroke="#007AFF" strokeWidth="1.5" /><path d="M6 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" stroke="#007AFF" strokeWidth="1.5" /><path d="M6 9h8M6 12.5h5" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Mon espace organisateur</div><div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Checklist & suivi</div></div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1l6 6-6 6" stroke="#AEAEB2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        )}

        {renderChatBanner()}

        {!canManage && isInvitedGuest && event.type === 'Anniversaire' && (
          <div style={{ marginBottom: 14 }}>
            <div onClick={() => navigate(`/events/${event.id}/secret-space`)} style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'rgba(224,85,170,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="9" width="16" height="12" rx="2.5" stroke="#e055aa" strokeWidth="1.5" /><path d="M5 9V6a4 4 0 0 1 8 0v3" stroke="#e055aa" strokeWidth="1.5" strokeLinecap="round" /><circle cx="9" cy="15" r="1.5" fill="#e055aa" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>Espace secret</div>
                <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Cadeaux · Cagnotte · Carte</div>
                {organizerName && <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(224,85,170,0.08)', border: '1px solid rgba(224,85,170,0.20)', fontSize: 10, fontWeight: 600, color: '#993556' }}>🔒 Caché de {organizerName}</div>}
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1l6 6-6 6" stroke="#AEAEB2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        )}

        {editing && <EventEditForm event={event} editForm={editForm} setEditForm={setEditForm} friends={friends} birthdayPersonId={birthdayPersonId} onToggleBirthdayPerson={toggleBirthdayPerson} coverPreview={coverPreview} setCoverFile={setCoverFile} setCoverPreview={setCoverPreview} saving={saving} onSubmit={handleEditSubmit} onCancel={() => setEditing(false)} />}
        <EventInfoCard displayLocation={displayLocation} organizers={Object.assign([...organizers], { eventOwnerId: event.user_id })} userId={userId} eventId={event.id} onAddCoOrg={handleOpenCoOrgModal} />

        {(displayDescription || canManage) && (
          <div onClick={!displayDescription && canManage ? handleEditOpen : undefined} style={{ background: '#fff', borderRadius: 16, padding: '14px', marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', cursor: !displayDescription && canManage ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6 }}>Description</div>
            {displayDescription ? <div style={{ fontSize: 13, color: '#1C1C1E', lineHeight: 1.5 }}>{displayDescription}</div> : <div style={{ fontSize: 13, color: '#AEAEB2', fontStyle: 'italic' }}>Ajouter une description… ✏️</div>}
          </div>
        )}

        {canManage ? (
          <EventGuestList participants={participants} guestRsvps={guestRsvps} eventGuests={eventGuests} canManage={canManage} userId={userId} invitedIds={invitedIds} onInvite={handleInviteFriend} onAddFriend={handleAddFriend} />
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <EventGuestList participants={participants} guestRsvps={guestRsvps} eventGuests={eventGuests} canManage={canManage} userId={userId} invitedIds={invitedIds} onInvite={handleInviteFriend} onAddFriend={handleAddFriend} embedded />
            <EventRsvpButtons rsvpStatus={rsvpStatus} myRsvp={myRsvp} loading={loading} currentUserName={currentUserName} eventId={event.id} onRsvp={handleRsvp} onAddToCalendar={handleAddToCalendar} embedded />
          </div>
        )}
        {isPollActive && <EventDatePoll dateOptions={dateOptions} myVotes={myVotes} allVoteCounts={allVoteCounts} canManage={canManage} confirmingDate={confirmingDate} onVote={handleDateVote} onConfirmDate={handleConfirmDate} />}
        {canManage && <PlusOneReviewList eventId={event.id} isOrganizer={canManage} />}
        {userId && canManage && event.type === 'Anniversaire' && <div style={{ marginBottom: 14 }}><CardView eventId={event.id} currentUserId={userId} /></div>}
        {canManage && <EventInviteSection friends={friends} invitedIds={invitedIds} copySuccess={copySuccess} onInvite={handleInviteFriend} onCopyLink={handleCopyLink} />}
        {canManage && <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}><div onClick={() => setShowDeleteModal(true)} style={{ flex: 1, background: 'rgba(255,59,48,0.08)', borderRadius: 14, padding: '14px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#FF3B30', cursor: 'pointer' }}>Supprimer</div></div>}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', color: '#fff', borderRadius: 20, padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}

      {showCoOrgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 20px' }}>
          <div style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 20, padding: '18px 16px 16px', boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#1C1C1E' }}>Ajouter un co-organisateur</div><button type="button" onClick={() => setShowCoOrgModal(false)} style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: '#F5F5F5', color: '#8E8E93', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 18 }}>×</button></div>
            {coOrgError && <div style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, marginBottom: 10 }}>{coOrgError}</div>}
            {coOrgLoading ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#8E8E93', fontSize: 14 }}>Chargement…</div> : confirmedParticipants.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#8E8E93', fontSize: 14 }}>Aucun participant confirmé disponible</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                {confirmedParticipants.map(participant => {
                  const name = participant.first_name || participant.name || 'Invité'
                  return <div key={participant.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{participant.avatar_url ? <img src={participant.avatar_url} alt={name} style={{ width: 38, height: 38, borderRadius: 19, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 38, height: 38, borderRadius: 19, background: getAvatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{name.charAt(0).toUpperCase()}</div>}<div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{name}</div><button type="button" disabled={coOrgSubmitting} onClick={() => handleAddCoOrganizer(participant.id)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: coOrgSubmitting ? 'default' : 'pointer', opacity: coOrgSubmitting ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}>Ajouter</button></div>
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 20px' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 20px 16px', width: '100%', maxWidth: 430, boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', textAlign: 'center', marginBottom: 10 }}>Supprimer l'événement ?</div>
            <div style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 1.5, marginBottom: 24 }}>Cette action est irréversible. Tous les invités seront notifiés de l'annulation.</div>
            <div style={{ display: 'flex', gap: 10 }}><button onClick={() => setShowDeleteModal(false)} disabled={deleting} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: '#F5F5F5', color: '#1C1C1E', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Annuler</button><button onClick={handleDeleteEvent} disabled={deleting} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: '#FF3B30', color: '#fff', fontSize: 15, fontWeight: 700, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? '…' : 'Supprimer'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
