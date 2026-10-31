// @vitest-environment jsdom
// Demandes de +1 (organisateur) : après Accepter / Refuser, la page de
// l'événement recharge ses invités (compteurs et liste à jour sans recharger).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PlusOneReviewList from './PlusOneReviewList'

const respondPlusOne = vi.fn()
vi.mock('../hooks/usePlusOne', () => ({ usePlusOne: () => ({ respondPlusOne }) }))

function query(data) {
  const chain = { select: () => chain, eq: () => chain, in: () => chain, then: resolve => resolve({ data, error: null }) }
  return chain
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: table => query({
      rsvps: [{ id: 'r1', event_id: 'ev', user_id: 'lola', plus_one_name: 'Marc', plus_one_message: null }],
      guest_rsvps: [],
      profiles: [{ id: 'lola', first_name: 'Lola', name: 'Martin' }],
    }[table]),
  },
}))

afterEach(() => {
  cleanup()
  respondPlusOne.mockReset()
})

describe('PlusOneReviewList', () => {
  it('Accepter : met à jour la demande puis prévient la page', async () => {
    respondPlusOne.mockResolvedValue({ id: 'r1', plus_one_status: 'accepted' })
    const onResponded = vi.fn()
    render(<PlusOneReviewList eventId="ev" isOrganizer onResponded={onResponded} />)
    fireEvent.click(await screen.findByText('✓ Accepter'))
    await waitFor(() => expect(onResponded).toHaveBeenCalledTimes(1))
    expect(respondPlusOne).toHaveBeenCalledWith({ rsvpId: 'r1', table: 'rsvps', status: 'accepted' })
    expect(screen.queryByText('Demandes de +1')).toBeNull()
  })

  it('échec : la demande reste et la page n’est pas rechargée', async () => {
    respondPlusOne.mockRejectedValue(new Error('refusé'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onResponded = vi.fn()
    render(<PlusOneReviewList eventId="ev" isOrganizer onResponded={onResponded} />)
    fireEvent.click(await screen.findByText('✗ Refuser'))
    await waitFor(() => expect(respondPlusOne).toHaveBeenCalled())
    expect(onResponded).not.toHaveBeenCalled()
    expect(screen.getByText('Demandes de +1')).toBeTruthy()
  })
})
