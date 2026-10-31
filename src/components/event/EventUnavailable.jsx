import { Lock } from 'lucide-react'

// Lien vers un événement que la personne ne peut pas voir : pas invitée, ou
// événement supprimé (impossible à distinguer, la base cache les deux).
export default function EventUnavailable({ onBack }) {
  return (
    <div style={{ flex: 1, background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 28px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: '#F2F2F7', display: 'grid', placeItems: 'center', marginBottom: 18 }}>
        <Lock size={28} color="#8E8E93" strokeWidth={2} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1C1C1E', margin: '0 0 8px' }}>Tu n'as pas accès à cet événement</h1>
      <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.5, marginBottom: 24 }}>
        Tu n'y es pas invité, ou il a été supprimé. Demande le lien d'invitation à l'organisateur.
      </div>
      <button
        type="button"
        onClick={onBack}
        style={{ minHeight: 50, padding: '0 28px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Retour à l'accueil
      </button>
    </div>
  )
}
