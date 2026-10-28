import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './lib/supabase'
import { isNative, parseDeepLink } from './lib/native'
import { identifyUser, resetAnalyticsUser, track } from './lib/analytics'
import { captureSupabaseError, clearMonitoringUser, setMonitoringUser } from './lib/monitoring'
import { useNotifications } from './hooks/useNotifications'
import { useUnreadCounts } from './hooks/useUnreadCounts'
import BottomNav from './components/BottomNav'
import CreateActionSheet from './components/CreateActionSheet'
import AddAmivModal from './components/AddAmivModal'
import OnboardingFlow from './pages/Onboarding'
import Auth from './screens/Auth'
import AuthCallback from './screens/AuthCallback'
import Home from './screens/Home'
import Calendar from './screens/Calendar'
import Messages from './screens/Messages'
import Create from './screens/Create'
import CreateDispoScreen from './screens/CreateDispoScreen'
import CloseFriendsScreen from './screens/CloseFriendsScreen'
import DispoDetailScreen from './screens/DispoDetailScreen'
import EventDetail from './screens/EventDetail'
import Invitation from './screens/Invitation'
import Profile from './screens/Profile'
import EditProfile from './screens/EditProfile'
import GuestRsvpPage from './screens/GuestRsvpPage'
import AllEvents from './screens/AllEvents'
import ConversationScreen from './screens/ConversationScreen'
import EventPage from './pages/EventPage'
import DispoCalendarPage from './pages/DispoCalendarPage'
import UsernamePrompt from './components/UsernamePrompt'

// Écrans secondaires chargés à la demande (hors premier écran)
const SecretSpacePage = lazy(() => import('./pages/SecretSpacePage'))
const OrganizerSpacePage = lazy(() => import('./pages/OrganizerSpacePage'))
const MemoriesPage = lazy(() => import('./pages/MemoriesPage'))
const PublicUserProfile = lazy(() => import('./screens/PublicUserProfile'))
const AuthReset = lazy(() => import('./screens/AuthReset'))
const TermsPage = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.TermsPage })))
const PrivacyPage = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.PrivacyPage })))
const SupportPage = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.SupportPage })))
const LegalNoticePage = lazy(() => import('./pages/LegalPages').then(m => ({ default: m.LegalNoticePage })))

function SplashScreen() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ fontSize: 48, fontWeight: 900, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Amiv</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {isNative && <NativeDeepLinks />}
      <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/events/:id/secret-space" element={<SecretSpacePage />} />
        <Route path="/events/:id/souvenirs" element={<MemoriesPage />} />
        <Route path="/events/:id/manage" element={<OrganizerSpacePage />} />
        <Route path="/events/:id/organizer-space" element={<OrganizerSpacePage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/u/:username" element={<PublicUserProfile />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/reset" element={<AuthReset />} />
        <Route path="/cgu" element={<TermsPage />} />
        <Route path="/confidentialite" element={<PrivacyPage />} />
        <Route path="/mentions-legales" element={<LegalNoticePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

// Deep links natifs (amiv://… et futurs Universal Links https://amiv.app/…)
function NativeDeepLinks() {
  const navigate = useNavigate()

  useEffect(() => {
    const listener = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      const link = parseDeepLink(url)
      if (!link) return

      const accessToken = link.params.get('access_token')
      const refreshToken = link.params.get('refresh_token')
      const code = link.params.get('code')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (error) captureSupabaseError(error, { operation: 'deep_link_set_session' })
        navigate('/', { replace: true })
        return
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) captureSupabaseError(error, { operation: 'deep_link_exchange_code' })
        navigate('/', { replace: true })
        return
      }
      if (link.path === '/auth/callback') {
        navigate('/', { replace: true })
        return
      }
      navigate(link.path + link.search)
    })
    return () => { listener.then(l => l.remove()) }
  }, [navigate])

  return null
}

function MainApp() {
  const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)/)
  if (inviteMatch) return <GuestRsvpPage token={inviteMatch[1]} />

  // Connexion par défaut ; /register (lien « Rejoindre Amiv ») ouvre l'inscription
  const authInitLogin = window.location.pathname !== '/register'
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [onboardingCompleted, setOnboardingCompleted] = useState(null)
  const [hasUsername, setHasUsername] = useState(null)
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState('home')
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [showCreateDispo, setShowCreateDispo] = useState(false)
  const [showCloseFriends, setShowCloseFriends] = useState(false)
  const [dispoDetailId, setDispoDetailId] = useState(null)
  const [showAddAmiv, setShowAddAmiv] = useState(false)
  const [birthdayRefreshTrigger, setBirthdayRefreshTrigger] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [conversationEvent, setConversationEvent] = useState(null)
  const [directConv, setDirectConv] = useState(null)
  const [createInitialData, setCreateInitialData] = useState(null)
  const [editProfileFocus, setEditProfileFocus] = useState(null)
  const appLoadedTracked = useRef(false)
  const { notifications, markAsRead, markAllAsRead } = useNotifications(session?.user?.id)
  const { totalUnread } = useUnreadCounts(session?.user?.id)
  const hasUnreadNotifications = notifications.some(n => n.type !== 'message_received' && !n.read)
  const notificationUnreadCount = notifications.filter(
    n => !n.read && n.type !== 'message_received'
  ).length
  const pendingEventId = useRef(
    window.location.pathname.match(/^\/events\/([^/]+)/)?.[1] ?? null
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user?.id) {
        identifyUser(session.user.id)
        setMonitoringUser(session.user.id)
      }
      if (!appLoadedTracked.current) {
        track('app_loaded', {
          authenticated: Boolean(session),
          path: window.location.pathname,
        })
        appLoadedTracked.current = true
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        if (_event === 'SIGNED_OUT') track('logout')
        resetAnalyticsUser()
        clearMonitoringUser()
        setOnboardingCompleted(null)
        setHasUsername(null)
      } else if (_event === 'SIGNED_IN') {
        identifyUser(session.user.id)
        setMonitoringUser(session.user.id)
        track('login_succeeded')
        const path = window.location.pathname
        const redirect = new URLSearchParams(window.location.search).get('redirect')
        if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
          window.history.replaceState(null, '', redirect)
          return
        }
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
      .rpc('get_my_profile')
      .select('onboarding_completed, username')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) captureSupabaseError(error, { operation: 'load_profile_onboarding_state' })
        setOnboardingCompleted(data?.onboarding_completed === true)
        setHasUsername(!!data?.username)
      })
  }, [session, onboardingCompleted])

  useEffect(() => {
    if (!session || !pendingEventId.current) return
    const id = pendingEventId.current
    pendingEventId.current = null
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(id)) return
    supabase.from('events').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error) captureSupabaseError(error, { operation: 'load_pending_event' })
      if (data) {
        setSelectedEvent(data)
        setScreen('eventDetail')
        window.history.replaceState(null, '', '/')
      }
    })
  }, [session])

  const isLoading = loading || (!!session && (onboardingCompleted === null || hasUsername === null))

  if (isLoading) return <SplashScreen />

  if (!session) return <Auth initialIsLogin={authInitLogin} />
  if (!onboardingCompleted) return <OnboardingFlow session={session} onComplete={() => { track('onboarding_completed'); setOnboardingCompleted(true); setHasUsername(true) }} />
  if (!hasUsername) return <UsernamePrompt session={session} onComplete={() => setHasUsername(true)} />

  const handleEventClick = (event) => { setSelectedEvent(event); setScreen('eventDetail') }
  const handleTabChange = (newTab) => {
    track('tab_changed', { tab: newTab })
    setTab(newTab)
    setScreen(newTab)
    setSelectedEvent(null)
    setConversationEvent(null)
    setDirectConv(null)
  }
  const handleNotifEventClick = async (partialEvent) => {
    const { data, error } = await supabase.from('events').select('*').eq('id', partialEvent.id).maybeSingle()
    if (error) captureSupabaseError(error, { operation: 'load_notification_event' })
    if (data) { setSelectedEvent(data); setScreen('eventDetail') }
  }
  const handleNotifMessageClick = async (partialEvent) => {
    const { data, error } = await supabase.from('events').select('*').eq('id', partialEvent.id).maybeSingle()
    if (error) captureSupabaseError(error, { operation: 'load_notification_message_event' })
    if (data) { setSelectedEvent(data); setScreen('messages') }
  }
  const handleCreateFromDispo = (post) => {
    setCreateInitialData({
      title: post?.message ? post.message.slice(0, 48) : '',
      desc: post?.message ?? '',
      description: post?.message ?? '',
      emoji: post?.moods?.includes('cafe') ? '☕' : post?.moods?.includes('diner') ? '🍽️' : post?.moods?.includes('cine') ? '🎬' : undefined,
    })
    setShowCreateDispo(false)
    setDispoDetailId(null)
    setScreen('create')
  }

  const isDetailScreen =
    showCloseFriends ||
    showCreateDispo ||
    !!dispoDetailId ||
    screen === 'create' ||
    screen === 'editProfile' ||
    screen === 'allEvents' ||
    screen === 'dispoCalendar' ||
    (screen === 'invitation' && selectedEvent) ||
    (screen === 'eventDetail' && selectedEvent) ||
    (screen === 'messages' && selectedEvent) ||
    !!directConv ||
  !!conversationEvent

  const renderCurrentScreen = () => {
    if (showCloseFriends) return (
      <CloseFriendsScreen
        onBack={() => setShowCloseFriends(false)}
        userId={session?.user?.id}
      />
    )
    if (showCreateDispo) return (
      <CreateDispoScreen
        onBack={() => setShowCreateDispo(false)}
        userId={session.user.id}
        onManageCloseFriends={() => setShowCloseFriends(true)}
      />
    )
    if (dispoDetailId) return (
      <DispoDetailScreen
        postId={dispoDetailId}
        currentUserId={session.user.id}
        onBack={() => setDispoDetailId(null)}
        onCreateEvent={handleCreateFromDispo}
      />
    )
    if (screen === 'allEvents') return <AllEvents onBack={() => setScreen('home')} onEventClick={handleEventClick} />
    if (screen === 'dispoCalendar') return <DispoCalendarPage userId={session.user.id} onBack={() => setScreen('home')} />
    if (screen === 'create') return <Create onBack={() => setScreen('home')} session={session} initialData={createInitialData} />
    if (screen === 'editProfile') return (
      <EditProfile
        initialFocus={editProfileFocus}
        onBack={() => { setEditProfileFocus(null); setTab('profile'); setScreen('home') }}
        onSave={() => { setEditProfileFocus(null); setTab('profile'); setScreen('home') }}
      />
    )
    if (screen === 'messages' && selectedEvent) return (
      <Messages event={selectedEvent} onBack={() => setScreen('eventDetail')} notifications={notifications} markAsRead={markAsRead} />
    )
    if (screen === 'eventDetail' && selectedEvent) return (
      <EventDetail event={selectedEvent} onBack={() => setScreen('home')} onInvitation={() => setScreen('invitation')} onChat={ev => { setConversationEvent(ev); setScreen('messages') }} onMessagesClick={ev => { setSelectedEvent(ev); setScreen('messages') }} />
    )
    if (screen === 'invitation' && selectedEvent) return (
      <Invitation event={selectedEvent} onBack={() => setScreen('eventDetail')} />
    )

    switch (tab) {
      case 'home': return <Home onEventClick={handleEventClick} onNotifEventClick={handleNotifEventClick} onNotifMessageClick={handleNotifMessageClick} notificationUnreadCount={notificationUnreadCount} onNotificationsRead={() => markAllAsRead(false)} onCreateClick={(initialData = null) => { setCreateInitialData(initialData); setScreen('create') }} onTrendingClick={(data) => { setCreateInitialData(data); setScreen('create') }} onMessagesClick={() => handleTabChange('messages')} onAllEventsClick={() => setScreen('allEvents')} onCalendarClick={() => handleTabChange('calendar')} onDispoDetailClick={(id) => setDispoDetailId(id)} onDispoCalendarClick={() => setScreen('dispoCalendar')} session={session} birthdayRefreshTrigger={birthdayRefreshTrigger} />
      case 'calendar': return <Calendar onEventClick={handleEventClick} onCreateClick={() => { setCreateInitialData(null); setScreen('create') }} onMessagesClick={ev => { setSelectedEvent(ev); setScreen('messages') }} />
      case 'messages':
        if (directConv) {
          return (
            <ConversationScreen
              conversationId={directConv.conversationId}
              friend={directConv.friend}
              onBack={() => setDirectConv(null)}
              onFriendChange={friend => setDirectConv(prev => prev ? { ...prev, friend } : prev)}
            />
          )
        }
        if (conversationEvent) {
          return <Messages event={conversationEvent} onBack={() => setConversationEvent(null)} notifications={notifications} markAsRead={markAsRead} />
        }
        return <Messages onEventOpen={setConversationEvent} onDirectConvOpen={setDirectConv} notifications={notifications} markAsRead={markAsRead} onCreateClick={() => { setCreateInitialData(null); setScreen('create') }} />
      case 'profile': return (
        <Profile
          session={session}
          onEdit={() => { setEditProfileFocus(null); setScreen('editProfile') }}
          onAddBirthday={() => { setEditProfileFocus('birthday'); setScreen('editProfile') }}
          onCalendarClick={() => handleTabChange('calendar')}
        />
      )
      default: return null
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', maxWidth: 430, margin: '0 auto', width: '100%', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
        {renderCurrentScreen()}
      </div>
      <BottomNav
        current={tab}
        onChange={handleTabChange}
        onCreateClick={() => setShowCreateSheet(true)}
        hasUnreadMessages={totalUnread > 0}
        hasUnreadNotifications={hasUnreadNotifications}
        hidden={isDetailScreen}
      />
      {showCreateSheet && (
        <CreateActionSheet
          onClose={() => setShowCreateSheet(false)}
          onCreateEvent={() => { setCreateInitialData(null); setScreen('create') }}
          onAddAmiv={() => setShowAddAmiv(true)}
        />
      )}
      {showAddAmiv && (
        <AddAmivModal
          onClose={() => setShowAddAmiv(false)}
          onSaved={() => { setShowAddAmiv(false); setBirthdayRefreshTrigger(t => t + 1) }}
        />
      )}
    </div>
  )
}
