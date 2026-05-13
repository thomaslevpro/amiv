import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, Pencil, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cardStyles, CARD_GRADIENT } from './cardUtils'

export default function CardContribute({ eventId, currentUserId }) {
  const [message, setMessage] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const inputRef = useRef(null)

  const canSubmit = useMemo(() => {
    return (!!message.trim() || !!photoFile || (editing && !!existing?.photo_url && !photoPreview.startsWith('blob:'))) && !submitting
  }, [message, photoFile, editing, existing, photoPreview, submitting])

  useEffect(() => {
    if (!eventId || !currentUserId) return
    let cancelled = false

    async function loadExisting() {
      setLoading(true)
      setErrorMessage('')
      const { data, error } = await supabase
        .from('group_card_messages')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        console.error('[CardContribute] existing contribution error:', error)
        setErrorMessage('Impossible de charger ta contribution.')
      } else {
        setExisting(data || null)
      }
      setLoading(false)
    }

    loadExisting()
    return () => { cancelled = true }
  }, [eventId, currentUserId])

  useEffect(() => {
    if (!photoFile) return undefined
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  function startEditing() {
    setMessage(existing?.message || '')
    setPhotoPreview(existing?.photo_url || '')
    setPhotoFile(null)
    setSent(false)
    setEditing(true)
  }

  function clearPhoto() {
    setPhotoFile(null)
    setPhotoPreview('')
  }

  async function uploadPhoto() {
    if (!photoFile) return existing?.photo_url || null

    const path = `${eventId}/${currentUserId}_${Date.now()}.jpg`
    const { error } = await supabase.storage
      .from('card-photos')
      .upload(path, photoFile, { cacheControl: '3600', upsert: false, contentType: photoFile.type || 'image/jpeg' })

    if (error) throw error

    const { data } = supabase.storage.from('card-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit || !eventId || !currentUserId) return

    setSubmitting(true)
    setErrorMessage('')

    try {
      const photoUrl = await uploadPhoto()

      const { error: cardError } = await supabase
        .from('group_cards')
        .upsert(
          { event_id: eventId, status: 'collecting' },
          { onConflict: 'event_id', ignoreDuplicates: true }
        )
      if (cardError) throw cardError

      if (existing?.id) {
        const { error: deleteError } = await supabase
          .from('group_card_messages')
          .delete()
          .eq('id', existing.id)
        if (deleteError) throw deleteError
      }

      const payload = {
        event_id: eventId,
        user_id: currentUserId,
        message: message.trim() || null,
        photo_url: photoUrl || null,
      }
      const { data, error } = await supabase
        .from('group_card_messages')
        .insert(payload)
        .select('*')
        .single()
      if (error) throw error

      setExisting(data)
      setMessage('')
      setPhotoFile(null)
      setPhotoPreview('')
      setEditing(false)
      setSent(true)
    } catch (error) {
      console.error('[CardContribute] submit error:', error)
      setErrorMessage(error.message || 'Impossible d’enregistrer ton message.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section style={cardStyles.section}>
        <div style={cardStyles.eyebrow}>Carte collective</div>
        <div style={cardStyles.muted}>Chargement…</div>
      </section>
    )
  }

  if (sent && existing && !editing) {
    return (
      <section style={{ ...cardStyles.section, textAlign: 'center', padding: '28px 18px' }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>🎉</div>
        <div style={{ ...cardStyles.title, marginBottom: 6 }}>Ton message est enregistré</div>
        <div style={cardStyles.muted}>Sophie le découvrira le jour J</div>
        <button type="button" onClick={startEditing} style={{ ...cardStyles.secondaryButton, marginTop: 18 }}>
          Modifier
        </button>
      </section>
    )
  }

  if (existing && !editing) {
    return (
      <section style={cardStyles.section}>
        <div style={cardStyles.eyebrow}>Ta contribution</div>
        <div style={{ border: '1px solid #F2F2F7', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          {existing.photo_url && (
            <img src={existing.photo_url} alt="Contribution" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
          )}
          {existing.message && (
            <div style={{ padding: 12, fontSize: 14, lineHeight: 1.45, color: '#1C1C1E', whiteSpace: 'pre-wrap' }}>
              {existing.message}
            </div>
          )}
        </div>
        <button type="button" onClick={startEditing} style={{ ...cardStyles.secondaryButton, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Pencil size={15} />
          Modifier
        </button>
        {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12, marginTop: 10 }}>{errorMessage}</div>}
      </section>
    )
  }

  return (
    <section style={cardStyles.section}>
      <div style={cardStyles.eyebrow}>Carte collective</div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={message}
          onChange={event => setMessage(event.target.value)}
          placeholder="Écris un message à Sophie…"
          rows={5}
          style={{ ...cardStyles.input, resize: 'vertical', minHeight: 116 }}
        />

        {photoPreview ? (
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid #E5E5EA' }}>
            <img src={photoPreview} alt="Aperçu" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            <button
              type="button"
              onClick={clearPhoto}
              aria-label="Retirer la photo"
              title="Retirer la photo"
              style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{ border: '1px dashed rgba(224,85,170,0.35)', borderRadius: 14, padding: 14, background: 'rgba(224,85,170,0.06)', color: '#993556', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <ImagePlus size={18} />
            Ajouter une photo
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={event => setPhotoFile(event.target.files?.[0] || null)}
          style={{ display: 'none' }}
        />

        {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12 }}>{errorMessage}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...cardStyles.primaryButton,
            background: canSubmit ? CARD_GRADIENT : '#D1D1D6',
            opacity: submitting ? 0.7 : 1,
            cursor: canSubmit ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Camera size={17} />
          {submitting ? 'Envoi…' : 'Envoyer mon message'}
        </button>
      </form>
    </section>
  )
}
