import { CheckCircle2, Clock3, Sparkles } from 'lucide-react'

const COLORS = {
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8E8E93',
  gradient: 'linear-gradient(135deg, #e055aa, #f5a623)',
  warm: '#FFF5F0',
}

export default function GuestLeaderBanner({
  currentUserRole,
  isConfirmedGuest,
  isGuestLeader,
  hasPendingRequest,
  applyAsGuestLeader,
  onToast,
}) {
  if (currentUserRole === 'owner' || currentUserRole === 'co_organizer') return null
  if (!isConfirmedGuest && !hasPendingRequest && !isGuestLeader) return null

  async function handleApply() {
    try {
      await applyAsGuestLeader()
      onToast?.("Demande envoyée à l'organisateur ✓")
    } catch (error) {
      console.error('[GuestLeaderBanner] apply error:', error)
      onToast?.(error.message ?? "Impossible d'envoyer la demande", true)
    }
  }

  if (isGuestLeader) {
    return (
      <div style={{ background: COLORS.card, borderRadius: 20, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: COLORS.gradient, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <CheckCircle2 size={19} strokeWidth={2.1} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'inline-flex', borderRadius: 999, background: COLORS.gradient, color: '#fff', fontSize: 11, fontWeight: 850, padding: '5px 10px', marginBottom: 6 }}>
            ✦ Coordinateur
          </span>
          <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 650 }}>
            Tu coordonnes cet espace secret
          </div>
        </div>
      </div>
    )
  }

  if (hasPendingRequest) {
    return (
      <div style={{ background: COLORS.card, borderRadius: 20, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F5F5F5', color: COLORS.muted, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Clock3 size={19} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 15, color: COLORS.text, fontWeight: 850 }}>Demande en attente de validation…</div>
          <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 550, marginTop: 3 }}>
            L'organisateur te répondra bientôt.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: COLORS.warm, borderRadius: 20, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(224,85,170,0.11)', color: '#e055aa', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Sparkles size={20} strokeWidth={2.1} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, color: COLORS.text, fontWeight: 900 }}>Coordonner cet anniversaire ?</div>
        <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, marginTop: 3 }}>Aide l'organisateur : relances, cagnotte, chat</div>
      </div>
      <button
        type="button"
        onClick={handleApply}
        style={{ minHeight: 38, borderRadius: 13, background: COLORS.gradient, color: '#fff', fontSize: 12, fontWeight: 850, padding: '0 13px', flexShrink: 0 }}
      >
        Je me propose
      </button>
    </div>
  )
}
