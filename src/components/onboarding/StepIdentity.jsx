import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { captureSupabaseError } from '../../lib/monitoring'
import { hapticError, hapticSuccess } from '../../lib/haptics'
import { USERNAME_REGEX, USERNAME_RULES, cleanUsername, slugify, suggestUsername, usernameTaken } from '../../lib/onboarding'
import { ErrorText, GRAY, GREEN, OnboardingScreen, PrimaryButton, RED, StepTitle, TextField } from './OnboardingUI'

// Étape 2 : prénom, puis pseudo proposé à partir du prénom (modifiable),
// disponibilité vérifiée pendant la saisie.
export default function StepIdentity({ userId, profile, header, direction, onDone }) {
  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  // Tant que la personne n'a pas touché au pseudo, il suit le prénom. Le
  // pseudo créé avec le compte (tiré de l'email, sans prénom) ne compte pas
  // comme choisi.
  const chosen = Boolean(profile?.username && profile?.first_name?.trim())
  const [username, setUsername] = useState(chosen ? profile.username : '')
  const [usernameEdited, setUsernameEdited] = useState(chosen)
  const [status, setStatus] = useState(chosen ? 'available' : 'idle') // idle | checking | available | taken | invalid
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const firstNameRef = useRef(null)

  useEffect(() => { firstNameRef.current?.focus() }, [])

  // Suggestion à partir du prénom
  useEffect(() => {
    if (usernameEdited) return undefined
    const name = firstName.trim()
    if (!name) {
      setUsername('')
      setStatus('idle')
      return undefined
    }
    let cancelled = false
    setStatus('checking')
    const timer = window.setTimeout(async () => {
      try {
        const suggestion = await suggestUsername(name, userId)
        if (!cancelled) {
          setUsername(suggestion)
          setStatus('available')
        }
      } catch (err) {
        if (!cancelled) setStatus('idle')
        captureSupabaseError(err, { operation: 'suggest_username' })
      }
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [firstName, usernameEdited, userId])

  // Vérification d'un pseudo saisi à la main
  useEffect(() => {
    if (!usernameEdited) return undefined
    const value = cleanUsername(username)
    if (!value) { setStatus('idle'); return undefined }
    if (!USERNAME_REGEX.test(value)) { setStatus('invalid'); return undefined }
    if (value === profile?.username) { setStatus('available'); return undefined }
    let cancelled = false
    setStatus('checking')
    const timer = window.setTimeout(async () => {
      try {
        const taken = await usernameTaken(value, userId)
        if (!cancelled) setStatus(taken ? 'taken' : 'available')
      } catch (err) {
        if (!cancelled) setStatus('idle')
        captureSupabaseError(err, { operation: 'check_username' })
      }
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [username, usernameEdited, userId, profile?.username])

  const finalUsername = cleanUsername(username)
  const canContinue = firstName.trim().length > 0 && status === 'available' && USERNAME_REGEX.test(finalUsername)

  async function handleSubmit(event) {
    event?.preventDefault()
    if (!canContinue || saving) return
    setSaving(true)
    setError(null)
    const name = firstName.trim().slice(0, 50)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ first_name: name, name, username: finalUsername })
      .eq('id', userId)
    setSaving(false)
    if (updateError?.code === '23505') {
      hapticError()
      setStatus('taken')
      return
    }
    if (updateError) {
      captureSupabaseError(updateError, { operation: 'save_identity' })
      hapticError()
      setError('Impossible d\'enregistrer. Vérifie ta connexion et réessaie.')
      return
    }
    hapticSuccess()
    onDone({ first_name: name, username: finalUsername })
  }

  const hint = {
    idle: USERNAME_RULES,
    checking: 'Vérification…',
    available: `@${finalUsername} est disponible`,
    taken: `@${finalUsername} est déjà pris. Essaie une variante.`,
    invalid: USERNAME_RULES,
  }[status]
  const hintColor = status === 'available' ? GREEN : status === 'taken' || status === 'invalid' ? RED : GRAY
  const statusIcon = status === 'checking'
    ? <Loader2 size={18} color={GRAY} style={{ animation: 'ob-spin 0.8s linear infinite' }} />
    : status === 'available' ? <Check size={18} color={GREEN} strokeWidth={2.6} />
      : status === 'taken' || status === 'invalid' ? <X size={18} color={RED} strokeWidth={2.6} /> : null

  return (
    <OnboardingScreen
      header={header}
      direction={direction}
      screenKey="identity"
      footer={<PrimaryButton onClick={handleSubmit} disabled={!canContinue} loading={saving}>{saving ? 'Enregistrement…' : 'Continuer'}</PrimaryButton>}
    >
      <form onSubmit={handleSubmit}>
        <StepTitle emoji="👋" title="Comment tu t'appelles ?" subtitle="Ton prénom et ton pseudo permettent à tes amis de te retrouver." />

        <TextField
          label="Prénom"
          inputRef={firstNameRef}
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          placeholder="Ton prénom"
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={50}
          enterKeyHint="next"
        />

        <TextField
          label="Pseudo"
          prefix="@"
          suffix={statusIcon}
          value={username}
          onChange={e => {
            setUsernameEdited(true)
            setUsername(slugify(e.target.value))
          }}
          placeholder="ton-pseudo"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
          hint={hint}
          hintColor={hintColor}
          enterKeyHint="done"
        />

        <div style={{ fontSize: 13, color: GRAY, lineHeight: 1.5, paddingLeft: 4, marginBottom: 16 }}>
          Ton lien public : amiv.app/u/{finalUsername || 'ton-pseudo'}
        </div>

        <ErrorText>{error}</ErrorText>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </OnboardingScreen>
  )
}
