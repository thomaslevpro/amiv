import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { acceptFriendRequest, cancelFriendRequest, declineFriendRequest, getPendingRequests, searchUsers, sendFriendRequest } from '../../lib/friendships'
import { BG, BLACK, FONT, GRADIENT, GRAY1, GRAY2, WHITE } from './constants'
import { Avatar } from './MessageUI'

function displayName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim() || profile?.username || 'Utilisateur'
}

function requestName(request) {
  return request.requester_first_name || request.requester_name || request.friend_name || request.name || 'Utilisateur'
}

function requestAvatar(request) {
  return request.requester_avatar || request.requester_avatar_url || request.friend_avatar || request.avatar_url || ''
}

function requestId(request) {
  return request.friendship_id || request.id
}

export default function FriendSearchSheet({ onClose, currentUserId, onFriendAdded }) {
  const [pendingRequests, setPendingRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [sentIds, setSentIds] = useState(() => new Set())
  const [busyRequestIds, setBusyRequestIds] = useState(() => new Set())
  const [busyUserIds, setBusyUserIds] = useState(() => new Set())

  const trimmedQuery = query.trim()
  const hasSearch = trimmedQuery.length >= 2

  useEffect(() => {
    let cancelled = false

    async function loadRequests() {
      if (!currentUserId) return
      setRequestsLoading(true)
      const { data, error } = await getPendingRequests(currentUserId)
      if (!cancelled) {
        setPendingRequests(error ? [] : data ?? [])
        setRequestsLoading(false)
      }
    }

    loadRequests()
    return () => { cancelled = true }
  }, [currentUserId])

  useEffect(() => {
    if (!hasSearch || !currentUserId) {
      setResults([])
      setSearchLoading(false)
      return undefined
    }

    let cancelled = false
    setSearchLoading(true)
    const timeout = window.setTimeout(async () => {
      const { data, error } = await searchUsers(trimmedQuery, currentUserId)
      if (!cancelled) {
        setResults(error ? [] : data ?? [])
        setSearchLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [currentUserId, hasSearch, trimmedQuery])

  const pendingVisible = useMemo(() => pendingRequests.filter(request => requestId(request)), [pendingRequests])

  function setRequestBusy(id, isBusy) {
    setBusyRequestIds(prev => {
      const next = new Set(prev)
      if (isBusy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function setUserBusy(id, isBusy) {
    setBusyUserIds(prev => {
      const next = new Set(prev)
      if (isBusy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function acceptRequest(request) {
    const id = requestId(request)
    if (!id || busyRequestIds.has(id)) return
    setRequestBusy(id, true)
    const { error } = await acceptFriendRequest(id)
    setRequestBusy(id, false)
    if (error) return
    setPendingRequests(prev => prev.filter(item => requestId(item) !== id))
    onFriendAdded?.()
  }

  async function declineRequest(request) {
    const id = requestId(request)
    if (!id || busyRequestIds.has(id)) return
    setRequestBusy(id, true)
    const { error } = await declineFriendRequest(id)
    setRequestBusy(id, false)
    if (error) return
    setPendingRequests(prev => prev.filter(item => requestId(item) !== id))
  }

  async function addFriend(profile) {
    if (!profile?.id || sentIds.has(profile.id) || busyUserIds.has(profile.id)) return
    setUserBusy(profile.id, true)
    const { error } = await sendFriendRequest(currentUserId, profile.id)
    setUserBusy(profile.id, false)
    if (error) return
    setSentIds(prev => new Set([...prev, profile.id]))
  }

  async function cancelRequest(profile) {
    if (!profile?.friendshipId || busyUserIds.has(profile.id)) return
    setUserBusy(profile.id, true)
    const { error } = await cancelFriendRequest(profile.friendshipId)
    setUserBusy(profile.id, false)
    if (error) return
    setSentIds(prev => { const next = new Set(prev); next.delete(profile.id); return next })
    setResults(prev => prev.map(p =>
      p.id === profile.id
        ? { ...p, status: undefined, friendshipId: undefined }
        : p
    ))
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(28,28,30,0.20)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 10000,
          width: '100%',
          maxHeight: '80vh',
          background: WHITE,
          borderRadius: '0 0 20px 20px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '8px 16px 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 3, background: GRAY2 }} />
        </div>
        <div style={{ padding: '10px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: BLACK }}>Ajouter un ami</div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={17} strokeWidth={2.2} color={BLACK} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 16px 24px' }}>
          {!requestsLoading && pendingVisible.length > 0 && (
            <section style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY1, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 }}>
                Demandes reçues
              </div>
              {pendingVisible.map((request, index) => {
                const id = requestId(request)
                const isBusy = busyRequestIds.has(id)
                const name = requestName(request)
                return (
                  <div key={id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                      <Avatar name={name} url={requestAvatar(request)} size={44} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 650, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => acceptRequest(request)}
                        style={{ border: 'none', background: GRADIENT, color: WHITE, borderRadius: 12, padding: '9px 12px', fontSize: 13, fontWeight: 600, cursor: isBusy ? 'default' : 'pointer', fontFamily: FONT, opacity: isBusy ? 0.7 : 1 }}
                      >
                        Accepter
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => declineRequest(request)}
                        style={{ border: 'none', background: BG, color: BLACK, borderRadius: 12, padding: '9px 12px', fontSize: 13, fontWeight: 600, cursor: isBusy ? 'default' : 'pointer', fontFamily: FONT, opacity: isBusy ? 0.7 : 1 }}
                      >
                        Refuser
                      </button>
                    </div>
                    {index !== pendingVisible.length - 1 && <div style={{ marginLeft: 56, height: 0.5, background: 'rgba(0,0,0,0.08)' }} />}
                  </div>
                )
              })}
            </section>
          )}

          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: GRAY1, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 }}>
              Recherche
            </div>
            <div style={{ height: 44, borderRadius: 14, background: BG, display: 'flex', alignItems: 'center', gap: 9, padding: '0 13px' }}>
              <Search size={17} strokeWidth={2.2} color={GRAY1} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Username ou email"
                autoFocus
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: BLACK, fontFamily: FONT }}
              />
            </div>

            {hasSearch && (
              <div style={{ marginTop: 12 }}>
                {searchLoading ? (
                  <div style={{ padding: '14px 0', color: GRAY1, fontSize: 14 }}>Recherche...</div>
                ) : results.length === 0 ? (
                  <div style={{ padding: '14px 0', color: GRAY1, fontSize: 14 }}>Aucun utilisateur trouvé</div>
                ) : results.map((profile, index) => {
                  const name = displayName(profile)
                  const isSent = sentIds.has(profile.id)
                  const isBusy = busyUserIds.has(profile.id)
                  const isPendingSent = profile.status === 'pending_sent' && !sentIds.has(profile.id)
                  return (
                    <div key={profile.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                        <Avatar name={name} url={profile.avatar_url} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 650, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          {profile.username && <div style={{ marginTop: 3, fontSize: 13, color: GRAY1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{profile.username}</div>}
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => isPendingSent ? cancelRequest(profile) : addFriend(profile)}
                          style={{
                            minWidth: 88,
                            border: 'none',
                            background: isPendingSent ? BG : isSent ? BG : GRADIENT,
                            color: isPendingSent ? '#FF3B30' : isSent ? GRAY1 : WHITE,
                            borderRadius: 12,
                            padding: '10px 12px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: (isSent || isBusy) ? 'default' : 'pointer',
                            fontFamily: FONT,
                          }}
                        >
                          {isPendingSent ? 'Annuler' : isSent ? 'Envoyé ✓' : 'Ajouter'}
                        </button>
                      </div>
                      {index !== results.length - 1 && <div style={{ marginLeft: 56, height: 0.5, background: 'rgba(0,0,0,0.08)' }} />}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
