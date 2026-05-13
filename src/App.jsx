import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useNotifications } from './hooks/useNotifications'
import BottomNav from './components/BottomNav'
import CreateActionSheet from './components/CreateActionSheet'
import AddAmivModal from './components/AddAmivModal'
import Onboarding from './screens/Onboarding'
import OnboardingFlow from './pages/Onboarding'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Calendar from './screens/Calendar'
import Messages from './screens/Messages'
import Create from './screens/Create'
import EventDetail from './screens/EventDetail'
import Invitation from './screens/Invitation'
import Profile from './screens/Profile'
import EditProfile from './screens/EditProfile'
import GuestRsvpPage from './screens/GuestRsvpPage'
import AllEvents from './screens/AllEvents'
import ConversationScreen from './screens/ConversationScreen'
import SecretSpacePage from './pages/SecretSpacePage'
import OrganizerSpacePage from './pages/OrganizerSpacePage'
import EventPage from './pages/EventPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/events/:id/secret-space" element={<SecretSpacePage />} />
        <Route path="/events/:id/organizer-space" element={<OrganizerSpacePage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  )
}

function MainApp() {
  const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)/)
  if (inviteMatch) return <GuestRsvpPage token={inviteMatch[1]} />

  const [hasOnboarded, setHasOnboarded] = useState(false)
  const [authInitLogin, setAuthInitLogin] = useState(false)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboardingCompleted, setOnboardingCompleted] = useState(null)
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState('home')
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [showAddAmiv, setShowAddAmiv] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [conversationEvent, setConversationEvent] = useState(null)
  const [directConv, setDirectConv] = useState(null)
  const { notifications, markAsRead, markAllAsReadByType } = useNotifications(session?.user?.id)
  const unreadMessagesCount = notifications.filter(n => n.type === 'message_received' && !n.read).length
  const hasUnreadNotifications = notifications.some(n => n.type !== 'message_received' && !n.read)
  const pendingEventId = useRef(
    window.location.pathname.match(/^\/events\/([^/]+)/)?.[1] ?? null
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) setHasOnboarded(true)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setOnboardingCompleted(null)
      } else if (_event === 'SIGNED_IN') {
        const path = window.location.pathname
        if (path !== '/' && !path.startsWith('/invite/') && !path.startsWith('/events/')) {
          window.history.replaceState(null, '', '/')
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || onboardingCompleted !== null) return
    supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setOnboardingCompleted(data?.onboarding_completed === true)
      })
  }, [session, onboardingCompleted])

  useEffect(() => {
    if (!session || !pendingEventId.current) return
    const id = pendingEventId.current
    pendingEventId.current = null
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(id)) return
    supabase.from('events').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        setSelectedEvent(data)
        setScreen('eventDetail')
        window.history.replaceState(null, '', '/')
      }
    })
  }, [session])

  const isLoading = loading || (!!session && onboardingCompleted === null)

  if (isLoading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ fontSize: 48, fontWeight: 900, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Amiv</div>
    </div>
  )

  if (!hasOnboarded) return <Onboarding onFinish={(loginMode) => { setAuthInitLogin(loginMode); setHasOnboarded(true) }} />
  if (!session) return <Auth initialIsLogin={authInitLogin} />
  if (!onboardingCompleted) return <OnboardingFlow session={session} onComplete={() => setOnboardingCompleted(true)} />

  const handleEventClick = (event) => { setSelectedEvent(event); setScreen('eventDetail') }
  const handleTabChange = (newTab) => {
    if (newTab === 'messages') markAllAsReadByType('message_received')
    setTab(newTab)
    setScreen('home')
    setConversationEvent(null)
    setDirectConv(null)
  }
  const handleNotifEventClick = async (partialEvent) => {
    const { data } = await supabase.from('events').select('*').eq('id', partialEvent.id).maybeSingle()
    if (data) { setSelectedEvent(data); setScreen('eventDetail') }
  }

  const isDetailScreen =
    screen === 'create' ||
    screen === 'editProfile' ||
    screen === 'allEvents' ||
    (screen === 'invitation' && selectedEvent) ||
    (screen === 'eventDetail' && selectedEvent) ||
    (screen === 'messages' && selectedEvent) ||
    !!directConv

  const renderCurrentScreen = () => {
    if (screen === 'allEvents') return <AllEvents onBack={() => setScreen('home')} onEventClick={handleEventClick} />
    if (screen === 'create') return <Create onBack={() => setScreen('home')} session={session} />
    if (screen === 'editProfile') return (
      <EditProfile onBack={() => { setTab('profile'); setScreen('home') }} onSave={() => { setTab('profile'); setScreen('home') }} />
    )
    if (screen === 'messages' && selectedEvent) return (
      <Messages event={selectedEvent} onBack={() => setScreen('eventDetail')} />
    )
    if (screen === 'eventDetail' && selectedEvent) return (
      <EventDetail event={selectedEvent} onBack={() => setScreen('home')} onInvitation={() => setScreen('invitation')} onMessagesClick={ev => { setSelectedEvent(ev); setScreen('messages') }} />
    )
    if (screen === 'invitation' && selectedEvent) return (
      <Invitation event={selectedEvent} onBack={() => setScreen('eventDetail')} />
    )

    switch (tab) {
      case 'home': return <Home onEventClick={handleEventClick} onNotifEventClick={handleNotifEventClick} onCreateClick={() => setScreen('create')} onMessagesClick={() => handleTabChange('messages')} onAllEventsClick={() => setScreen('allEvents')} session={session} />
      case 'calendar': return <Calendar onEventClick={handleEventClick} onCreateClick={() => setScreen('create')} onMessagesClick={ev => { setSelectedEvent(ev); setScreen('messages') }} />
      case 'messages':
        if (directConv) {
          return <ConversationScreen conversationId={directConv.conversationId} friend={directConv.friend} onBack={() => setDirectConv(null)} />
        }
        if (conversationEvent) {
          return <Messages event={conversationEvent} onBack={() => setConversationEvent(null)} notifications={notifications} markAsRead={markAsRead} />
        }
        return <Messages onEventOpen={setConversationEvent} onDirectConvOpen={setDirectConv} notifications={notifications} markAsRead={markAsRead} onCreateClick={() => setScreen('create')} />
      case 'profile': return <Profile session={session} onEdit={() => setScreen('editProfile')} />
      default: return null
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', width: '100%', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderCurrentScreen()}
      </div>
      <BottomNav
        current={tab}
        onChange={handleTabChange}
        onCreateClick={() => setShowCreateSheet(true)}
        hasUnreadMessages={unreadMessagesCount > 0}
        hasUnreadNotifications={hasUnreadNotifications}
        hidden={isDetailScreen}
      />
      {showCreateSheet && (
        <CreateActionSheet
          onClose={() => setShowCreateSheet(false)}
          onCreateEvent={() => setScreen('create')}
          onAddAmiv={() => setShowAddAmiv(true)}
        />
      )}
      {showAddAmiv && (
        <AddAmivModal
          onClose={() => setShowAddAmiv(false)}
          onSaved={() => setShowAddAmiv(false)}
        />
      )}
    </div>
  )
}
