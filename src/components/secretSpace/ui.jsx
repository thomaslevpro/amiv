import { X } from 'lucide-react'

// Éléments d'interface partagés par l'espace secret et ses onglets

export const COLORS = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8E8E93',
  line: '#E5E5EA',
  pink: '#e055aa',
  orange: '#f5a623',
  green: '#34C759',
  red: '#FF3B30',
  gradient: 'linear-gradient(135deg, #e055aa, #f5a623)',
}

export function Input({ label, ...props }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>{label}</span>
      <input
        {...props}
        style={{
          width: '100%',
          border: `1px solid ${COLORS.line}`,
          borderRadius: 12,
          padding: '12px 13px',
          fontSize: 16,
          color: COLORS.text,
          background: COLORS.card,
          outline: 'none',
          ...props.style,
        }}
      />
    </label>
  )
}

export function Sheet({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.24)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: COLORS.card,
          // Plafonnée sous la barre d'état et scrollable : clavier ouvert,
          // le haut du formulaire ne doit pas sortir de l'écran.
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 24px)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          borderRadius: '20px 20px 0 0',
          padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ width: 42, height: 5, borderRadius: 999, background: COLORS.line, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, lineHeight: 1.2, color: COLORS.text }}>{title}</h2>
          <button type="button" aria-label="Fermer" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 17, background: COLORS.bg, display: 'grid', placeItems: 'center' }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PrimaryButton({ children, disabled, style, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 48,
        borderRadius: 14,
        background: disabled ? '#C7C7CC' : COLORS.gradient,
        color: '#fff',
        fontSize: 14,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, disabled, style, ...props }) {
  return (
    <PrimaryButton
      disabled={disabled}
      style={{ background: COLORS.bg, color: disabled ? COLORS.muted : COLORS.text, ...style }}
      {...props}
    >
      {children}
    </PrimaryButton>
  )
}

export function EmptyCard({ children }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', color: COLORS.muted, fontSize: 14 }}>
      {children}
    </div>
  )
}
