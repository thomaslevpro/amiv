import { useCallback, useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { Camera as CameraIcon, Images, Plus, RotateCcw, X } from 'lucide-react'
import PhotoViewer from './PhotoViewer'
import { SECTION_TITLE } from './eventUtils'
import { BottomSheet } from '../safety/SafetySheets'
import {
  createPhotoRow, deleteEventPhoto, fetchEventPhotos, hasNativePhotoPicker, MAX_PHOTOS_PER_USER,
  notifyPhotosAdded, PhotoLimitError, pickNativePhotos, preparePhoto, signEventPhotoPaths, uploadPhotoFile,
} from '../../lib/eventPhotos'

const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'
// Vignettes de la rangée : les plus récentes, « Voir tout » pour le reste
const ROW_COUNT = 20
const THUMB = { width: 72, height: 72, borderRadius: 12, flexShrink: 0, padding: 0, boxSizing: 'border-box' }
// Les URL signées durent 10 min : on recharge l'album avant leur expiration.
const REFRESH_INTERVAL_MS = 8 * 60 * 1000

let uploadKey = 0

// Album photo partagé : visible par les organisateurs et les participants
// ayant accepté (la base décide, get_event_photos.can_view). Rien ne
// s'affiche pour les autres. Photos conservées 2 mois après l'événement
// (expires_at), l'album est fermé ensuite.
export default function EventPhotosSection({ eventId, userId, focus = false, showToast }) {
  const sectionRef = useRef(null)
  const fileInputRef = useRef(null)
  const [album, setAlbum] = useState(null)
  const [thumbUrls, setThumbUrls] = useState({})
  const [myCount, setMyCount] = useState(0)
  const [uploads, setUploads] = useState([])
  const uploadsRef = useRef([])
  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)
  const [showAll, setShowAll] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)
  const [showSourceSheet, setShowSourceSheet] = useState(false)
  const focusedRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const data = await fetchEventPhotos(eventId)
      const urls = data.can_view ? await signEventPhotoPaths((data.photos ?? []).map(photo => photo.thumb_path)) : {}
      setAlbum(data)
      setThumbUrls(urls)
      setMyCount(data.my_count ?? 0)
    } catch {
      setAlbum(current => current ?? { can_view: false })
    }
  }, [eventId])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!focus || focusedRef.current || !album?.can_view) return
    focusedRef.current = true
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [focus, album?.can_view])

  if (!album?.can_view) return null

  const photos = album.photos ?? []
  const maxPerUser = album.max_per_user ?? MAX_PHOTOS_PER_USER
  // Photos choisies dont la ligne n'est pas encore créée (comptées dans myCount sinon)
  const waiting = uploads.filter(item => !item.row && !item.limit).length
  const expiresAt = album.expires_at ? dayjs(album.expires_at) : null
  const closed = !!expiresAt && !expiresAt.isAfter(dayjs())
  const expiringSoon = !!expiresAt && expiresAt.diff(dayjs(), 'day') < 31
  const remaining = closed ? 0 : Math.max(0, maxPerUser - myCount - waiting)
  const failed = uploads.filter(item => item.status === 'error')
  const retryable = failed.filter(item => !item.limit)
  const active = uploads.filter(item => item.status !== 'error')
  const progress = active.length ? active.reduce((sum, item) => sum + item.progress, 0) / active.length : 0
  const rowPhotos = photos.slice(0, ROW_COUNT)

  function commitUploads(next) {
    uploadsRef.current = next
    setUploads(next)
  }

  function patchUpload(key, patch) {
    commitUploads(uploadsRef.current.map(item => (item.key === key ? { ...item, ...patch } : item)))
  }

  async function processUpload(item) {
    let { prepared, row } = item
    patchUpload(item.key, { status: 'uploading' })
    try {
      if (!prepared) {
        prepared = await preparePhoto(item.file)
        patchUpload(item.key, { prepared, progress: 0.25 })
      }
      if (!row) {
        row = await createPhotoRow(eventId)
        setMyCount(count => count + 1)
        patchUpload(item.key, { row, progress: 0.4 })
      }
      await uploadPhotoFile(row.thumb_path, prepared.thumb)
      patchUpload(item.key, { progress: 0.6 })
      await uploadPhotoFile(row.path, prepared.full)
      patchUpload(item.key, { status: 'done', progress: 1 })
      return true
    } catch (error) {
      console.error('[EventPhotosSection] upload failed', error)
      patchUpload(item.key, { status: 'error', limit: error instanceof PhotoLimitError })
      return false
    }
  }

  // Une photo à la fois ; un échec n'arrête pas les suivantes.
  async function runUploads() {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    let sent = 0
    for (;;) {
      const next = uploadsRef.current.find(item => item.status === 'queued')
      if (!next) break
      if (await processUpload(next)) sent += 1
    }
    if (sent > 0) await notifyPhotosAdded(eventId)
    commitUploads(uploadsRef.current.filter(item => item.status !== 'done'))
    runningRef.current = false
    setRunning(false)
    await load()
    const errors = uploadsRef.current.filter(item => item.status === 'error')
    if (errors.some(item => item.limit)) showToast?.(`Limite de ${maxPerUser} photos atteinte`)
    else if (errors.length) showToast?.(errors.length > 1 ? `${errors.length} photos n’ont pas pu être envoyées` : 'Une photo n’a pas pu être envoyée')
    else if (sent > 0) showToast?.(sent > 1 ? `${sent} photos ajoutées ✓` : 'Photo ajoutée ✓')
    // Photos choisies pendant la fin de l'envoi précédent
    if (uploadsRef.current.some(item => item.status === 'queued')) runUploads()
  }

  function addFiles(files) {
    const accepted = files.slice(0, remaining)
    if (files.length > accepted.length) {
      showToast?.(remaining > 0 ? `Seules ${remaining} photo${remaining > 1 ? 's' : ''} ont été ajoutées (${maxPerUser} max)` : `Limite de ${maxPerUser} photos atteinte`)
    }
    if (!accepted.length) return
    commitUploads([
      ...uploadsRef.current,
      ...accepted.map(file => ({ key: ++uploadKey, file, prepared: null, row: null, status: 'queued', progress: 0, limit: false })),
    ])
    runUploads()
  }

  async function pickFrom(source) {
    setShowSourceSheet(false)
    try {
      addFiles(await pickNativePhotos({ source, limit: remaining }))
    } catch (error) {
      console.error('[EventPhotosSection] picker failed', error)
      showToast?.(source === 'camera' ? 'Appareil photo indisponible' : 'Impossible d’ouvrir la galerie')
    }
  }

  function handleAddClick() {
    if (remaining <= 0) return
    if (hasNativePhotoPicker) setShowSourceSheet(true)
    else fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files ?? []).filter(file => file.type.startsWith('image/') || !file.type)
    event.target.value = ''
    addFiles(files)
  }

  function retryFailed() {
    commitUploads(uploadsRef.current.map(item => (item.status === 'error' && !item.limit ? { ...item, status: 'queued' } : item)))
    runUploads()
  }

  // Abandon : la ligne déjà créée est supprimée (ses fichiers partiels avec).
  async function abandonFailed() {
    const rows = uploadsRef.current.filter(item => item.status === 'error' && item.row)
    commitUploads(uploadsRef.current.filter(item => item.status !== 'error'))
    await Promise.all(rows.map(item => deleteEventPhoto(item.row.id).catch(() => {})))
    load()
  }

  async function handleDelete(photo) {
    await deleteEventPhoto(photo.id)
    if (photo.user_id === userId) setMyCount(count => Math.max(0, count - 1))
    setAlbum(current => ({ ...current, photos: (current.photos ?? []).filter(item => item.id !== photo.id) }))
    showToast?.('Photo supprimée')
  }

  function openPhoto(index) {
    setShowAll(false)
    setViewerIndex(index)
  }

  return (
    <section ref={sectionRef} aria-labelledby="event-photos-title" style={{ scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h2 id="event-photos-title" style={{ ...SECTION_TITLE, flex: 1, minWidth: 0 }}>Participer à l’album partagé</h2>
        <div style={{ fontSize: 14, fontWeight: 600, color: myCount >= maxPerUser ? '#FF3B30' : '#8E8E93', fontVariantNumeric: 'tabular-nums' }} aria-label={`${myCount} photos ajoutées sur ${maxPerUser}`}>{myCount}/{maxPerUser}</div>
        {photos.length > 0 && (
          <button type="button" onClick={() => setShowAll(true)} style={{ border: 'none', background: 'none', padding: 0, fontSize: 14, fontWeight: 600, color: '#e055aa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Voir tout
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {active.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600, marginBottom: 6 }}>
            Envoi de {active.length} photo{active.length > 1 ? 's' : ''}…
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#F2F2F7', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: GRADIENT, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {!running && failed.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,59,48,0.08)' }}>
          <div style={{ flex: 1, fontSize: 13, color: '#FF3B30', fontWeight: 600 }}>
            {retryable.length > 0
              ? `${retryable.length} photo${retryable.length > 1 ? 's' : ''} non envoyée${retryable.length > 1 ? 's' : ''}`
              : `Limite de ${maxPerUser} photos atteinte`}
          </div>
          {retryable.length > 0 && (
            <button type="button" onClick={retryFailed} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 16, border: 'none', background: '#FF3B30', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <RotateCcw size={14} strokeWidth={2.2} />
              Réessayer
            </button>
          )}
          <button type="button" aria-label="Abandonner" onClick={abandonFailed} style={{ width: 30, height: 30, borderRadius: 15, border: 'none', background: 'rgba(255,59,48,0.12)', color: '#FF3B30', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', margin: '0 -16px', padding: '0 16px' }}>
        <button
          type="button"
          onClick={handleAddClick}
          disabled={remaining <= 0}
          aria-label="Ajouter des photos"
          style={{ ...THUMB, border: `1.5px dashed ${remaining > 0 ? '#C7C7CC' : '#E5E5EA'}`, background: '#FAFAFC', color: remaining > 0 ? '#8E8E93' : '#D1D1D6', display: 'grid', placeItems: 'center', cursor: remaining > 0 ? 'pointer' : 'default' }}
        >
          <Plus size={26} strokeWidth={2} />
        </button>
        {photos.length === 0 ? (
          <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.35, paddingLeft: 4 }}>Ajoute jusqu’à {maxPerUser} photos de l’événement</div>
        ) : rowPhotos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => openPhoto(index)}
            aria-label={`Photo ajoutée par ${photo.author_name}`}
            style={{ ...THUMB, border: 'none', background: '#F2F2F7', cursor: 'pointer', overflow: 'hidden' }}
          >
            {thumbUrls[photo.thumb_path] && (
              <img src={thumbUrls[photo.thumb_path]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </button>
        ))}
      </div>

      {photos.length > 0 && expiresAt && !closed && (
        <div style={{ fontSize: 12, color: expiringSoon ? '#FF3B30' : '#8E8E93', fontWeight: expiringSoon ? 600 : 400, marginTop: 8 }}>
          Conservées jusqu’au {expiresAt.locale('fr').format('D MMMM YYYY')}
        </div>
      )}

      {showAll && (
        <BottomSheet title={`${photos.length} photo${photos.length > 1 ? 's' : ''}`} onClose={() => setShowAll(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, borderRadius: 12, overflow: 'hidden' }}>
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => openPhoto(index)}
                aria-label={`Photo ajoutée par ${photo.author_name}`}
                style={{ aspectRatio: '1', padding: 0, border: 'none', background: '#E5E5EA', cursor: 'pointer', overflow: 'hidden' }}
              >
                {thumbUrls[photo.thumb_path] && (
                  <img src={thumbUrls[photo.thumb_path]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          startIndex={viewerIndex}
          thumbUrls={thumbUrls}
          userId={userId}
          canManage={!!album.can_manage}
          onClose={() => setViewerIndex(null)}
          onDelete={handleDelete}
          onToast={showToast}
        />
      )}

      {showSourceSheet && (
        <BottomSheet title="Ajouter des photos" onClose={() => setShowSourceSheet(false)}>
          <div style={{ fontSize: 13, color: '#8E8E93', padding: '0 4px 12px' }}>
            Encore {remaining} photo{remaining > 1 ? 's' : ''} possible{remaining > 1 ? 's' : ''}
          </div>
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            {[
              { source: 'gallery', icon: <Images size={20} color="#e055aa" />, label: 'Choisir dans la galerie' },
              { source: 'camera', icon: <CameraIcon size={20} color="#e055aa" />, label: 'Prendre une photo' },
            ].map((option, index) => (
              <button
                key={option.source}
                type="button"
                onClick={() => pickFrom(option.source)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', border: 'none', borderTop: index ? '0.5px solid rgba(0,0,0,0.07)' : 'none', background: 'transparent', fontSize: 15, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', textAlign: 'left' }}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </section>
  )
}
