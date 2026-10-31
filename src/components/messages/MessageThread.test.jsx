// @vitest-environment jsdom
// En-tête du chat d'événement : cadenas vers l'espace secret, jamais pour la
// personne fêtée ; bandeau « Conversation cachée de … » dans l'onglet Secret.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import MessageThread from './MessageThread'
import { canLinkSecretSpace } from '../../lib/secretSpace'
import { buildEventMessageRows } from './utils'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/monitoring', () => ({ captureSupabaseError() {} }))

const event = { id: 'e1', name: 'Anniv de Nicolas', date: '2026-11-20T20:00:00Z', location: 'Paris', birthday_person_user_id: 'nicolas' }

function renderThread(userId, { isSecret = false } = {}) {
  const canUse = canLinkSecretSpace(event, userId)
  const onOpenSecretSpace = canUse ? vi.fn() : null
  render(
    <MessageThread
      event={event}
      onBack={() => {}}
      canUseSecretChannel={canUse}
      isSecret={isSecret}
      setIsSecret={() => {}}
      birthdayPersonFirstName="Nicolas"
      messages={[]}
      eventMessageRows={[]}
      bottomRef={createRef()}
      input=""
      setInput={() => {}}
      send={() => {}}
      onOpenSecretSpace={onOpenSecretSpace}
      currentUserId={userId}
    />,
  )
  return onOpenSecretSpace
}

afterEach(cleanup)

describe('MessageThread — en-tête', () => {
  it('invité : le cadenas ouvre l’espace secret, plus de bouton « ··· »', () => {
    const open = renderThread('lola')
    fireEvent.click(screen.getByRole('button', { name: "Ouvrir l'espace secret" }))
    expect(open).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: "Plus d'options" })).toBeNull()
  })

  it('personne fêtée : aucun cadenas, aucun onglet Secret', () => {
    renderThread('nicolas')
    expect(screen.queryByRole('button', { name: "Ouvrir l'espace secret" })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Secret' })).toBeNull()
  })

  it('onglet Secret : bandeau sur une ligne avec le prénom, sans carte « Espace secret »', () => {
    renderThread('lola', { isSecret: true })
    expect(screen.getByText('Conversation cachée de Nicolas')).toBeTruthy()
    expect(screen.queryByText(/ne lui sont jamais montrés/)).toBeNull()
    expect(screen.queryByText('Espace secret')).toBeNull()
  })
})

// jsdom n'a pas PointerEvent : sans lui, clientX / pointerType sont perdus
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
}

describe('MessageThread — gestes sur les messages', () => {
  const lola = { id: 'lola', first_name: 'Lola', name: 'Martin', avatar_url: '' }
  const chatMessages = [
    { id: 'm1', event_id: 'e1', user_id: 'lola', content: 'On se retrouve où ?', created_at: '2026-10-31T10:00:00Z', profile: lola },
    { id: 'm2', event_id: 'e1', user_id: 'me', content: 'Chez moi', created_at: '2026-10-31T10:05:00Z', profile: null },
    { id: 'm3', event_id: 'e1', user_id: 'bob', content: null, is_hidden: true, created_at: '2026-10-31T10:06:00Z', profile: { id: 'bob', first_name: 'Bob' } },
  ]

  function renderChat({ onDeleteMessage = vi.fn(async () => true), send = vi.fn(async () => true) } = {}) {
    const reactions = {
      reactionsByMessage: { m1: { '❤️': { emoji: '❤️', count: 2, reactedByMe: true } } },
      myEmojis: id => new Set(id === 'm1' ? ['❤️'] : []),
      toggleReaction: vi.fn(),
    }
    render(
      <MessageThread
        event={event}
        onBack={() => {}}
        canUseSecretChannel={false}
        isSecret={false}
        setIsSecret={() => {}}
        messages={chatMessages}
        eventMessageRows={buildEventMessageRows(chatMessages, 'me')}
        bottomRef={createRef()}
        input="Ok"
        setInput={() => {}}
        send={send}
        currentUserId="me"
        reactions={reactions}
        onDeleteMessage={onDeleteMessage}
      />,
    )
    return { reactions, onDeleteMessage, send }
  }

  const bubble = text => screen.getByText(text).closest('[data-message-id]')
  const tap = el => {
    fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 5, clientY: 5 })
    fireEvent.pointerUp(el, { pointerType: 'touch', clientX: 5, clientY: 5 })
  }
  async function longPress(el) {
    vi.useFakeTimers()
    fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 5, clientY: 5 })
    await act(async () => { vi.advanceTimersByTime(450) })
    fireEvent.pointerUp(el, { pointerType: 'touch', clientX: 5, clientY: 5 })
    vi.useRealTimers()
  }

  it('tap seul : rien ; double-tap : ❤️', () => {
    const { reactions } = renderChat()
    tap(bubble('On se retrouve où ?'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(reactions.toggleReaction).not.toHaveBeenCalled()
    tap(bubble('On se retrouve où ?'))
    expect(reactions.toggleReaction).toHaveBeenCalledWith('m1', '❤️')
  })

  it('pastilles sous la bulle ; tap = retire / ajoute ma réaction', () => {
    const { reactions } = renderChat()
    fireEvent.click(screen.getByRole('button', { name: /❤️ 2, retirer ma réaction/ }))
    expect(reactions.toggleReaction).toHaveBeenCalledWith('m1', '❤️')
  })

  it('appui long sur un message reçu : réactions + Répondre, Copier, Signaler, sans Bloquer', async () => {
    renderChat()
    await longPress(bubble('On se retrouve où ?'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByRole('button', { name: /Réagir avec/ })).toHaveLength(6)
    expect(within(dialog).getByRole('button', { name: 'Réagir avec ❤️' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(dialog).getAllByRole('menuitem').map(b => b.textContent)).toEqual(['Répondre', 'Copier', 'Signaler'])
    expect(within(dialog).queryByText(/Bloquer/)).toBeNull()
  })

  it('appui long sur mon message : Supprimer après confirmation', async () => {
    const { onDeleteMessage } = renderChat()
    await longPress(bubble('Chez moi'))
    expect(screen.getAllByRole('menuitem').map(b => b.textContent)).toEqual(['Répondre', 'Copier', 'Supprimer'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(onDeleteMessage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer pour tous ?' }))
    await act(async () => {})
    expect(onDeleteMessage).toHaveBeenCalledWith(chatMessages[1])
  })

  it('message masqué (auteur bloqué) : pas de menu', async () => {
    renderChat()
    await longPress(bubble('Message masqué'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Répondre : bandeau au-dessus de la saisie, envoyé avec le message cité', async () => {
    const { send } = renderChat()
    await longPress(bubble('On se retrouve où ?'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Répondre' }))
    expect(screen.getByText('Réponse à Lola Martin')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /envoyer/i })) })
    expect(send).toHaveBeenCalledWith({ replyToId: 'm1' })
    expect(screen.queryByText('Réponse à Lola Martin')).toBeNull()
  })

  it('tap sur le nom de l’auteur : Voir le profil, Bloquer, Signaler', () => {
    renderChat()
    fireEvent.click(screen.getByRole('button', { name: 'Lola Martin' }))
    expect(screen.getByRole('button', { name: 'Voir le profil' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bloquer cet utilisateur' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Signaler' })).toBeTruthy()
  })

  it('tap sur l’auteur d’un message masqué : Débloquer', () => {
    renderChat()
    fireEvent.click(screen.getByRole('button', { name: 'Options pour Bob' }))
    expect(screen.getByRole('button', { name: 'Débloquer cet utilisateur' })).toBeTruthy()
  })
})
