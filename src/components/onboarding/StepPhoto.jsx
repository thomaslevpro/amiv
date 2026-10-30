import { useEffect, useRef, useState } from 'react'
import { Camera, Images } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadAvatar } from '../../lib/avatar'
import { captureSupabaseError } from '../../lib/monitoring'
import { hasNativePhotoPicker, pickNativePhotos } from '../../lib/eventPhotos'
import { hapticError, hapticSuccess } from '../../lib/haptics'
import AvatarCropper from './AvatarCropper'
import { ErrorText, GRADIENT, GRAY, OnboardingScreen, PrimaryButton, SecondaryButton, StepTitle } from './OnboardingUI'

// Étape 4 (facultative) : galerie ou appareil photo, puis recadrage rond.
export default function StepPhoto({ userId, profile, header, direction, onDone }) {
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [source, setSource] = useState(null) // URL de la photo à recadrer
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const galleryInput = useRef(null)
  const cameraInput = useRef(null)
  const cropRef = useRef(null)

  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])

  const openBlob = blob => {
    if (!blob) return
    setError(null)
    setSource(URL.createObjectURL(blob))
  }

  async function pick(kind) {
    if (!hasNativePhotoPicker) {
      (kind === 'camera' ? cameraInput : galleryInput).current?.click()
      return
    }
    try {
      const [blob] = await pickNativePhotos({ source: kind, limit: 1 })
      openBlob(blob)
    } catch (err) {
      captureSupabaseError(err, { operation: 'pick_avatar' })
      setError(kind === 'camera'
        ? 'Impossible d\'ouvrir l\'appareil photo. Autorise Amiv dans Réglages > Amiv.'
        : 'Impossible d\'ouvrir tes photos. Autorise Amiv dans Réglages > Amiv.')
    }
  }

  async function handleValidate() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const blob = await cropRef.current?.()
      if (!blob) throw new Error('Recadrage impossible')
      const url = await uploadAvatar(userId, new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
      if (updateError) throw updateError
      setAvatarUrl(url)
      setSource(null)
      hapticSuccess()
      onDone({ avatar_url: url })
    } catch (err) {
      captureSupabaseError(err, { operation: 'save_avatar' })
      hapticError()
      setError('La photo n\'a pas pu être enregistrée. Réessaie.')
    } finally {
      setSaving(false)
    }
  }

  const fileInputs = (
    <>
      <input ref={galleryInput} type="file" accept="image/*" hidden onChange={e => { openBlob(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="user" hidden onChange={e => { openBlob(e.target.files?.[0]); e.target.value = '' }} />
    </>
  )

  if (source) {
    return (
      <OnboardingScreen
        header={header}
        direction="next"
        screenKey="photo-crop"
        footer={(
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PrimaryButton onClick={handleValidate} loading={saving}>{saving ? 'Enregistrement…' : 'Valider'}</PrimaryButton>
            <SecondaryButton onClick={() => setSource(null)} disabled={saving}>Choisir une autre photo</SecondaryButton>
          </div>
        )}
      >
        <StepTitle title="Place ta photo" subtitle="Fais-la glisser et zoome pour bien la cadrer." />
        <AvatarCropper src={source} cropRef={cropRef} />
        <div style={{ marginTop: 16 }}><ErrorText>{error}</ErrorText></div>
      </OnboardingScreen>
    )
  }

  const initial = (profile?.first_name ?? '?').trim().charAt(0).toUpperCase()

  return (
    <OnboardingScreen
      header={header}
      direction={direction}
      screenKey="photo"
      footer={avatarUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryButton onClick={() => { hapticSuccess(); onDone({}) }}>Continuer</PrimaryButton>
          <SecondaryButton onClick={() => pick('gallery')}>Changer de photo</SecondaryButton>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryButton onClick={() => pick('gallery')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Images size={19} /> Choisir dans la galerie</span>
          </PrimaryButton>
          <SecondaryButton onClick={() => pick('camera')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Camera size={19} /> Prendre une photo</span>
          </SecondaryButton>
        </div>
      )}
    >
      {fileInputs}
      <StepTitle icon={Camera} title="Ajoute une photo" subtitle="Tes amis te reconnaîtront plus facilement dans leurs invitations." />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <button
          type="button"
          onClick={() => pick('gallery')}
          aria-label={avatarUrl ? 'Changer de photo' : 'Choisir une photo'}
          className="ob-pop"
          style={{ width: 168, height: 168, borderRadius: '50%', border: 'none', padding: 4, background: GRADIENT, cursor: 'pointer', boxShadow: '0 10px 30px rgba(224,85,170,0.25)' }}
        >
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff', border: '4px solid #fff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="Ta photo de profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 64, fontWeight: 800, color: '#D1D1D6' }}>{initial}</span>}
          </div>
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 13, color: GRAY, marginTop: 14 }}>Tu pourras la changer à tout moment dans ton profil.</div>
      <div style={{ marginTop: 16 }}><ErrorText>{error}</ErrorText></div>
    </OnboardingScreen>
  )
}
