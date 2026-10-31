// Heures d'événement autour des changements d'heure, en Europe/Paris
// (passage à l'heure d'hiver le 25/10/2026, à l'heure d'été le 28/03/2027).
process.env.TZ = 'Europe/Paris'

import { describe, expect, it } from 'vitest'
import { eventDateToLocalInput, localDayKey, localInputToEventDate, pollOptionToEventDate, toIcsUtc } from './eventDate'

describe('localInputToEventDate : heure saisie (Paris) → instant UTC', () => {
  it.each([
    // heure d'été (UTC+2) avant le 25 octobre, heure d'hiver (UTC+1) après
    ['2026-10-24T20:00', '2026-10-24T18:00:00.000Z'],
    ['2026-10-25T20:00', '2026-10-25T19:00:00.000Z'],
    ['2026-10-26T09:30', '2026-10-26T08:30:00.000Z'],
    // heure d'hiver avant le 28 mars, heure d'été après
    ['2027-03-27T20:00', '2027-03-27T19:00:00.000Z'],
    ['2027-03-28T20:00', '2027-03-28T18:00:00.000Z'],
    ['2026-03-28T20:00', '2026-03-28T19:00:00.000Z'],
    ['2026-03-29T20:00', '2026-03-29T18:00:00.000Z'],
    // minuit et demie : la veille en UTC
    ['2026-10-25T00:30', '2026-10-24T22:30:00.000Z'],
    ['2027-03-28T00:30', '2027-03-27T23:30:00.000Z'],
  ])('%s → %s', (input, expected) => {
    expect(localInputToEventDate(input)).toBe(expected)
  })

  it("heure qui n'existe pas (28/03/2027 02:30) : décalée à 03:30, comme le téléphone", () => {
    expect(localInputToEventDate('2027-03-28T02:30')).toBe('2027-03-28T01:30:00.000Z')
  })

  it('vide ou invalide → null', () => {
    expect(localInputToEventDate('')).toBeNull()
    expect(localInputToEventDate(null)).toBeNull()
    expect(localInputToEventDate('pas une date')).toBeNull()
  })
})

describe('eventDateToLocalInput : instant → champ « Modifier »', () => {
  it.each([
    ['2026-10-24T18:00:00+00:00', '2026-10-24T20:00'],
    ['2026-10-25T19:00:00+00:00', '2026-10-25T20:00'],
    ['2027-03-27T19:00:00+00:00', '2027-03-27T20:00'],
    ['2027-03-28T18:00:00+00:00', '2027-03-28T20:00'],
    ['2026-10-24T22:30:00+00:00', '2026-10-25T00:30'],
  ])('%s → %s', (stored, expected) => {
    expect(eventDateToLocalInput(stored)).toBe(expected)
  })

  it('ouvrir puis enregistrer sans toucher garde le même instant', () => {
    for (const stored of ['2026-10-24T18:00:00.000Z', '2026-10-25T19:00:00.000Z', '2027-03-27T19:00:00.000Z', '2027-03-28T18:00:00.000Z', '2026-10-24T22:30:00.000Z']) {
      expect(localInputToEventDate(eventDateToLocalInput(stored))).toBe(stored)
    }
  })

  it('sans date → champ vide', () => {
    expect(eventDateToLocalInput(null)).toBe('')
  })
})

describe('pollOptionToEventDate : date confirmée du sondage', () => {
  it.each([
    ['2026-10-24', '20:00:00', '2026-10-24T18:00:00.000Z'],
    ['2026-10-25', '20:00:00', '2026-10-25T19:00:00.000Z'],
    ['2027-03-27', '20:00', '2027-03-27T19:00:00.000Z'],
    ['2027-03-28', '20:00', '2027-03-28T18:00:00.000Z'],
    ['2026-10-25', null, '2026-10-24T22:00:00.000Z'],
    ['2027-03-28', null, '2027-03-27T23:00:00.000Z'],
  ])('%s %s → %s', (date, time, expected) => {
    expect(pollOptionToEventDate(date, time)).toBe(expected)
  })
})

describe('localDayKey : jour affiché dans le calendrier', () => {
  it.each([
    ['2026-10-24T22:30:00Z', '2026-10-25'],
    ['2027-03-27T23:30:00Z', '2027-03-28'],
    ['2026-10-25T21:30:00Z', '2026-10-25'],
    ['2027-03-28T21:30:00Z', '2027-03-28'],
    ['2026-10-31T23:30:00Z', '2026-11-01'],
  ])('%s → %s', (stored, expected) => {
    expect(localDayKey(stored)).toBe(expected)
  })

  it('premier et dernier jour du mois (cases du calendrier, minuit local)', () => {
    expect(localDayKey(new Date(2026, 9, 1))).toBe('2026-10-01')
    expect(localDayKey(new Date(2026, 10, 0))).toBe('2026-10-31')
    expect(localDayKey(new Date(2027, 2, 1))).toBe('2027-03-01')
    expect(localDayKey(new Date(2027, 3, 0))).toBe('2027-03-31')
  })
})

describe('toIcsUtc : export agenda', () => {
  it.each([
    ['2026-10-24T18:00:00+00:00', '20261024T180000Z'],
    ['2026-10-25T19:00:00+00:00', '20261025T190000Z'],
    ['2027-03-28T18:00:00+00:00', '20270328T180000Z'],
  ])('%s → %s', (stored, expected) => {
    expect(toIcsUtc(stored)).toBe(expected)
  })

  it("20:00 saisi avant et après le changement d'heure reste 20:00 dans l'agenda", () => {
    for (const input of ['2026-10-24T20:00', '2026-10-25T20:00', '2027-03-27T20:00', '2027-03-28T20:00']) {
      expect(new Date(localInputToEventDate(input)).getHours()).toBe(20)
    }
  })
})
