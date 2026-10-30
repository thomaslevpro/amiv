import { ClipboardList, Lock, MessageCircle } from 'lucide-react'
import { SECRET_ACCENT, SECRET_ACCENT_SOFT } from '../../lib/secretSpace'

function Tile({ icon, label, badge, iconBg, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ position: 'relative', flex: '1 1 0', minWidth: 0, minHeight: 92, borderRadius: 16, border: 'none', background: '#F5F5F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 7, cursor: 'pointer', padding: '14px 6px 10px' }}>
      <span style={{ position: 'relative', width: 36, height: 36, borderRadius: 11, background: iconBg, display: 'grid', placeItems: 'center' }}>
        {icon}
        {badge > 0 && (
          <span aria-label={`${badge} nouveauté${badge > 1 ? 's' : ''}`} style={{ position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#FF3B30', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', boxSizing: 'border-box', border: '2px solid #F5F5F7' }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', lineHeight: 1.2, textAlign: 'center', maxWidth: '100%' }}>{label}</span>
    </button>
  )
}

// Tuiles d'accès rapide : seules les tuiles autorisées s'affichent et se
// partagent la largeur.
export default function EventQuickActions({ onChat, chatUnread, onSecretSpace, secretUnread, onOrganizerSpace }) {
  const tiles = [
    onChat && <Tile key="chat" label="Chat" badge={chatUnread} iconBg="rgba(224,85,170,0.12)" icon={<MessageCircle size={19} strokeWidth={2} color="#e055aa" />} onClick={onChat} />,
    onSecretSpace && <Tile key="secret" label="Espace secret" badge={secretUnread} iconBg={SECRET_ACCENT_SOFT} icon={<Lock size={18} strokeWidth={2.2} color={SECRET_ACCENT} />} onClick={onSecretSpace} />,
    onOrganizerSpace && <Tile key="organizer" label="Espace organisateur" iconBg="rgba(0,122,255,0.10)" icon={<ClipboardList size={19} strokeWidth={2} color="#007AFF" />} onClick={onOrganizerSpace} />,
  ].filter(Boolean)

  if (tiles.length === 0) return null
  return <div style={{ display: 'flex', gap: 8 }}>{tiles}</div>
}
