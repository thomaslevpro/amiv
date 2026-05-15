import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function OnboardingProfile({ userId, onNext }) {
  const [firstName, setFirstName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('first_name, birthday, avatar_url, name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.first_name) setFirstName(data.first_name)
        else if (data?.name) setFirstName(data.name)
        if (data?.birthday) setBirthday(data.birthday)
        if (data?.avatar_url) setAvatarPreview(data.avatar_url)
      })
  }, [userId])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!firstName.trim()) { setError('Le prénom est obligatoire'); return }
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let avatar_url = avatarPreview?.startsWith('blob:') ? null : (avatarPreview ?? null)

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${user.id}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData.publicUrl
      }

      const updates = {
        first_name: firstName.trim(),
        name: firstName.trim(),
        onboarding_step: 2,
      }
      if (birthday) updates.birthday = birthday
      if (avatar_url) updates.avatar_url = avatar_url

      const { error: upsertErr } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (upsertErr) throw upsertErr

      onNext()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#faf9fb', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 48px', overflowY: 'auto' }}>

        <div style={{ paddingTop: 12, marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1C1C1E', letterSpacing: -0.5, marginBottom: 6 }}>
            Mon profil
          </div>
          <div style={{ fontSize: 14, color: '#8E8E93' }}>
            Quelques infos pour personnaliser ton expérience
          </div>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div
            onClick={() => fileInputRef.current.click()}
            style={{
              width: 100, height: 100, borderRadius: '50%', cursor: 'pointer',
              background: avatarPreview ? 'transparent' : 'linear-gradient(135deg,#e055aa,#f5a623)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative',
              boxShadow: '0 4px 18px rgba(224,85,170,0.35)',
            }}
          >
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 38 }}>👤</span>
            }
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
              background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>Changer</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 10 }}>Photo (optionnel)</div>
        </div>

        {/* First name */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 7, paddingLeft: 4, fontWeight: 500 }}>Prénom *</div>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Ton prénom"
            style={{
              width: '100%', padding: '15px 16px', borderRadius: 14, border: 'none',
              background: '#fff', fontSize: 16, color: '#1C1C1E', outline: 'none',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Birthday */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 7, paddingLeft: 4, fontWeight: 500 }}>
            Ton anniversaire (optionnel)
          </div>
          <input
            type="date"
            value={birthday}
            onChange={e => setBirthday(e.target.value)}
            style={{
              width: '100%', padding: '15px 16px', borderRadius: 14, border: 'none',
              background: '#fff', fontSize: 16, color: birthday ? '#1C1C1E' : '#C7C7CC', outline: 'none',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#FF3B30', fontSize: 13, marginBottom: 16, paddingLeft: 4 }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: 16, borderRadius: 16, border: 'none',
            background: saving ? '#C7C7CC' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff', fontSize: 17, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 18px rgba(224,85,170,0.35)',
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Enregistrement…' : 'Continuer →'}
        </button>
      </div>
    </div>
  )
}
