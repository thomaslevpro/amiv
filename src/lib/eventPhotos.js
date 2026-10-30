import { Capacitor } from '@capacitor/core'
import { Camera, MediaTypeSelection } from '@capacitor/camera'
import { Media } from '@capacitor-community/media'
import { supabase } from './supabase'
import { captureSupabaseError } from './monitoring'
import { loadImage, renderJpeg } from './imageCompression'
import { isNative, openExternalUrl } from './native'

// Album photo partagé d'un événement (≠ Flashback de l'espace secret).
// Bucket privé event-photos, lu par URL signée à durée courte. Les chemins
// sont fixés par la base à l'insertion de la ligne (trigger
// prepare_event_photo), qui applique aussi la limite par personne.
export const EVENT_PHOTOS_BUCKET = 'event-photos'
export const SIGNED_URL_TTL = 10 * 60
export const MAX_PHOTOS_PER_USER = 10

const FULL_MAX_WIDTH = 1600
const FULL_QUALITY = 0.8
const THUMB_MIN_SIDE = 400
const THUMB_QUALITY = 0.75

export class PhotoLimitError extends Error {}

// { can_view, can_manage, my_count, max_per_user, photos } (photos complètes,
// les plus récentes d'abord).
export async function fetchEventPhotos(eventId) {
  const { data, error } = await supabase.rpc('get_event_photos', { p_event_id: eventId })
  if (error) {
    captureSupabaseError(error, { operation: 'get_event_photos' })
    throw error
  }
  return data ?? { can_view: false }
}

export async function signEventPhotoPaths(paths) {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(EVENT_PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  if (error) {
    console.error('[eventPhotos] signed urls error:', error)
    return {}
  }
  return Object.fromEntries((data ?? []).filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]))
}

// Photo pleine taille (1600 px de large max, JPEG ~80 %) et miniature pour la
// grille (plus petit côté 400 px, recadrée en carré à l'affichage).
export async function preparePhoto(file) {
  const img = await loadImage(file)
  const shortSide = Math.min(img.naturalWidth, img.naturalHeight)
  const [full, thumb] = await Promise.all([
    renderJpeg(img, Math.min(1, FULL_MAX_WIDTH / img.naturalWidth), FULL_QUALITY),
    renderJpeg(img, Math.min(1, THUMB_MIN_SIDE / shortSide), THUMB_QUALITY),
  ])
  return { full, thumb }
}

export async function createPhotoRow(eventId) {
  const { data, error } = await supabase
    .from('event_photos')
    .insert({ event_id: eventId })
    .select('id, path, thumb_path')
    .single()
  if (error) {
    if (error.code === '23514') throw new PhotoLimitError('Limite de photos atteinte')
    captureSupabaseError(error, { operation: 'create_event_photo' })
    throw error
  }
  return data
}

// Rejouable : un fichier déjà envoyé lors d'un essai précédent compte comme envoyé.
export async function uploadPhotoFile(path, blob) {
  const { error } = await supabase.storage
    .from(EVENT_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
  if (error && !(String(error.statusCode) === '409' || /already exists/i.test(error.message ?? ''))) throw error
}

// Une notification groupée pour les photos envoyées et pas encore annoncées.
export async function notifyPhotosAdded(eventId) {
  const { error } = await supabase.rpc('notify_event_photos_added', { p_event_id: eventId })
  if (error) captureSupabaseError(error, { operation: 'notify_event_photos_added' })
}

// Les fichiers sont effacés côté serveur (file storage_deletion_queue).
export async function deleteEventPhoto(photoId) {
  const { data, error } = await supabase.from('event_photos').delete().eq('id', photoId).select('id')
  if (error) {
    captureSupabaseError(error, { operation: 'delete_event_photo' })
    throw error
  }
  if (!data?.length) throw new Error('Photo non supprimée')
}

// Sélecteur natif (iOS) : limite le nombre de photos choisies. Absent des
// builds antérieurs à l'album : on retombe alors sur <input type="file">.
export const hasNativePhotoPicker = isNative && Capacitor.isPluginAvailable('Camera')

async function blobFromWebPath(webPath) {
  const response = await fetch(webPath)
  return response.blob()
}

function isCancel(error) {
  return /cancel/i.test(error?.message ?? '')
}

export async function pickNativePhotos({ source, limit }) {
  try {
    if (source === 'camera') {
      const result = await Camera.takePhoto({ quality: 90, correctOrientation: true })
      return result?.webPath ? [await blobFromWebPath(result.webPath)] : []
    }
    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: true,
      limit,
      quality: 90,
    })
    const paths = (results ?? []).map(result => result.webPath).filter(Boolean).slice(0, limit)
    return Promise.all(paths.map(blobFromWebPath))
  } catch (error) {
    if (isCancel(error)) return []
    throw error
  }
}

// « Enregistrer » : photothèque de l'iPhone (NSPhotoLibraryAddUsageDescription),
// téléchargement sur le web. Renvoie 'saved' | 'downloaded' | 'opened'.
export async function savePhotoToDevice(url) {
  if (isNative && Capacitor.isPluginAvailable('Media')) {
    await Media.savePhoto({ path: url })
    return 'saved'
  }
  if (isNative) {
    // Build sans le plugin : la photo s'ouvre, appui long pour l'enregistrer
    openExternalUrl(url)
    return 'opened'
  }
  const response = await fetch(url)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `amiv-photo-${Date.now()}.jpg`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
  return 'downloaded'
}
