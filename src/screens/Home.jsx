import { useState } from 'react'
import NotificationBell from '../components/NotificationBell'
import NotificationPanel from '../components/NotificationPanel'
import FriendRequests from '../components/FriendRequests'
import FriendSuggestions from '../components/FriendSuggestions'
import TrendingSection from '../components/TrendingSection'
import BirthdaySection from '../components/home/BirthdaySection'
import InvitationsSection from '../components/home/InvitationsSection'
import InviteCard from '../components/home/InviteCard'
import MyEventsSection from '../components/home/MyEventsSection'
import SectionHeader from '../components/home/SectionHeader'
import { useAvailability } from '../hooks/useAvailability'
import { useFriendships } from '../hooks/useFriendships'
import { useHomeData } from '../hooks/useHomeData'

export default function Home({
  onEventClick,
  onCreateClick,
  onNotifEventClick,
  onNotifMessageClick,
  onNotificationsRead,
  notificationUnreadCount = 0,
  onMessagesClick,
  onAllEventsClick,
  onCalendarClick,
  onTrendingClick,
  onDispoDetailClick,
  onDispoCalendarClick,
  session,
  birthdayRefreshTrigger = 0,
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const userId = session?.user?.id
  const userEmail = session?.user?.email
  const { suggestions, pendingRequests, sendRequest, acceptRequest, declineRequest } = useFriendships(userId)
  const { invitations, refetchInvitations, myEvents, profileName } = useHomeData(userId, userEmail)
  const { feed: availabilityFeed } = useAvailability(userId)
  const [toast, setToast] = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)

  function showToast(message, isError = false, duration = 3000) {
    setToast({ message, isError })
    setTimeout(() => setToast(null), duration)
  }

  const weekday = today.toLocaleDateString('fr-FR', { weekday: 'long' })
  const dateRest = today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const dateStr = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dateRest}`
  const displayName = profileName || session?.user?.user_metadata?.first_name || session?.user?.user_metadata?.name || userEmail?.split('@')[0] || 'toi'
  const amivCount = myEvents.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0px rgba(224,85,170,0.4), 0 0 0 0px rgba(245,166,35,0.2); }
          50% { box-shadow: 0 0 0 6px rgba(224,85,170,0.15), 0 0 0 12px rgba(245,166,35,0.05); }
        }
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.5; }
        }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, padding: '6px 2px 0', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#aaa', fontWeight: 500, marginBottom: 10 }}>
              {dateStr}
            </div>
            <div style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 800, color: '#1C1C1E', letterSpacing: -0.5 }}>
              Bonjour {displayName},
              <br />
              vous avez{' '}
              <span style={{
                background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                {amivCount} amiv{amivCount > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#aaa', fontWeight: 400, marginTop: 8 }}>
              à venir dans les 30 prochains jours
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
            {availabilityFeed.length > 0 && (
              <div
                onClick={() => {
                  if (onDispoCalendarClick) onDispoCalendarClick()
                  else onDispoDetailClick?.(availabilityFeed[0].id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  borderRadius: 999,
                  padding: '5px 11px',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#fff',
                  opacity: 0.85,
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  {availabilityFeed.length} dispo{availabilityFeed.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
            <NotificationBell unreadCount={notificationUnreadCount} onClick={() => setShowNotifications(true)} />
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <>
            <SectionHeader title="Demandes d'amitié" badge={pendingRequests.length} />
            <FriendRequests requests={pendingRequests} onAccept={acceptRequest} onDecline={declineRequest} />
          </>
        )}

        <InvitationsSection invitations={invitations} userId={userId} userEmail={userEmail} onUpdate={refetchInvitations} />

        <BirthdaySection user={session?.user} onToast={showToast} onMessage={onMessagesClick} refreshTrigger={birthdayRefreshTrigger} />

        {suggestions.length > 0 && (
          <>
            <SectionHeader title="Suggestions" />
            <FriendSuggestions suggestions={suggestions} onAdd={sendRequest} />
          </>
        )}

        <MyEventsSection
          events={myEvents}
          onSeeAll={onAllEventsClick ?? onCalendarClick}
          onEventClick={onNotifEventClick ?? onEventClick}
          onCreateClick={onCreateClick}
        />

        <TrendingSection onCreateEvent={onTrendingClick} />
        <InviteCard onToast={showToast} />
      </div>

      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        currentUser={session?.user}
        onEventOpen={onNotifEventClick ?? onEventClick}
        onMessagesOpen={onNotifMessageClick}
        onCreateEvent={onCreateClick}
        onNotificationsRead={onNotificationsRead}
        onAcceptFriend={acceptRequest}
        onDeclineFriend={declineRequest}
      />

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: 16, right: 16, zIndex: 400,
          background: toast.isError ? '#FF3B30' : '#34C759',
          color: '#fff', borderRadius: 14, padding: '13px 18px',
          textAlign: 'center', fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
