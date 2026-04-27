import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useNotifications } from './hooks/useNotifications'
import BottomNav from './components/BottomNav'
import Onboarding from './screens/Onboarding'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Calendar from './screens/Calendar'
import Messages from './screens/Messages'
import Create from './screens/Create'
import EventDetail from './screens/EventDetail'
import Invitation from './screens/Invitation'
import Profile from './screens/Profile'
import EditProfile from './screens/EditProfile'
import PublicInvite from './screens/PublicInvite'

export default function App() {
  const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)/)
  if (inviteMatch) return <PublicInvite token={inviteMatch[1]} />

  const [hasOnboarded, setHasOnboarded] = useState(false)
  const [authInitLogin, setAuthInitLogin] = useState(false)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileComplete, setProfileComplete] = useState(null)
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState('home')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [conversationEvent, setConversationEvent] = useState(null)
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
        setProfileComplete(null)
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
    if (!session || profileComplete !== null) return
    supabase.from('profiles').select('name').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      setProfileComplete(!!(data?.name))
    })
  }, [session, profileComplete])

  useEffect(() => {
    if (!session || !pendingEventId.current) return
    const id = pendingEventId.current
    pendingEventId.current = null
    supabase.from('events').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        setSelectedEvent(data)
        setScreen('eventDetail')
        window.history.replaceState(null, '', '/')
      }
    })
  }, [session])

  const isLoading = loading || (!!session && profileComplete === null)

  if (isLoading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ fontSize: 48, fontWeight: 900, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Amiv</div>
    </div>
  )

  if (!hasOnboarded) return <Onboarding onFinish={(loginMode) => { setAuthInitLogin(loginMode); setHasOnboarded(true) }} />
  if (!session) return <Auth initialIsLogin={authInitLogin} />
  if (!profileComplete) return <EditProfile isOnboarding={true} onSave={() => setProfileComplete(true)} />

  const handleEventClick = (event) => { setSelectedEvent(event); setScreen('eventDetail') }
  const handleTabChange = (newTab) => {
    if (newTab === 'messages') markAllAsReadByType('message_received')
    setTab(newTab)
    setScreen('home')
    setConversationEvent(null)
  }
  const handleNotifEventClick = async (partialEvent) => {
    const { data } = await supabase.from('events').select('*').eq('id', partialEvent.id).maybeSingle()
    if (data) { setSelectedEvent(data); setScreen('eventDetail') }
  }

  const isDetailScreen =
    screen === 'create' ||
    screen === 'editProfile' ||
    (screen === 'invitation' && selectedEvent) ||
    (screen === 'eventDetail' && selectedEvent) ||
    (screen === 'messages' && selectedEvent)

  const renderCurrentScreen = () => {
    if (screen === 'create') return <Create onBack={() => setScreen('home')} />
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
      case 'home': return <Home onEventClick={handleEventClick} onNotifEventClick={handleNotifEventClick} onCreateClick={() => setScreen('create')} onMessagesClick={() => handleTabChange('messages')} />
      case 'calendar': return <Calendar onEventClick={handleEventClick} />
      case 'messages':
        if (conversationEvent) {
          return <Messages event={conversationEvent} onBack={() => setConversationEvent(null)} notifications={notifications} markAsRead={markAsRead} />
        }
        return <Messages onEventOpen={setConversationEvent} notifications={notifications} markAsRead={markAsRead} onCreateClick={() => setScreen('create')} />
      case 'profile': return <Profile session={session} onEdit={() => setScreen('editProfile')} />
      default: return null
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', width: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderCurrentScreen()}
      </div>
      <BottomNav
        current={tab}
        onChange={handleTabChange}
        hasUnreadMessages={unreadMessagesCount > 0}
        hasUnreadNotifications={hasUnreadNotifications}
        hidden={isDetailScreen}
      />
    </div>
  )
}
