import { useEffect, useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { captureSupabaseError } from '../lib/monitoring'
import { fetchEventGuestList, guestDisplayName, sortableName } from '../lib/eventGuests'
import GuestAvatar from './event/GuestAvatar'
import GuestStatusPill from './event/GuestStatusPill'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'

function normalize(text) {
  return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Mes amis à cocher. L'organisateur (et moi) n'y figurent jamais ; les amis
// déjà invités sont grisés avec leur statut.
export default function InviteFriendsSheet({ eventId, onClose, onInvited }) {
  const [visible, setVisible] = useState(false)
  const [friends, setFriends] = useState([])
  const [statusByUserId, setStatusByUserId] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [friendshipsRes, eventRes, guests] = await Promise.all([
      supabase.from('friendships').select('requester_id, addressee_id').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted'),
      supabase.from('events').select('user_id').eq('id', eventId).maybeSingle(),
      fetchEventGuestList(eventId),
    ])

    const excluded = new Set([user.id, eventRes.data?.user_id].filter(Boolean))
    const friendIds = (friendshipsRes.data ?? [])
      .map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
      .filter(id => !excluded.has(id))

    let profiles = []
    if (friendIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, first_name, name, username, avatar_url').in('id', friendIds)
      profiles = (data ?? []).map(p => ({ ...p, displayName: guestDisplayName(p) }))
    }

    setStatusByUserId(Object.fromEntries((guests ?? []).filter(g => g.user_id).map(g => [g.user_id, g.status])))
    setFriends(profiles.sort((a, b) => sortableName(a.displayName).localeCompare(sortableName(b.displayName), 'fr', { sensitivity: 'base' })))
    setLoading(false)
  }

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  function toggleSelect(friendId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(friendId)) next.delete(friendId)
      else next.add(friendId)
      return next
    })
  }

  async function handleInvite() {
    if (selected.size === 0 || sending) return
    setSending(true)
    setError('')
    const ids = [...selected]
    const { error: rpcError } = await supabase.rpc('invite_friends_to_event', { p_event_id: eventId, p_user_ids: ids })
    setSending(false)
    if (rpcError) {
      captureSupabaseError(rpcError, { operation: 'invite_friends_to_event' })
      setError("L'invitation n'a pas pu être envoyée. Réessaie.")
      return
    }
    setVisible(false)
    setTimeout(() => { onClose(); onInvited?.(ids.length) }, 280)
  }

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return friends
    return friends.filter(f => normalize(`${f.displayName} ${f.username || ''} ${f.first_name || ''}`).includes(q))
  }, [friends, query])

  const allAlreadyInvited = friends.length > 0 && friends.every(f => statusByUserId[f.id])
  const canInvite = selected.size > 0 && !sending

  return (
    <div onClick={dismiss} style={{ position: 'fixed', inset: 0, zIndex: 700, background: visible ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)', transition: 'background 0.28s ease', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        role="dialog"
        aria-label="Inviter des amis"
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '20px 20px 0 0', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)', height: '85vh', maxHeight: 'calc(100vh - env(safe-area-inset-top) - 24px)', display: 'flex', flexDirection: 'column', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div style={{ paddingTop: 8, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 5, background: '#D1D1D6', borderRadius: 3 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 12px' }}>
          <button type="button" onClick={dismiss} style={{ border: 'none', background: 'none', padding: 0, fontSize: 15, color: '#8E8E93', cursor: 'pointer', width: 70, textAlign: 'left' }}>Annuler</button>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#1C1C1E', textAlign: 'center' }}>Inviter des amis</div>
          <div style={{ width: 70 }} />
        </div>

        <div style={{ padding: '0 16px 8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F2F2F7', borderRadius: 10, padding: '0 10px', height: 38 }}>
            <Search size={16} strokeWidth={2} color="#8E8E93" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un ami"
              aria-label="Rechercher un ami"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 16, color: '#1C1C1E' }}
            />
          </label>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: 32 }}>Chargement…</div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: 32 }}>Aucun ami pour l'instant</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: 32 }}>Aucun ami ne correspond à « {query.trim()} »</div>
          ) : (
            filtered.map((friend, index) => {
              const status = statusByUserId[friend.id]
              const isSelected = selected.has(friend.id)
              return (
                <div
                  key={friend.id}
                  role={status ? undefined : 'checkbox'}
                  aria-checked={status ? undefined : isSelected}
                  onClick={() => !status && toggleSelect(friend.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, cursor: status ? 'default' : 'pointer', opacity: status ? 0.5 : 1 }}
                >
                  <GuestAvatar name={friend.displayName} avatarUrl={friend.avatar_url} seed={friend.id} />
                  <div style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 10, borderTop: index > 0 ? '0.5px solid rgba(60,60,67,0.18)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friend.displayName}</div>
                      {friend.username && !friend.displayName.startsWith('@') && <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 1 }}>@{friend.username}</div>}
                    </div>
                    {status ? <GuestStatusPill status={status} /> : (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, border: isSelected ? 'none' : '1.5px solid #C7C7CC', background: isSelected ? GRADIENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <Check size={14} strokeWidth={3} color="#fff" />}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ padding: '12px 16px 0', borderTop: '0.5px solid rgba(60,60,67,0.12)' }}>
          {error && <div style={{ textAlign: 'center', fontSize: 13, color: '#FF3B30', marginBottom: 8 }}>{error}</div>}
          {allAlreadyInvited && !error && <div style={{ textAlign: 'center', fontSize: 13, color: '#8E8E93', marginBottom: 8 }}>Tous tes amis sont déjà invités</div>}
          <button
            type="button"
            onClick={handleInvite}
            disabled={!canInvite}
            style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, background: canInvite ? GRADIENT : '#F2F2F7', color: canInvite ? '#fff' : '#AEAEB2', cursor: canInvite ? 'pointer' : 'default', opacity: sending ? 0.6 : 1 }}
          >
            {sending ? 'Envoi…' : selected.size > 0 ? `Inviter (${selected.size})` : 'Inviter'}
          </button>
        </div>
      </div>
    </div>
  )
}
