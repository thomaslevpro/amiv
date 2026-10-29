// @vitest-environment jsdom
// Messagerie : la conversation d'un événement n'apparaît que pour les
// organisateurs et les invités qui ont accepté (get_my_event_conversation_ids).
// Invitation en attente : rien ; acceptation : visible tout de suite, sans
// recharger ; refus : rien.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import Messages from './Messages'
import { announceRsvpChange } from '../lib/eventGuests'

const EVENT = { id: 'ev1', name: 'Anniv de Lola', emoji: '🎂', type: 'Anniversaire', date: null, location: null, cover_image: null, created_at: '2026-10-28T10:00:00Z', birthday_person_user_id: null, user_id: 'orga' }
const db = { memberIds: [], listCalls: 0 }

vi.mock('../lib/analytics', () => ({ track() {} }))
vi.mock('../lib/monitoring', () => ({ captureSupabaseError() {} }))
vi.mock('../hooks/useGuestLeader', () => ({ useGuestLeader: () => ({ guestLeaders: [] }) }))
vi.mock('../lib/friendships', () => ({ getFriends: () => Promise.resolve({ data: [], error: null }) }))
vi.mock('../lib/supabase', () => {
  // Requête chaînable : chaque table répond une liste fixe.
  function query(table) {
    const rows = table === 'events' ? [EVENT] : []
    const result = { data: rows, error: null }
    const q = {
      select: () => q, eq: () => q, in: (column, ids) => (table === 'events' ? { ...q, then: (ok, ko) => Promise.resolve({ data: rows.filter(row => ids.includes(row.id)), error: null }).then(ok, ko) } : q),
      or: () => q, order: () => q, limit: () => q,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (ok, ko) => Promise.resolve(result).then(ok, ko),
    }
    return q
  }
  const channel = { on: () => channel, subscribe: () => channel }
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'me', email: 'me@amiv.test' } } }) },
      from: query,
      rpc: name => {
        if (name === 'get_my_event_conversation_ids') db.listCalls += 1
        return Promise.resolve({ data: name === 'get_my_event_conversation_ids' ? db.memberIds : [], error: null })
      },
      channel: () => channel,
      removeChannel() {},
    },
  }
})

describe('Messages : conversations d’événement', () => {
  beforeEach(() => { db.memberIds = []; db.listCalls = 0; window.localStorage.clear() })
  afterEach(() => cleanup())

  it('invitation en attente : pas de conversation ; acceptation : visible sans recharger ; refus : rien', async () => {
    render(<Messages notifications={[]} />)
    await screen.findByPlaceholderText('Rechercher')
    await waitFor(() => expect(db.listCalls).toBeGreaterThan(0))
    expect(screen.queryByText('Anniv de Lola')).toBeNull()

    // J'accepte : le serveur me compte comme membre, la liste suit
    db.memberIds = ['ev1']
    act(() => announceRsvpChange('ev1'))
    expect(await screen.findByText('Anniv de Lola')).toBeTruthy()

    // Je refuse : la conversation disparaît
    db.memberIds = []
    act(() => announceRsvpChange('ev1'))
    await waitFor(() => expect(screen.queryByText('Anniv de Lola')).toBeNull())
  })
})
