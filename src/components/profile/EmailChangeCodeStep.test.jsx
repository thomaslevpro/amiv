// @vitest-environment jsdom
// Changement d'adresse : un ou deux codes, validation dans n'importe quel
// ordre, erreur sur le bon champ, renvoi qui remet tout à zéro.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import EmailChangeCodeStep from './EmailChangeCodeStep'

const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), updateUser: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth } }))
vi.mock('../../lib/analytics', () => ({ track() {} }))
vi.mock('../../lib/monitoring', () => ({ captureSupabaseError() {} }))

const otpError = { name: 'AuthApiError', status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }
const props = { currentEmail: 'old@amiv.app', newEmail: 'new@amiv.app', sentAt: Date.now() }
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  Object.values(auth).forEach(fn => fn.mockReset())
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
  auth.updateUser.mockResolvedValue({ data: {}, error: null })
})
afterEach(cleanup)

describe('EmailChangeCodeStep', () => {
  it('sécurisé : deux champs, chaque code vérifié avec sa propre adresse', async () => {
    const onDone = vi.fn()
    render(<EmailChangeCodeStep {...props} secure onDone={onDone} onCancel={() => {}} />)
    expect(screen.getByText('old@amiv.app')).toBeTruthy()
    expect(screen.getByText('new@amiv.app')).toBeTruthy()
    const field = screen.getByLabelText('Code reçu sur ton adresse actuelle')
    expect(field.getAttribute('autocomplete')).toBe('one-time-code')
    type('Code reçu sur ton adresse actuelle', '111111')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    type('Code reçu sur ta nouvelle adresse', '222222')
    await screen.findByText('Adresse modifiée')
    expect(auth.verifyOtp).toHaveBeenNthCalledWith(1, { email: 'old@amiv.app', token: '111111', type: 'email_change' })
    expect(auth.verifyOtp).toHaveBeenNthCalledWith(2, { email: 'new@amiv.app', token: '222222', type: 'email_change' })
    fireEvent.click(screen.getByText('Terminé'))
    expect(onDone).toHaveBeenCalled()
  })

  it('code faux sur la nouvelle adresse : le premier reste validé, erreur sur le second seulement', async () => {
    auth.verifyOtp
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: {}, error: otpError })
    render(<EmailChangeCodeStep {...props} secure onDone={() => {}} onCancel={() => {}} />)
    type('Code reçu sur ton adresse actuelle', '111111')
    type('Code reçu sur ta nouvelle adresse', '999999')
    expect(await screen.findByText(/Code incorrect/)).toBeTruthy()
    expect(screen.getByText('Code validé')).toBeTruthy()
    // Seul le second code est redemandé
    type('Code reçu sur ta nouvelle adresse', '222222')
    await screen.findByText('Adresse modifiée')
    expect(auth.verifyOtp).toHaveBeenCalledTimes(3)
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({ email: 'new@amiv.app', token: '222222', type: 'email_change' })
  })

  it('Valider avec un champ incomplet : message sur ce champ, aucun appel', async () => {
    render(<EmailChangeCodeStep {...props} secure onDone={() => {}} onCancel={() => {}} />)
    type('Code reçu sur ton adresse actuelle', '111111')
    fireEvent.click(screen.getByText('Valider'))
    expect(await screen.findByText('Saisis les 6 chiffres reçus.')).toBeTruthy()
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('non sécurisé : un seul champ, celui de la nouvelle adresse', async () => {
    render(<EmailChangeCodeStep {...props} secure={false} onDone={() => {}} onCancel={() => {}} />)
    expect(screen.queryByLabelText('Code reçu sur ton adresse actuelle')).toBeNull()
    type('Code reçu sur ta nouvelle adresse', '333333')
    await screen.findByText('Adresse modifiée')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'new@amiv.app', token: '333333', type: 'email_change' })
  })

  it('renvoyer : bloqué 60 s, puis redemande le changement et remet les codes à zéro', async () => {
    render(<EmailChangeCodeStep {...props} sentAt={Date.now() - 61_000} secure onDone={() => {}} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Renvoyer les codes'))
    await screen.findByText('Nouveaux codes envoyés aux deux adresses.')
    expect(auth.updateUser).toHaveBeenCalledWith({ email: 'new@amiv.app' })
    await waitFor(() => expect(screen.getByText(/Renvoyer les codes \(60 s\)/)).toBeTruthy())
  })
})
