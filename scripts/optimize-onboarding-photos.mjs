// Photos de l'écran de bienvenue : originaux dans assets/onboarding/ (hors
// du build), versions pour l'app dans src/assets/onboarding/.
// WebP + JPEG de secours, 1200 px de large, recadrage centré au format de
// la photo des cartes, moins de 250 Ko chacune.
// Usage : node scripts/optimize-onboarding-photos.mjs
import { mkdirSync, statSync } from 'node:fs'
import sharp from 'sharp'

const NAMES = ['proches', 'fete', 'surprise']
const WIDTH = 1200
const HEIGHT = 1000
const MAX_BYTES = 250 * 1024
const OUT = 'src/assets/onboarding'

mkdirSync(OUT, { recursive: true })

async function encode(name, format) {
  const out = `${OUT}/onboarding-${name}.${format === 'webp' ? 'webp' : 'jpg'}`
  // Qualité baissée par paliers jusqu'à passer sous la limite
  for (let quality = 82; quality >= 50; quality -= 4) {
    const pipeline = sharp(`assets/onboarding/onboarding-${name}.jpg`)
      .rotate()
      .resize({ width: WIDTH, height: HEIGHT, fit: 'cover', position: 'centre' })
    await (format === 'webp'
      ? pipeline.webp({ quality, effort: 6 })
      : pipeline.jpeg({ quality, mozjpeg: true, progressive: true })
    ).toFile(out)
    const size = statSync(out).size
    if (size <= MAX_BYTES) return { out, size, quality }
  }
  throw new Error(`${out} dépasse ${MAX_BYTES} octets`)
}

for (const name of NAMES) {
  for (const format of ['webp', 'jpeg']) {
    const { out, size, quality } = await encode(name, format)
    console.log(`${out}  ${Math.round(size / 1024)} Ko  (qualité ${quality})`)
  }
}
