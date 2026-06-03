import { useState } from 'react'
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
  const { invitations, refetchInvitations, myEvents, profileName, profileAvatar } = useHomeData(userId, userEmail)
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
  const availableFriendsCount = new Set(availabilityFeed.filter(p => p.user_id !== userId).map(p => p.user_id)).size

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '20px 2px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, flexShrink: 0, overflow: 'hidden' }}>
              {profileAvatar ? (
                <img src={profileAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 23 }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #c5b49a, #a89070)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 19, fontWeight: 600, color: '#fff',
                }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 13, color: '#8E8E93', fontWeight: 400, lineHeight: 1 }}>
                Bonjour,
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.2 }}>
                <span style={{
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {displayName}
                </span>
              </div>
              {availableFriendsCount > 0 ? (
                <div
                  onClick={() => {
                    if (onDispoCalendarClick) onDispoCalendarClick()
                    else onDispoDetailClick?.(availabilityFeed[0].id)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759', flexShrink: 0, animation: 'pulse-dot 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, color: '#1C1C1E', fontWeight: 500 }}>
                    {availableFriendsCount} ami{availableFriendsCount > 1 ? 's' : ''} disponible{availableFriendsCount > 1 ? 's' : ''} cette semaine
                  </span>
                  <span style={{ color: '#AEAEB2', fontSize: 12 }}>›</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#8E8E93', fontWeight: 400 }}>
                  {dateStr}
                </div>
              )}
            </div>
          </div>
          <div
            onClick={() => setShowNotifications(true)}
            style={{
              width: 38, height: 38, background: '#fff', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.10)', flexShrink: 0, cursor: 'pointer',
              position: 'relative',
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: '#1C1C1E', fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notificationUnreadCount > 0 && (
              <div style={{
                position: 'absolute', top: 6, right: 6,
                width: 8, height: 8, borderRadius: '50%',
                background: '#FF3B30', border: '1.5px solid #fff',
              }} />
            )}
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <>
            <SectionHeader title="Demandes d'amitié" badge={pendingRequests.length} />
            <FriendRequests requests={pendingRequests} onAccept={acceptRequest} onDecline={declineRequest} />
          </>
        )}

        <InvitationsSection invitations={invitations} userId={userId} userEmail={userEmail} onUpdate={refetchInvitations} />

        <BirthdaySection
          user={session?.user}
          onToast={showToast}
          onMessage={onMessagesClick}
          refreshTrigger={birthdayRefreshTrigger}
          availabilityFeed={availabilityFeed}
          availableFriendsCount={availableFriendsCount}
          nextEvent={myEvents[0] ?? null}
          onAvailabilityClick={() => {
            if (onDispoCalendarClick) onDispoCalendarClick()
            else onDispoDetailClick?.(availabilityFeed.find(post => post.user_id !== userId)?.id)
          }}
          onEventClick={onNotifEventClick ?? onEventClick}
        />

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
