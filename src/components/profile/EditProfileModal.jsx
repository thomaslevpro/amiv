import { useEffect, useRef, useState } from 'react'
import { AtSign, Camera, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadAvatar } from '../../lib/avatar'
import { captureSupabaseError } from '../../lib/monitoring'
import { ownBirthdayError } from '../../utils/birthday'
import BirthdayFields from './BirthdayFields'
import EmailChangeCodeStep, { emailChangeErrorMessage } from './EmailChangeCodeStep'
import { SECURE_EMAIL_CHANGE } from '../../lib/authCode'

const EMAIL_RE = /^\S+@\S+\.\S+$/

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
  const [username, setUsername] = useState('')
  const [usernameInitial, setUsernameInitial] = useState('')
  const [usernameStatus, setUsernameStatus] = useState(null)
  const usernameDebounceRef = useRef(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)
  // Changement d'adresse demandé : { from, to, sentAt, profile } → saisie du code
  const [emailChange, setEmailChange] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setFirstName(profile?.first_name ?? '')
    setName(profile?.name ?? '')
    setBirthday(profile?.birthday ?? '')
    setEmail(profile?.email ?? '')
    setUsername(profile?.username ?? '')
    setUsernameInitial(profile?.username ?? '')
    setUsernameStatus(null)
    setAvatarFile(null)
    setAvatarPreview(profile?.avatar_url ?? null)
    setError(null)
  }, [isOpen, profile])

  // Pas dans l'effet ci-dessus : onSaved met à jour le profil pendant la
  // saisie du code, ce qui ne doit pas ramener au formulaire.
  useEffect(() => {
    if (isOpen) setEmailChange(null)
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (usernameDebounceRef.current) window.clearTimeout(usernameDebounceRef.current)
    }
  }, [])

  if (!isOpen) return null

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choisis une image.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const nextFirstName = firstName.trim()
    const nextName = name.trim()
    const nextEmail = email.trim()
    const nextBirthday = birthday || null
    const nextUsername = username.trim() || null

    if (!nextFirstName || !nextName) {
      setError('Le prénom et le nom sont obligatoires.')
      return
    }

    if (!isValidDate(birthday)) {
      setError('La date de naissance est invalide.')
      return
    }

    if (ownBirthdayError(birthday)) {
      setError(ownBirthdayError(birthday))
      return
    }

    const emailChanged = !!nextEmail && nextEmail.toLowerCase() !== (profile?.email ?? '').toLowerCase()
    if (emailChanged && !EMAIL_RE.test(nextEmail)) {
      setError('Adresse email invalide.')
      return
    }

    if (usernameStatus === 'invalid' || usernameStatus === 'taken') {
      setError(usernameStatus === 'taken' ? 'Ce pseudo est déjà pris' : 'Le format du pseudo est invalide.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Utilisateur non connecté.')

      const nextAvatarUrl = avatarFile ? await uploadAvatar(user.id, avatarFile) : undefined

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: nextFirstName,
          name: nextName,
          birthday: nextBirthday,
          username: nextUsername,
          ...(nextAvatarUrl ? { avatar_url: nextAvatarUrl } : {}),
        })
        .eq('id', user.id)
        .select('id, first_name, name, avatar_url, username')
        .maybeSingle()

      if (updateError?.code === '23505') {
        setUsernameStatus('taken')
        setError('Ce pseudo est déjà pris')
        return
      }
      if (updateError) throw updateError

      // L'adresse ne change qu'une fois le code validé (EmailChangeCodeStep)
      const updatedProfile = {
        ...(profile ?? {}),
        ...(data ?? {}),
        first_name: nextFirstName,
        name: nextName,
        birthday: nextBirthday,
        username: nextUsername,
        email: profile?.email ?? data?.email ?? null,
      }
      onSaved?.(updatedProfile)

      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail })
        if (emailError) {
          captureSupabaseError(emailError, { operation: 'request_email_change' })
          setError(emailChangeErrorMessage(emailError))
          return
        }
        setEmailChange({ from: user.email ?? profile?.email ?? '', to: nextEmail, sentAt: Date.now(), profile: updatedProfile })
        return
      }

      onClose?.()
    } catch (err) {
      setError(err.message ?? 'Impossible de modifier le profil.')
    } finally {
      setSaving(false)
    }
  }

  function checkUsername(value) {
    const nextValue = value.trim()
    if (usernameDebounceRef.current) window.clearTimeout(usernameDebounceRef.current)
    if (!nextValue) {
      setUsernameStatus(null)
      return
    }
    if (nextValue === usernameInitial) {
      setUsernameStatus('same')
      return
    }
    if (!/^[a-z0-9-]{3,30}$/.test(nextValue)) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('checking')
    usernameDebounceRef.current = window.setTimeout(async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Utilisateur non connecté.')

        const { data, error: usernameError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', nextValue)
          .neq('id', user.id)
          .maybeSingle()

        if (usernameError) throw usernameError
        setUsernameStatus(data ? 'taken' : 'available')
      } catch (err) {
        console.error('username availability failed', err)
        setUsernameStatus('taken')
      }
    }, 500)
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
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 24px)',
          overflowY: 'auto',
          background: '#F5F5F5',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.18)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>{emailChange ? "Changer d'adresse email" : 'Modifier mon profil'}</div>
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

        {emailChange ? (
          <EmailChangeCodeStep
            currentEmail={emailChange.from}
            newEmail={emailChange.to}
            secure={SECURE_EMAIL_CHANGE}
            sentAt={emailChange.sentAt}
            onDone={() => {
              onSaved?.({ ...emailChange.profile, email: emailChange.to })
              onClose?.()
            }}
            onCancel={onClose}
          />
        ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Changer la photo de profil"
              style={{ position: 'relative', width: 88, height: 88, borderRadius: '50%', border: 'none', padding: 0, background: '#FBBF9A', cursor: 'pointer', overflow: 'visible' }}
            >
              <div style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 32, fontWeight: 800 }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (firstName || name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 5px rgba(0,0,0,0.18)' }}>
                <Camera size={15} strokeWidth={2} color="#e055aa" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ border: 'none', background: 'none', color: '#e055aa', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 4 }}
            >
              {avatarPreview ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

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
            <BirthdayFields value={birthday} onChange={setBirthday} selectStyle={{ ...inputStyle, minWidth: 0, width: 'auto', padding: '13px 10px' }} />
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 7 }}>Visible par tes amis Amiv</div>
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
              Pseudo
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E5EA', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
              <div style={{ paddingLeft: 14, color: '#8E8E93', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <AtSign size={17} strokeWidth={2} />
              </div>
              <input
                value={username}
                onChange={e => {
                  const value = e.target.value.toLowerCase()
                  setUsername(value)
                  checkUsername(value)
                }}
                placeholder="ton-pseudo"
                autoCapitalize="none"
                autoCorrect="off"
                style={{ ...inputStyle, border: 'none', borderRadius: 0, paddingLeft: 5, boxShadow: 'none' }}
              />
            </div>
            <div style={{ fontSize: 11, color: '#AEAEB2', marginTop: 7, lineHeight: 1.35 }}>
              3 à 30 caractères · lettres minuscules, chiffres et tirets
            </div>
            {usernameStatus && (
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                marginTop: 7,
                color: usernameStatus === 'available' ? '#34C759'
                  : usernameStatus === 'same' || usernameStatus === 'checking' ? '#8E8E93'
                  : '#FF3B30',
              }}>
                {usernameStatus === 'available' && '✅ Disponible'}
                {usernameStatus === 'taken' && '❌ Déjà pris'}
                {usernameStatus === 'invalid' && '❌ Format invalide'}
                {usernameStatus === 'checking' && '⏳ Vérification…'}
                {usernameStatus === 'same' && 'Pseudo actuel'}
              </div>
            )}
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
              Un code de confirmation te sera envoyé par email
            </div>
          </div>

          {error && (
            <div style={{ color: '#FF3B30', fontSize: 13, padding: '0 2px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || usernameStatus === 'invalid' || usernameStatus === 'taken'}
            style={{
              width: '100%',
              padding: 16,
              borderRadius: 16,
              border: 'none',
              background: saving || usernameStatus === 'invalid' || usernameStatus === 'taken' ? '#C7C7CC' : 'linear-gradient(135deg,#e055aa,#f5a623)',
              color: '#fff',
              fontSize: 17,
              fontWeight: 800,
              cursor: saving || usernameStatus === 'invalid' || usernameStatus === 'taken' ? 'default' : 'pointer',
              boxShadow: saving || usernameStatus === 'invalid' || usernameStatus === 'taken' ? 'none' : '0 4px 18px rgba(224,85,170,0.35)',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
