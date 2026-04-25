import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
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

export default function App() { const [hasOnboarded, setHasOnboarded] = useState(false)
  const [authInitLogin, setAuthInitLogin] = useState(false)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState('home')
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ fontSize: 48, fontWeight: 900, background: 'linear-gradient(135deg,#e055aa,#f5a623)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Amiv</div>
    </div>
  )

  if (!hasOnboarded) return <Onboarding onFinish={(loginMode) => { setAuthInitLogin(loginMode); setHasOnboarded(true) }} />
  if (!session) return <Auth initialIsLogin={authInitLogin} onLogin={() => setSession(true)} />

  if (screen === 'create') return <Create onBack={() => setScreen('home')} />
  if (screen === 'eventDetail' && selectedEvent) return (
    <EventDetail event={selectedEvent} onBack={() => setScreen('home')} onInvitation={() => setScreen('invitation')} />
  )
  if (screen === 'invitation' && selectedEvent) return (
    <Invitation event={selectedEvent} onBack={() => setScreen('eventDetail')} />
  )

  const handleEventClick = (event) => { setSelectedEvent(event); setScreen('eventDetail') }
  const handleTabChange = (newTab) => { setTab(newTab); setScreen('home') }

  const renderScreen = () => {
    switch (tab) {
      case 'home': return <Home onEventClick={handleEventClick} onCreateClick={() => setScreen('create')} />
      case 'calendar': return <Calendar onEventClick={handleEventClick} />
      case 'messages': return <Messages />
      case 'profile': return <Profile session={session} />
      default: return null
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', width: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderScreen()}
      </div>
      <BottomNav current={tab} onChange={handleTabChange} />
    </div>
  )
}
