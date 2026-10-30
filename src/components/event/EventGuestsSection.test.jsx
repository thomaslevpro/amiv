// @vitest-environment jsdom
// Section « Invités » de la page d'un événement : résumé, filtres, ordre de la
// liste, appui long (organisateur, invités en attente), nom affiché.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import EventGuestsSection from './EventGuestsSection'
import { canRemindGuest, formatInvitedAgo, guestDisplayName, guestSubtitle, sortGuests } from '../../lib/eventGuests'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../PlusOneRequest', () => ({ default: () => null }))

const NOW = new Date('2026-10-29T12:00:00Z').getTime()
const daysAgo = days => new Date(NOW - days * 86400000).toISOString()

const GUESTS = sortGuests([
  { guest_key: 'zoe', user_id: 'zoe', role: 'guest', status: 'declined', display_name: 'Zoé', username: 'zoe' },
  { guest_key: 'bob', user_id: 'bob', role: 'guest', status: 'pending', display_name: 'Bob', invitation_id: 'inv-bob', invited_at: daysAgo(2) },
  { guest_key: 'ana', user_id: 'ana', role: 'guest', status: 'confirmed', display_name: 'Ana', username: 'ana' },
  { guest_key: 'org', user_id: 'org', role: 'owner', status: 'confirmed', display_name: 'Thomas' },
  { guest_key: 'cam', user_id: 'cam', role: 'guest', status: 'confirmed', display_name: 'Camille', username: 'cam' },
])

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function rowNames() {
  // Sans l'initiale de l'avatar
  return screen.getAllByRole('listitem').map(li => li.textContent.slice(1))
}

describe('EventGuestsSection', () => {
  it('résumé, filtres sans les statuts à 0, ordre organisateur > statut > nom', () => {
    // « Invité il y a 2 j » est calculé depuis maintenant : on fige l'horloge
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    render(<EventGuestsSection guests={GUESTS} canManage={false} userId="ana" />)
    expect(screen.getByText('5 invités')).toBeTruthy()
    const tabs = screen.getAllByRole('tab').map(tab => tab.textContent)
    expect(tabs).toEqual(['Tous 5', 'Confirmés 3', 'En attente 1', 'Déclinés 1'])
    const names = rowNames()
    expect(names[0]).toMatch(/^ThomasOrganisateur/)
    expect(names[1]).toMatch(/^Ana \(toi\)@ana/)
    expect(names[2]).toMatch(/^Camille/)
    expect(names[3]).toMatch(/^BobInvité il y a 2 j/)
    expect(names[4]).toMatch(/^Zoé/)
  })

  it('un appui sur un filtre filtre la liste', () => {
    render(<EventGuestsSection guests={GUESTS} canManage={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Déclinés/ }))
    expect(rowNames()).toHaveLength(1)
    expect(rowNames()[0]).toMatch(/^Zoé/)
    fireEvent.click(screen.getByRole('tab', { name: /Tous/ }))
    expect(rowNames()).toHaveLength(5)
  })

  it('organisateur : appui long sur un invité en attente -> Relancer / Retirer', () => {
    vi.useFakeTimers()
    const onRemind = vi.fn()
    const onRemove = vi.fn()
    render(<EventGuestsSection guests={GUESTS} canManage onRemind={onRemind} onRemove={onRemove} onInvite={() => {}} onShare={() => {}} />)
    const bob = screen.getAllByRole('listitem')[3]
    fireEvent.touchStart(bob)
    act(() => { vi.advanceTimersByTime(500) })
    const sheet = screen.getByRole('dialog')
    fireEvent.click(within(sheet).getByText('Relancer'))
    expect(onRemind).toHaveBeenCalledWith(expect.objectContaining({ guest_key: 'bob' }))

    fireEvent.touchStart(bob)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.click(within(screen.getByRole('dialog')).getByText("Retirer l'invitation"))
    expect(onRemove).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Confirmer le retrait'))
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ guest_key: 'bob' }))
  })

  it('pas de menu sur un confirmé, ni pour un invité qui regarde', () => {
    vi.useFakeTimers()
    const { unmount } = render(<EventGuestsSection guests={GUESTS} canManage onInvite={() => {}} onShare={() => {}} />)
    fireEvent.touchStart(screen.getAllByRole('listitem')[1])
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()

    render(<EventGuestsSection guests={GUESTS} canManage={false} />)
    fireEvent.touchStart(screen.getAllByRole('listitem')[3])
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Inviter des amis')).toBeNull()
  })

  it('actions organisateur', () => {
    const onInvite = vi.fn()
    const onShare = vi.fn()
    render(<EventGuestsSection guests={GUESTS} canManage onInvite={onInvite} onShare={onShare} />)
    fireEvent.click(screen.getByText('Inviter des amis'))
    fireEvent.click(screen.getByText('Partager le lien'))
    expect(onInvite).toHaveBeenCalled()
    expect(onShare).toHaveBeenCalled()
  })
})

describe('eventGuests', () => {
  it('nom affiché : nom, prénom, @pseudo, Utilisateur Amiv', () => {
    expect(guestDisplayName({ name: 'Léa Martin', first_name: 'Léa' })).toBe('Léa Martin')
    expect(guestDisplayName({ name: 'L', first_name: 'Léa' })).toBe('Léa')
    expect(guestDisplayName({ name: 'L', username: 'lea' })).toBe('@lea')
    expect(guestDisplayName({ name: '' })).toBe('Utilisateur Amiv')
  })

  it('sous-titre', () => {
    expect(guestSubtitle({ role: 'owner', status: 'confirmed' })).toBe('Organisateur')
    expect(guestSubtitle({ role: 'guest', status: 'confirmed', username: 'ana' })).toBe('@ana')
    expect(guestSubtitle({ role: 'guest', status: 'pending', invited_at: daysAgo(2) }, NOW)).toBe('Invité il y a 2 j')
    expect(formatInvitedAgo(daysAgo(0.1), NOW)).toBe('Invité il y a 2 h')
  })

  it('relance au plus une fois par 24 h', () => {
    expect(canRemindGuest({ reminded_at: null }, NOW)).toBe(true)
    expect(canRemindGuest({ reminded_at: daysAgo(0.5) }, NOW)).toBe(false)
    expect(canRemindGuest({ reminded_at: daysAgo(1.1) }, NOW)).toBe(true)
  })
})
