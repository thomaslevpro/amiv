import { useEffect, useMemo, useState } from 'react'
import { QrCode, Search, Share2, X } from 'lucide-react'
import { acceptFriendRequest, declineFriendRequest, dismissFriendSuggestion, getFriendSuggestions, getPendingRequests, searchPeople, sendFriendRequest } from '../../lib/friendships'
import { supabase } from '../../lib/supabase'
import AmivQrModal from '../profile/AmivQrModal'
import { BG, BLACK, FONT, GRADIENT, GRAY1, WHITE } from './constants'
import { Avatar } from './MessageUI'

function requestName(request) {
  return request.requester_first_name || request.requester_name || request.friend_name || request.name || 'Utilisateur'
}

function requestAvatar(request) {
  return request.requester_avatar || request.requester_avatar_url || request.friend_avatar || request.avatar_url || ''
}

function requestId(request) {
  return request.friendship_id || request.id
}

const sectionTitleStyle = { fontSize: 11, fontWeight: 700, color: GRAY1, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 }
const separator = <div style={{ marginLeft: 56, height: 0.5, background: 'rgba(0,0,0,0.08)' }} />

// person : { user_id, name, username, avatar_url, reason? }
// status : 'add' | 'sent' | 'friend'
function PersonRow({ person, status, busy, onAdd, onDismiss }) {
  const title = person.name || `@${person.username}`
  const buttonLabel = status === 'friend' ? 'Ami' : status === 'sent' ? 'Demande envoyée' : 'Ajouter'
  const isAdd = status === 'add'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <Avatar name={person.name || person.username} url={person.avatar_url} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 650, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {person.name && person.username && (
          <div style={{ marginTop: 2, fontSize: 13, color: GRAY1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{person.username}</div>
        )}
        {person.reason && (
          <div style={{ marginTop: 2, fontSize: 12, color: GRAY1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.reason}</div>
        )}
      </div>
      <button
        type="button"
        disabled={!isAdd || busy}
        onClick={onAdd}
        style={{
          border: 'none',
          background: isAdd ? GRADIENT : BG,
          color: isAdd ? WHITE : GRAY1,
          borderRadius: 12,
          padding: '9px 12px',
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          cursor: isAdd && !busy ? 'pointer' : 'default',
          opacity: busy ? 0.7 : 1,
          fontFamily: FONT,
        }}
      >
        {buttonLabel}
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Masquer ${title}`}
          style={{ width: 28, height: 28, marginLeft: -4, border: 'none', background: 'transparent', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AEAEB2', flexShrink: 0, cursor: 'pointer', padding: 0 }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

export default function FriendSearchSheet({ onClose, currentUserId, onFriendAdded }) {
  const [pendingRequests, setPendingRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [sentIds, setSentIds] = useState(() => new Set())
  const [busyRequestIds, setBusyRequestIds] = useState(() => new Set())
  const [busyUserIds, setBusyUserIds] = useState(() => new Set())
  const [myUsername, setMyUsername] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const trimmedQuery = query.trim()
  const hasSearch = trimmedQuery.length >= 2
  const inviteLink = myUsername ? `https://amiv.app/u/${myUsername}` : 'https://amiv.app'

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!currentUserId) return
      setRequestsLoading(true)
      setSuggestionsLoading(true)
      const [requestsRes, suggestionsRes, profileRes] = await Promise.all([
        getPendingRequests(currentUserId),
        getFriendSuggestions(currentUserId),
        supabase.from('profiles').select('username').eq('id', currentUserId).maybeSingle(),
      ])
      if (cancelled) return
      setPendingRequests(requestsRes.error ? [] : requestsRes.data ?? [])
      setRequestsLoading(false)
      setSuggestions(suggestionsRes.error ? [] : suggestionsRes.data ?? [])
      setSuggestionsLoading(false)
      setMyUsername(profileRes.data?.username || null)
    }

    load()
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
      const { data, error } = await searchPeople(trimmedQuery)
      if (!cancelled) {
        setResults(error ? [] : data ?? [])
        setSearchLoading(false)
      }
    }, 250)

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

  async function addFriend(userId) {
    if (!userId || sentIds.has(userId) || busyUserIds.has(userId)) return
    setUserBusy(userId, true)
    const { error } = await sendFriendRequest(currentUserId, userId)
    setUserBusy(userId, false)
    if (error) {
      console.error('[FriendSearch] friend request failed:', error)
      return
    }
    setSentIds(prev => new Set([...prev, userId]))
  }

  async function dismissSuggestion(person) {
    setSuggestions(prev => prev.filter(s => s.user_id !== person.user_id))
    const { error } = await dismissFriendSuggestion(person.user_id)
    if (error) {
      console.error('[FriendSearch] dismiss suggestion failed:', error)
      setSuggestions(prev => prev.some(s => s.user_id === person.user_id) ? prev : [...prev, person])
    }
  }

  async function shareInviteLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Rejoins-moi sur Amiv', url: inviteLink })
      } catch {
        // Partage annulé.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
    } catch {
      setShowQr(true)
    }
  }

  function personStatus(person) {
    if (person.is_friend) return 'friend'
    return sentIds.has(person.user_id) ? 'sent' : 'add'
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: WHITE,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        fontFamily: FONT,
      }}
    >
      <div style={{ padding: '14px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 800, color: BLACK }}>Ajouter un ami</div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={17} strokeWidth={2.2} color={BLACK} />
          </button>
        </div>
        <div style={{ height: 44, borderRadius: 14, background: BG, display: 'flex', alignItems: 'center', gap: 9, padding: '0 13px' }}>
          <Search size={17} strokeWidth={2.2} color={GRAY1} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nom ou pseudo"
            aria-label="Rechercher un nom ou un pseudo"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: BLACK, fontFamily: FONT }}
          />
          {query && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => setQuery('')}
              style={{ width: 22, height: 22, border: 'none', borderRadius: '50%', background: '#C7C7CC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', flexShrink: 0 }}
            >
              <X size={13} strokeWidth={2.6} color={WHITE} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px max(24px, env(safe-area-inset-bottom))' }}>
        {hasSearch ? (
          <section>
            {searchLoading ? (
              <div style={{ padding: '14px 0', color: GRAY1, fontSize: 14 }}>Recherche...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: '14px 0', color: GRAY1, fontSize: 14 }}>Aucun résultat</div>
            ) : results.map((person, index) => (
              <div key={person.user_id}>
                <PersonRow
                  person={person}
                  status={personStatus(person)}
                  busy={busyUserIds.has(person.user_id)}
                  onAdd={() => addFriend(person.user_id)}
                />
                {index !== results.length - 1 && separator}
              </div>
            ))}
          </section>
        ) : (
          <>
            {!requestsLoading && pendingVisible.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <div style={sectionTitleStyle}>Demandes reçues</div>
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
                      {index !== pendingVisible.length - 1 && separator}
                    </div>
                  )
                })}
              </section>
            )}

            <section>
              <div style={sectionTitleStyle}>Suggestions</div>
              {suggestionsLoading ? (
                <div style={{ padding: '14px 0', color: GRAY1, fontSize: 14 }}>Chargement...</div>
              ) : suggestions.length === 0 ? (
                <div style={{ padding: '18px 0 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 650, color: BLACK }}>Pas encore de suggestions</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: GRAY1, lineHeight: 1.4 }}>
                    Invite tes amis à rejoindre Amiv avec ton lien ou ton QR code.
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={shareInviteLink}
                      style={{ border: 'none', background: GRADIENT, color: WHITE, borderRadius: 14, padding: '11px 16px', fontSize: 14, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: FONT }}
                    >
                      <Share2 size={16} strokeWidth={2.2} />
                      {linkCopied ? 'Lien copié ✓' : 'Partager mon lien'}
                    </button>
                    {myUsername && (
                      <button
                        type="button"
                        onClick={() => setShowQr(true)}
                        style={{ border: 'none', background: BG, color: BLACK, borderRadius: 14, padding: '11px 16px', fontSize: 14, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: FONT }}
                      >
                        <QrCode size={16} strokeWidth={2.2} />
                        Mon QR code
                      </button>
                    )}
                  </div>
                </div>
              ) : suggestions.map((person, index) => (
                <div key={person.user_id}>
                  <PersonRow
                    person={person}
                    status={personStatus(person)}
                    busy={busyUserIds.has(person.user_id)}
                    onAdd={() => addFriend(person.user_id)}
                    onDismiss={() => dismissSuggestion(person)}
                  />
                  {index !== suggestions.length - 1 && separator}
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      <AmivQrModal isOpen={showQr} link={inviteLink} onClose={() => setShowQr(false)} />
    </div>
  )
}
