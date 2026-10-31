import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))
vi.mock('./monitoring', () => ({ captureSupabaseError() {} }))

const { STEP, cleanUsername, resumeStep, slugify, USERNAME_REGEX } = await import('./onboarding')
const { ageOn, birthdayHasYear, formatBirthday, hasBirthYear, ownBirthdayError, parseBirthday, toBirthdayValue, UNKNOWN_BIRTH_YEAR } = await import('../utils/birthday')
const { gettingStartedItems } = await import('../components/home/GettingStartedCard')

const full = { first_name: 'Léa', username: 'lea', birthday: '1996-12-02' }

describe('reprise de l\'onboarding', () => {
  it('compte tout neuf : prénom et pseudo', () => {
    expect(resumeStep({ onboarding_step: 0 })).toBe(STEP.IDENTITY)
  })
  it('pseudo manquant : retour à l\'étape 2, même plus loin', () => {
    expect(resumeStep({ ...full, username: null, onboarding_step: 6 })).toBe(STEP.IDENTITY)
  })
  it('anniversaire manquant : étape 3', () => {
    expect(resumeStep({ ...full, birthday: null, onboarding_step: 5 })).toBe(STEP.BIRTHDAY)
  })
  it('reprend à la dernière étape non faite', () => {
    expect(resumeStep({ ...full, onboarding_step: 6 })).toBe(STEP.BIRTHDAYS)
  })
  it('jamais avant la photo une fois le profil rempli (ancien onboarding)', () => {
    expect(resumeStep({ ...full, onboarding_step: 2 })).toBe(STEP.PHOTO)
  })
})

describe('pseudo', () => {
  it('suggestion à partir du prénom', () => {
    expect(cleanUsername('Élodie-Marie ')).toBe('elodie-marie')
    expect(cleanUsername('Zoë')).toBe('zoe')
  })
  it('un tiret final reste permis pendant la saisie', () => {
    expect(slugify('marie-')).toBe('marie-')
  })
  it('règles de format', () => {
    expect(USERNAME_REGEX.test('lo')).toBe(false)
    expect(USERNAME_REGEX.test('lou-2')).toBe(true)
    expect(USERNAME_REGEX.test('Lou')).toBe(false)
  })
})

describe('anniversaire sans année', () => {
  it('année inconnue stockée avant 1900, jamais affichée', () => {
    const value = toBirthdayValue({ day: 29, month: 2, year: null })
    expect(value).toBe(`${UNKNOWN_BIRTH_YEAR}-02-29`)
    expect(hasBirthYear(value)).toBe(false)
    expect(parseBirthday(value)).toEqual({ day: 29, month: 2, year: null })
    expect(formatBirthday(value)).toBe('29 février')
    expect(formatBirthday('1996-12-01')).toBe('1er décembre 1996')
  })
  it('anniversaires de la table birthdays : birth_year_known décide', () => {
    expect(birthdayHasYear({ birthdate: '2000-03-12', birth_year_known: true })).toBe(true)
    expect(birthdayHasYear({ birthdate: '2000-03-12', birth_year_known: false })).toBe(false)
    expect(birthdayHasYear({ birthdate: '1995-03-12', birth_year_known: true })).toBe(true)
  })
  it('ligne chargée sans birth_year_known : 2000 = année inconnue', () => {
    expect(birthdayHasYear({ birthdate: '2000-03-12' })).toBe(false)
    expect(birthdayHasYear({ birthdate: `${UNKNOWN_BIRTH_YEAR}-03-12` })).toBe(false)
    expect(birthdayHasYear({ birthdate: '1995-03-12' })).toBe(true)
  })
  it('âge minimum des CGU : 15 ans', () => {
    const ref = new Date(2026, 9, 30)
    expect(ageOn({ day: 31, month: 10, year: 2011 }, ref)).toBe(14)
    expect(ageOn({ day: 30, month: 10, year: 2011 }, ref)).toBe(15)
  })
  it('profil : moins de 15 ans refusé, sans année accepté', () => {
    const year = new Date().getFullYear()
    expect(ownBirthdayError(`${year - 10}-01-01`)).toMatch(/15 ans/)
    expect(ownBirthdayError(`${UNKNOWN_BIRTH_YEAR}-01-01`)).toBeNull()
    expect(ownBirthdayError(`${year - 30}-01-01`)).toBeNull()
  })
})

describe('carte « Bien démarrer »', () => {
  it('4 étapes, 2 faites', () => {
    const items = gettingStartedItems({ profile: { ...full, avatar_url: 'x' }, birthdaysCount: 1, friendsCount: 1, pushState: 'prompt' })
    expect(items.map(item => item.key)).toEqual(['photo', 'birthdays', 'friend', 'notifications'])
    expect(items.filter(item => item.done)).toHaveLength(2)
    expect(items[1].detail).toBe('1/3')
  })
  it('profil sans anniversaire : étape en plus', () => {
    const items = gettingStartedItems({ profile: { ...full, birthday: null }, birthdaysCount: 0, friendsCount: 0, pushState: null })
    expect(items[0].key).toBe('birthday')
    expect(items.some(item => item.key === 'notifications')).toBe(false)
  })
  it('tout fait', () => {
    const items = gettingStartedItems({ profile: { ...full, avatar_url: 'x' }, birthdaysCount: 3, friendsCount: 2, pushState: 'granted' })
    expect(items.every(item => item.done)).toBe(true)
  })
})
