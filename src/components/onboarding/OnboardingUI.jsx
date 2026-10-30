import { ChevronLeft } from 'lucide-react'
import { PROGRESS_STEPS } from '../../lib/onboarding'

export const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'
export const BLACK = '#1C1C1E'
export const GRAY = '#8E8E93'
export const LIGHT = '#F5F5F5'
export const RED = '#FF3B30'
export const GREEN = '#34C759'
export const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

// Animations partagées par tous les écrans de l'onboarding
export function OnboardingStyles() {
  return (
    <style>{`
      @keyframes ob-in-next { from { opacity: 0; transform: translateX(36px); } to { opacity: 1; transform: none; } }
      @keyframes ob-in-back { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: none; } }
      @keyframes ob-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      @keyframes ob-pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
      @keyframes ob-spin { to { transform: rotate(360deg); } }
      @keyframes ob-shake { 0%, 100% { transform: none; } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
      .ob-screen { animation: ob-in-next 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
      .ob-screen[data-direction="back"] { animation-name: ob-in-back; }
      .ob-rise { animation: ob-rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
      .ob-pop { animation: ob-pop 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
      .ob-shake { animation: ob-shake 0.3s ease; }
      .ob-press { transition: transform 0.12s ease, opacity 0.2s ease, background 0.2s ease; }
      .ob-press:active:not(:disabled) { transform: scale(0.97); }
      @media (prefers-reduced-motion: reduce) {
        .ob-screen, .ob-rise, .ob-pop, .ob-shake { animation: none !important; }
      }
    `}</style>
  )
}

export function ProgressBar({ step }) {
  const ratio = Math.min(1, Math.max(0, step / PROGRESS_STEPS))
  return (
    <div
      role="progressbar"
      aria-label="Progression"
      aria-valuemin={0}
      aria-valuemax={PROGRESS_STEPS}
      aria-valuenow={step}
      style={{ flex: 1, height: 6, borderRadius: 3, background: '#EFEFF4', overflow: 'hidden' }}
    >
      <div style={{ width: `${ratio * 100}%`, height: '100%', borderRadius: 3, background: GRADIENT, transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)' }} />
    </div>
  )
}

// En-tête : retour, progression, « Plus tard » sur les étapes facultatives.
// progressStep null = pas de barre (connexion).
export function OnboardingHeader({ progressStep = null, onBack, onLater, laterLabel = 'Plus tard' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 6px', minHeight: 48, flexShrink: 0 }}>
      <div style={{ width: 36, flexShrink: 0 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            className="ob-press"
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
          >
            <ChevronLeft size={21} strokeWidth={2} color={BLACK} />
          </button>
        )}
      </div>
      {progressStep != null ? <ProgressBar step={progressStep} /> : <div style={{ flex: 1 }} />}
      <div style={{ minWidth: 36, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        {onLater && (
          <button
            type="button"
            onClick={onLater}
            className="ob-press"
            style={{ border: 'none', background: 'none', color: GRAY, fontSize: 15, fontWeight: 600, cursor: 'pointer', padding: '8px 0', fontFamily: FONT, whiteSpace: 'nowrap' }}
          >
            {laterLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// Écran plein : en-tête, contenu défilant, pied fixe (boutons)
export function OnboardingScreen({ header, footer, children, direction = 'next', screenKey, contentStyle, zIndex = 50 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', background: '#fff', fontFamily: FONT, zIndex }}>
      <OnboardingStyles />
      <div style={{ width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: 0 }}>
        {header}
        <div key={screenKey} className="ob-screen" data-direction={direction} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 24px 16px', ...contentStyle }}>
            {children}
          </div>
          {footer && <div style={{ padding: '8px 24px 20px', flexShrink: 0 }}>{footer}</div>}
        </div>
      </div>
    </div>
  )
}

// Icône au trait dans un carré arrondi rose clair (pas d'emoji dans l'onboarding)
export function IconBadge({ icon: Icon, size = 48, iconSize = 24, style }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}>
      <Icon size={iconSize} strokeWidth={1.9} color="#e055aa" />
    </div>
  )
}

export function StepTitle({ icon, title, subtitle }) {
  return (
    <div className="ob-rise" style={{ marginBottom: 26 }}>
      {icon && <IconBadge icon={icon} style={{ marginBottom: 16 }} />}
      <h1 style={{ fontSize: 28, fontWeight: 800, color: BLACK, letterSpacing: -0.5, lineHeight: 1.15, margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 15, color: GRAY, lineHeight: 1.5, margin: '8px 0 0' }}>{subtitle}</p>}
    </div>
  )
}

export function PrimaryButton({ children, disabled, loading, onClick, type = 'button', style }) {
  const off = disabled || loading
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={off}
      className="ob-press"
      style={{
        width: '100%', padding: 16, borderRadius: 16, border: 'none',
        background: off ? '#D1D1D6' : GRADIENT,
        color: '#fff', fontSize: 17, fontWeight: 700,
        cursor: off ? 'default' : 'pointer',
        boxShadow: off ? 'none' : '0 6px 20px rgba(224,85,170,0.30)',
        fontFamily: FONT,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ob-press"
      style={{ width: '100%', padding: 15, borderRadius: 16, border: 'none', background: LIGHT, color: BLACK, fontSize: 16, fontWeight: 650, cursor: disabled ? 'default' : 'pointer', fontFamily: FONT, ...style }}
    >
      {children}
    </button>
  )
}

export function TextField({ label, hint, hintColor = GRAY, prefix, suffix, inputRef, style, ...inputProps }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      {label && <div style={{ fontSize: 13, color: GRAY, fontWeight: 600, marginBottom: 7, paddingLeft: 4 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', background: LIGHT, borderRadius: 14, padding: '0 16px', ...style }}>
        {prefix && <span style={{ fontSize: 16, color: GRAY, fontWeight: 600, flexShrink: 0 }}>{prefix}</span>}
        <input
          ref={inputRef}
          {...inputProps}
          style={{ flex: 1, minWidth: 0, padding: '15px 0', border: 'none', background: 'transparent', fontSize: 17, color: BLACK, outline: 'none', fontFamily: FONT }}
        />
        {suffix && <span style={{ display: 'flex', flexShrink: 0, marginLeft: 8 }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 13, color: hintColor, fontWeight: 600, marginTop: 7, paddingLeft: 4, lineHeight: 1.4 }}>{hint}</div>}
    </label>
  )
}

export function ErrorText({ children }) {
  if (!children) return null
  return <div role="alert" style={{ background: 'rgba(255,59,48,0.08)', color: RED, borderRadius: 12, padding: '10px 14px', fontSize: 14, lineHeight: 1.4, marginBottom: 12 }}>{children}</div>
}
