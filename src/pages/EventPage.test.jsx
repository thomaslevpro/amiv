// @vitest-environment jsdom
// Lien /events/<id> : sans connexion, l'événement est gardé pour après la
// connexion ; connecté mais sans accès, un message plutôt qu'une page vide.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const EVENT_ID = '11111111-1111-1111-1111-111111111111'
const state = vi.hoisted(() => ({ session: null, event: null }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: state.session } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.event, error: null }) }) }) }),
  },
}))
vi.mock('../screens/EventDetail', () => ({ default: ({ event }) => <h1>{event.name}</h1> }))

const { default: EventPage } = await import('./EventPage')
const { takePendingEventLink } = await import('../lib/onboarding')

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/" element={<h1>Accueil</h1>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  state.session = null
  state.event = null
})
afterEach(cleanup)

it('sans connexion : garde l\'événement et mène à la connexion', async () => {
  renderAt(`/events/${EVENT_ID}`)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Accueil' })).toBeTruthy())
  expect(takePendingEventLink()).toBe(EVENT_ID)
})

it('connecté et invité : la page de l\'événement', async () => {
  state.session = { user: { id: 'me' } }
  state.event = { id: EVENT_ID, name: 'Soirée' }
  renderAt(`/events/${EVENT_ID}`)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Soirée' })).toBeTruthy())
  expect(takePendingEventLink()).toBe(null)
})

it('connecté sans accès : message d\'accès refusé', async () => {
  state.session = { user: { id: 'me' } }
  renderAt(`/events/${EVENT_ID}`)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Tu n\'as pas accès à cet événement' })).toBeTruthy())
})
