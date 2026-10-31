// Révélation du Flashback : même règle que memories_revealed côté serveur
// (jour de l'événement à 00:00, heure de Paris).
import { describe, expect, it, vi } from 'vitest'
import { daysUntilReveal, formatRevealDay, memoriesRevealed, secretRevealDay } from './secretSpace'

vi.mock('./supabase', () => ({ supabase: {} }))

describe('révélation du Flashback', () => {
  it('jour de l’événement à Paris, pas le lendemain', () => {
    expect(secretRevealDay('2026-11-20T19:00:00Z')).toBe('2026-11-20')
    expect(formatRevealDay(secretRevealDay('2026-11-20T19:00:00Z'))).toBe('20 novembre')
  })

  it('00:30 à Paris = encore la veille en UTC : on suit Paris', () => {
    expect(secretRevealDay('2026-11-20T23:30:00Z')).toBe('2026-11-21')
  })

  it('J-n puis révélé dès 00:00 Paris le jour J', () => {
    const event = '2026-11-20T19:00:00Z'
    expect(daysUntilReveal(event, new Date('2026-11-18T12:00:00Z'))).toBe(2)
    expect(memoriesRevealed(event, new Date('2026-11-19T22:59:00Z'))).toBe(false)
    expect(memoriesRevealed(event, new Date('2026-11-19T23:01:00Z'))).toBe(true)
    expect(memoriesRevealed(event, new Date('2026-11-25T12:00:00Z'))).toBe(true)
  })

  it('sans date : pas de révélation', () => {
    expect(daysUntilReveal(null)).toBeNull()
    expect(memoriesRevealed(null)).toBe(false)
  })
})
