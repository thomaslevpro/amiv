import { useState } from 'react'
import BottomNav from './components/BottomNav'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import Calendar from './screens/Calendar'
import Messages from './screens/Messages'
import Create from './screens/Create'
import EventDetail from './screens/EventDetail'
import Invitation from './screens/Invitation'
import Profile from './screens/Profile'

export default function App() {
  const [hasOnboarded, setHasOnboarded] = useState(false)
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState('home') // 'home' | 'eventDetail' | 'invitation' | 'create'
  const [selectedEvent, setSelectedEvent] = useState(null)

  // Pas encore onboardé → écran onboarding
  if (!hasOnboarded) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Onboarding onFinish={() => setHasOnboarded(true)} />
      </div>
    )
  }

  // Écrans overlay (pas de bottom nav)
  if (screen === 'create') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Create onBack={() => setScreen('home')} />
      </div>
    )
  }

  if (screen === 'eventDetail' && selectedEvent) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <EventDetail
          event={selectedEvent}
          onBack={() => setScreen('home')}
          onInvitation={() => setScreen('invitation')}
        />
      </div>
    )
  }

  if (screen === 'invitation' && selectedEvent) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Invitation
          event={selectedEvent}
          onBack={() => setScreen('eventDetail')}
        />
      </div>
    )
  }

  // Handlers partagés
  const handleEventClick = (event) => {
    setSelectedEvent(event)
    setScreen('eventDetail')
  }

  const handleTabChange = (newTab) => {
    setTab(newTab)
    setScreen('home') // reset overlay si besoin
  }

  // Rendu de l'écran actif (avec bottom nav)
  const renderScreen = () => {
    switch (tab) {
      case 'home':
        return (
          <Home
            onEventClick={handleEventClick}
            onCreateClick={() => setScreen('create')}
          />
        )
      case 'calendar':
        return <Calendar onEventClick={handleEventClick} />
      case 'messages':
        return <Messages />
      case 'profile':
        return <Profile />
      default:
        return null
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
