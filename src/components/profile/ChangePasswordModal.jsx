import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const inputStyle = {
  width: '100%',
  padding: '14px 15px',
  borderRadius: 14,
  border: '1px solid #E5E5EA',
  background: '#fff',
  color: '#1C1C1E',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setToast(null)
  }, [isOpen])

  if (!isOpen) return null

  function close() {
    if (saving) return
    onClose?.()
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les deux mots de passe doivent être identiques.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setToast('Mot de passe modifié ✓')
    window.setTimeout(() => {
      setSaving(false)
      onClose?.()
    }, 650)
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 700,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 'max(18px, env(safe-area-inset-top))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 702,
            background: '#1C1C1E',
            color: '#fff',
            borderRadius: 16,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          }}
        >
          {toast}
        </div>
      )}

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: '#F5F5F5',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.18)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>Changer le mot de passe</div>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            disabled={saving}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: '#E5E5EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: saving ? 'default' : 'pointer',
              color: '#1C1C1E',
              opacity: saving ? 0.65 : 1,
            }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ color: '#FF3B30', fontSize: 13, padding: '0 2px', lineHeight: 1.35 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 16,
              border: 'none',
              background: saving ? '#C7C7CC' : 'linear-gradient(135deg,#e055aa,#f5a623)',
              color: '#fff',
              fontSize: 17,
              fontWeight: 800,
              cursor: saving ? 'default' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 18px rgba(224,85,170,0.35)',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Enregistrement...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
