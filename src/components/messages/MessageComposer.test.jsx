// @vitest-environment jsdom
// Saisie d'un message : retours à la ligne, envoi au clavier selon l'appareil,
// bouton désactivé tant que le message est vide.
// Participants d'un chat : seulement ceux qui y ont accès.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import MessageComposer from './MessageComposer'
import { chatMembers } from './ChatMembersSheet'
import { previewMessage } from './utils'

const native = vi.hoisted(() => ({ value: false }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))
vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/monitoring', () => ({ captureSupabaseError() {} }))

function setCoarsePointer(coarse) {
  window.matchMedia = query => ({ matches: coarse && query.includes('coarse'), addEventListener() {}, removeEventListener() {} })
}

function Harness({ onSend, initial = '' }) {
  const [value, setValue] = useState(initial)
  return <MessageComposer value={value} onChange={setValue} onSend={() => onSend(value)} />
}

afterEach(() => { cleanup(); native.value = false })

describe('MessageComposer', () => {
  it('ordinateur : Entrée envoie, Maj + Entrée ne envoie pas', () => {
    setCoarsePointer(false)
    const onSend = vi.fn()
    render(<Harness onSend={onSend} initial="Salut" />)
    const field = screen.getByLabelText('Message')
    expect(field.tagName).toBe('TEXTAREA')
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('Salut')
  })

  it('iPhone : la touche retour ne envoie jamais', () => {
    native.value = true
    setCoarsePointer(true)
    const onSend = vi.fn()
    render(<Harness onSend={onSend} initial="Salut" />)
    const field = screen.getByLabelText('Message')
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
    expect(field.getAttribute('enterkeyhint')).toBe('enter')
    fireEvent.click(screen.getByLabelText('Envoyer'))
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('bouton désactivé avec seulement des espaces ou des retours à la ligne', () => {
    setCoarsePointer(false)
    render(<Harness onSend={vi.fn()} initial={'  \n \n '} />)
    expect(screen.getByLabelText('Envoyer').disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'a\nb' } })
    expect(screen.getByLabelText('Envoyer').disabled).toBe(false)
  })
})

describe('aperçu dans la liste', () => {
  it('les retours à la ligne deviennent des espaces', () => {
    expect(previewMessage('Salut\nça va ?\n\n à ce soir').text).toBe('Salut ça va ? à ce soir')
  })
})

describe('chatMembers', () => {
  const guests = [
    { guest_key: 'o', user_id: 'orga', role: 'owner', status: 'confirmed' },
    { guest_key: 'c', user_id: 'coorg', role: 'co_organizer', status: 'pending' },
    { guest_key: 'a', user_id: 'alice', role: 'guest', status: 'confirmed' },
    { guest_key: 't', user_id: 'toto', role: 'guest', status: 'confirmed' },
    { guest_key: 'm', user_id: 'maybe', role: 'guest', status: 'maybe' },
    { guest_key: 'p', user_id: 'pending', role: 'guest', status: 'pending' },
    { guest_key: 'd', user_id: 'declined', role: 'guest', status: 'declined' },
    { guest_key: 'l', user_id: null, role: 'link_guest', status: 'confirmed' },
  ]
  const ids = list => list.map(guest => guest.user_id)

  it('organisateurs et confirmés seulement', () => {
    expect(ids(chatMembers(guests))).toEqual(['orga', 'coorg', 'alice', 'toto'])
  })

  it('Général d’un anniversaire : la personne fêtée en premier', () => {
    expect(ids(chatMembers(guests, { birthdayPersonId: 'toto' }))).toEqual(['toto', 'orga', 'coorg', 'alice'])
  })

  it('Secret : la personne fêtée n’apparaît jamais', () => {
    expect(ids(chatMembers(guests, { birthdayPersonId: 'toto', isSecret: true }))).toEqual(['orga', 'coorg', 'alice'])
  })
})
