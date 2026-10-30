// Compression côté client, partagée par la photo de couverture et l'album.

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}

// Réencode en JPEG à l'échelle donnée (≤ 1). Le navigateur applique déjà
// l'orientation EXIF au décodage de <img>.
export async function renderJpeg(img, scale, quality) {
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // Fond blanc : un PNG transparent deviendrait noir en JPEG.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Compression impossible')
  return blob
}

// Largeur max maxWidth, JPEG ~quality.
export async function compressImage(file, { maxWidth, quality }) {
  const img = await loadImage(file)
  return renderJpeg(img, Math.min(1, maxWidth / img.naturalWidth), quality)
}
