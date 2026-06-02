import { useState } from 'react'
import { Plus, Search, UserPlus } from 'lucide-react'
import { BG, BLACK, FONT, GRADIENT, GRAY1, GRAY2, PAGE_BG, WHITE } from './constants'
import { firstName } from './utils'
import { Avatar, EmptyState, IconButton, SkeletonRow } from './MessageUI'
import ConversationRow from './ConversationRow'
import EventConversationCard from './EventConversationCard'
import NewMessageSheet from './NewMessageSheet'
import FriendSearchSheet from './FriendSearchSheet'

export default function ConversationList({
  unreadTotal,
  openNewMessage,
  friendsLoading,
  friends,
  conversationsByFriendId,
  appOpenedAtRef,
  userId,
  currentUserId,
  activeTab,
  setActiveTab,
  hiddenEventIds,
  showAllHiddenEvents,
  listLoading,
  visibleConversations,
  unreadByConversation,
  handleConversationTap,
  hideEventCard,
  hideConversation,
  showNewMessage,
  setShowNewMessage,
  openFriend,
  onFriendAdded,
}) {
  const [showFriendSearch, setShowFriendSearch] = useState(false)
  const effectiveUserId = currentUserId || userId
  const tabs = [
    { id: 'all', label: 'Tous' },
    { id: 'events', label: 'Événements 🎉' },
    { id: 'directs', label: 'Directs' },
    { id: 'unread', label: 'Non lus', badge: unreadTotal },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: PAGE_BG, overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ padding: '18px 16px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.1, fontWeight: 800, color: BLACK, letterSpacing: 0 }}>
              Messages
            </h1>
            <div style={{ marginTop: 4, fontSize: 13, color: GRAY1 }}>
              {unreadTotal} non lu{unreadTotal > 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconButton label="Rechercher"><Search size={17} strokeWidth={2.2} color={BLACK} /></IconButton>
            <IconButton label="Composer" gradient onClick={openNewMessage}><Plus size={22} strokeWidth={2} color={WHITE} /></IconButton>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 90 }}>
        <section style={{ padding: '8px 16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GRAY1, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 }}>
            AMIS
          </div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6, scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setShowFriendSearch(true)}
              style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 58, flexShrink: 0, cursor: 'pointer', fontFamily: FONT }}
            >
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: `1.5px dashed ${GRAY2}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={22} strokeWidth={2} color={GRAY1} />
              </div>
              <span style={{ maxWidth: 58, fontSize: 11, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Ajouter
              </span>
            </button>
            {friendsLoading ? (
              [0, 1, 2, 3].map(item => <div key={item} style={{ width: 58, height: 68, flexShrink: 0, borderRadius: 16, background: 'rgba(255,255,255,0.7)' }} />)
            ) : friends.length === 0 ? (
              <div style={{ fontSize: 13, color: GRAY1, padding: '8px 0 12px' }}>Aucun ami pour l'instant</div>
            ) : friends.map(friend => {
              const conv = conversationsByFriendId.get(friend.friend_id)
              const openedAt = new Date(appOpenedAtRef.current || 0).getTime()
              const hasFreshMessages = conv?.lastMessage?.sender_id !== effectiveUserId && new Date(conv?.lastAt || 0).getTime() > openedAt
              return (
                <button
                  key={friend.friend_id}
                  type="button"
                  onClick={() => openFriend(friend)}
                  style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 58, flexShrink: 0, cursor: 'pointer', fontFamily: FONT }}
                >
                  <div style={{ padding: 2, borderRadius: '50%', background: hasFreshMessages ? GRADIENT : '#E5E5EA' }}>
                    <div style={{ padding: 2, borderRadius: '50%', background: BG }}>
                      <Avatar name={friend.friend_name} url={friend.friend_avatar} size={48} isCloseFriend={friend.is_close_friend} />
                    </div>
                  </div>
                  <span style={{ maxWidth: 58, fontSize: 11, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firstName(friend.friend_name)}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section style={{ padding: '14px 16px 0' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {tabs.map(tab => {
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{ border: 'none', borderRadius: 20, background: isActive ? GRADIENT : WHITE, color: isActive ? WHITE : BLACK, padding: '8px 14px', minHeight: 34, display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: isActive ? '0 2px 8px rgba(224,85,170,0.20)' : 'none', fontFamily: FONT, cursor: 'pointer' }}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: '#FF3B30', color: WHITE, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <section style={{ padding: '12px 16px 0' }}>
          {hiddenEventIds.size > 0 && (activeTab === 'all' || activeTab === 'events') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button
                type="button"
                onClick={showAllHiddenEvents}
                style={{ border: 'none', background: 'transparent', fontSize: 12, color: '#007AFF', cursor: 'pointer', padding: 0, fontFamily: FONT }}
              >
                Afficher masqués
              </button>
            </div>
          )}
          {listLoading ? (
            <div>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow isLast />
            </div>
          ) : visibleConversations.length === 0 ? (
            <EmptyState activeTab={activeTab} onNewMessage={openNewMessage} />
          ) : (
            <div>
              {visibleConversations.map((conv, index) => (
                conv.kind === 'event' ? (
                  <EventConversationCard
                    key={conv.id}
                    conversation={conv}
                    onOpenChannel={secretChannel => handleConversationTap(conv, secretChannel)}
                    onHide={() => hideEventCard(conv.eventId)}
                  />
                ) : (
                  <ConversationRow
                    key={conv.id}
                    conversation={{ ...conv, unreadCount: unreadByConversation.get(conv.conversationId) ?? 0 }}
                    isLast={index === visibleConversations.length - 1}
                    onClick={() => handleConversationTap(conv)}
                    onDelete={() => hideConversation(conv)}
                  />
                )
              ))}
            </div>
          )}
        </section>
      </div>
      {showNewMessage && (
        <NewMessageSheet
          friends={friends}
          loading={friendsLoading}
          onClose={() => setShowNewMessage(false)}
          onSelectFriend={openFriend}
        />
      )}
      {showFriendSearch && (
        <FriendSearchSheet
          currentUserId={effectiveUserId}
          onClose={() => setShowFriendSearch(false)}
          onFriendAdded={onFriendAdded}
        />
      )}
    </div>
  )
}
