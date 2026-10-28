import { useEffect, useState } from 'react'
import { fetchBlockedUsers, unblockUser } from '../../lib/safety'
import { BottomSheet } from '../safety/SafetySheets'
import { Avatar } from '../messages/MessageUI'

const TEXT = '#1C1C1E'
const SECONDARY = '#8E8E93'
const CARD = '#FFFFFF'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

function getDisplayName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim() || profile?.username || 'Utilisateur'
}

export default function BlockedUsersModal({ isOpen, onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchBlockedUsers()
      .then(data => { if (!cancelled) setUsers(data) })
      .catch(err => {
        console.error('BlockedUsersModal load failed', err)
        if (!cancelled) setError('Impossible de charger la liste.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen])

  async function handleUnblock(userId) {
    if (pendingId) return
    setPendingId(userId)
    try {
      await unblockUser(userId)
      setUsers(prev => prev.filter(user => user.id !== userId))
    } catch {
      setError('Impossible de débloquer pour le moment.')
    } finally {
      setPendingId(null)
    }
  }

  if (!isOpen) return null

  return (
    <BottomSheet title="Utilisateurs bloqués" onClose={onClose}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: SECONDARY, fontSize: 14 }}>Chargement…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 12px', color: SECONDARY, fontSize: 14, lineHeight: 1.45 }}>
          Tu n'as bloqué personne.
        </div>
      ) : (
        <div style={{ background: CARD, borderRadius: 16, overflow: 'hidden' }}>
          {users.map((user, index) => {
            const name = getDisplayName(user.profile)
            return (
              <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: index ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
                <Avatar name={name} url={user.profile?.avatar_url} size={40} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </div>
                <button
                  type="button"
                  onClick={() => handleUnblock(user.id)}
                  disabled={pendingId === user.id}
                  style={{ border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, background: '#F2F2F7', color: TEXT, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}
                >
                  {pendingId === user.id ? '…' : 'Débloquer'}
                </button>
              </div>
            )
          })}
        </div>
      )}
      {error && <div style={{ color: '#FF3B30', fontSize: 13, fontWeight: 700, marginTop: 10, padding: '0 4px' }}>{error}</div>}
    </BottomSheet>
  )
}
