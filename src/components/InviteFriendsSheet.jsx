import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AVATAR_COLORS = ['#e055aa', '#f5a623', '#34C759', '#007AFF', '#AF52DE', '#FF9500']
function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function InviteFriendsSheet({ eventId, onClose, onInvited }) {
  const [visible, setVisible] = useState(false)
  const [friends, setFriends] = useState([])
  const [invitations, setInvitations] = useState({})
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')

    const friendIds = (friendships ?? []).map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )

    let friendProfiles = []
    if (friendIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, name, email, avatar_url')
        .in('id', friendIds)
      friendProfiles = profiles ?? []
    }

    const { data: invites } = await supabase
      .from('invitations')
      .select('invited_email, status')
      .eq('event_id', eventId)
      .eq('invited_by', user.id)

    const inviteMap = {}
    ;(invites ?? []).forEach(inv => { inviteMap[inv.invited_email] = inv.status })

    setFriends(friendProfiles)
    setInvitations(inviteMap)
    setLoading(false)
  }

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  function toggleSelect(email) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  async function handleInvite() {
    if (selected.size === 0 || sending) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSending(false); return }

    const rows = [...selected].map(email => ({
      event_id: eventId,
      invited_email: email,
      invited_by: user.id,
      status: 'pending',
    }))

    const { error } = await supabase.from('invitations').insert(rows)

    if (!error) {
      const count = selected.size
      setVisible(false)
      setTimeout(() => { onClose(); onInvited?.(count) }, 280)
    }
    setSending(false)
  }

  const allAlreadyInvited = friends.length > 0 && friends.every(f => invitations[f.email])
  const canInvite = selected.size > 0

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 700,
        background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s ease',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Drag handle */}
        <div style={{ paddingTop: 12, display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, background: '#C7C7CC', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 12px', flexShrink: 0, borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E', textAlign: 'center' }}>
            Inviter des amis
          </div>
        </div>

        {/* Friend list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: 32 }}>
              Chargement…
            </div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: 32 }}>
              Aucun ami pour l'instant
            </div>
          ) : (
            friends.map(friend => {
              const status = invitations[friend.email]
              const isSelectable = !status
              const isSelected = selected.has(friend.email)
              const displayName = friend.first_name || friend.name || 'Ami'

              return (
                <div
                  key={friend.id}
                  onClick={() => isSelectable && toggleSelect(friend.email)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 0',
                    borderBottom: '0.5px solid rgba(0,0,0,0.07)',
                    cursor: isSelectable ? 'pointer' : 'default',
                  }}
                >
                  {friend.avatar_url ? (
                    <img
                      src={friend.avatar_url}
                      alt=""
                      style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: getAvatarColor(displayName),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1C1C1E' }}>
                    {displayName}
                  </div>

                  {status === 'pending' && (
                    <div style={{
                      background: '#F2F2F7', borderRadius: 20,
                      padding: '5px 12px', fontSize: 12, fontWeight: 600,
                      color: '#8E8E93', flexShrink: 0,
                    }}>
                      Invité
                    </div>
                  )}
                  {status === 'accepted' && (
                    <div style={{
                      background: 'rgba(52,199,89,0.12)', borderRadius: 20,
                      padding: '5px 12px', fontSize: 12, fontWeight: 600,
                      color: '#34C759', flexShrink: 0,
                    }}>
                      Confirmé ✓
                    </div>
                  )}
                  {status === 'declined' && (
                    <div style={{
                      background: 'rgba(255,59,48,0.10)', borderRadius: 20,
                      padding: '5px 12px', fontSize: 12, fontWeight: 600,
                      color: '#FF3B30', flexShrink: 0,
                    }}>
                      Décliné
                    </div>
                  )}
                  {!status && (
                    <div style={{
                      width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                      border: isSelected ? 'none' : '2px solid #E5E5EA',
                      background: isSelected ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}>
                      {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          {allAlreadyInvited && (
            <div style={{ textAlign: 'center', fontSize: 13, color: '#8E8E93', marginBottom: 10 }}>
              Tous tes amis sont déjà invités
            </div>
          )}
          <div
            onClick={handleInvite}
            style={{
              padding: '15px', borderRadius: 14, textAlign: 'center',
              fontSize: 15, fontWeight: 700,
              background: canInvite ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
              color: canInvite ? '#fff' : '#8E8E93',
              cursor: (canInvite && !sending) ? 'pointer' : 'default',
              opacity: sending ? 0.6 : 1,
              boxShadow: canInvite ? '0 4px 16px rgba(224,85,170,0.28)' : 'none',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
            }}
          >
            {sending ? '…' : selected.size > 0 ? `Inviter (${selected.size})` : 'Inviter'}
          </div>
        </div>
      </div>
    </div>
  )
}
