import { useState } from 'react'
import { Ban, Flag, UserRound, X } from 'lucide-react'
import { REPORT_REASONS, blockUser, submitReport, unblockUser } from '../../lib/safety'

const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'
const TEXT = '#1C1C1E'
const SECONDARY = '#8E8E93'
const CARD = '#FFFFFF'
const PAGE = '#F5F5F5'
const DESTRUCTIVE = '#FF3B30'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

export function BottomSheet({ title, onClose, children }) {
  return (
    <div
      onClick={event => { event.stopPropagation(); onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          background: PAGE,
          borderRadius: '22px 22px 0 0',
          padding: '18px 16px max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.18)',
          boxSizing: 'border-box',
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 24px)',
          overflowY: 'auto',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: '#D1D1D6' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px', gap: 12 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: TEXT }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E5EA', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SheetButton({ children, onClick, disabled, variant = 'primary' }) {
  const styles = {
    primary: { background: GRADIENT, color: '#fff' },
    destructive: { background: DESTRUCTIVE, color: '#fff' },
    neutral: { background: CARD, color: TEXT },
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ width: '100%', minHeight: 50, borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 800, fontFamily: FONT, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, ...styles }}
    >
      {children}
    </button>
  )
}

// Signalement d'un message ou d'un profil : motif obligatoire, commentaire optionnel.
export function ReportSheet({ targetType, targetId, subjectLabel, onClose, onDone }) {
  const [reason, setReason] = useState(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    if (!reason || sending) return
    setSending(true)
    setError(null)
    try {
      await submitReport({ targetType, targetId, reason, comment })
      setSent(true)
      onDone?.()
    } catch {
      setError("Impossible d'envoyer le signalement. Réessaie plus tard.")
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <BottomSheet title="Merci" onClose={onClose}>
        <div style={{ fontSize: 14, color: SECONDARY, lineHeight: 1.5, padding: '0 4px 18px' }}>
          Ton signalement a bien été envoyé à l'équipe Amiv. Nous allons l'examiner rapidement.
        </div>
        <SheetButton onClick={onClose}>Fermer</SheetButton>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title={`Signaler ${subjectLabel}`} onClose={onClose}>
      <div style={{ fontSize: 13, color: SECONDARY, padding: '0 4px 12px' }}>Pourquoi signales-tu ce contenu ?</div>
      <div style={{ background: CARD, borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
        {REPORT_REASONS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setReason(item.id)}
            style={{ width: '100%', border: 'none', borderTop: index ? '0.5px solid rgba(0,0,0,0.07)' : 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', fontSize: 15, color: TEXT, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', textAlign: 'left' }}
          >
            {item.label}
            <span style={{ width: 20, height: 20, borderRadius: '50%', border: reason === item.id ? 'none' : '1.5px solid #C7C7CC', background: reason === item.id ? GRADIENT : 'transparent', flexShrink: 0 }} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={event => setComment(event.target.value.slice(0, 1000))}
        placeholder="Ajouter un commentaire (optionnel)"
        rows={3}
        style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderRadius: 14, padding: '12px 14px', fontSize: 16, fontFamily: FONT, color: TEXT, background: CARD, resize: 'none', outline: 'none', marginBottom: 14 }}
      />
      {error && <div style={{ color: DESTRUCTIVE, fontSize: 13, fontWeight: 700, marginBottom: 10, padding: '0 4px' }}>{error}</div>}
      <SheetButton onClick={handleSubmit} disabled={!reason || sending}>
        {sending ? 'Envoi…' : 'Envoyer le signalement'}
      </SheetButton>
    </BottomSheet>
  )
}

// Menu « … » d'un utilisateur : signaler le profil, bloquer / débloquer.
// Avec onViewProfile (en-tête d'une conversation) : Voir le profil, Bloquer, Signaler.
export function UserSafetySheet({ userId, userName, isBlocked, onClose, onBlockedChange, onViewProfile = null, initialStep = 'menu' }) {
  const [step, setStep] = useState(initialStep)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const name = userName || 'cet utilisateur'

  async function toggleBlock() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (isBlocked) await unblockUser(userId)
      else await blockUser(userId)
      onBlockedChange?.(!isBlocked)
      onClose()
    } catch {
      setError('Action impossible pour le moment.')
      setBusy(false)
    }
  }

  if (step === 'report') {
    return <ReportSheet targetType="profile" targetId={userId} subjectLabel="ce profil" onClose={onClose} />
  }

  if (step === 'confirmBlock') {
    return (
      <BottomSheet title={`Bloquer ${name} ?`} onClose={onClose}>
        <div style={{ fontSize: 14, color: SECONDARY, lineHeight: 1.5, padding: '0 4px 18px' }}>
          {name} ne pourra plus t'envoyer de message privé, de demande d'ami ni t'inviter à un événement. Ses messages seront masqués dans les discussions d'événement. Tu pourras annuler le blocage depuis Profil → Utilisateurs bloqués.
        </div>
        {error && <div style={{ color: DESTRUCTIVE, fontSize: 13, fontWeight: 700, marginBottom: 10, padding: '0 4px' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SheetButton variant="destructive" onClick={toggleBlock} disabled={busy}>{busy ? 'Blocage…' : 'Bloquer'}</SheetButton>
          <SheetButton variant="neutral" onClick={onClose}>Annuler</SheetButton>
        </div>
      </BottomSheet>
    )
  }

  const reportRow = { key: 'report', label: 'Signaler', color: DESTRUCTIVE, icon: <Flag size={18} strokeWidth={1.8} color={DESTRUCTIVE} />, onClick: () => setStep('report') }
  const blockRow = isBlocked
    ? { key: 'unblock', label: 'Débloquer cet utilisateur', color: TEXT, icon: <Ban size={18} strokeWidth={1.8} color={SECONDARY} />, onClick: toggleBlock }
    : { key: 'block', label: 'Bloquer cet utilisateur', color: DESTRUCTIVE, icon: <Ban size={18} strokeWidth={1.8} color={DESTRUCTIVE} />, onClick: () => setStep('confirmBlock') }
  const rows = onViewProfile
    ? [{ key: 'profile', label: 'Voir le profil', color: TEXT, icon: <UserRound size={18} strokeWidth={1.8} color={SECONDARY} />, onClick: onViewProfile }, blockRow, reportRow]
    : [reportRow, blockRow]

  return (
    <BottomSheet title={userName || 'Options'} onClose={onClose}>
      <div style={{ background: CARD, borderRadius: 16, overflow: 'hidden' }}>
        {rows.map((row, index) => (
          <button
            key={row.key}
            type="button"
            onClick={row.onClick}
            disabled={busy}
            style={{ width: '100%', border: 'none', borderTop: index ? '0.5px solid rgba(0,0,0,0.07)' : 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', fontSize: 15, color: row.color, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', textAlign: 'left' }}
          >
            {row.icon}
            {row.label}
          </button>
        ))}
      </div>
      {error && <div style={{ color: DESTRUCTIVE, fontSize: 13, fontWeight: 700, marginTop: 10, padding: '0 4px' }}>{error}</div>}
    </BottomSheet>
  )
}
