// @vitest-environment jsdom
// Rappels d'anniversaire J-1, J-3, J-7, J-14 : activer / désactiver depuis la
// fiche anniversaire et depuis la carte du haut de l'Accueil.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import BirthdayBottomSheet from './BirthdayBottomSheet'
import HeroBirthdayCard from './HeroBirthdayCard'

// Chaque update est mis en attente : le test choisit quand la base répond.
const db = vi.hoisted(() => ({ updates: [], pending: [] }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: payload => {
        db.updates.push(payload)
        const result = new Promise(resolve => db.pending.push(() => resolve({ data: payload, error: null })))
        const chain = {
          eq: () => chain,
          select: () => chain,
          maybeSingle: () => result,
          then: (onFulfilled, onRejected) => result.then(onFulfilled, onRejected),
        }
        return chain
      },
    }),
  },
}))

const BIRTHDAY = { id: 'b1', name: 'Léa', birthdate: '1990-11-20', reminder_enabled: false, reminder_days: [7] }

// Répond aux `count` enregistrements, un par un, dans l'ordre d'envoi
async function answer(count) {
  for (let index = 0; index < count; index += 1) {
    await waitFor(() => expect(db.pending).toHaveLength(1))
    await act(async () => { db.pending.shift()() })
  }
}

function isActive(label) {
  return screen.getByRole('button', { name: label }).style.color === 'rgb(255, 255, 255)'
}

beforeEach(() => {
  db.updates = []
  db.pending = []
})
afterEach(cleanup)

describe('fiche anniversaire', () => {
  it('appuis rapprochés : enregistrés dans l\'ordre, la base garde la dernière sélection', async () => {
    const onReminderSaved = vi.fn()
    render(<BirthdayBottomSheet birthday={BIRTHDAY} onClose={() => {}} onEdit={() => {}} onReminderSaved={onReminderSaved} />)

    fireEvent.click(screen.getByRole('button', { name: 'J-1' }))
    fireEvent.click(screen.getByRole('button', { name: 'J-3' }))
    fireEvent.click(screen.getByRole('button', { name: 'J-7' }))
    expect(isActive('J-1') && isActive('J-3') && !isActive('J-7')).toBe(true)

    // Le deuxième enregistrement ne part qu'après la réponse au premier
    await waitFor(() => expect(db.updates).toHaveLength(1))
    await answer(3)

    expect(db.updates).toEqual([
      { reminder_enabled: true, reminder_days: [1, 7] },
      { reminder_enabled: true, reminder_days: [1, 3, 7] },
      { reminder_enabled: true, reminder_days: [1, 3] },
    ])
    expect(onReminderSaved).toHaveBeenLastCalledWith({ id: 'b1', reminder_enabled: true, reminder_days: [1, 3] })
  })

  it('la liste renvoie l\'anniversaire (nouvel objet) pendant l\'enregistrement : la sélection reste affichée', async () => {
    const { rerender } = render(<BirthdayBottomSheet birthday={BIRTHDAY} onClose={() => {}} onEdit={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'J-14' }))
    rerender(<BirthdayBottomSheet birthday={{ ...BIRTHDAY }} onClose={() => {}} onEdit={() => {}} />)
    expect(isActive('J-14')).toBe(true)
    await answer(1)
  })
})

describe('carte du prochain anniversaire', () => {
  function renderCard(birthday = { ...BIRTHDAY, days: 18 }) {
    return render(<HeroBirthdayCard birthday={birthday} onReminderSaved={() => {}} />)
  }

  it('l\'Accueil se redessine avant Enregistrer : les choix ne sont pas effacés', async () => {
    const { rerender } = renderCard()
    fireEvent.click(screen.getByText('PROCHAIN ANNIVERSAIRE'))
    fireEvent.click(screen.getByRole('button', { name: 'J-3' }))
    rerender(<HeroBirthdayCard birthday={{ ...BIRTHDAY, days: 18 }} onReminderSaved={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(db.updates).toEqual([{ reminder_enabled: true, reminder_days: [3, 7] }])
    await answer(1)
  })

  it('un appui sur le fond ferme la fiche', () => {
    renderCard()
    fireEvent.click(screen.getByText('PROCHAIN ANNIVERSAIRE'))
    const backdrop = screen.getByText('Gérer le rappel').closest('[style*="position: fixed"]')
    fireEvent.click(backdrop)
    expect(screen.queryByText('Gérer le rappel')).toBeNull()
  })
})
