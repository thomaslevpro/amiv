import { supabase } from './supabase'
import { compressImage } from './imageCompression'

const MAX_WIDTH = 1600
const JPEG_QUALITY = 0.8

// Redimensionne (largeur max 1600 px) et réencode en JPEG ~80 %.
export function compressCoverImage(file) {
  return compressImage(file, { maxWidth: MAX_WIDTH, quality: JPEG_QUALITY })
}

// Couverture stockée sous event-covers/{eventId}/cover_{ts}.jpg : les policies
// du bucket (can_manage_event_cover) exigent que l'événement existe déjà et que
// l'utilisateur en soit organisateur. Renvoie { path, error }.
export async function uploadEventCover(eventId, file) {
  let body = file
  let ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  try {
    body = await compressCoverImage(file)
    ext = 'jpg'
  } catch (err) {
    console.warn('[uploadEventCover] compression impossible, envoi du fichier original', err)
  }

  const path = `${eventId}/cover_${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('event-covers')
    .upload(path, body, { upsert: true, contentType: body.type || undefined })
  return { path: error ? null : path, error }
}
