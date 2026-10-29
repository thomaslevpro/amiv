import { supabase } from './supabase'

const MAX_WIDTH = 1600
const JPEG_QUALITY = 0.8

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}

// Redimensionne (largeur max 1600 px) et réencode en JPEG ~80 %. Le navigateur
// applique déjà l'orientation EXIF au décodage de <img>.
export async function compressCoverImage(file) {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_WIDTH / img.naturalWidth)
  const width = Math.round(img.naturalWidth * scale)
  const height = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // Fond blanc : un PNG transparent deviendrait noir en JPEG.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Compression impossible')
  return blob
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
