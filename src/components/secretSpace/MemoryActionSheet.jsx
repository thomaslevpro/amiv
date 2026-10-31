import { useState } from 'react'

// Actions sur son propre souvenir (même feuille que les actions d'un invité) :
// Remplacer, ou Supprimer après confirmation.
const SEPARATOR = '0.5px solid rgba(60,60,67,0.18)'

export default function MemoryActionSheet({ busy, onReplace, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const buttonStyle = { width: '100%', minHeight: 56, border: 'none', background: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

  return (
    <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 8px max(8px, env(safe-area-inset-bottom))' }}>
      <div role="dialog" aria-label={confirmDelete ? 'Supprimer ce souvenir ?' : 'Actions du souvenir'} onClick={e => e.stopPropagation()} style={{ maxWidth: 430, width: '100%', margin: '0 auto' }}>
        <div style={{ borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          {/* Clés distinctes : les boutons ne sont pas réutilisés d'une étape à l'autre */}
          {confirmDelete ? (
            <div key="confirm">
              <div style={{ padding: '14px 16px', textAlign: 'center', borderBottom: SEPARATOR }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>Supprimer ce souvenir ?</div>
                <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>Cette action est définitive.</div>
              </div>
              <button type="button" disabled={busy} onClick={onDelete} style={{ ...buttonStyle, color: '#FF3B30', fontWeight: 600 }}>
                {busy ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          ) : (
            <div key="actions">
              <div style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: '#8E8E93', borderBottom: SEPARATOR }}>
                Ton souvenir · visible par toi seul jusqu’à la révélation
              </div>
              <button type="button" onClick={onReplace} style={{ ...buttonStyle, color: '#007AFF', borderBottom: SEPARATOR }}>
                Remplacer
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...buttonStyle, color: '#FF3B30' }}>
                Supprimer
              </button>
            </div>
          )}
        </div>
        <button type="button" disabled={busy} onClick={onClose} style={{ ...buttonStyle, marginTop: 8, borderRadius: 14, fontWeight: 600, color: '#007AFF' }}>Annuler</button>
      </div>
    </div>
  )
}
