import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { fetchBlockedUsers, unblockUser } from '../lib/safety'
import { BottomSheet, SheetButton } from '../components/safety/SafetySheets'
import { Avatar } from '../components/messages/MessageUI'

const TEXT = '#1C1C1E'
const SECONDARY = '#8E8E93'
const CARD = '#FFFFFF'
const PAGE = '#F5F5F5'
const DESTRUCTIVE = '#FF3B30'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

function getDisplayName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim() || profile?.username || 'Utilisateur'
}

// Personnes que j'ai bloquées (Messages → ··· et Profil → Utilisateurs bloqués)
export default function BlockedUsersScreen({ onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmUser, setConfirmUser] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchBlockedUsers()
      .then(data => { if (!cancelled) setUsers(data) })
      .catch(err => {
        console.error('BlockedUsersScreen load failed', err)
        if (!cancelled) setError('Impossible de charger la liste.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleUnblock() {
    if (!confirmUser || busy) return
    setBusy(true)
    setError(null)
    try {
      await unblockUser(confirmUser.id)
      setUsers(prev => prev.filter(user => user.id !== confirmUser.id))
      setConfirmUser(null)
    } catch {
      setError('Impossible de débloquer pour le moment.')
    } finally {
      setBusy(false)
    }
  }

  const confirmName = confirmUser ? getDisplayName(confirmUser.profile) : ''

  return (
    <div style={{ flex: 1, background: PAGE, overflowY: 'auto', padding: '14px 16px 30px', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: CARD, color: TEXT, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <ArrowLeft size={20} strokeWidth={2.4} />
        </button>
        <div style={{ color: TEXT, fontSize: 24, fontWeight: 900, letterSpacing: '-0.2px' }}>Utilisateurs bloqués</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: SECONDARY, fontSize: 14 }}>Chargement…</div>
      ) : users.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '60px 12px', color: SECONDARY, fontSize: 14, lineHeight: 1.45 }}>
          Tu n'as bloqué personne
        </div>
      ) : users.length > 0 && (
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
                  onClick={() => { setError(null); setConfirmUser(user) }}
                  style={{ border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, background: '#F2F2F7', color: TEXT, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}
                >
                  Débloquer
                </button>
              </div>
            )
          })}
        </div>
      )}
      {error && !confirmUser && <div style={{ color: DESTRUCTIVE, fontSize: 13, fontWeight: 700, marginTop: 10, padding: '0 4px' }}>{error}</div>}

      {confirmUser && (
        <BottomSheet title={`Débloquer ${confirmName} ?`} onClose={() => { if (!busy) setConfirmUser(null) }}>
          <div style={{ fontSize: 14, color: SECONDARY, lineHeight: 1.5, padding: '0 4px 18px' }}>
            {confirmName} pourra de nouveau t'envoyer des messages privés, des demandes d'ami et t'inviter à des événements. Ses messages réapparaîtront dans les discussions d'événement.
          </div>
          {error && <div style={{ color: DESTRUCTIVE, fontSize: 13, fontWeight: 700, marginBottom: 10, padding: '0 4px' }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SheetButton onClick={handleUnblock} disabled={busy}>{busy ? 'Déblocage…' : 'Débloquer'}</SheetButton>
            <SheetButton variant="neutral" onClick={() => setConfirmUser(null)} disabled={busy}>Annuler</SheetButton>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
