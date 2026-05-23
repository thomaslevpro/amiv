import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addMemory, type Memory } from '../lib/collectiveCard'

type Props = {
  cardId: string
  eventId: string
  contributorId: string
  birthdayFirstName: string
  onClose: () => void
  onAdded: (memory: Memory) => void
}

const COLORS = ['#FFF5F0', '#F0F5FF', '#F0FFF4', '#FFF8F0', '#F5F0FF', '#F0FFFE']
const GRADIENT = 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)'

export default function AddMemoryModal({
  cardId,
  eventId,
  contributorId,
  birthdayFirstName,
  onClose,
  onAdded,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [text, setText] = useState('')
  const [bgColor, setBgColor] = useState(COLORS[0])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('')
      return undefined
    }

    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const canSubmit = (!!text.trim() || !!imageFile) && !saving

  async function uploadImage() {
    if (!imageFile) return null

    const ext = imageFile.name.split('.').pop() || 'jpg'
    const path = `${eventId}/${contributorId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('memory-images')
      .upload(path, imageFile, {
        cacheControl: '3600',
        contentType: imageFile.type || 'image/jpeg',
        upsert: false,
      })

    if (error) throw error

    return supabase.storage.from('memory-images').getPublicUrl(path).data.publicUrl
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    setErrorMessage('')

    try {
      const imageUrl = await uploadImage()
      const memory = await addMemory({
        cardId,
        eventId,
        contributorId,
        text,
        imageUrl: imageUrl || undefined,
        bgColor,
      })
      onAdded(memory)
      onClose()
    } catch (error) {
      console.error('[AddMemoryModal] submit error:', error)
      setErrorMessage("Impossible d'ajouter ce souvenir.")
    } finally {
      setSaving(false)
    }
  }

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.30)', display: 'flex', alignItems: 'flex-end' }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, boxSizing: 'border-box', boxShadow: '0 -8px 24px rgba(0,0,0,0.16)' }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E5EA', margin: '0 auto 16px' }} />

        <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', marginBottom: 16 }}>
          Un souvenir pour {birthdayFirstName}
        </div>

        <button
          type="button"
          onClick={openPicker}
          style={{ position: 'relative', width: '100%', height: 180, border: 'none', borderRadius: 14, background: '#F2F2F7', padding: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', cursor: 'pointer' }}
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14, display: 'block' }} />
              <span
                onClick={event => {
                  event.stopPropagation()
                  setImageFile(null)
                }}
                role="button"
                aria-label="Retirer la photo"
                title="Retirer la photo"
                style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, background: '#fff', color: '#1C1C1E', display: 'grid', placeItems: 'center', fontSize: 18, lineHeight: 1, boxShadow: '0 1px 6px rgba(0,0,0,0.14)' }}
              >
                ×
              </span>
            </>
          ) : (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>🖼️</span>
              <span style={{ fontSize: 14, color: '#8E8E93', fontWeight: 700 }}>Ajouter une photo</span>
            </span>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={event => setImageFile(event.target.files?.[0] || null)}
          style={{ display: 'none' }}
        />

        <label style={{ display: 'block', marginTop: 14 }}>
          <span style={{ display: 'block', fontSize: 11, color: '#8E8E93', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>
            Ton message
          </span>
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={4}
            placeholder="Décris ce souvenir…"
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 12, background: '#F2F2F7', padding: 12, fontSize: 14, color: '#1C1C1E', outline: 'none', resize: 'vertical' }}
          />
        </label>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>
            Couleur de la carte
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setBgColor(color)}
                aria-label={`Choisir la couleur ${color}`}
                title={`Choisir la couleur ${color}`}
                style={{ width: 32, height: 32, borderRadius: 16, border: bgColor === color ? '2px solid #e055aa' : '2px solid transparent', background: color, boxShadow: '0 0 0 1px #E5E5EA', cursor: 'pointer' }}
              />
            ))}
          </div>
        </div>

        {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12, marginTop: 12 }}>{errorMessage}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{ width: '100%', marginTop: 16, border: 'none', borderRadius: 14, padding: 14, background: GRADIENT, color: '#fff', fontSize: 14, fontWeight: 800, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'default' }}
        >
          {saving ? 'Ajout...' : 'Ajouter ce souvenir 🎁'}
        </button>
      </form>
    </div>
  )
}
