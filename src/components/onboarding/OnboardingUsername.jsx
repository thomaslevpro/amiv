import { useEffect, useMemo, useState } from 'react'
import { AtSign } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const USERNAME_REGEX = /^[a-z0-9-]{3,30}$/

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 30)
}

async function usernameTaken(username, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return Boolean(data && data.id !== userId)
}

async function suggestUsername(profile, userId) {
  const lastName = profile?.name?.split(' ')[0] ?? ''
  const base = slugify([profile?.first_name, lastName].filter(Boolean).join('-')) || 'amiv'
  const root = USERNAME_REGEX.test(base) ? base : `${base}ami`.slice(0, 30)
  if (!(await usernameTaken(root, userId))) return root

  for (let index = 2; index < 100; index += 1) {
    const suffix = String(index)
    const candidate = `${root.slice(0, 30 - suffix.length)}${suffix}`
    if (!(await usernameTaken(candidate, userId))) return candidate
  }
  return `${root.slice(0, 24)}${Date.now().toString().slice(-6)}`
}

export default function OnboardingUsername({ userId, onNext, variant }) {
  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isFormatValid = useMemo(() => USERNAME_REGEX.test(username), [username])

  useEffect(() => {
    let cancelled = false

    async function loadSuggestion() {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, name, username')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled) return
      if (data?.username) {
        setUsername(data.username)
        setAvailable(true)
        return
      }

      const suggestion = await suggestUsername(data, userId)
      if (!cancelled) setUsername(suggestion)
    }

    loadSuggestion()
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!username) {
      setAvailable(null)
      return undefined
    }
    if (!isFormatValid) {
      setAvailable(false)
      return undefined
    }

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setChecking(true)
      try {
        const taken = await usernameTaken(username, userId)
        if (!cancelled) setAvailable(!taken)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [isFormatValid, userId, username])

  async function handleSave() {
    if (!isFormatValid) {
      setError('3 à 30 caractères: lettres minuscules, chiffres et tirets.')
      return
    }
    if (!available) {
      setError('Ce nom d’utilisateur n’est pas disponible.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username, onboarding_step: 4 })
        .eq('id', userId)
      if (updateError) throw updateError
      onNext()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const helper = !username
    ? 'Choisis ton lien public.'
    : !isFormatValid
      ? '3 à 30 caractères: a-z, 0-9 et tirets.'
      : checking
        ? 'Vérification...'
        : available
          ? 'Disponible'
          : 'Déjà pris'

  const embedded = variant === 'embedded'

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 48px', overflowY: 'auto' }}>
        {!embedded && (
          <div style={{ paddingTop: 12, marginBottom: 32 }}>
            <div style={{ marginBottom: 14 }}><AtSign size={21} strokeWidth={1.7} /></div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1C1C1E', marginBottom: 8 }}>
              Ton lien Amiv
            </div>
            <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.55 }}>
              Un lien simple à partager pour que tes proches t’ajoutent.
            </div>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 7, fontWeight: 600 }}>Nom d’utilisateur</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F5F5F5', borderRadius: 14, padding: '0 14px' }}>
            <span style={{ fontSize: 15, color: '#8E8E93', fontWeight: 700 }}>amiv.app/u/</span>
            <input
              value={username}
              onChange={e => {
                setError(null)
                setAvailable(null)
                setUsername(slugify(e.target.value))
              }}
              autoFocus
              placeholder="prenom-nom"
              style={{ flex: 1, minWidth: 0, padding: '15px 0', border: 'none', background: 'transparent', fontSize: 16, color: '#1C1C1E', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ fontSize: 12, color: available && isFormatValid ? '#34C759' : '#8E8E93', fontWeight: 700, marginTop: 9 }}>
            {helper}
          </div>
        </div>

        {error && <div style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16, paddingLeft: 4 }}>{error}</div>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || checking || !available || !isFormatValid}
          style={{ width: '100%', padding: 16, borderRadius: 16, border: 'none', background: saving || checking || !available || !isFormatValid ? '#C7C7CC' : 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 17, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving || checking || !available || !isFormatValid ? 'none' : '0 4px 18px rgba(224,85,170,0.35)', fontFamily: 'inherit' }}
        >
          {saving ? 'Enregistrement...' : 'Continuer'}
        </button>
      </div>
    </div>
  )
}
