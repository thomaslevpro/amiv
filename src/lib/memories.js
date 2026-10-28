import { supabase } from './supabase'

// Bucket privé : image_url contient le chemin <event_id>/<user_id>/<fichier>,
// lu par URL signée. Les anciennes valeurs (URL http, ex. card-photos) sont
// affichées telles quelles.
export const MEMORY_IMAGES_BUCKET = 'memory-images'
const SIGNED_URL_TTL = 60 * 60

export async function uploadMemoryImage(file, eventId, userId) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${eventId}/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(MEMORY_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })
  if (error) throw error
  return path
}

// Ajoute display_image_url à chaque souvenir.
export async function withMemoryImageUrls(memories) {
  const paths = [...new Set(memories
    .map(memory => memory.image_url)
    .filter(value => value && !/^https?:\/\//i.test(value)))]

  let signedByPath = {}
  if (paths.length > 0) {
    const { data, error } = await supabase.storage
      .from(MEMORY_IMAGES_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL)
    if (error) console.error('[memories] signed urls error:', error)
    signedByPath = Object.fromEntries((data ?? [])
      .filter(item => item.signedUrl)
      .map(item => [item.path, item.signedUrl]))
  }

  return memories.map(memory => ({
    ...memory,
    display_image_url: !memory.image_url
      ? null
      : /^https?:\/\//i.test(memory.image_url) ? memory.image_url : signedByPath[memory.image_url] ?? null,
  }))
}
