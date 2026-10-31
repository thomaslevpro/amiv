// @vitest-environment jsdom
// Section « Invités » de la page d'un événement : résumé, filtres, ordre de la
// liste, appui long (organisateur, invités en attente, +1), nom affiché.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import EventGuestsSection from './EventGuestsSection'
import { canRemindGuest, canRemovePlusOne, countsFromGuests, formatInvitedAgo, guestDisplayName, guestSubtitle, sortGuests } from '../../lib/eventGuests'

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

// Lola vient avec Marc (+1 accepté), Paul (lien public) avec Julie.
const WITH_PLUS_ONES = sortGuests([
  { guest_key: 'plus1_r1', user_id: null, role: 'plus_one', status: 'confirmed', display_name: 'Marc', plus_one_of: 'Lola', plus_one_host_key: 'lola', plus_one_source: 'rsvps', plus_one_rsvp_id: 'r1' },
  { guest_key: 'org', user_id: 'org', role: 'owner', status: 'confirmed', display_name: 'Thomas' },
  { guest_key: 'zoe', user_id: 'zoe', role: 'guest', status: 'confirmed', display_name: 'Zoé' },
  { guest_key: 'lola', user_id: 'lola', role: 'guest', status: 'confirmed', display_name: 'Lola Martin' },
  { guest_key: 'plus1_g1', user_id: null, role: 'plus_one', status: 'maybe', display_name: 'Julie', plus_one_of: 'Paul', plus_one_host_key: 'link_g1', plus_one_source: 'guest_rsvps', plus_one_rsvp_id: 'g1' },
  { guest_key: 'link_g1', user_id: null, role: 'link_guest', status: 'maybe', display_name: 'Paul' },
])

describe('EventGuestsSection : +1', () => {
  it('le +1 compte et apparaît sous la personne qui l’amène', () => {
    render(<EventGuestsSection guests={WITH_PLUS_ONES} canManage={false} />)
    expect(screen.getByText('6 invités')).toBeTruthy()
    const names = rowNames()
    expect(names[0]).toMatch(/^ThomasOrganisateur/)
    expect(names[1]).toMatch(/^Lola Martin/)
    expect(names[2]).toMatch(/^Marc\+1 de Lola/)
    expect(names[3]).toMatch(/^Zoé/)
    expect(names[4]).toMatch(/^Paul/)
    expect(names[5]).toMatch(/^Julie\+1 de Paul/)
    fireEvent.click(screen.getByRole('tab', { name: /Peut-être/ }))
    expect(rowNames().map(name => name.slice(0, 4))).toEqual(['Paul', 'Juli'])
  })

  it('organisateur : appui long sur un +1 -> Retirer le +1', () => {
    vi.useFakeTimers()
    const onRemovePlusOne = vi.fn()
    const onRemove = vi.fn()
    render(<EventGuestsSection guests={WITH_PLUS_ONES} canManage onRemove={onRemove} onRemovePlusOne={onRemovePlusOne} onInvite={() => {}} onShare={() => {}} />)
    fireEvent.touchStart(screen.getAllByRole('listitem')[2])
    act(() => { vi.advanceTimersByTime(500) })
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByText('Marc · +1 de Lola')).toBeTruthy()
    expect(within(sheet).queryByText('Relancer')).toBeNull()
    fireEvent.click(within(sheet).getByText('Retirer le +1'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Confirmer le retrait'))
    expect(onRemovePlusOne).toHaveBeenCalledWith(expect.objectContaining({ guest_key: 'plus1_r1' }))
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('pas de menu sur un +1 pour un invité qui regarde', () => {
    vi.useFakeTimers()
    render(<EventGuestsSection guests={WITH_PLUS_ONES} canManage={false} onRemovePlusOne={() => {}} />)
    fireEvent.touchStart(screen.getAllByRole('listitem')[2])
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('compteurs, retrait possible seulement pour une demande depuis un compte', () => {
    expect(countsFromGuests(WITH_PLUS_ONES)).toMatchObject({ total: 6, confirmed: 4, maybe: 2 })
    expect(canRemovePlusOne(WITH_PLUS_ONES.find(g => g.guest_key === 'plus1_r1'))).toBe(true)
    expect(canRemovePlusOne(WITH_PLUS_ONES.find(g => g.guest_key === 'plus1_g1'))).toBe(false)
    expect(canRemovePlusOne({ ...WITH_PLUS_ONES[2], plus_one_rsvp_id: null })).toBe(false)
  })

  it('un +1 dont l’hôte n’est pas dans la liste reste affiché', () => {
    const list = sortGuests([{ guest_key: 'plus1_x', role: 'plus_one', status: 'confirmed', display_name: 'Max', plus_one_host_key: 'absent' }])
    expect(list.map(g => g.guest_key)).toEqual(['plus1_x'])
  })
})

describe('eventGuests', () => {
  it('nom affiché : Prénom Nom, @pseudo, Utilisateur Amiv', () => {
    expect(guestDisplayName({ name: 'Léa Martin', first_name: 'Léa' })).toBe('Léa Martin')
    expect(guestDisplayName({ name: 'Martin', first_name: 'Léa' })).toBe('Léa Martin')
    expect(guestDisplayName({ name: 'Léa', first_name: 'Léa' })).toBe('Léa')
    expect(guestDisplayName({ name: '', username: 'lea' })).toBe('@lea')
    expect(guestDisplayName({ name: '' })).toBe('Utilisateur Amiv')
  })

  it('sous-titre', () => {
    expect(guestSubtitle({ role: 'owner', status: 'confirmed' })).toBe('Organisateur')
    expect(guestSubtitle({ role: 'guest', status: 'confirmed', username: 'ana' })).toBe('@ana')
    expect(guestSubtitle({ role: 'guest', status: 'pending', invited_at: daysAgo(2) }, NOW)).toBe('Invité il y a 2 j')
    expect(guestSubtitle({ role: 'plus_one', status: 'pending', plus_one_of: 'Lola', invited_at: daysAgo(2) }, NOW)).toBe('+1 de Lola')
    expect(formatInvitedAgo(daysAgo(0.1), NOW)).toBe('Invité il y a 2 h')
  })

  it('relance au plus une fois par 24 h', () => {
    expect(canRemindGuest({ reminded_at: null }, NOW)).toBe(true)
    expect(canRemindGuest({ reminded_at: daysAgo(0.5) }, NOW)).toBe(false)
    expect(canRemindGuest({ reminded_at: daysAgo(1.1) }, NOW)).toBe(true)
  })
})
