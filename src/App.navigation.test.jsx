// @vitest-environment jsdom
// Barre de navigation du bas : visible sur les onglets, masquée sur les
// écrans de détail, quelle que soit la façon de revenir en arrière.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useNavigate } from 'react-router-dom'

const EVENT = { id: '11111111-1111-1111-1111-111111111111', name: 'Soirée' }

vi.mock('@capacitor/app', () => ({ App: { addListener: () => Promise.resolve({ remove() {} }) } }))
vi.mock('./lib/native', () => ({ isNative: false, parseDeepLink: () => null, setStatusBarDark() {} }))
vi.mock('./lib/analytics', () => ({ identifyUser() {}, resetAnalyticsUser() {}, track() {} }))
vi.mock('./lib/monitoring', () => ({ captureSupabaseError() {}, clearMonitoringUser() {}, setMonitoringUser() {} }))
vi.mock('./lib/push', () => ({
  initPushListeners: () => () => {},
  onPushTarget: () => () => {},
  refreshPushRegistration() {},
  setPendingPushTarget() {},
  shouldShowPushPrompt: () => Promise.resolve(false),
  takePendingPushTarget: () => null,
}))
vi.mock('./lib/supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    update: () => query,
    maybeSingle: () => Promise.resolve({ data: EVENT, error: null }),
  }
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      rpc: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { onboarding_completed: true, username: 'moi' }, error: null }) }) }),
      from: () => query,
    },
  }
})
vi.mock('./hooks/useNotifications', () => ({ useNotifications: () => ({ notifications: [], markAsRead() {}, markAllAsRead() {} }) }))
vi.mock('./hooks/useUnreadCounts', () => ({ useUnreadCounts: () => ({ totalUnread: 0 }) }))

// Écrans réduits à leur titre et aux boutons qui déclenchent la navigation
const Back = ({ onBack }) => <button onClick={onBack}>Retour</button>
vi.mock('./screens/Home', () => ({
  default: ({ onEventClick, onNotifEventClick }) => (
    <div>
      <h1>Accueil</h1>
      <button onClick={() => onEventClick(EVENT)}>Ouvrir l'événement</button>
      <button onClick={() => onNotifEventClick({ id: EVENT.id })}>Notification</button>
    </div>
  ),
}))
vi.mock('./screens/Calendar', () => ({
  default: ({ onEventClick }) => (
    <div><h1>Événements</h1><button onClick={() => onEventClick(EVENT)}>Ouvrir l'événement</button></div>
  ),
}))
vi.mock('./screens/EventDetail', () => ({
  default: ({ event, onBack, onChat, onSecretSpace }) => (
    <div>
      <h1>Page de l'événement</h1>
      <button onClick={() => onChat(event)}>Chat</button>
      <button onClick={() => onSecretSpace(event)}>Espace secret</button>
      <Back onBack={onBack} />
    </div>
  ),
}))
vi.mock('./pages/SecretSpacePage', () => ({
  default: ({ initialTab, onBack, onOpenSecretChat }) => (
    <div>
      <h1>Espace secret</h1>
      <p>Onglet {initialTab}</p>
      <button onClick={() => onOpenSecretChat(EVENT)}>Discussion secrète</button>
      <Back onBack={() => onBack(EVENT)} />
    </div>
  ),
}))
vi.mock('./screens/Messages', () => ({
  default: ({ event, onBack, onEventOpen, onDirectConvOpen, onOpenSecretSpace }) => event
    ? (
      <div>
        <h1>Chat de l'événement</h1>
        <p>Canal {event.initialIsSecret ? 'Secret' : 'Général'}</p>
        <button onClick={() => onOpenSecretSpace({ eventId: event.id, tab: 'gifts' })}>Ouvrir l'espace secret</button>
        <Back onBack={onBack} />
      </div>
    )
    : (
      <div>
        <h1>Messages</h1>
        <button onClick={() => onEventOpen(EVENT)}>Conversation d'événement</button>
        <button onClick={() => onDirectConvOpen({ conversationId: 'c1', friend: { friend_id: 'f1' } })}>Message privé</button>
      </div>
    ),
}))
vi.mock('./screens/ConversationScreen', () => ({
  default: ({ onBack }) => <div><h1>Conversation privée</h1><Back onBack={onBack} /></div>,
}))
vi.mock('./screens/Profile', () => ({
  default: function Profile({ onEdit }) {
    const navigate = useNavigate()
    return (
      <div>
        <h1>Profil</h1>
        <button onClick={() => navigate('/u/alice')}>Ami</button>
        <button onClick={onEdit}>Modifier</button>
      </div>
    )
  },
}))
vi.mock('./screens/PublicUserProfile', () => ({
  default: function PublicUserProfile() {
    const navigate = useNavigate()
    return <div><h1>Profil d'Alice</h1><Back onBack={() => navigate(-1)} /></div>
  },
}))
vi.mock('./screens/EditProfile', () => ({ default: ({ onBack }) => <div><h1>Édition du profil</h1><Back onBack={onBack} /></div> }))
vi.mock('./screens/Create', () => ({ default: ({ onBack }) => <div><h1>Création</h1><Back onBack={onBack} /></div> }))
vi.mock('./screens/Auth', () => ({ default: () => null }))
vi.mock('./screens/AuthCallback', () => ({ default: () => null }))
vi.mock('./screens/Invitation', () => ({ default: () => null }))
vi.mock('./screens/AllEvents', () => ({ default: () => null }))
vi.mock('./screens/CreateDispoScreen', () => ({ default: () => null }))
vi.mock('./screens/CloseFriendsScreen', () => ({ default: () => null }))
vi.mock('./screens/DispoDetailScreen', () => ({ default: () => null }))
vi.mock('./screens/GuestRsvpPage', () => ({ default: () => null }))
vi.mock('./pages/Onboarding', () => ({ default: () => null }))
vi.mock('./pages/EventPage', () => ({ default: () => null }))
vi.mock('./pages/DispoCalendarPage', () => ({ default: () => null }))
vi.mock('./components/UsernamePrompt', () => ({ default: () => null }))
vi.mock('./components/PushPermissionPrompt', () => ({ default: () => null }))
vi.mock('./components/AddAmivModal', () => ({ default: () => null }))
vi.mock('./components/CreateActionSheet', () => ({
  default: ({ onCreateEvent, onClose }) => <button onClick={() => { onCreateEvent(); onClose() }}>Créer un événement</button>,
}))

const { default: App } = await import('./App')

const tap = name => fireEvent.click(screen.getByRole('button', { name }))
const tapTab = index => fireEvent.click(screen.getByRole('navigation').firstChild.children[index])
const expectPage = title => waitFor(() => expect(screen.getByRole('heading', { name: title })).toBeTruthy())
const expectNav = visible => expect(Boolean(screen.queryByRole('navigation'))).toBe(visible)

// Les trois façons de revenir en arrière. Le balayage depuis le bord gauche
// (Safari iPhone, amiv.app) est un retour navigateur : popstate.
const BACKS = {
  'bouton retour de l\'app': () => tap('Retour'),
  'retour navigateur / balayage': () => act(() => { window.history.back() }),
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(cleanup)

async function start() {
  render(<App />)
  await expectPage('Accueil')
  expectNav(true)
}

describe.each(Object.entries(BACKS))('barre du bas — %s', (_, back) => {
  it('Événements → événement → chat → retour ×2 : barre visible', async () => {
    await start()
    tapTab(1)
    await expectPage('Événements')
    tap('Ouvrir l\'événement')
    await expectPage('Page de l\'événement')
    expectNav(false)
    tap('Chat')
    await expectPage('Chat de l\'événement')
    expectNav(false)
    await back()
    await expectPage('Page de l\'événement')
    expectNav(false)
    await back()
    await expectPage('Événements')
    expectNav(true)
  })

  it('Accueil → événement → chat → retour ×2 : barre visible', async () => {
    await start()
    tap('Ouvrir l\'événement')
    await expectPage('Page de l\'événement')
    tap('Chat')
    await expectPage('Chat de l\'événement')
    await back()
    await expectPage('Page de l\'événement')
    await back()
    await expectPage('Accueil')
    expectNav(true)
  })

  it('Messages → conversation → retour : barre visible', async () => {
    await start()
    tapTab(3)
    await expectPage('Messages')
    tap('Conversation d\'événement')
    await expectPage('Chat de l\'événement')
    expectNav(false)
    await back()
    await expectPage('Messages')
    expectNav(true)
    tap('Message privé')
    await expectPage('Conversation privée')
    expectNav(false)
    await back()
    await expectPage('Messages')
    expectNav(true)
  })

  it('notification → événement → retour : barre visible', async () => {
    await start()
    tap('Notification')
    await expectPage('Page de l\'événement')
    expectNav(false)
    await back()
    await expectPage('Accueil')
    expectNav(true)
  })

  it('Profil → ami → retour : barre visible sur le Profil', async () => {
    await start()
    tapTab(4)
    await expectPage('Profil')
    tap('Ami')
    await expectPage('Profil d\'Alice')
    expectNav(false)
    await back()
    await expectPage('Profil')
    expectNav(true)
  })

  it('Profil → modifier / + → création → retour : barre masquée puis visible', async () => {
    await start()
    tapTab(4)
    await expectPage('Profil')
    tap('Modifier')
    await expectPage('Édition du profil')
    expectNav(false)
    await back()
    await expectPage('Profil')
    expectNav(true)
    fireEvent.click(screen.getByRole('navigation').firstChild.children[2].firstChild)
    tap('Créer un événement')
    await expectPage('Création')
    expectNav(false)
    await back()
    await expectPage('Profil')
    expectNav(true)
  })
})

it('écran ouvert sans historique (lien direct) : le retour de l\'app ramène à l\'onglet', async () => {
  window.history.replaceState(null, '', `/events/${EVENT.id}/x`)
  render(<App />)
  await expectPage('Page de l\'événement')
  expectNav(false)
  tap('Retour')
  await expectPage('Accueil')
  expectNav(true)
})

// Espace secret ↔ chat Secret : l'un ouvre l'autre, le retour ramène à
// l'autre puis à la page de départ, barre du bas comprise.
describe.each(Object.entries(BACKS))('espace secret et chat Secret — %s', (_, back) => {
  const expectText = text => waitFor(() => expect(screen.getByText(text)).toBeTruthy())

  it('événement → espace secret → discussion secrète → retour ×3', async () => {
    await start()
    tap('Ouvrir l\'événement')
    await expectPage('Page de l\'événement')
    tap('Espace secret')
    await expectPage('Espace secret')
    await expectText('Onglet flashback')
    expectNav(false)
    tap('Discussion secrète')
    await expectPage('Chat de l\'événement')
    await expectText('Canal Secret')
    expectNav(false)
    await back()
    await expectPage('Espace secret')
    await back()
    await expectPage('Page de l\'événement')
    await back()
    await expectPage('Accueil')
    expectNav(true)
  })

  it('chat → espace secret → discussion secrète revient au même chat, sans empiler', async () => {
    await start()
    tap('Ouvrir l\'événement')
    await expectPage('Page de l\'événement')
    tap('Chat')
    await expectPage('Chat de l\'événement')
    await expectText('Canal Général')
    tap('Ouvrir l\'espace secret')
    await expectPage('Espace secret')
    await expectText('Onglet gifts')
    tap('Discussion secrète')
    await expectPage('Chat de l\'événement')
    await expectText('Canal Secret')
    tap('Ouvrir l\'espace secret')
    await expectPage('Espace secret')
    await back()
    await expectPage('Chat de l\'événement')
    await expectText('Canal Secret')
    await back()
    await expectPage('Page de l\'événement')
    await back()
    await expectPage('Accueil')
    expectNav(true)
  })

  it('Messages → conversation → espace secret → retour ×2 : barre visible', async () => {
    await start()
    tapTab(3)
    await expectPage('Messages')
    tap('Conversation d\'événement')
    await expectPage('Chat de l\'événement')
    tap('Ouvrir l\'espace secret')
    await expectPage('Espace secret')
    expectNav(false)
    await back()
    await expectPage('Chat de l\'événement')
    await expectText('Canal Secret')
    await back()
    await expectPage('Messages')
    expectNav(true)
  })
})

it('lien direct vers l\'espace secret : retour vers la page de l\'événement puis l\'onglet', async () => {
  window.history.replaceState(null, '', `/events/${EVENT.id}/secret-space`)
  render(<App />)
  await expectPage('Espace secret')
  expectNav(false)
  tap('Retour')
  await expectPage('Page de l\'événement')
  tap('Retour')
  await expectPage('Accueil')
  expectNav(true)
})
