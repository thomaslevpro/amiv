import { useRef } from 'react'
import { Copy, Download, Share2, X } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'

export default function AmivQrModal({ isOpen, link, onClose, onToast }) {
  const qrRef = useRef(null)

  if (!isOpen) return null

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      onToast?.('Lien copié ✓')
    } catch {
      onToast?.('Impossible de copier le lien')
    }
  }

  function downloadPng() {
    const sourceCanvas = qrRef.current?.querySelector('canvas')
    if (!sourceCanvas) return

    const size = 420
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size + 86
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(sourceCanvas, 58, 42, 304, 304)

    const gradient = ctx.createLinearGradient(140, 382, 280, 382)
    gradient.addColorStop(0, '#e055aa')
    gradient.addColorStop(1, '#f5a623')
    ctx.fillStyle = gradient
    ctx.font = '900 34px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Amiv', size / 2, 404)

    const url = canvas.toDataURL('image/png')
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'amiv-qr-code.png'
    anchor.click()
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mon lien Amiv', url: link })
        return
      } catch {
        return
      }
    }
    await copyLink()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 760, background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: '#F5F5F5', borderRadius: '22px 22px 0 0', padding: '18px 20px max(28px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 36px rgba(0,0,0,0.18)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: '#D1D1D6' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1C1C1E' }}>Mon QR code</div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '24px 18px 18px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', textAlign: 'center' }}>
          <div ref={qrRef} style={{ display: 'inline-flex', padding: 14, background: '#fff', borderRadius: 16 }}>
            <QRCodeCanvas value={link} size={224} bgColor="#ffffff" fgColor="#1C1C1E" includeMargin={false} />
          </div>
          <div style={{ marginTop: 14, fontSize: 30, fontWeight: 900, background: GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Amiv
          </div>
          <div style={{ marginTop: 7, fontSize: 13, color: '#8E8E93', fontWeight: 700, overflowWrap: 'anywhere' }}>
            {link.replace(/^https:\/\//, '')}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <button type="button" onClick={downloadPng} style={{ minHeight: 50, borderRadius: 16, background: '#fff', color: '#1C1C1E', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
            <Download size={17} strokeWidth={2} />
            <span>Télécharger</span>
          </button>
          <button type="button" onClick={shareLink} style={{ minHeight: 50, borderRadius: 16, background: GRADIENT, color: '#fff', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 18px rgba(224,85,170,0.30)' }}>
            {navigator.share ? <Share2 size={17} strokeWidth={2} /> : <Copy size={17} strokeWidth={2} />}
            <span>Partager</span>
          </button>
        </div>
      </div>
    </div>
  )
}
