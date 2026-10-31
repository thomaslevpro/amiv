// @vitest-environment jsdom
// Messages privés : tap seul = rien, double-tap = ❤️, appui long = réactions +
// Répondre / Copier / Signaler (ou Supprimer sur mes messages), jamais Bloquer.
// Bloquer passe dans l'en-tête (tap sur le nom).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const ME = 'me'
const FRIEND = 'friend'
const MESSAGES = [
  { id: 'm1', conversation_id: 'c1', sender_id: FRIEND, content: 'Salut !', created_at: '2026-10-31T10:00:00Z', reply_to_id: null },
  { id: 'm2', conversation_id: 'c1', sender_id: ME, content: 'Coucou', created_at: '2026-10-31T10:05:00Z', reply_to_id: null },
]

const calls = vi.hoisted(() => ({ inserts: [], deletes: [] }))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, isPluginAvailable: () => false } }))
vi.mock('../lib/monitoring', () => ({ captureSupabaseError() {} }))
vi.mock('../lib/safety', () => ({ isBlockedByMe: async () => false, unblockUser: async () => {}, blockUser: async () => {}, submitReport: async () => {}, REPORT_REASONS: [] }))
vi.mock('../lib/supabase', () => {
  // Requête chaînable : chaque méthode renvoie la chaîne, await donne { data }
  function query(table) {
    const state = { table, op: 'select', payload: null, filters: {} }
    const result = () => {
      if (state.op === 'insert') {
        calls.inserts.push({ table, ...state.payload })
        return { data: { id: `r-${calls.inserts.length}`, created_at: 'now', ...state.payload }, error: null }
      }
      if (state.op === 'delete') {
        calls.deletes.push({ table, ...state.filters })
        return { data: [{ id: state.filters.id }], error: null }
      }
      if (table === 'direct_messages') return { data: MESSAGES, error: null }
      return { data: table === 'friendships' ? null : [], error: null }
    }
    const chain = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
        if (prop === 'insert') return payload => { state.op = 'insert'; state.payload = payload; return chain }
        if (prop === 'delete') return () => { state.op = 'delete'; return chain }
        if (prop === 'eq') return (column, value) => { state.filters[column] = value; return chain }
        return () => chain
      },
    })
    return chain
  }
  const channel = { on() { return channel }, subscribe() { return channel } }
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
      from: query,
      rpc: () => query('rpc'),
      channel: () => channel,
      removeChannel() {},
    },
  }
})

const { default: ConversationScreen } = await import('./ConversationScreen')

const friend = { friend_id: FRIEND, friend_first_name: 'Camille', friend_name: 'Martin' }

async function renderScreen() {
  render(<ConversationScreen conversationId="c1" friend={friend} onBack={() => {}} />)
  await act(async () => {})
  await act(async () => {})
}

function bubble(text) {
  return screen.getAllByText(text).find(el => el.closest('[data-message-id]')).closest('[data-message-id]')
}

function tap(element) {
  fireEvent.pointerDown(element, { pointerType: 'touch', clientX: 10, clientY: 10 })
  fireEvent.pointerUp(element, { pointerType: 'touch', clientX: 10, clientY: 10 })
}

async function longPress(element) {
  fireEvent.pointerDown(element, { pointerType: 'touch', clientX: 10, clientY: 10 })
  await act(async () => { vi.advanceTimersByTime(450) })
  fireEvent.pointerUp(element, { pointerType: 'touch', clientX: 10, clientY: 10 })
}

// jsdom n'a pas PointerEvent : sans lui, clientX / pointerType sont perdus
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
}

beforeEach(() => {
  calls.inserts.length = 0
  calls.deletes.length = 0
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('ConversationScreen — gestes sur les messages', () => {
  it('un tap seul ne fait rien', async () => {
    await renderScreen()
    vi.useFakeTimers()
    tap(bubble('Salut !'))
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(calls.inserts).toHaveLength(0)
  })

  it('un double-tap ajoute ❤️', async () => {
    await renderScreen()
    tap(bubble('Salut !'))
    tap(bubble('Salut !'))
    await act(async () => {})
    expect(calls.inserts).toEqual([{ table: 'message_reactions', message_id: 'm1', user_id: ME, emoji: '❤️' }])
    expect(screen.getByRole('button', { name: /❤️ 1, retirer ma réaction/ })).toBeTruthy()
  })

  it('un appui qui glisse (défilement) n’ouvre pas le menu', async () => {
    await renderScreen()
    vi.useFakeTimers()
    const el = bubble('Salut !')
    fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(el, { pointerType: 'touch', clientX: 10, clientY: 40 })
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('appui long sur un message reçu : 6 réactions, Répondre, Copier, Signaler — pas Bloquer', async () => {
    await renderScreen()
    vi.useFakeTimers()
    await longPress(bubble('Salut !'))
    const dialog = screen.getByRole('dialog')
    const emojis = within(dialog).getAllByRole('button', { name: /Réagir avec/ }).map(b => b.textContent)
    expect(emojis).toEqual(['❤️', '😂', '🎉', '👍', '😮', '😢'])
    const items = within(dialog).getAllByRole('menuitem').map(b => b.textContent)
    expect(items).toEqual(['Répondre', 'Copier', 'Signaler'])
    expect(within(dialog).queryByText(/Bloquer/)).toBeNull()
  })

  it('appui long sur mon message : Supprimer à la place de Signaler, avec confirmation', async () => {
    await renderScreen()
    vi.useFakeTimers()
    await longPress(bubble('Coucou'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByRole('menuitem').map(b => b.textContent)).toEqual(['Répondre', 'Copier', 'Supprimer'])
    fireEvent.click(within(dialog).getByRole('menuitem', { name: 'Supprimer' }))
    expect(calls.deletes).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('menuitem', { name: 'Supprimer pour tous ?' }))
    await act(async () => {})
    expect(calls.deletes).toEqual([{ table: 'direct_messages', id: 'm2' }])
    expect(screen.queryByText('Coucou')).toBeNull()
  })

  it('Répondre affiche le message cité au-dessus de la saisie', async () => {
    await renderScreen()
    vi.useFakeTimers()
    await longPress(bubble('Salut !'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Répondre' }))
    expect(screen.getByText('Réponse à Camille Martin')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Annuler la réponse' })).toBeTruthy()
  })

  it('tap sur le nom : Voir le profil, Bloquer, Signaler', async () => {
    await renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Options pour Camille Martin' }))
    const labels = ['Voir le profil', 'Bloquer cet utilisateur', 'Signaler']
    const buttons = labels.map(label => screen.getByRole('button', { name: label }))
    // Dans cet ordre
    expect(buttons[0].compareDocumentPosition(buttons[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(buttons[1].compareDocumentPosition(buttons[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
