import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { GRAY } from './OnboardingUI'

const OUTPUT_SIZE = 512
const MAX_ZOOM = 4

function clamp(value, max) {
  return Math.min(max, Math.max(-max, value))
}

// Recadrage rond : glisser pour déplacer, pincer ou curseur pour zoomer.
// `cropRef.current()` renvoie le JPEG carré (512 px) de la zone visible.
export default function AvatarCropper({ src, cropRef, size = 280 }) {
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => { setImage(img); setZoom(1); setOffset({ x: 0, y: 0 }) }
    img.src = src
  }, [src])

  const cover = image ? size / Math.min(image.naturalWidth, image.naturalHeight) : 1
  const scale = cover * zoom
  const width = image ? image.naturalWidth * scale : size
  const height = image ? image.naturalHeight * scale : size
  const maxX = Math.max(0, (width - size) / 2)
  const maxY = Math.max(0, (height - size) / 2)
  const x = clamp(offset.x, maxX)
  const y = clamp(offset.y, maxY)

  cropRef.current = async () => {
    if (!image) return null
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    const sx = (width / 2 - x - size / 2) / scale
    const sy = (height / 2 - y - size / 2) / scale
    ctx.drawImage(image, sx, sy, size / scale, size / scale, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  }

  const distance = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const onPointerDown = event => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    gesture.current = pointers.current.size === 2
      ? { type: 'pinch', distance: distance(), zoom }
      : { type: 'drag', startX: event.clientX, startY: event.clientY, x, y }
  }

  const onPointerMove = event => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (gesture.current.type === 'pinch' && pointers.current.size === 2) {
      setZoom(Math.min(MAX_ZOOM, Math.max(1, gesture.current.zoom * (distance() / gesture.current.distance))))
    } else if (gesture.current.type === 'drag') {
      setOffset({
        x: clamp(gesture.current.x + event.clientX - gesture.current.startX, maxX),
        y: clamp(gesture.current.y + event.clientY - gesture.current.startY, maxY),
      })
    }
  }

  const onPointerUp = event => {
    pointers.current.delete(event.pointerId)
    setOffset({ x, y })
    const [rest] = [...pointers.current.values()]
    gesture.current = rest ? { type: 'drag', startX: rest.x, startY: rest.y, x, y } : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Zone de recadrage : fais glisser la photo pour la placer"
        style={{ width: size, height: size, position: 'relative', overflow: 'hidden', borderRadius: 24, background: '#1C1C1E', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
      >
        {image && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ position: 'absolute', left: '50%', top: '50%', width, height, maxWidth: 'none', transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, pointerEvents: 'none' }}
          />
        )}
        {/* Masque : tout est assombri sauf le cercle */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '0 0 0 400px rgba(0,0,0,0.55)', border: '2px solid rgba(255,255,255,0.9)', pointerEvents: 'none' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: size, marginTop: 18 }}>
        <ZoomOut size={18} color={GRAY} />
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          style={{ flex: 1, accentColor: '#e055aa' }}
        />
        <ZoomIn size={18} color={GRAY} />
      </div>
    </div>
  )
}
