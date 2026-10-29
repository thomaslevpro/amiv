import { useEffect, useState } from 'react'
import { CalendarPlus, Cake, Send } from 'lucide-react'

function ActionRow({ icon, iconBackground, title, subtitle, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 12px', borderRadius: 16,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={e => e.currentTarget.style.background = '#F5F5F5'}
      onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
      onMouseDown={e => e.currentTarget.style.background = '#F5F5F5'}
      onMouseUp={e => e.currentTarget.style.background = 'transparent'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 16, flexShrink: 0,
        background: iconBackground,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', lineHeight: 1.3 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}

export default function CreateActionSheet({ onClose, onCreateEvent, onAddAmiv, onAskBirthday }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  function closeThen(action) {
    setVisible(false)
    setTimeout(() => { onClose(); action() }, 300)
  }

  const divider = <div style={{ height: 1, background: '#F5F5F5', marginLeft: 78 }} />

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
          <ActionRow
            icon={<CalendarPlus size={24} color="#fff" strokeWidth={1.8} />}
            iconBackground="linear-gradient(135deg, #e055aa, #f5a623)"
            title="Créer un événement"
            subtitle="Soirée, anniversaire, apéro…"
            onClick={() => closeThen(onCreateEvent)}
          />
          {divider}
          <ActionRow
            icon={<Cake size={24} color="#1C1C1E" strokeWidth={1.8} />}
            iconBackground="#F5F5F5"
            title="Ajouter un rappel anniv"
            subtitle="Je connais déjà la date"
            onClick={() => closeThen(onAddAmiv)}
          />
          {divider}
          <ActionRow
            icon={<Send size={22} color="#1C1C1E" strokeWidth={1.8} />}
            iconBackground="#F5F5F5"
            title="Demander son anniversaire"
            subtitle="Envoie un lien à un ami pour qu'il te donne sa date"
            onClick={() => closeThen(onAskBirthday)}
          />
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
