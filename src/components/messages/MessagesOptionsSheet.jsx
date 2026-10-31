import { Ban, Bell, CheckCheck } from 'lucide-react'
import { BottomSheet } from '../safety/SafetySheets'
import { BLACK, FONT, GRAY1, WHITE } from './constants'

// Menu « ··· » de l'écran Messages
export default function MessagesOptionsSheet({ hasUnread, onMarkAllRead, onOpenBlockedUsers, onOpenNotificationSettings, onClose }) {
  const rows = [
    { key: 'read', label: 'Tout marquer comme lu', icon: CheckCheck, disabled: !hasUnread, onClick: onMarkAllRead },
    { key: 'blocked', label: 'Utilisateurs bloqués', icon: Ban, onClick: onOpenBlockedUsers },
    { key: 'notifications', label: 'Notifications des messages', icon: Bell, onClick: onOpenNotificationSettings },
  ]

  return (
    <BottomSheet title="Options" onClose={onClose}>
      <div style={{ background: WHITE, borderRadius: 16, overflow: 'hidden' }}>
        {rows.map(({ key, label, icon: Icon, disabled, onClick }, index) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => { onClose(); onClick?.() }}
            style={{ width: '100%', border: 'none', borderTop: index ? '0.5px solid rgba(0,0,0,0.07)' : 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', fontSize: 15, color: disabled ? GRAY1 : BLACK, opacity: disabled ? 0.55 : 1, fontWeight: 700, fontFamily: FONT, cursor: disabled ? 'default' : 'pointer', textAlign: 'left' }}
          >
            <Icon size={18} strokeWidth={1.8} color={GRAY1} />
            {label}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
