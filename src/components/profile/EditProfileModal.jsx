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

function isValidDate(value) {
  if (!value) return true
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export default function EditProfileModal({ isOpen, onClose, profile, onSaved }) {
  const [firstName, setFirstName] = useState('')
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setFirstName(profile?.first_name ?? '')
    setName(profile?.name ?? '')
    setBirthday(profile?.birthday ?? '')
    setEmail(profile?.email ?? '')
    setError(null)
  }, [isOpen, profile])

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()

    const nextFirstName = firstName.trim()
    const nextName = name.trim()
    const nextEmail = email.trim()
    const nextBirthday = birthday || null

    if (!nextFirstName || !nextName) {
      setError('Le prénom et le nom sont obligatoires.')
      return
    }

    if (!isValidDate(birthday)) {
      setError('La date de naissance est invalide.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Utilisateur non connecté.')

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: nextFirstName,
          name: nextName,
          birthday: nextBirthday,
        })
        .eq('id', user.id)
        .select('id, first_name, name, email, avatar_url, created_at, birthday')
        .maybeSingle()

      if (updateError) throw updateError

      if (nextEmail && nextEmail !== profile?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail })
        if (emailError) throw emailError
      }

      const updatedProfile = {
        ...(profile ?? {}),
        ...(data ?? {}),
        first_name: nextFirstName,
        name: nextName,
        birthday: nextBirthday,
        email: nextEmail || profile?.email || data?.email || null,
      }

      onSaved?.(updatedProfile)
      onClose?.()
    } catch (err) {
      setError(err.message ?? 'Impossible de modifier le profil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
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
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#F2F2F7',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.18)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>Modifier mon profil</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: '#E5E5EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1C1C1E',
            }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
              Prénom
            </label>
            <input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
              Nom
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
              Date de naissance
            </label>
            <input
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 8, lineHeight: 1.35 }}>
              Un email de confirmation sera envoyé
            </div>
          </div>

          {error && (
            <div style={{ color: '#FF3B30', fontSize: 13, padding: '0 2px' }}>
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
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}
