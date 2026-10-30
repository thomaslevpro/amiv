import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Share, Trash2, UserPlus, UserRoundPlus } from 'lucide-react'
import EventDatePoll from '../components/event/EventDatePoll'
import EventEditForm from '../components/event/EventEditForm'
import EventGuestsSummary from '../components/event/EventGuestsSummary'
import EventHero, { countdownDays } from '../components/event/EventHero'
import EventInfoCard from '../components/event/EventInfoCard'
import EventPhotosSection from '../components/event/EventPhotosSection'
import EventQuickActions from '../components/event/EventQuickActions'
import EventRsvpButtons from '../components/event/EventRsvpButtons'
import PendingPollsBanner from '../components/event/PendingPollsBanner'
import { getAvatarColor, SECTION_TITLE } from '../components/event/eventUtils'
import RevealedMemoriesEntry from '../components/event/RevealedMemoriesEntry'
import InviteFriendsSheet from '../components/InviteFriendsSheet'
import PlusOneRequest from '../components/PlusOneRequest'
import PlusOneReviewList from '../components/PlusOneReviewList'
import { BottomSheet } from '../components/safety/SafetySheets'
import useEventDetail from '../hooks/useEventDetail'
import { profileFullName } from '../utils/displayName'

// Âge atteint à la date de l'événement (ou aujourd'hui sans date)
function ageAt(birthday, dateStr) {
  if (!birthday) return null
  const [year, month, day] = String(birthday).slice(0, 10).split('-').map(Number)
  if (!year || year < 1900) return null
  const ref = dateStr && !isNaN(new Date(dateStr)) ? new Date(dateStr) : new Date()
  const age = ref.getFullYear() - year - (ref.getMonth() + 1 < month || (ref.getMonth() + 1 === month && ref.getDate() < day) ? 1 : 0)
  return age > 0 && age < 130 ? age : null
}

export default function EventDetail({ event, onBack, onChat, onMessagesClick, onSecretSpace }) {
  const navigate = useNavigate()
  const detail = useEventDetail(event, onBack)
  const scrollRef = useRef(null)
  const [pollBannerVisible, setPollBannerVisible] = useState(false)
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [showGuests, setShowGuests] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  if (!event) return null

  const {
    rsvpStatus, myRsvp, userId, currentUserName, canManage, loading,
    toast, editing, editForm, setEditForm, birthdayPersonId, currentType, saving,
    coverPreview, setCoverFile, setCoverPreview, eventOverrides, showDeleteModal,
    setShowDeleteModal, deleting, friends, guests, guestsLoading, dateOptions,
    myVotes, allVoteCounts, confirmingDate, birthdayPersonName, birthdayPersonBirthday,
    canAccessSecretSpace, canAccessEventChat, chatUnreadCount, secretUnreadCount, organizers, showCoOrgModal,
    setShowCoOrgModal, coOrgSubmitting, coOrgError, confirmedParticipants, coOrgLoading,
    eventForMessages, handleRsvp, handleDateVote, handleConfirmDate, handleEditOpen,
    toggleBirthdayPerson, handleEditSubmit, handleDeleteEvent,
    refreshGuests, handleRemindGuest, handleRemoveInvitation, handleShare, showToast,
    handleOpenCoOrgModal, handleAddCoOrganizer, setEditing,
  } = detail

  const displayDescription = eventOverrides.description ?? event.description
  const displayLocation = eventOverrides.location ?? event.location
  const displayDate = eventOverrides.date ?? event.date
  const pollClosed = eventOverrides.poll_closed ?? event.poll_closed ?? false
  const isPollActive = dateOptions.length > 0 && !pollClosed
  const heroEvent = { ...event, type: currentType, __isPollActive: isPollActive }
  const isBirthdayEvent = currentType === 'Anniversaire' || !!birthdayPersonId
  const isBirthdayPerson = !!userId && birthdayPersonId === userId
  const hasDeclined = !canManage && rsvpStatus === 'declined'
  // Sondages auxquels je peux répondre (aujourd'hui : le sondage de dates)
  const myPolls = isPollActive && !canManage && !hasDeclined && !!userId ? [{ key: 'dates', options: dateOptions }] : []
  // Plus de changement de réponse une fois l'événement passé
  const canChangeRsvp = !displayDate || isPollActive || countdownDays(displayDate) !== null
  const isOwner = event.user_id === userId
  // event_organizers contient aussi le coordinateur de cagnotte (guest_leader)
  const eventOrganizers = organizers.filter(o => o.role === 'owner' || o.role === 'co_organizer')
  // Jamais pour la personne fêtée (le serveur applique la même règle)
  const showSecretSpace = canAccessSecretSpace && isBirthdayEvent && !!birthdayPersonId && !isBirthdayPerson
  void onMessagesClick

  function openEdit() {
    setShowMenu(false)
    handleEditOpen()
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openInvite() {
    setShowMenu(false)
    setShowGuests(false)
    setShowInviteSheet(true)
  }

  const menuActions = [
    { key: 'edit', icon: <Pencil size={19} color="#1C1C1E" />, label: "Modifier l'événement", onClick: openEdit },
    { key: 'invite', icon: <UserPlus size={19} color="#1C1C1E" />, label: 'Inviter des amis', onClick: openInvite },
    { key: 'share', icon: <Share size={19} color="#1C1C1E" />, label: 'Partager le lien', onClick: () => { setShowMenu(false); handleShare() } },
    isOwner && eventOrganizers.length < 4 && { key: 'coorg', icon: <UserRoundPlus size={19} color="#1C1C1E" />, label: 'Ajouter un co-organisateur', onClick: () => { setShowMenu(false); handleOpenCoOrgModal() } },
    { key: 'delete', icon: <Trash2 size={19} color="#FF3B30" />, label: "Supprimer l'événement", danger: true, onClick: () => { setShowMenu(false); setShowDeleteModal(true) } },
  ].filter(Boolean)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <EventHero event={heroEvent} eventOverrides={eventOverrides} onBack={onBack} onMenu={canManage ? () => setShowMenu(true) : undefined} />

        {/* Feuille d'infos qui chevauche le bas de la couverture */}
        <div style={{ position: 'relative', marginTop: -24, borderRadius: '24px 24px 0 0', background: '#fff', padding: '22px 16px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {editing && <EventEditForm event={event} editForm={editForm} setEditForm={setEditForm} friends={friends} currentType={currentType} birthdayPersonId={birthdayPersonId} birthdayPersonName={birthdayPersonName} onToggleBirthdayPerson={toggleBirthdayPerson} coverPreview={coverPreview} setCoverFile={setCoverFile} setCoverPreview={setCoverPreview} saving={saving} onSubmit={handleEditSubmit} onCancel={() => setEditing(false)} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <EventInfoCard
              displayDate={displayDate}
              isPollActive={isPollActive}
              displayLocation={displayLocation}
              organizers={eventOrganizers}
              userId={userId}
              birthday={isBirthdayEvent && birthdayPersonName ? { name: birthdayPersonName, isMe: isBirthdayPerson, age: ageAt(birthdayPersonBirthday, displayDate) } : null}
              onOpenProfile={profile => profile.username && navigate(`/u/${encodeURIComponent(profile.username)}`)}
            />
            {/* L'organisateur participe d'office */}
            {!canManage && userId && (
              <EventRsvpButtons
                rsvpStatus={rsvpStatus}
                loading={loading}
                onRsvp={handleRsvp}
                canChange={canChangeRsvp}
                goingExtra={myRsvp?.id ? <PlusOneRequest rsvpId={myRsvp.id} table="rsvps" currentStatus={myRsvp.plus_one_status || 'none'} currentName={myRsvp.plus_one_name || ''} eventId={event.id} requesterName={currentUserName} variant="compact" /> : null}
              />
            )}
            <EventQuickActions
              onChat={canAccessEventChat ? () => onChat?.(eventForMessages) : null}
              chatUnread={chatUnreadCount}
              onSecretSpace={showSecretSpace ? () => (onSecretSpace ? onSecretSpace(event) : navigate(`/events/${event.id}/secret-space`)) : null}
              secretUnread={secretUnreadCount}
              onOrganizerSpace={canManage ? () => navigate(`/events/${event.id}/organizer-space`) : null}
            />
          </div>

          {myPolls.length > 0 && <div style={{ marginBottom: -14 }}><PendingPollsBanner polls={myPolls} myVotes={myVotes} allVoteCounts={allVoteCounts} onVote={handleDateVote} onVisibleChange={setPollBannerVisible} /></div>}

          {isBirthdayPerson && <div style={{ marginBottom: -14 }}><RevealedMemoriesEntry eventId={event.id} /></div>}

          <EventGuestsSummary
            open={showGuests}
            onOpen={() => setShowGuests(true)}
            onClose={() => setShowGuests(false)}
            sectionProps={{ guests, loading: guestsLoading, canManage, userId, onInvite: openInvite, onShare: handleShare, onRemind: handleRemindGuest, onRemove: handleRemoveInvitation }}
          />

          <EventPhotosSection key={event.id} eventId={event.id} userId={userId} focus={event.focusSection === 'photos'} showToast={showToast} />

          {(displayDescription || canManage) && (
            <section>
              <h2 style={{ ...SECTION_TITLE, marginBottom: 8 }}>Description</h2>
              {displayDescription
                ? <div style={{ fontSize: 15, color: '#1C1C1E', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{displayDescription}</div>
                : <button type="button" onClick={openEdit} style={{ border: 'none', background: 'none', padding: 0, fontSize: 15, color: '#AEAEB2', cursor: 'pointer' }}>Ajouter une description…</button>}
            </section>
          )}

          {isPollActive && !pollBannerVisible && <EventDatePoll asSection dateOptions={dateOptions} myVotes={myVotes} allVoteCounts={allVoteCounts} canManage={canManage} confirmingDate={confirmingDate} onVote={handleDateVote} onConfirmDate={handleConfirmDate} />}
          {canManage && <PlusOneReviewList eventId={event.id} isOrganizer={canManage} />}
        </div>
      </div>

      {showMenu && (
        <BottomSheet title="Événement" onClose={() => setShowMenu(false)}>
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            {menuActions.map((action, index) => (
              <button key={action.key} type="button" onClick={action.onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', border: 'none', borderTop: index ? '0.5px solid rgba(0,0,0,0.07)' : 'none', background: 'transparent', fontSize: 15, fontWeight: 600, color: action.danger ? '#FF3B30' : '#1C1C1E', cursor: 'pointer', textAlign: 'left' }}>
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', color: '#fff', borderRadius: 20, padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}

      {showInviteSheet && (
        <InviteFriendsSheet
          eventId={event.id}
          onClose={() => setShowInviteSheet(false)}
          onInvited={count => {
            showToast(count > 1 ? `${count} amis invités ✓` : 'Ami invité ✓')
            refreshGuests()
          }}
        />
      )}

      {showCoOrgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 20px' }}>
          <div style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 20, padding: '18px 16px 16px', boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#1C1C1E' }}>Ajouter un co-organisateur</div><button type="button" onClick={() => setShowCoOrgModal(false)} style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: '#F5F5F5', color: '#8E8E93', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 18 }}>×</button></div>
            {coOrgError && <div style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, marginBottom: 10 }}>{coOrgError}</div>}
            {coOrgLoading ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#8E8E93', fontSize: 14 }}>Chargement…</div> : confirmedParticipants.length === 0 ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#8E8E93', fontSize: 14 }}>Aucun participant confirmé disponible</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                {confirmedParticipants.map(participant => {
                  const name = profileFullName(participant, 'Invité')
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
