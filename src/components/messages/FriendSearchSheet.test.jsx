// @vitest-environment jsdom
// Écran « Ajouter un ami » : suggestions, recherche, envoi de demande, masquage,
// et message quand il n'y a aucune suggestion.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FriendSearchSheet from './FriendSearchSheet'
import * as friendships from '../../lib/friendships'

vi.mock('qrcode.react', () => ({ QRCodeCanvas: () => null }))
vi.mock('../../lib/supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: { username: 'moi' }, error: null }),
  }
  return { supabase: { from: () => query } }
})
vi.mock('../../lib/friendships', () => ({
  acceptFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  dismissFriendSuggestion: vi.fn(() => Promise.resolve({ error: null })),
  getFriendSuggestions: vi.fn(),
  getPendingRequests: vi.fn(() => Promise.resolve({ data: [], error: null })),
  searchPeople: vi.fn(),
  sendFriendRequest: vi.fn(() => Promise.resolve({ data: {}, error: null })),
}))

const MIA = { user_id: 'mia', name: 'Mia Deux', username: 'mia', avatar_url: null, reason: '3 amis en commun', mutual_friends_count: 3 }
const SAM = { user_id: 'sam', name: 'Sam Dry', username: 'sam', avatar_url: null, reason: 'Invité·e à Anniv de Lola', mutual_friends_count: 0 }

describe('FriendSearchSheet', () => {
  beforeEach(() => {
    friendships.getFriendSuggestions.mockResolvedValue({ data: [MIA, SAM], error: null })
    friendships.searchPeople.mockResolvedValue({ data: [], error: null })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche les suggestions avec pseudo et raison', async () => {
    render(<FriendSearchSheet currentUserId="me" onClose={() => {}} />)
    expect(await screen.findByText('Mia Deux')).toBeTruthy()
    expect(screen.getByText('@mia')).toBeTruthy()
    expect(screen.getByText('3 amis en commun')).toBeTruthy()
    expect(screen.getByText('Invité·e à Anniv de Lola')).toBeTruthy()
  })

  it('« Ajouter » devient « Demande envoyée »', async () => {
    render(<FriendSearchSheet currentUserId="me" onClose={() => {}} />)
    await screen.findByText('Mia Deux')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ajouter' })[0])
    expect(await screen.findByRole('button', { name: 'Demande envoyée' })).toBeTruthy()
    expect(friendships.sendFriendRequest).toHaveBeenCalledWith('me', 'mia')
  })

  it('la croix masque la suggestion', async () => {
    render(<FriendSearchSheet currentUserId="me" onClose={() => {}} />)
    await screen.findByText('Mia Deux')
    fireEvent.click(screen.getByRole('button', { name: 'Masquer Mia Deux' }))
    await waitFor(() => expect(screen.queryByText('Mia Deux')).toBeNull())
    expect(friendships.dismissFriendSuggestion).toHaveBeenCalledWith('mia')
  })

  it('sans suggestion : message et partage du lien / QR code', async () => {
    friendships.getFriendSuggestions.mockResolvedValue({ data: [], error: null })
    render(<FriendSearchSheet currentUserId="me" onClose={() => {}} />)
    expect(await screen.findByText('Pas encore de suggestions')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Partager mon lien/ })).toBeTruthy()
    expect(await screen.findByRole('button', { name: /Mon QR code/ })).toBeTruthy()
  })

  it('recherche à partir de 2 caractères, amis marqués « Ami »', async () => {
    friendships.searchPeople.mockResolvedValue({
      data: [{ user_id: 'fanny', name: 'Fanny', username: 'fanny', avatar_url: null, is_friend: true }],
      error: null,
    })
    render(<FriendSearchSheet currentUserId="me" onClose={() => {}} />)
    await screen.findByText('Mia Deux')
    const input = screen.getByLabelText('Rechercher un nom ou un pseudo')
    fireEvent.change(input, { target: { value: 'f' } })
    expect(screen.getByText('Mia Deux')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'fa' } })
    expect(await screen.findByText('Fanny')).toBeTruthy()
    expect(screen.queryByText('Mia Deux')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ami' }).disabled).toBe(true)
    expect(friendships.searchPeople).toHaveBeenCalledWith('fa')
  })
})
