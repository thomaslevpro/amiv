import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

const COLORS = {
  page: '#FFFFFF',
  card: '#fff',
  text: '#1C1C1E',
  secondary: '#8E8E93',
  gradient: 'linear-gradient(135deg,#e055aa,#f5a623)',
}

function getDisplayName(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim() || 'Profil Amiv'
}

function getInitials(profile) {
  const parts = [profile?.first_name, profile?.name].filter(Boolean)
  const source = parts.length ? parts : ['A']
  return source.slice(0, 2).map(part => part.trim().charAt(0).toUpperCase()).join('')
}

function Toast({ message }) {
  if (!message) return null
  return (
    <div style={{ position: 'fixed', bottom: 34, left: '50%', transform: 'translateX(-50%)', background: COLORS.text, color: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 700, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', whiteSpace: 'nowrap' }}>
      {message}
    </div>
  )
}

export default function PublicUserProfile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [profile, setProfile] = useState(null)
  const [friendship, setFriendship] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const [{ data: authData }, profileRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from('profiles')
          .select('id, first_name, name, avatar_url, username')
          .eq('username', username)
          .not('username', 'is', null)
          .maybeSingle(),
      ])

      if (cancelled) return
      const currentSession = authData?.session ?? null
      setSession(currentSession)

      if (profileRes.error) {
        setError('Impossible de charger ce profil.')
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(profileRes.data ?? null)

      if (currentSession?.user?.id && profileRes.data?.id && currentSession.user.id !== profileRes.data.id) {
        const [friendshipRes, currentProfileRes] = await Promise.all([
          supabase
            .from('friendships')
            .select('id, status, requester_id, addressee_id')
            .or(`and(requester_id.eq.${currentSession.user.id},addressee_id.eq.${profileRes.data.id}),and(requester_id.eq.${profileRes.data.id},addressee_id.eq.${currentSession.user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('first_name, name')
            .eq('id', currentSession.user.id)
            .maybeSingle(),
        ])
        if (!cancelled) {
          setFriendship(friendshipRes.data ?? null)
          setCurrentProfile(currentProfileRes.data ?? null)
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [username])

  const buttonState = useMemo(() => {
    if (!session) return { label: 'Rejoindre Amiv', disabled: false, mode: 'register' }
    if (session.user.id === profile?.id) return { label: 'C’est ton profil', disabled: true }
    if (friendship?.status === 'accepted') return { label: 'Déjà amis 🎉', disabled: true }
    if (friendship?.status === 'pending') return { label: 'Demande en attente', disabled: true }
    return { label: 'Ajouter en ami', disabled: false, mode: 'add' }
  }, [friendship, profile?.id, session])

  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  async function handleAction() {
    if (!profile) return
    const redirect = `/u/${profile.username}`
    if (!session) {
      navigate(`/register?redirect=${encodeURIComponent(redirect)}`)
      return
    }

    setSending(true)
    try {
      const { data, error: friendshipError } = await supabase
        .from('friendships')
        .insert({
          requester_id: session.user.id,
          addressee_id: profile.id,
          status: 'pending',
        })
        .select('id, status, requester_id, addressee_id')
        .single()

      if (friendshipError) throw friendshipError

      const requesterFirstName = currentProfile?.first_name || currentProfile?.name || session.user.user_metadata?.first_name || 'Quelqu’un'
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'friend_request',
        title: "Nouvelle demande d'ami",
        body: `${requesterFirstName} veut t'ajouter`,
        data: { requester_id: session.user.id, sender_id: session.user.id, friendship_id: data.id },
      })

      setFriendship(data)
      showToast(`Demande envoyée à ${profile.first_name || 'ton amiv'}`)
    } catch (err) {
      setError(err.message ?? 'Impossible d’envoyer la demande.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: COLORS.page, display: 'flex', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', background: COLORS.page, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: COLORS.gradient, padding: '74px 20px 88px', color: '#fff', textAlign: 'center', borderRadius: '0 0 28px 28px' }}>
          <div style={{ width: 106, height: 106, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(255,255,255,0.25)', border: '3px solid rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={getDisplayName(profile)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 36, fontWeight: 900 }}>{loading ? '' : getInitials(profile)}</span>
            }
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{loading ? 'Amiv' : getDisplayName(profile)}</div>
          {profile?.username && <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>amiv.app/u/{profile.username}</div>}
        </div>

        <div style={{ padding: '0 18px', marginTop: -44 }}>
          <div style={{ background: COLORS.card, borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,0.10)', padding: 18, textAlign: 'center' }}>
            {error && <div style={{ color: '#FF3B30', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>}
            {!loading && !profile && (
              <div style={{ color: COLORS.text, fontSize: 16, fontWeight: 800 }}>Profil introuvable</div>
            )}
            {profile && (
              <>
                <div style={{ color: COLORS.secondary, fontSize: 13, lineHeight: 1.45, marginBottom: 16 }}>
                  Ajoute {profile.first_name || 'cette personne'} pour organiser vos anniversaires et événements ensemble.
                </div>
                <button
                  type="button"
                  disabled={buttonState.disabled || sending}
                  onClick={handleAction}
                  style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', background: buttonState.disabled ? '#F5F5F5' : COLORS.gradient, color: buttonState.disabled ? COLORS.secondary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 16, fontWeight: 800, cursor: buttonState.disabled || sending ? 'default' : 'pointer', boxShadow: buttonState.disabled ? 'none' : '0 4px 18px rgba(224,85,170,0.30)', fontFamily: 'inherit' }}
                >
                  {!buttonState.disabled && <UserPlus size={18} strokeWidth={2.2} />}
                  <span>{sending ? 'Envoi...' : buttonState.label}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <Toast message={toast} />
    </div>
  )
}
