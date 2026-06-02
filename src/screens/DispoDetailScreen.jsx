import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

const moodEmoji = {
  cafe: '☕',
  jeux: '🎲',
  diner: '🍽️',
  cine: '🎬',
  apero: '🍻',
  balade: '🚶',
}

function name(profile) {
  return [profile?.first_name, profile?.name].filter(Boolean).join(' ') || 'Ami'
}

function firstName(profile) {
  return profile?.first_name || profile?.name || 'Ami'
}

function initials(profile) {
  const first = profile?.first_name?.[0] ?? ''
  const last = profile?.name?.[0] ?? ''
  return `${first}${last || (!first ? 'A' : '')}`.toUpperCase()
}

function avatar(profile, size = 42) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.max(11, size * 0.34),
      fontWeight: 900,
      flexShrink: 0,
    }}>
      {initials(profile)}
    </div>
  )
}

function relativeTime(value) {
  const diffHours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000))
  if (diffHours < 1) return "à l'instant"
  if (diffHours < 24) return `il y a ${diffHours}h`
  return `il y a ${Math.floor(diffHours / 24)}j`
}

function dateLabel(value) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function DispoDetailScreen({ postId, currentUserId, onBack, onCreateEvent }) {
  const [post, setPost] = useState(null)
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState(null)

  const myResponse = useMemo(
    () => responses.find(response => response.user_id === currentUserId),
    [responses, currentUserId]
  )
  const goingCount = responses.filter(response => response.status === 'going').length
  const canConvert = post && goingCount >= 3 && !post.converted_event_id && currentUserId === post.user_id

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const postRes = await supabase
        .from('availability_posts')
        .select('*, profiles(first_name, name, avatar_url)')
        .eq('id', postId)
        .maybeSingle()

      if (postRes.error) throw postRes.error

      let responseRes = await supabase
        .from('availability_responses')
        .select('id, post_id, user_id, status, moods, created_at, profiles(first_name, name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (responseRes.error) {
        responseRes = await supabase
          .from('availability_responses')
          .select('id, post_id, user_id, status, moods, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: true })
      }
      if (responseRes.error) throw responseRes.error

      setPost(postRes.data)
      setResponses(responseRes.data ?? [])
    } catch (err) {
      console.error('[DispoDetail] load error:', err)
      setError(err.message || 'Impossible de charger cette dispo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (postId) load()
  }, [postId])

  async function updateResponse(status) {
    setResponding(true)
    setError(null)
    try {
      const { error: upsertError } = await supabase
        .from('availability_responses')
        .upsert(
          { post_id: postId, user_id: currentUserId, status, moods: post?.moods ?? [] },
          { onConflict: 'post_id,user_id' }
        )
      if (upsertError) throw upsertError
      await load()
    } catch (err) {
      console.error('[DispoDetail] response error:', err)
      setError(err.message || 'Impossible de répondre.')
    } finally {
      setResponding(false)
    }
  }

  if (loading) {
    return <div style={{ flex: 1, background: '#faf9fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E8E93', fontWeight: 800 }}>Chargement…</div>
  }

  if (!post) {
    return (
      <div style={{ flex: 1, background: '#faf9fb', padding: 16 }}>
        <BackRow onBack={onBack} title="Dispo" />
        <div style={{ color: '#8E8E93', fontWeight: 700 }}>{error || 'Dispo introuvable.'}</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, background: '#faf9fb', overflowY: 'auto', padding: '14px 16px 30px' }}>
      <BackRow onBack={onBack} title={`Dispo de ${firstName(post.profiles)}`} />

      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {avatar(post.profiles)}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#1C1C1E', fontSize: 16, fontWeight: 900 }}>{name(post.profiles)}</div>
            <div style={{ color: '#8E8E93', fontSize: 12, fontWeight: 700 }}>{relativeTime(post.created_at)}</div>
          </div>
        </div>

        <div style={{ color: '#1C1C1E', fontSize: 18, fontWeight: 800, fontStyle: 'italic', lineHeight: 1.35, marginBottom: 14 }}>
          “{post.message}”
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {(post.moods ?? []).map(mood => <Chip key={mood} label={`${moodEmoji[mood] ?? '🟢'} ${mood}`} />)}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(post.available_dates ?? []).map(value => <Chip key={value} label={dateLabel(value)} />)}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,59,48,0.10)', color: '#FF3B30', borderRadius: 999, padding: '7px 10px', fontSize: 12, fontWeight: 800 }}>
            <Clock size={13} strokeWidth={2.2} />
            Expire dimanche soir
          </span>
        </div>
      </div>

      <SectionTitle label="Ta réponse" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          type="button"
          disabled={responding}
          onClick={() => updateResponse('going')}
          style={{
            flex: 1,
            border: myResponse?.status === 'going' ? '2px solid #e055aa' : 'none',
            background: myResponse?.status === 'going' ? '#fff' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: myResponse?.status === 'going' ? '#e055aa' : '#fff',
            borderRadius: 18,
            padding: '13px 12px',
            fontSize: 15,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          🙋 Je suis partant !
        </button>
        <button
          type="button"
          disabled={responding}
          onClick={() => updateResponse('maybe')}
          style={{
            width: 56,
            border: myResponse?.status === 'maybe' ? '2px solid #FF9500' : 'none',
            background: myResponse?.status === 'maybe' ? '#fff' : '#E5E5EA',
            color: '#1C1C1E',
            borderRadius: 18,
            fontSize: 22,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          🤔
        </button>
      </div>
      {myResponse && (
        <div style={{ color: '#8E8E93', fontSize: 12, fontWeight: 700, marginTop: -10, marginBottom: 16 }}>
          Réponse actuelle : {myResponse.status === 'going' ? 'Partant' : 'Peut-être'}
        </div>
      )}

      {canConvert && (
        <div style={{ background: 'rgba(0,122,255,0.10)', borderRadius: 18, padding: 14, marginBottom: 18 }}>
          <div style={{ color: '#007AFF', fontSize: 14, fontWeight: 900, marginBottom: 10 }}>
            {goingCount} amis sont partants !
          </div>
          <button
            type="button"
            onClick={() => onCreateEvent?.(post)}
            style={{ width: '100%', border: 'none', borderRadius: 16, background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', padding: '13px 14px', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
          >
            Créer l'événement →
          </button>
        </div>
      )}

      {error && <div style={{ color: '#FF3B30', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>}

      <SectionTitle label={`Réponses (${responses.length})`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {responses.map(response => (
          <div key={response.id} style={{ background: '#fff', borderRadius: 16, padding: 12, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            {avatar(response.profiles, 34)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#1C1C1E', fontSize: 14, fontWeight: 900 }}>{name(response.profiles)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                {(response.moods ?? []).map(mood => <Chip key={mood} small label={`${moodEmoji[mood] ?? '🟢'} ${mood}`} />)}
              </div>
            </div>
            <span style={{
              background: response.status === 'going' ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)',
              color: response.status === 'going' ? '#34C759' : '#FF9500',
              borderRadius: 999,
              padding: '6px 9px',
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}>
              {response.status === 'going' ? 'Partant' : 'Peut-être'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BackRow({ onBack, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#fff', color: '#1C1C1E', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <ArrowLeft size={20} strokeWidth={2.4} />
      </button>
      <div style={{ color: '#1C1C1E', fontSize: 22, fontWeight: 900, letterSpacing: '-0.2px' }}>{title}</div>
    </div>
  )
}

function SectionTitle({ label }) {
  return <div style={{ color: '#8E8E93', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 2px 9px' }}>{label}</div>
}

function Chip({ label, small = false }) {
  return (
    <span style={{ background: '#F2F2F7', color: '#3A3A3C', borderRadius: 999, padding: small ? '4px 7px' : '7px 10px', fontSize: small ? 11 : 12, fontWeight: 800 }}>
      {label}
    </span>
  )
}
