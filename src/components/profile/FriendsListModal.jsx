import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../messages/MessageUI'

dayjs.locale('fr')

const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'
const TEXT = '#1C1C1E'
const SECONDARY = '#8E8E93'
const CARD = '#FFFFFF'
const PAGE = '#F2F2F7'
const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
const CARD_SHADOW = '0 1px 8px rgba(0,0,0,0.07)'

function getDisplayName(p) {
  return [p?.first_name, p?.name].filter(Boolean).join(' ').trim() || '—'
}

async function loadFriends(currentUserId) {
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, is_close_friend')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
    .eq('status', 'accepted')

  if (error) throw error
  if (!rows?.length) return []

  const friendIds = rows.map(r =>
    r.requester_id === currentUserId ? r.addressee_id : r.requester_id
  )

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, name, avatar_url, birthday')
    .in('id', friendIds)

  if (profilesError) throw profilesError

  const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  return rows.map(r => {
    const friendId = r.requester_id === currentUserId ? r.addressee_id : r.requester_id
    const p = byId[friendId] ?? {}
    return {
      friendshipId: r.id,
      isCloseFriend: r.is_close_friend ?? false,
      name: getDisplayName(p),
      avatarUrl: p.avatar_url ?? null,
      birthday: p.birthday ?? null,
    }
  })
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: SECONDARY,
      fontWeight: 700,
      marginBottom: 10,
      padding: '0 2px',
    }}>
      {children}
    </div>
  )
}

function FriendRow({ friend, onToggle, isLast }) {
  const birthdayLabel = friend.birthday
    ? dayjs(friend.birthday).format('D MMMM YYYY')
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderBottom: isLast ? 'none' : '0.5px solid rgba(0,0,0,0.07)',
    }}>
      <Avatar name={friend.name} url={friend.avatarUrl} size={44} isCloseFriend={friend.isCloseFriend} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {friend.name}
        </div>
        {birthdayLabel && (
          <div style={{ fontSize: 12, color: SECONDARY, marginTop: 2 }}>🎂 {birthdayLabel}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onToggle(friend.friendshipId)}
        title={friend.isCloseFriend ? 'Retirer des amis proches' : 'Ajouter aux amis proches'}
        style={{
          flexShrink: 0,
          border: 'none',
          borderRadius: 10,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: FONT,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: friend.isCloseFriend ? GRADIENT : PAGE,
          color: friend.isCloseFriend ? '#fff' : SECONDARY,
          transition: 'opacity 0.15s',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>★</span>
        Proche
      </button>
    </div>
  )
}

function FriendSection({ title, friends, onToggle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ background: CARD, borderRadius: 20, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
        {friends.map((f, i) => (
          <FriendRow
            key={f.friendshipId}
            friend={f}
            onToggle={onToggle}
            isLast={i === friends.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

export default function FriendsListModal({ isOpen, onClose, currentUserId }) {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !currentUserId) return
    let cancelled = false

    setLoading(true)
    loadFriends(currentUserId)
      .then(data => { if (!cancelled) setFriends(data) })
      .catch(err => console.error('FriendsListModal load failed', err))
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [isOpen, currentUserId])

  const toggleCloseFriend = friendshipId => {
    setFriends(prev => prev.map(f => {
      if (f.friendshipId !== friendshipId) return f
      const next = !f.isCloseFriend
      supabase
        .from('friendships')
        .update({ is_close_friend: next })
        .eq('id', friendshipId)
        .then(({ error }) => { if (error) console.error('toggle close friend failed', error) })
      return { ...f, isCloseFriend: next }
    }))
  }

  if (!isOpen) return null

  const closeFriends = friends.filter(f => f.isCloseFriend)
  const regularFriends = friends.filter(f => !f.isCloseFriend)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 760,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          background: PAGE,
          borderRadius: '22px 22px 0 0',
          padding: '18px 0 max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.18)',
          boxSizing: 'border-box',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, flexShrink: 0 }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: '#D1D1D6' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0, padding: '0 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: TEXT }}>
            Mes amis{!loading ? ` (${friends.length})` : ''}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E5EA', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: SECONDARY, fontSize: 14 }}>
              Chargement…
            </div>
          ) : friends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Vous n'avez pas encore d'amis</div>
              <div style={{ fontSize: 13, color: SECONDARY }}>Invitez des amis pour commencer !</div>
            </div>
          ) : (
            <>
              {closeFriends.length > 0 && (
                <FriendSection title="⭐ Amis proches" friends={closeFriends} onToggle={toggleCloseFriend} />
              )}
              {regularFriends.length > 0 && (
                <FriendSection title="Tous les amis" friends={regularFriends} onToggle={toggleCloseFriend} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
