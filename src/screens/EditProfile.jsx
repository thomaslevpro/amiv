import { useState, useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function EditProfile({ onSave, onBack, isOnboarding = false, initialFocus = null }) {
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [existingAvatarUrl, setExistingAvatarUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const birthdayInputRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('name, first_name, birthday, avatar_url').eq('id', user.id).maybeSingle()
      if (data?.name) setName(data.name)
      else if (data?.first_name) setName(data.first_name)
      if (data?.birthday) setBirthday(data.birthday)
      if (data?.avatar_url) { setAvatarPreview(data.avatar_url); setExistingAvatarUrl(data.avatar_url) }
    }
    load()
  }, [])

  useEffect(() => {
    if (initialFocus !== 'birthday') return
    const timeout = window.setTimeout(() => birthdayInputRef.current?.focus(), 150)
    return () => window.clearTimeout(timeout)
  }, [initialFocus])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Le prénom est obligatoire'); return }
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let avatar_url = existingAvatarUrl

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${user.id}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData.publicUrl
      }

      const { error: upsertErr } = await supabase.from('profiles').upsert({
        id: user.id,
        name: name.trim(),
        first_name: name.trim(),
        email: user.email,
        birthday: birthday || null,
        avatar_url: avatar_url ?? null,
      })
      if (upsertErr) throw upsertErr

      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', minHeight: '100dvh' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 20px 40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {!isOnboarding && onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 12px 0 0',
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronLeft size={22} strokeWidth={1.5} color="#1C1C1E" />
            </button>
          )}
          <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: 0, color: '#1C1C1E' }}>
            {isOnboarding ? 'Bienvenue !' : 'Mon profil'}
          </div>
        </div>

        {/* Avatar picker */}
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
        </div>

        {/* Name field */}
        <div style={{ marginBottom: error ? 8 : 24 }}>
          <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 7, paddingLeft: 4, fontWeight: 500 }}>Prénom *</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ton prénom"
            style={{
              width: '100%', padding: '15px 16px', borderRadius: 14, border: 'none',
              background: '#fff', fontSize: 16, color: '#1C1C1E', outline: 'none',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: error ? 8 : 24 }}>
          <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 7, paddingLeft: 4, fontWeight: 500 }}>Date de naissance</div>
          <input
            ref={birthdayInputRef}
            type="date"
            value={birthday}
            onChange={e => setBirthday(e.target.value)}
            style={{
              width: '100%', padding: '15px 16px', borderRadius: 14, border: 'none',
              background: '#fff', fontSize: 16, color: birthday ? '#1C1C1E' : '#C7C7CC', outline: 'none',
              boxShadow: '0 1px 8px rgba(0,0,0,0.07)', boxSizing: 'border-box',
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
            width: '100%', padding: 17, borderRadius: 16, border: 'none',
            background: saving ? '#C7C7CC' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff', fontSize: 17, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 18px rgba(224,85,170,0.35)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          {saving ? 'Enregistrement…' : isOnboarding ? 'Commencer 🚀' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
