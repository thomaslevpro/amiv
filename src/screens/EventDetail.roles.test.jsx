// @vitest-environment jsdom
// Page d'un événement : blocs et tuiles visibles selon le rôle, et
// comportement du bloc de réponse.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EventDetail from './EventDetail'

vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } } }))
vi.mock('../components/event/EventPhotosSection', () => ({ default: () => null }))
vi.mock('../components/event/RevealedMemoriesEntry', () => ({ default: () => null }))
vi.mock('../components/PlusOneReviewList', () => ({ default: () => null }))
vi.mock('../components/PlusOneRequest', () => ({ default: () => null }))
vi.mock('../components/InviteFriendsSheet', () => ({ default: () => null }))

let detail
vi.mock('../hooks/useEventDetail', () => ({ default: () => detail }))

const FUTURE = new Date(Date.now() + 10 * 86400000).toISOString()
const OWNER = { role: 'owner', profile: { id: 'org', first_name: 'Thomas', username: 'thomas' } }

function makeDetail(overrides) {
  return {
    rsvpStatus: null, myRsvp: null, userId: 'me', currentUserName: 'Moi', canManage: false, loading: false,
    toast: null, editing: false, editForm: {}, setEditForm: () => {}, birthdayPersonId: null, currentType: 'Soirée', saving: false,
    coverPreview: null, setCoverFile: () => {}, setCoverPreview: () => {}, eventOverrides: {}, showDeleteModal: false,
    setShowDeleteModal: () => {}, deleting: false, friends: [], guests: [], guestsLoading: false, dateOptions: [],
    myVotes: {}, allVoteCounts: {}, confirmingDate: false, birthdayPersonName: null, birthdayPersonBirthday: null,
    canAccessSecretSpace: false, canAccessEventChat: false, chatUnreadCount: 0, secretUnreadCount: 0, organizers: [OWNER], showCoOrgModal: false,
    setShowCoOrgModal: () => {}, coOrgSubmitting: false, coOrgError: '', confirmedParticipants: [], coOrgLoading: false,
    eventForMessages: {}, handleRsvp: vi.fn(async () => {}), handleDateVote: () => {}, handleConfirmDate: () => {}, handleEditOpen: () => {},
    toggleBirthdayPerson: () => {}, handleEditSubmit: () => {}, handleDeleteEvent: () => {},
    refreshGuests: () => {}, handleRemindGuest: () => {}, handleRemoveInvitation: () => {}, handleShare: () => {}, showToast: () => {},
    handleOpenCoOrgModal: () => {}, handleAddCoOrganizer: () => {}, setEditing: () => {},
    ...overrides,
  }
}

function renderPage(overrides, event = {}) {
  detail = makeDetail(overrides)
  render(
    <MemoryRouter>
      <EventDetail event={{ id: 'e1', name: 'Fête', type: detail.currentType, visibility: 'invite_only', user_id: 'org', date: FUTURE, location: 'Paris', ...event }} onBack={() => {}} />
    </MemoryRouter>,
  )
}

const tile = name => screen.queryByRole('button', { name: new RegExp(name) })

afterEach(() => cleanup())

describe('EventDetail — rôles', () => {
  it('invité simple (soirée, a accepté) : réponse + Chat, ni espace secret ni espace organisateur', () => {
    renderPage({ rsvpStatus: 'going', canAccessEventChat: true })
    expect(screen.getByText('Tu y seras')).toBeTruthy()
    expect(tile('Chat')).toBeTruthy()
    expect(tile('Espace secret')).toBeNull()
    expect(tile('Espace organisateur')).toBeNull()
    expect(screen.queryByLabelText("Plus d'actions")).toBeNull()
  })

  it("invité d'un anniversaire (accepté) : Chat + Espace secret avec badge, ligne de la personne fêtée", () => {
    renderPage({ currentType: 'Anniversaire', birthdayPersonId: 'jen', birthdayPersonName: 'Jen', birthdayPersonBirthday: '1996-01-15', rsvpStatus: 'going', canAccessEventChat: true, canAccessSecretSpace: true, secretUnreadCount: 3 }, { date: '2026-06-26T12:00:00' })
    expect(tile('Chat')).toBeTruthy()
    expect(tile('Espace secret')).toBeTruthy()
    expect(screen.getByLabelText('3 nouveautés')).toBeTruthy()
    expect(screen.getByText(/Jen/).parentElement.textContent).toBe('Pour Jen · 30 ans')
    expect(tile('Espace organisateur')).toBeNull()
  })

  it('personne fêtée : jamais d’espace secret, même si le serveur répondait oui', () => {
    renderPage({ userId: 'jen', currentType: 'Anniversaire', birthdayPersonId: 'jen', birthdayPersonName: 'Jen', rsvpStatus: 'going', canAccessEventChat: true, canAccessSecretSpace: true })
    expect(tile('Espace secret')).toBeNull()
    expect(tile('Chat')).toBeTruthy()
    expect(screen.getByText('Pour').textContent).toBe('Pour toi')
  })

  it("organisateur d'un anniversaire : pas de bloc de réponse, les trois tuiles, menu ···", () => {
    renderPage({ userId: 'org', canManage: true, currentType: 'Anniversaire', birthdayPersonId: 'jen', birthdayPersonName: 'Jen', canAccessEventChat: true, canAccessSecretSpace: true })
    expect(screen.queryByText('Ta réponse')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Ta réponse' })).toBeNull()
    expect(tile('Chat')).toBeTruthy()
    expect(tile('Espace secret')).toBeTruthy()
    expect(tile('Espace organisateur')).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Plus d'actions"))
    for (const label of ["Modifier l'événement", 'Inviter des amis', 'Partager le lien', 'Ajouter un co-organisateur', "Supprimer l'événement"]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it("organisateur d'une soirée : Chat + Espace organisateur, pas d'espace secret", () => {
    renderPage({ userId: 'org', canManage: true, canAccessEventChat: true })
    expect(tile('Chat')).toBeTruthy()
    expect(tile('Espace organisateur')).toBeTruthy()
    expect(tile('Espace secret')).toBeNull()
  })
})

describe('EventDetail — réponse', () => {
  it('sans réponse : les trois boutons directement', () => {
    renderPage({ rsvpStatus: 'pending' })
    const group = screen.getByRole('group', { name: 'Ta réponse' })
    expect([...group.querySelectorAll('button')].map(b => b.textContent)).toEqual(["J'y serai", 'Peut-être', 'Non'])
  })

  it('« Modifier » affiche les boutons, le choix est enregistré et le résumé revient', async () => {
    renderPage({ rsvpStatus: 'going' })
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    fireEvent.click(screen.getByRole('button', { name: 'Non' }))
    expect(detail.handleRsvp).toHaveBeenCalledWith('declined')
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Ta réponse' })).toBeNull())
  })

  it('« Peut-être » et « Tu ne viens pas » en résumé', () => {
    renderPage({ rsvpStatus: 'maybe' })
    expect(screen.getAllByText('Peut-être')).toHaveLength(1)
    cleanup()
    renderPage({ rsvpStatus: 'declined' })
    expect(screen.getByText('Tu ne viens pas')).toBeTruthy()
  })
})

describe('EventDetail — invités', () => {
  const guests = Array.from({ length: 20 }, (_, i) => ({ guest_key: `g${i}`, user_id: `g${i}`, role: 'guest', status: i < 6 ? 'confirmed' : i < 9 ? 'pending' : i < 12 ? 'maybe' : 'declined', display_name: `Invité ${i}` }))

  it('ligne résumée : 3 photos puis +N, compteurs ; la feuille contient la liste', () => {
    renderPage({ guests })
    expect(screen.getByText('20 invités')).toBeTruthy()
    expect(screen.getByText('+17')).toBeTruthy()
    expect(screen.getByText('6 confirmés · 3 en attente')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    fireEvent.click(screen.getByText('20 invités'))
    expect(screen.getByRole('dialog', { name: 'Invités' })).toBeTruthy()
    expect(screen.getByRole('tablist')).toBeTruthy()
  })

  it('aucun invité', () => {
    renderPage({ guests: [] })
    expect(screen.getByText('0 invité')).toBeTruthy()
  })
})

describe('EventDetail — sondage de dates', () => {
  const dateOptions = [{ id: 'o1', proposed_date: '2026-12-12', proposed_time: '20:00:00' }, { id: 'o2', proposed_date: '2026-12-19', proposed_time: null }]
  // Événement tel que chargé par les listes : sans poll_closed, date encore vide
  const listEvent = { date: null, poll_closed: undefined }

  it('sondage ouvert : bandeau « Un sondage attend ta réponse », date à définir', () => {
    renderPage({ rsvpStatus: 'pending', dateOptions, eventOverrides: { date: null, poll_closed: false } }, listEvent)
    expect(screen.getByText('Un sondage attend ta réponse')).toBeTruthy()
    expect(screen.getByText(/Date à définir/)).toBeTruthy()
  })

  it('date choisie (lue en base) : plus de sondage, date affichée, réponse possible', () => {
    renderPage({ rsvpStatus: 'pending', dateOptions, eventOverrides: { date: FUTURE, poll_closed: true } }, listEvent)
    expect(screen.queryByText('Un sondage attend ta réponse')).toBeNull()
    expect(screen.queryByText('Sondage de dates')).toBeNull()
    expect(screen.queryByText(/Date à définir/)).toBeNull()
    const group = screen.getByRole('group', { name: 'Ta réponse' })
    expect([...group.querySelectorAll('button')].map(b => b.textContent)).toEqual(["J'y serai", 'Peut-être', 'Non'])
  })
})
