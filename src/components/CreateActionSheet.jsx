import { useEffect, useState } from 'react'
import { CalendarPlus, UserPlus } from 'lucide-react'

export default function CreateActionSheet({ onClose, onCreateEvent, onAddAmiv }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  function handleCreateEvent() {
    setVisible(false)
    setTimeout(() => { onClose(); onCreateEvent() }, 300)
  }

  function handleAddAmiv() {
    setVisible(false)
    setTimeout(() => { onClose(); onAddAmiv() }, 300)
  }

  return (
    <>
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 401,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        paddingBottom: 'env(safe-area-inset-bottom, 24px)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
        </div>

        <div style={{ padding: '8px 16px 0' }}>
          {/* Row 1 — Créer un événement */}
          <div
            onClick={handleCreateEvent}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 12px', borderRadius: 16,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
            onTouchStart={e => e.currentTarget.style.background = '#F2F2F7'}
            onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
            onMouseDown={e => e.currentTarget.style.background = '#F2F2F7'}
            onMouseUp={e => e.currentTarget.style.background = 'transparent'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(135deg, #e055aa, #f5a623)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarPlus size={24} color="#fff" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', lineHeight: 1.3 }}>
                Créer un événement
              </div>
              <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>
                Soirée, anniversaire, apéro…
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#F2F2F7', marginLeft: 78 }} />

          {/* Row 2 — Ajouter un amiv */}
          <div
            onClick={handleAddAmiv}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 12px', borderRadius: 16,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
            onTouchStart={e => e.currentTarget.style.background = '#F2F2F7'}
            onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
            onMouseDown={e => e.currentTarget.style.background = '#F2F2F7'}
            onMouseUp={e => e.currentTarget.style.background = 'transparent'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: '#F2F2F7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserPlus size={24} color="#1C1C1E" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', lineHeight: 1.3 }}>
                Ajouter un amiv
              </div>
              <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>
                Inviter un ami par email ou lien
              </div>
            </div>
          </div>
        </div>

        {/* Cancel */}
        <div style={{ padding: '4px 16px 0' }}>
          <button
            onClick={close}
            style={{
              width: '100%', padding: '14px 0',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8E8E93', fontSize: 16, fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </>
  )
}
