import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { setStatusBarDark } from '../lib/native'
import { withMemoryImageUrls } from '../lib/memories'

// Souvenirs révélés à la personne fêtée, en lecture seule. L'accès est décidé
// par la RLS (jour de l'événement atteint) : avant, la requête ne renvoie rien
// et l'écran reste neutre.
const COLORS = {
  bg: '#FFF8F3',
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8E8E93',
  pink: '#e055aa',
  gradient: 'linear-gradient(135deg, #e055aa, #f5a623)',
}

const PASTELS = ['#fbeaf0', '#faeeda', '#eeedfe', '#e1f5ee']
const AVATAR_COLORS = ['#FBBF9A', '#B5CAF0', '#C5E8C5', '#F9DDB3', '#E2C9F0', '#F0C5C5', '#A7D8F0', '#F3B7C4']

function firstName(profile, fallback = 'Un ami') {
  return profile?.first_name || profile?.name?.split(' ')?.[0] || fallback
}

function avatarColor(value = '') {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = (hash + value.charCodeAt(index) * (index + 1)) % 997
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function MemoryCard({ memory, index }) {
  const author = firstName(memory.profile)
  const background = memory.bg_color || PASTELS[index % PASTELS.length]

  return (
    <article style={{ background: COLORS.card, borderRadius: 20, overflow: 'hidden', boxShadow: '0 6px 24px rgba(224,85,170,0.10)' }}>
      {memory.display_image_url ? (
        <img src={memory.display_image_url} alt="" style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block', background }} />
      ) : (
        <div style={{ background, minHeight: 120, display: 'grid', placeItems: 'center', fontSize: 52 }}>
          {memory.emoji || '✨'}
        </div>
      )}
      <div style={{ padding: '14px 16px 16px' }}>
        {memory.text && (
          <p style={{ fontSize: 16, lineHeight: 1.45, color: COLORS.text, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
            {memory.display_image_url && memory.emoji ? `${memory.emoji} ` : ''}{memory.text}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {memory.profile?.avatar_url ? (
            <img src={memory.profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 14, background: avatarColor(memory.contributor_id || author), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>
              {author.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{author}</div>
        </div>
      </div>
    </article>
  )
}

export default function MemoriesPage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setStatusBarDark(true)
    return () => setStatusBarDark(false)
  }, [])

  useEffect(() => {
    if (!eventId) return undefined
    let cancelled = false

    async function load() {
      setLoading(true)
      const [eventRes, memoriesRes] = await Promise.all([
        supabase.from('events').select('id, name').eq('id', eventId).maybeSingle(),
        supabase
          .from('collective_memories')
          .select('id, contributor_id, emoji, text, image_url, bg_color, created_at')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return

      if (memoriesRes.error) {
        console.error('[Memories] load error:', memoriesRes.error)
        setErrorMessage('Impossible de charger les souvenirs.')
        setLoading(false)
        return
      }

      const rows = memoriesRes.data ?? []
      const contributorIds = [...new Set(rows.map(row => row.contributor_id).filter(Boolean))]
      const [withImages, profilesRes] = await Promise.all([
        withMemoryImageUrls(rows),
        contributorIds.length > 0
          ? supabase.from('profiles').select('id, first_name, name, avatar_url').in('id', contributorIds)
          : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return

      const profilesById = Object.fromEntries((profilesRes.data ?? []).map(profile => [profile.id, profile]))
      setEvent(eventRes.data ?? null)
      setMemories(withImages.map(memory => ({ ...memory, profile: profilesById[memory.contributor_id] ?? null })))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId])

  const friendCount = new Set(memories.map(memory => memory.contributor_id)).size

  return (
    <div style={{ minHeight: '100dvh', background: COLORS.bg, color: COLORS.text, display: 'flex', justifyContent: 'center' }}>
      <main style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ position: 'relative', overflow: 'hidden', background: COLORS.gradient, padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 26px', borderRadius: '0 0 28px 28px' }}>
          <div style={{ position: 'absolute', top: -60, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
          <button type="button" aria-label="Retour" onClick={() => navigate(`/events/${eventId}`, { replace: true })} style={{ position: 'relative', width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.22)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <ChevronLeft size={23} />
          </button>
          {!loading && memories.length > 0 && (
            <>
              <div style={{ position: 'relative', fontSize: 40, marginTop: 14 }}>🎁</div>
              <h1 style={{ position: 'relative', color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1.15, marginTop: 8 }}>
                Tes amis t’ont préparé une surprise
              </h1>
              <div style={{ position: 'relative', color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600, marginTop: 8 }}>
                {memories.length} souvenir{memories.length > 1 ? 's' : ''} · {friendCount} ami{friendCount > 1 ? 's' : ''}{event?.name ? ` · ${event.name}` : ''}
              </div>
            </>
          )}
        </header>

        <div style={{ flex: 1, padding: '20px 16px calc(28px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: 14, padding: '40px 0' }}>Chargement…</div>
          ) : errorMessage ? (
            <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: 14, padding: '40px 0' }}>{errorMessage}</div>
          ) : memories.length === 0 ? (
            <div style={{ textAlign: 'center', color: COLORS.muted, fontSize: 14, padding: '40px 0' }}>Rien à afficher pour le moment.</div>
          ) : (
            memories.map((memory, index) => <MemoryCard key={memory.id} memory={memory} index={index} />)
          )}
        </div>
      </main>
    </div>
  )
}
