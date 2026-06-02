import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BG, BLACK, FONT, GRAY1, WHITE } from './constants'
import { CloseFriendBadge } from './MessageUI'

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'

function getInitials(firstName, lastName, fallbackName) {
  const parts = [firstName, lastName].filter(Boolean)
  const source = parts.length ? parts.join(' ') : fallbackName
  return (source || 'Ami')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}

function getDisplayName(profile, friend) {
  const fullName = [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim()
  return fullName || friend?.friend_name || friend?.full_name || friend?.name || 'Ami'
}

function getFriendId(friend) {
  return friend?.friend_id || friend?.id || friend?.user_id || null
}

function getFriendAvatar(profile, friend) {
  return profile?.avatar_url || friend?.friend_avatar || friend?.avatar_url || ''
}

function notifyCloseFriendChange(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('amiv:close-friend-updated', { detail }))
}

function formatBirthday(birthday) {
  if (!birthday) return 'Non renseigné'
  const date = new Date(`${birthday}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'Non renseigné'
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function Avatar({ profile, friend, size = 84, isCloseFriend = false }) {
  const name = getDisplayName(profile, friend)
  const avatarUrl = getFriendAvatar(profile, friend)

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: GRADIENT,
      color: WHITE,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 26,
      fontWeight: 850,
      flexShrink: 0,
      boxShadow: '0 8px 22px rgba(224,85,170,0.20)',
      position: 'relative',
    }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      ) : (
        getInitials(profile?.first_name, profile?.name, name)
      )}
      {isCloseFriend && <CloseFriendBadge size={20} />}
    </div>
  )
}

export default function DirectFriendProfileSheet({ friend, currentUserId, onClose, onCloseFriendChange }) {
  const [visible, setVisible] = useState(false)
  const [profile, setProfile] = useState(null)
  const [friendship, setFriendship] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const friendId = getFriendId(friend)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!friendId || !currentUserId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')
      const [profileRes, friendshipRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, name, avatar_url, birthday')
          .eq('id', friendId)
          .maybeSingle(),
        supabase
          .from('friendships')
          .select('id, requester_id, addressee_id, is_close_friend')
          .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${friendId}),and(addressee_id.eq.${currentUserId},requester_id.eq.${friendId})`)
          .eq('status', 'accepted')
          .maybeSingle(),
      ])

      if (cancelled) return
      if (profileRes.error || friendshipRes.error) {
        console.error('[DirectFriendProfileSheet] load error:', profileRes.error || friendshipRes.error)
        setErrorMessage('Impossible de charger ce profil.')
      }
      setProfile(profileRes.data ?? null)
      setFriendship(friendshipRes.data ?? null)
      setLoading(false)
    }

    loadProfile()
    return () => { cancelled = true }
  }, [currentUserId, friendId])

  const displayName = useMemo(() => getDisplayName(profile, friend), [profile, friend])
  const birthdayText = formatBirthday(profile?.birthday)
  const isCloseFriend = friendship?.is_close_friend === true

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  async function toggleCloseFriend() {
    if (!friendship?.id || updating) return
    const previous = friendship
    const nextValue = !isCloseFriend

    setFriendship({ ...friendship, is_close_friend: nextValue })
    onCloseFriendChange?.(nextValue)
    notifyCloseFriendChange({ friendId, friendshipId: friendship.id, isCloseFriend: nextValue })
    setUpdating(true)
    setErrorMessage('')

    const { error } = await supabase
      .from('friendships')
      .update({ is_close_friend: nextValue })
      .eq('id', friendship.id)

    if (error) {
      console.error('[DirectFriendProfileSheet] toggle close friend error:', error)
      setFriendship(previous)
      onCloseFriendChange?.(previous.is_close_friend === true)
      notifyCloseFriendChange({ friendId, friendshipId: previous.id, isCloseFriend: previous.is_close_friend === true })
      setErrorMessage('Impossible de mettre à jour Ami proche.')
    }
    setUpdating(false)
  }

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 700,
        background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s ease',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        fontFamily: FONT,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: BG,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.16)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          padding: '12px 16px max(24px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 36, height: 4, background: '#C7C7CC', borderRadius: 2 }} />
        </div>

        <div style={{
          background: WHITE,
          borderRadius: 18,
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
          padding: 18,
          position: 'relative',
        }}>
          <button
            type="button"
            aria-label="Fermer"
            onClick={dismiss}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={17} strokeWidth={2.2} color={BLACK} />
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
            <Avatar profile={profile} friend={friend} isCloseFriend={isCloseFriend} />
            <div style={{ marginTop: 14, fontSize: 22, lineHeight: 1.2, fontWeight: 850, color: BLACK, textAlign: 'center' }}>
              {displayName}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: GRAY1, fontWeight: 600, textAlign: 'center' }}>
              {loading ? 'Chargement...' : birthdayText}
            </div>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isCloseFriend}
          disabled={loading || !friendship || updating}
          onClick={toggleCloseFriend}
          style={{
            width: '100%',
            marginTop: 10,
            border: 'none',
            background: WHITE,
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: loading || !friendship || updating ? 'default' : 'pointer',
            opacity: loading || !friendship ? 0.7 : 1,
            fontFamily: FONT,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BLACK }}>Ami proche</div>
            <div style={{ marginTop: 3, fontSize: 12, color: GRAY1, fontWeight: 500 }}>
              Voit tes dispos privées
            </div>
          </div>
          <div style={{
            width: 46,
            height: 28,
            borderRadius: 999,
            flexShrink: 0,
            background: isCloseFriend ? GRADIENT : '#E5E5EA',
            position: 'relative',
            transition: 'background 0.18s ease',
          }}>
            <div style={{
              position: 'absolute',
              top: 3,
              left: isCloseFriend ? 21 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: WHITE,
              boxShadow: '0 1px 5px rgba(0,0,0,0.22)',
              transition: 'left 0.18s ease',
            }} />
          </div>
        </button>

        {errorMessage && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#FF3B30', fontWeight: 650, textAlign: 'center' }}>
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={dismiss}
          style={{
            width: '100%',
            marginTop: 10,
            height: 48,
            borderRadius: 14,
            border: 'none',
            background: WHITE,
            color: BLACK,
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: FONT,
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
