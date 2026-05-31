import { useEffect, useState } from 'react'
import { Trash2, UserPlus, X } from 'lucide-react'
import { addCoOrganizer, getOrganizers, removeCoOrganizer } from '../lib/organizers'

const fontFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
const gradient = 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)'

function displayName(profile) {
  return profile?.first_name || profile?.name || profile?.username || profile?.email || 'Invité'
}

function avatarInitial(profile) {
  return displayName(profile).charAt(0).toUpperCase()
}

export default function CoOrganizers({ eventId, isOwner }) {
  const [organizers, setOrganizers] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')
  const [removingId, setRemovingId] = useState(null)

  async function refreshOrganizers() {
    if (!eventId) return
    setLoading(true)
    setListError('')
    try {
      setOrganizers(await getOrganizers(eventId))
    } catch (error) {
      setListError(error.message || 'Impossible de charger les organisateurs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshOrganizers()
  }, [eventId])

  async function handleAdd(e) {
    e.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || submitting) return

    setSubmitting(true)
    setModalError('')
    try {
      await addCoOrganizer(eventId, normalizedEmail)
      setEmail('')
      setModalOpen(false)
      await refreshOrganizers()
    } catch (error) {
      setModalError(error.message || 'Impossible d’ajouter ce co-organisateur')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemove(userId) {
    if (!userId || removingId) return
    setRemovingId(userId)
    setListError('')
    try {
      await removeCoOrganizer(eventId, userId)
      await refreshOrganizers()
    } catch (error) {
      setListError(error.message || 'Impossible de retirer ce co-organisateur')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <div style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', fontFamily }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1E' }}>Organisateurs</div>
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setModalError('')
                setModalOpen(true)
              }}
              style={{ border: 'none', borderRadius: 12, background: gradient, color: '#fff', padding: '8px 11px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}
            >
              <UserPlus size={15} strokeWidth={2} />
              Ajouter
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: '#8E8E93', padding: '6px 0' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {organizers.map(({ role, profile }) => {
              const isCoOrganizer = role === 'co_organizer'
              return (
                <div key={profile?.id || role} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName(profile)} style={{ width: 38, height: 38, borderRadius: 19, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: 19, background: '#FBBF9A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                      {avatarInitial(profile)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName(profile)}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '3px 9px', borderRadius: 20, background: isCoOrganizer ? '#F2F2F7' : gradient, color: isCoOrganizer ? '#8E8E93' : '#fff', fontSize: 11, fontWeight: 800 }}>
                      {isCoOrganizer ? 'Co-organisateur' : 'Organisateur'}
                    </div>
                  </div>
                  {isOwner && isCoOrganizer && (
                    <button
                      type="button"
                      aria-label="Supprimer le co-organisateur"
                      onClick={() => handleRemove(profile?.id)}
                      disabled={removingId === profile?.id}
                      style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: 'rgba(255,59,48,0.08)', color: '#FF3B30', display: 'grid', placeItems: 'center', cursor: removingId === profile?.id ? 'default' : 'pointer', opacity: removingId === profile?.id ? 0.55 : 1, flexShrink: 0 }}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {listError && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#FF3B30', fontWeight: 600 }}>{listError}</div>
        )}
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 20px', fontFamily }}>
          <form onSubmit={handleAdd} style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 20, padding: '18px 16px 16px', boxShadow: '0 -4px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#1C1C1E' }}>Ajouter un co-organisateur</div>
              <button type="button" onClick={() => setModalOpen(false)} style={{ width: 34, height: 34, borderRadius: 17, border: 'none', background: '#F2F2F7', color: '#8E8E93', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              autoFocus
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 12, padding: '12px 13px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box', marginBottom: 8 }}
            />
            {modalError && (
              <div style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, marginBottom: 10 }}>{modalError}</div>
            )}
            <button type="submit" disabled={submitting} style={{ width: '100%', border: 'none', borderRadius: 14, padding: '13px 14px', background: gradient, color: '#fff', fontSize: 15, fontWeight: 800, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Ajout…' : 'Confirmer'}
            </button>
          </form>
        </div>
      )}
    </>
  )
}
