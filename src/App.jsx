import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from './lib/supabase'
import { isNative, parseDeepLink, setStatusBarDark } from './lib/native'
import { initPushListeners, onPushTarget, refreshPushRegistration, setPendingPushTarget, shouldShowPushPrompt, takePendingPushTarget } from './lib/push'
import { identifyUser, resetAnalyticsUser, track } from './lib/analytics'
import { captureSupabaseError, clearMonitoringUser, setMonitoringUser } from './lib/monitoring'
import { useNotifications } from './hooks/useNotifications'
import { useUnreadCounts } from './hooks/useUnreadCounts'
import BottomNav from './components/BottomNav'
import CreateActionSheet from './components/CreateActionSheet'
import AddAmivModal from './components/AddAmivModal'
import AskBirthdaySheet from './components/AskBirthdaySheet'
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
import PushPermissionPrompt from './components/PushPermissionPrompt'

// Écrans secondaires chargés à la demande (hors premier écran)
const SecretSpacePage = lazy(() => import('./pages/SecretSpacePage'))
const OrganizerSpacePage = lazy(() => import('./pages/OrganizerSpacePage'))
const MemoriesPage = lazy(() => import('./pages/MemoriesPage'))
const PublicUserProfile = lazy(() => import('./screens/PublicUserProfile'))
const BirthdayRequestPage = lazy(() => import('./screens/BirthdayRequestPage'))
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
      {isNative && <NativePushListener />}
      <Suspense fallback={<SplashScreen />}>
      <Routes>
        <Route path="/events/:id/souvenirs" element={<MemoriesPage />} />
        <Route path="/events/:id/manage" element={<OrganizerSpacePage />} />
        <Route path="/events/:id/organizer-space" element={<OrganizerSpacePage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/u/:username" element={<PublicUserProfile />} />
        <Route path="/anniv/:code" element={<BirthdayRequestPage />} />
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

// Appui sur une notification push : profil et souvenirs sont des routes ;
// événement, conversation d'événement et message privé sont des écrans de
// MainApp, qui les ouvre dès que la session et l'onboarding sont chargés.
function NativePushListener() {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => initPushListeners((target, notificationId) => {
    if (target?.screen === 'event' || target?.screen === 'messages' || target?.screen === 'conversation') {
      if (window.location.pathname !== '/') navigateRef.current('/')
      setPendingPushTarget({ ...target, notificationId })
      return
    }
    if (notificationId) {
      supabase.from('notifications').update({ read: true }).eq('id', notificationId).then(({ error }) => {
        if (error) captureSupabaseError(error, { operation: 'mark_push_notification_read' })
      })
    }
    if (target?.screen === 'profile' && target.username) {
      navigateRef.current(`/u/${encodeURIComponent(target.username)}`)
    } else if (target?.screen === 'memories' && target.event_id) {
      navigateRef.current(`/events/${target.event_id}/souvenirs`)
    } else if (window.location.pathname !== '/') {
      navigateRef.current('/')
    }
  }), [])

  return null
}

// Écran affiché par MainApp. Chaque écran ouvert est une entrée de
// l'historique (location.state.amivNavKey) : le bouton retour de l'app, le
// balayage iOS et le retour du navigateur restaurent exactement l'écran
// précédent. Les écrans restent en mémoire (ils contiennent des objets non
// sérialisables) ; après un rechargement, on repart de l'accueil.
const ROOT_NAV = {
  tab: 'home',
  screen: 'home',
  selectedEvent: null,
  conversationEvent: null,
  directConv: null,
  showCloseFriends: false,
  showCreateDispo: false,
  dispoDetailId: null,
  createInitialData: null,
  editProfileFocus: null,
  // Espace secret d'un anniversaire : { eventId, tab, focusItemId }
  secretSpace: null,
  // Espace secret ↔ chat Secret : entrée d'historique de l'autre écran quand
  // l'un a été ouvert depuis l'autre (le lien y revient au lieu d'empiler).
  secretSpaceReturnKey: null,
  secretChatReturnKey: null,
  // Nombre d'écrans de MainApp ouverts avant celui-ci dans l'historique
  depth: 0,
}
const TAB_VIEWS = ['home', 'calendar', 'messages', 'profile']
const navEntries = new Map()
let navKeySeq = 0

// Conversation d'événement d'une entrée, rouverte sur l'onglet Secret
function withSecretChannel(entry) {
  if (entry.selectedEvent && entry.screen === 'messages') return { ...entry, selectedEvent: { ...entry.selectedEvent, initialIsSecret: true } }
  if (entry.conversationEvent) return { ...entry, conversationEvent: { ...entry.conversationEvent, initialIsSecret: true } }
  return entry
}

// Page réellement affichée : décide à la fois de l'écran rendu et de la
// visibilité de la barre du bas (visible seulement sur les onglets).
function currentView(nav) {
  if (nav.showCloseFriends) return 'closeFriends'
  if (nav.showCreateDispo) return 'createDispo'
  if (nav.dispoDetailId) return 'dispoDetail'
  if (nav.secretSpace) return 'secretSpace'
  if (['allEvents', 'dispoCalendar', 'create', 'editProfile'].includes(nav.screen)) return nav.screen
  if (nav.selectedEvent) {
    if (nav.screen === 'messages') return 'eventChat'
    if (nav.screen === 'eventDetail' || nav.screen === 'invitation') return nav.screen
  }
  if (nav.tab === 'messages') {
    if (nav.directConv) return 'directConversation'
    if (nav.conversationEvent) return 'eventConversation'
  }
  return nav.tab
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
  const location = useLocation()
  const routerNavigate = useNavigate()
  const nav = navEntries.get(location.state?.amivNavKey) ?? ROOT_NAV
  const navRef = useRef(nav)
  navRef.current = nav
  const { tab, selectedEvent, conversationEvent, directConv, createInitialData, editProfileFocus, dispoDetailId } = nav
  const view = currentView(nav)
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [showAddAmiv, setShowAddAmiv] = useState(false)
  const [showAskBirthday, setShowAskBirthday] = useState(false)
  const [birthdayRefreshTrigger, setBirthdayRefreshTrigger] = useState(0)
  const appLoadedTracked = useRef(false)
  const { notifications, markAsRead, markAllAsRead } = useNotifications(session?.user?.id)
  const { totalUnread } = useUnreadCounts(session?.user?.id)
  const hasUnreadNotifications = notifications.some(n => n.type !== 'message_received' && !n.read)
  const notificationUnreadCount = notifications.filter(
    n => !n.read && n.type !== 'message_received'
  ).length
  const [pushTarget, setPushTarget] = useState(() => takePendingPushTarget())
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  const pushNavEntry = (next, replace) => {
    const amivNavKey = `nav-${++navKeySeq}`
    navEntries.set(amivNavKey, next)
    routerNavigate(
      { pathname: window.location.pathname, search: window.location.search },
      { replace, state: { amivNavKey } }
    )
  }
  // Ouvre un écran par-dessus l'écran actuel (nouvelle entrée d'historique)
  const openScreen = (patch) => pushNavEntry({ ...navRef.current, ...patch, depth: navRef.current.depth + 1 }, false)
  // Modifie l'écran actuel sans ajouter d'entrée d'historique
  const replaceScreen = (patch) => pushNavEntry({ ...navRef.current, ...patch, depth: navRef.current.depth }, true)
  // Retour : revient à l'entrée précédente, ou, si l'écran a été ouvert
  // directement (lien, notification au lancement), affiche `fallback`.
  const goBack = (fallback) => {
    if (navRef.current.depth > 0) routerNavigate(-1)
    else replaceScreen(fallback)
  }
  // Revient à une entrée précédente (l'écran juste avant) après l'avoir modifiée
  const returnTo = (key, patchEntry) => {
    const entry = navEntries.get(key)
    if (!entry || navRef.current.depth === 0) return false
    navEntries.set(key, patchEntry(entry))
    routerNavigate(-1)
    return true
  }

  // Chat de l'événement → espace secret
  const openSecretSpace = ({ eventId, tab = 'flashback', focusItemId = null }) => {
    const current = navRef.current
    const secretSpace = { eventId, tab, focusItemId }
    if (current.secretSpaceReturnKey && returnTo(current.secretSpaceReturnKey, entry => ({ ...entry, secretSpace }))) return
    const currentKey = location.state?.amivNavKey
    // Au retour, le chat se rouvre sur l'onglet Secret
    if (currentKey && navEntries.has(currentKey)) navEntries.set(currentKey, withSecretChannel(navEntries.get(currentKey)))
    openScreen({ secretSpace, secretChatReturnKey: currentKey ?? null, secretSpaceReturnKey: null })
  }
  // Espace secret → chat de l'événement, onglet Secret
  const openSecretChat = (event) => {
    const current = navRef.current
    if (current.secretChatReturnKey && returnTo(current.secretChatReturnKey, withSecretChannel)) return
    openScreen({
      secretSpace: null,
      secretChatReturnKey: null,
      secretSpaceReturnKey: location.state?.amivNavKey ?? null,
      selectedEvent: { ...event, initialIsSecret: true },
      screen: 'messages',
    })
  }

  const pendingEventId = useRef(
    window.location.pathname.match(/^\/events\/([^/]+)/)?.[1] ?? null
  )
  const pendingSecretSpace = useRef(/^\/events\/[^/]+\/secret-space\/?$/.test(window.location.pathname))

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
        window.history.replaceState(window.history.state, '', '/')
        replaceScreen({ selectedEvent: data, screen: 'eventDetail' })
        // Lien direct vers l'espace secret : par-dessus la fiche, le retour y mène
        if (pendingSecretSpace.current) {
          pendingSecretSpace.current = false
          pushNavEntry({ ...ROOT_NAV, selectedEvent: data, screen: 'eventDetail', secretSpace: { eventId: data.id, tab: 'flashback', focusItemId: null }, depth: 1 }, false)
        }
      }
    })
  }, [session])

  useEffect(() => {
    const off = onPushTarget(() => setPushTarget(takePendingPushTarget()))
    // Cible arrivée entre le premier rendu et cet abonnement
    const missed = takePendingPushTarget()
    if (missed) setPushTarget(missed)
    return off
  }, [])

  // À chaque lancement (et connexion) : met à jour le jeton de l'appareil.
  useEffect(() => {
    if (session?.user?.id) refreshPushRegistration()
  }, [session?.user?.id])

  const appReady = !!session && onboardingCompleted === true && hasUsername === true

  useEffect(() => {
    if (!appReady) return
    let cancelled = false
    shouldShowPushPrompt().then(show => { if (!cancelled) setShowPushPrompt(show) })
    return () => { cancelled = true }
  }, [appReady])

  // Message privé : ouvre la conversation avec l'expéditeur (forme « friend »
  // attendue par ConversationScreen) et marque ses notifications comme lues.
  const openDirectConversation = async (conversationId, senderId) => {
    const { data, error } = await supabase.from('profiles').select('id, first_name, name, avatar_url').eq('id', senderId).maybeSingle()
    if (error) captureSupabaseError(error, { operation: 'load_direct_message_sender' })
    notifications
      .filter(n => n.type === 'message_received' && !n.read && n.data?.conversation_id === conversationId)
      .forEach(n => markAsRead(n.id))
    openScreen({
      ...ROOT_NAV,
      tab: 'messages',
      screen: 'messages',
      directConv: {
        conversationId,
        friend: {
          friend_id: senderId,
          friend_name: [data?.first_name, data?.name].filter(Boolean).join(' ') || 'Ami',
          friend_avatar: data?.avatar_url ?? '',
        },
      },
    })
  }

  useEffect(() => {
    if (!appReady || !pushTarget) return
    const { screen: targetScreen, event_id: eventId, notificationId } = pushTarget
    setPushTarget(null)
    if (notificationId) markAsRead(notificationId)
    if (targetScreen === 'conversation') {
      openDirectConversation(pushTarget.conversation_id, pushTarget.sender_id)
      return
    }
    supabase.from('events').select('*').eq('id', eventId).maybeSingle().then(({ data, error }) => {
      if (error) captureSupabaseError(error, { operation: 'load_push_notification_event' })
      if (!data) return
      openScreen({
        ...ROOT_NAV,
        tab: navRef.current.tab,
        selectedEvent: data,
        screen: targetScreen === 'messages' ? 'messages' : 'eventDetail',
      })
    })
  }, [appReady, pushTarget])

  // En-tête sombre de l'espace secret jusque sous la barre d'état
  useEffect(() => {
    if (view !== 'secretSpace') return undefined
    setStatusBarDark(true)
    return () => setStatusBarDark(false)
  }, [view])

  const isLoading = loading || (!!session && (onboardingCompleted === null || hasUsername === null))

  if (isLoading) return <SplashScreen />

  if (!session) return <Auth initialIsLogin={authInitLogin} />
  if (!onboardingCompleted) return <OnboardingFlow session={session} onComplete={() => { track('onboarding_completed'); setOnboardingCompleted(true); setHasUsername(true) }} />
  if (!hasUsername) return <UsernamePrompt session={session} onComplete={() => setHasUsername(true)} />

  const handleEventClick = (event) => openScreen({ selectedEvent: event, screen: 'eventDetail' })
  // Changer d'onglet ne s'empile pas dans l'historique, comme une app native
  const handleTabChange = (newTab) => {
    track('tab_changed', { tab: newTab })
    replaceScreen({ ...ROOT_NAV, tab: newTab, screen: newTab })
  }
  const openCreate = (initialData = null) => openScreen({ createInitialData: initialData, screen: 'create' })
  const handleNotifEventClick = async (partialEvent) => {
    const { data, error } = await supabase.from('events').select('*').eq('id', partialEvent.id).maybeSingle()
    if (error) captureSupabaseError(error, { operation: 'load_notification_event' })
    if (data) openScreen({ selectedEvent: data, screen: 'eventDetail' })
  }
  const handleNotifMessageClick = async (partialEvent) => {
    const { data, error } = await supabase.from('events').select('*').eq('id', partialEvent.id).maybeSingle()
    if (error) captureSupabaseError(error, { operation: 'load_notification_message_event' })
    if (data) openScreen({ selectedEvent: data, screen: 'messages' })
  }
  const handleCreateFromDispo = (post) => {
    replaceScreen({
      showCreateDispo: false,
      dispoDetailId: null,
      screen: 'create',
      createInitialData: {
      title: post?.message ? post.message.slice(0, 48) : '',
      desc: post?.message ?? '',
      description: post?.message ?? '',
        emoji: post?.moods?.includes('cafe') ? '☕' : post?.moods?.includes('diner') ? '🍽️' : post?.moods?.includes('cine') ? '🎬' : undefined,
      },
    })
  }

  const renderCurrentScreen = () => {
    switch (view) {
      case 'closeFriends': return (
        <CloseFriendsScreen
          onBack={() => goBack({ showCloseFriends: false })}
          userId={session?.user?.id}
        />
      )
      case 'createDispo': return (
        <CreateDispoScreen
          onBack={() => goBack({ showCreateDispo: false })}
          userId={session.user.id}
          onManageCloseFriends={() => openScreen({ showCloseFriends: true })}
        />
      )
      case 'dispoDetail': return (
        <DispoDetailScreen
          postId={dispoDetailId}
          currentUserId={session.user.id}
          onBack={() => goBack({ dispoDetailId: null })}
          onCreateEvent={handleCreateFromDispo}
        />
      )
      case 'allEvents': return <AllEvents onBack={() => goBack({ screen: 'home' })} onEventClick={handleEventClick} onInvitationAccepted={handleNotifEventClick} />
      case 'dispoCalendar': return <DispoCalendarPage userId={session.user.id} onBack={() => goBack({ screen: 'home' })} />
      case 'create': return <Create onBack={() => goBack({ screen: 'home' })} session={session} initialData={createInitialData} />
      case 'editProfile': return (
        <EditProfile
          initialFocus={editProfileFocus}
          onBack={() => goBack({ editProfileFocus: null, tab: 'profile', screen: 'home' })}
          onSave={() => goBack({ editProfileFocus: null, tab: 'profile', screen: 'home' })}
        />
      )
      case 'secretSpace': return (
        <SecretSpacePage
          key={nav.secretSpace.eventId}
          eventId={nav.secretSpace.eventId}
          initialTab={nav.secretSpace.tab}
          focusItemId={nav.secretSpace.focusItemId}
          onTabChange={tab => replaceScreen({ secretSpace: { ...navRef.current.secretSpace, tab, focusItemId: null } })}
          onBack={event => goBack({ ...ROOT_NAV, tab: navRef.current.tab, selectedEvent: event ?? null, screen: event ? 'eventDetail' : navRef.current.tab })}
          onOpenSecretChat={openSecretChat}
        />
      )
      case 'eventChat': return (
        <Messages event={selectedEvent} onBack={() => goBack({ screen: 'eventDetail' })} notifications={notifications} markAsRead={markAsRead} onOpenSecretSpace={openSecretSpace} />
      )
      case 'eventDetail': return (
        <EventDetail
          event={selectedEvent}
          onBack={() => goBack({ screen: 'home', selectedEvent: null })}
          onInvitation={() => openScreen({ screen: 'invitation' })}
          onChat={ev => openScreen({ selectedEvent: ev, screen: 'messages' })}
          onMessagesClick={ev => openScreen({ selectedEvent: ev, screen: 'messages' })}
          onSecretSpace={ev => openScreen({ secretSpace: { eventId: ev.id, tab: 'flashback', focusItemId: null }, secretSpaceReturnKey: null, secretChatReturnKey: null })}
        />
      )
      case 'invitation': return (
        <Invitation event={selectedEvent} onBack={() => goBack({ screen: 'eventDetail' })} />
      )
      case 'directConversation': return (
        <ConversationScreen
          conversationId={directConv.conversationId}
          friend={directConv.friend}
          onBack={() => goBack({ directConv: null })}
          onFriendChange={friend => {
            const current = navRef.current.directConv
            if (current) replaceScreen({ directConv: { ...current, friend } })
          }}
        />
      )
      case 'eventConversation': return (
        <Messages event={conversationEvent} onBack={() => goBack({ conversationEvent: null })} notifications={notifications} markAsRead={markAsRead} onOpenSecretSpace={openSecretSpace} />
      )
      case 'home': return <Home onEventClick={handleEventClick} onNotifEventClick={handleNotifEventClick} onNotifMessageClick={handleNotifMessageClick} onNotifDirectMessageClick={openDirectConversation} notificationUnreadCount={notificationUnreadCount} onNotificationsRead={() => markAllAsRead(false)} onCreateClick={openCreate} onTrendingClick={openCreate} onMessagesClick={() => handleTabChange('messages')} onAllEventsClick={() => openScreen({ screen: 'allEvents' })} onCalendarClick={() => handleTabChange('calendar')} onDispoDetailClick={(id) => openScreen({ dispoDetailId: id })} onDispoCalendarClick={() => openScreen({ screen: 'dispoCalendar' })} session={session} birthdayRefreshTrigger={birthdayRefreshTrigger} />
      case 'calendar': return <Calendar onEventClick={handleEventClick} onInvitationAccepted={handleNotifEventClick} onCreateClick={() => openCreate()} onMessagesClick={ev => openScreen({ selectedEvent: ev, screen: 'messages' })} />
      case 'messages': return <Messages onEventOpen={ev => openScreen({ conversationEvent: ev })} onDirectConvOpen={conv => openScreen({ directConv: conv })} notifications={notifications} markAsRead={markAsRead} onCreateClick={() => openCreate()} />
      case 'profile': return (
        <Profile
          session={session}
          onEdit={() => openScreen({ editProfileFocus: null, screen: 'editProfile' })}
          onAddBirthday={() => openScreen({ editProfileFocus: 'birthday', screen: 'editProfile' })}
          onCalendarClick={() => handleTabChange('calendar')}
        />
      )
      default: return null
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', maxWidth: 430, margin: '0 auto', width: '100%', paddingTop: 'env(safe-area-inset-top, 0px)', background: view === 'secretSpace' ? '#1c1c1e' : undefined }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
        {renderCurrentScreen()}
      </div>
      <BottomNav
        current={tab}
        onChange={handleTabChange}
        onCreateClick={() => setShowCreateSheet(true)}
        hasUnreadMessages={totalUnread > 0}
        hasUnreadNotifications={hasUnreadNotifications}
        hidden={!TAB_VIEWS.includes(view)}
      />
      {showCreateSheet && (
        <CreateActionSheet
          onClose={() => setShowCreateSheet(false)}
          onCreateEvent={() => openCreate()}
          onAddAmiv={() => setShowAddAmiv(true)}
          onAskBirthday={() => setShowAskBirthday(true)}
        />
      )}
      {showAskBirthday && <AskBirthdaySheet onClose={() => setShowAskBirthday(false)} />}
      {showAddAmiv && (
        <AddAmivModal
          onClose={() => setShowAddAmiv(false)}
          onSaved={() => { setShowAddAmiv(false); setBirthdayRefreshTrigger(t => t + 1) }}
        />
      )}
      {showPushPrompt && <PushPermissionPrompt onDone={() => setShowPushPrompt(false)} />}
    </div>
  )
}
