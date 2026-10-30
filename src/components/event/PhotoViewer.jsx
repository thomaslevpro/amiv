import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { Download, Flag, Trash2, X } from 'lucide-react'
import { ReportSheet } from '../safety/SafetySheets'
import { savePhotoToDevice, signEventPhotoPaths, SIGNED_URL_TTL } from '../../lib/eventPhotos'
import { setStatusBarDark } from '../../lib/native'

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
// URL pleine taille réutilisée tant qu'il lui reste au moins 2 minutes
const FULL_URL_MAX_AGE_MS = (SIGNED_URL_TTL - 120) * 1000

function ActionButton({ icon, label, onClick, disabled, color = '#fff' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', border: 'none', background: 'transparent', color, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      {icon}
      {label}
    </button>
  )
}

// Plein écran : balayage horizontal (scroll-snap), miniature affichée en
// attendant la photo pleine taille, signée à la demande.
export default function PhotoViewer({ photos, startIndex, thumbUrls, userId, canManage, onClose, onDelete, onToast }) {
  const scrollerRef = useRef(null)
  const [index, setIndex] = useState(startIndex)
  const [fullUrls, setFullUrls] = useState({})
  const signedAtRef = useRef({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reportPhoto, setReportPhoto] = useState(null)

  const photo = photos[index]
  const isMine = photo?.user_id === userId

  useEffect(() => {
    setStatusBarDark(true)
    return () => setStatusBarDark(false)
  }, [])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollLeft = startIndex * scroller.clientWidth
  }, [startIndex])

  // Photo supprimée : l'index peut dépasser la liste
  useEffect(() => {
    if (photos.length === 0) onClose()
    else if (index > photos.length - 1) setIndex(photos.length - 1)
  }, [photos.length, index, onClose])

  useEffect(() => {
    const now = Date.now()
    const wanted = [index - 1, index, index + 1]
      .map(position => photos[position]?.path)
      .filter(path => path && !(signedAtRef.current[path] > now - FULL_URL_MAX_AGE_MS))
    if (!wanted.length) return
    wanted.forEach(path => { signedAtRef.current[path] = now })
    signEventPhotoPaths(wanted).then(urls => setFullUrls(current => ({ ...current, ...urls })))
  }, [index, photos])

  function handleScroll(event) {
    const { scrollLeft, clientWidth } = event.currentTarget
    const next = Math.round(scrollLeft / Math.max(1, clientWidth))
    if (next !== index && next >= 0 && next < photos.length) {
      setIndex(next)
      setConfirmDelete(false)
    }
  }

  async function handleSave() {
    if (!photo || busy) return
    setBusy(true)
    try {
      const fresh = await signEventPhotoPaths([photo.path])
      const result = await savePhotoToDevice(fresh[photo.path] ?? fullUrls[photo.path])
      if (result === 'saved') onToast?.('Photo enregistrée ✓')
    } catch (error) {
      console.error('[PhotoViewer] save failed', error)
      onToast?.(/denied|permission/i.test(error?.message ?? '') ? 'Autorise l’accès aux photos dans les Réglages' : 'Impossible d’enregistrer la photo')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!photo || busy) return
    setBusy(true)
    try {
      await onDelete(photo)
      setConfirmDelete(false)
    } catch {
      onToast?.('Impossible de supprimer la photo')
    } finally {
      setBusy(false)
    }
  }

  if (!photo) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 880, background: '#000', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(10px + env(safe-area-inset-top, 0px)) 12px 10px', color: '#fff' }}>
        <button type="button" aria-label="Fermer" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{index + 1} / {photos.length}</div>
        <div style={{ width: 36 }} />
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {photos.map((item, position) => {
          const nearby = Math.abs(position - index) <= 1
          return (
            <div key={item.id} style={{ flex: '0 0 100%', width: '100%', height: '100%', scrollSnapAlign: 'center', display: 'grid', placeItems: 'center', position: 'relative' }}>
              {nearby && (
                <img
                  src={fullUrls[item.path] ?? thumbUrls[item.thumb_path]}
                  alt={`Photo ajoutée par ${item.author_name}`}
                  draggable={false}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none' }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', color: '#fff' }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{isMine ? 'Ajoutée par toi' : `Ajoutée par ${photo.author_name}`}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{dayjs(photo.created_at).locale('fr').format('D MMMM YYYY [à] HH:mm')}</div>

        {confirmDelete ? (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Supprimer cette photo ?</div>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>Annuler</button>
            <button type="button" onClick={handleDelete} disabled={busy} style={{ padding: '9px 14px', borderRadius: 12, border: 'none', background: '#FF3B30', color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: FONT, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Supprimer'}</button>
          </div>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
            <ActionButton icon={<Download size={22} />} label="Enregistrer" onClick={handleSave} disabled={busy} />
            {(isMine || canManage) && <ActionButton icon={<Trash2 size={22} />} label="Supprimer" onClick={() => setConfirmDelete(true)} disabled={busy} color="#FF6B60" />}
            {!isMine && <ActionButton icon={<Flag size={22} />} label="Signaler" onClick={() => setReportPhoto(photo)} disabled={busy} />}
          </div>
        )}
      </div>

      {reportPhoto && (
        <ReportSheet targetType="event_photo" targetId={reportPhoto.id} subjectLabel="cette photo" onClose={() => setReportPhoto(null)} />
      )}
    </div>
  )
}
