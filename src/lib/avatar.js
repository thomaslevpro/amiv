import { supabase } from './supabase'

// Avatar stocké sous avatars/{userId}.{ext} (seul nom autorisé par les policies du bucket).
// Renvoie l'URL publique versionnée (?v=) pour contourner le cache navigateur / CDN.
export async function uploadAvatar(userId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${userId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (uploadError) throw uploadError

  // Si l'extension a changé (.png → .jpg), l'ancien fichier resterait orphelin
  const { data: existing } = await supabase.storage.from('avatars').list('', { search: userId })
  const stale = (existing ?? [])
    .map(object => object.name)
    .filter(name => name !== path && name.startsWith(`${userId}.`))
  if (stale.length) {
    const { error: removeError } = await supabase.storage.from('avatars').remove(stale)
    if (removeError) console.warn('[uploadAvatar] ancien avatar non supprimé', removeError)
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}
