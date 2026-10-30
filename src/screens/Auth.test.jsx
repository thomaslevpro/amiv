// @vitest-environment jsdom
// Confirmation par code à 6 chiffres : inscription, compte non confirmé à la
// connexion, mot de passe oublié, renvoi du code et messages d'erreur.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Auth from './Auth'

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth }, AUTH_CALLBACK_URL: 'cb', AUTH_RESET_URL: 'reset' }))
vi.mock('../lib/analytics', () => ({ track() {} }))
vi.mock('../lib/monitoring', () => ({ captureSupabaseError() {} }))
vi.mock('../lib/native', () => ({ LEGAL_URLS: {}, openExternalUrl() {} }))
vi.mock('../lib/onboarding', () => ({ getPendingInviteToken: () => null }))

const otpError = { name: 'AuthApiError', status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }

beforeEach(() => {
  Object.values(auth).forEach(fn => fn.mockReset())
  auth.resend.mockResolvedValue({ error: null })
  auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  auth.verifyOtp.mockResolvedValue({ data: {}, error: null })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function signUp() {
  auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null })
  render(<Auth initialMode="signup" />)
  type('Email', 'lea@amiv.app')
  type('Mot de passe', 'motdepasse')
  type('Confirmer le mot de passe', 'motdepasse')
  fireEvent.click(screen.getByText('Créer mon compte'))
  await screen.findByText('Vérifie ta boîte mail')
}

describe('Auth — code par email', () => {
  it('inscription : écran du code, champ prêt pour l\'auto-remplissage iOS, validation à 6 chiffres', async () => {
    await signUp()
    expect(screen.getByText('lea@amiv.app')).toBeTruthy()
    const input = screen.getByLabelText('Code de vérification')
    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.getAttribute('autocomplete')).toBe('one-time-code')
    fireEvent.change(input, { target: { value: '12 34 56' } })
    await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'lea@amiv.app', token: '123456', type: 'email' }))
  })

  it('code faux puis code expiré : messages distincts', async () => {
    await signUp()
    auth.verifyOtp.mockResolvedValue({ data: {}, error: otpError })
    type('Code de vérification', '000000')
    expect(await screen.findByText(/Code incorrect/)).toBeTruthy()

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 61 * 60 * 1000)
    type('Code de vérification', '111111')
    expect(await screen.findByText(/Ce code a expiré/)).toBeTruthy()
  })

  it('renvoyer le code : bloqué 60 s, puis renvoie', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await signUp()
    const button = screen.getByText(/Renvoyer le code \(60 s\)/)
    expect(button.disabled).toBe(true)
    await act(async () => { vi.advanceTimersByTime(60_000) })
    fireEvent.click(screen.getByText('Renvoyer le code'))
    await screen.findByText('Nouveau code envoyé !')
    expect(auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'lea@amiv.app' }))
  })

  it('connexion avec un compte non confirmé : nouveau code et écran du code, pas d\'erreur', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { status: 400, code: 'email_not_confirmed', message: 'Email not confirmed' } })
    render(<Auth />)
    type('Email', 'lea@amiv.app')
    type('Mot de passe', 'motdepasse')
    fireEvent.click(screen.getByText('Se connecter'))
    await screen.findByText('Vérifie ta boîte mail')
    expect(auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'lea@amiv.app' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('mot de passe oublié : code de récupération puis nouveau mot de passe', async () => {
    const { rerender } = render(<Auth />)
    fireEvent.click(screen.getByText('Mot de passe oublié ?'))
    type('Email', 'lea@amiv.app')
    fireEvent.click(screen.getByText('Recevoir un code'))
    await screen.findByText('Vérifie ta boîte mail')
    type('Code de vérification', '654321')
    await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'lea@amiv.app', token: '654321', type: 'recovery' }))

    // App.jsx reçoit PASSWORD_RECOVERY et passe recovering
    const onPasswordReset = vi.fn()
    auth.updateUser.mockResolvedValue({ error: null })
    rerender(<Auth recovering onPasswordReset={onPasswordReset} />)
    type('Nouveau mot de passe', 'nouveau123')
    type('Confirmer le mot de passe', 'nouveau123')
    fireEvent.click(screen.getByText('Enregistrer'))
    await waitFor(() => expect(onPasswordReset).toHaveBeenCalled())
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nouveau123' })
  })
})
