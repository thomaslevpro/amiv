import { describe, expect, it } from 'vitest'
import { friendFullName, fullName, profileFullName } from './displayName'

describe('fullName', () => {
  it.each([
    ['Thomas', 'Levy', 'Thomas Levy'],
    ['Thomas', 'Thomas', 'Thomas'],
    ['Thomas', 'thomas', 'Thomas'],
    ['Thomas', 'Thomas Levy', 'Thomas Levy'],
    ['  Thomas ', ' Levy  ', 'Thomas Levy'],
    ['Thomas', '', 'Thomas'],
    ['Thomas', null, 'Thomas'],
    ['', 'Levy', 'Levy'],
    [null, 'Levy', 'Levy'],
    ['', '', ''],
    ['Jean', 'Jeanne', 'Jean Jeanne'],
  ])('(%s, %s) → %s', (first, last, expected) => {
    expect(fullName(first, last)).toBe(expected)
  })
})

describe('profileFullName', () => {
  it('replie sur le pseudo puis sur le libellé donné', () => {
    expect(profileFullName({ first_name: '', name: '', username: 'tom' })).toBe('@tom')
    expect(profileFullName({ first_name: null, name: '' }, 'Invité')).toBe('Invité')
    expect(profileFullName(null)).toBe('Ami')
  })
})

describe('friendFullName', () => {
  it('lit les champs de get_friends', () => {
    expect(friendFullName({ friend_first_name: 'Olga', friend_name: 'Petrova' })).toBe('Olga Petrova')
    expect(friendFullName({ friend_first_name: 'Olga', friend_name: 'Olga' })).toBe('Olga')
    expect(friendFullName({ friend_username: 'olga' })).toBe('@olga')
  })
})
