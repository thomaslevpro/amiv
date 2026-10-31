// @vitest-environment jsdom
// En-tête du chat d'événement : cadenas vers l'espace secret, jamais pour la
// personne fêtée ; bandeau « Conversation cachée de … » dans l'onglet Secret.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import MessageThread from './MessageThread'
import { canLinkSecretSpace } from '../../lib/secretSpace'

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
