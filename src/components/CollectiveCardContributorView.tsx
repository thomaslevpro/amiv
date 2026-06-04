import { useEffect, useMemo, useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AddMemoryModal from './AddMemoryModal'
import {
  deleteMemory,
  getMyMemories,
  getOrCreateCard,
  getProgress,
  toggleReaction,
  type CollectiveCard,
  type Memory,
  type Profile,
  type Progress,
} from '../lib/collectiveCard'

type Event = {
  id: string
  name: string
  date?: string | null
  birthday_person_user_id?: string | null
  birthdayFirstName?: string | null
}

type Props = {
  event: Event
  currentUserId: string
}

const GRADIENT = 'linear-gradient(135deg, #e055aa 0%, #f5a623 100%)'

function formatRevealDate(value?: string | null) {
  if (!value) return { day: 'jour J', time: '--:--' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: 'jour J', time: '--:--' }

  return {
    day: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function dayBadge(value?: string | null) {
  if (!value) return 'Jour J'
  const eventDate = new Date(value)
  if (Number.isNaN(eventDate.getTime())) return 'Jour J'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  eventDate.setHours(0, 0, 0, 0)

  const diff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? `J-${diff}` : 'Jour J'
}

function colorFromId(id = '') {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 72%, 68%)`
}

function firstName(profile?: Profile | null, fallback = 'Ami') {
  return profile?.first_name || fallback
}

export default function CollectiveCardContributorView({ event, currentUserId }: Props) {
  const [card, setCard] = useState<CollectiveCard | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [progress, setProgress] = useState<Progress>({ contributed: 0, total: 0, contributors: [] })
  const [birthdayFirstName, setBirthdayFirstName] = useState(event.birthdayFirstName || event.name)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const reveal = useMemo(() => formatRevealDate(event.date), [event.date])
  const percent = progress.total > 0 ? Math.min(100, (progress.contributed / progress.total) * 100) : 0

  async function refresh(cardOverride = card) {
    if (!cardOverride) return
    const [memoryRows, progressRow] = await Promise.all([
      getMyMemories(event.id, currentUserId),
      getProgress(event.id),
    ])
    setMemories(memoryRows)
    setProgress(progressRow)
  }

  useEffect(() => {
    if (!event.id || !currentUserId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      try {
        const cardRow = await getOrCreateCard(event.id)
        if (cancelled) return

        setCard(cardRow)
        await refresh(cardRow)

        const profileIds = [currentUserId, event.birthday_person_user_id].filter(Boolean) as string[]
        if (profileIds.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, first_name, avatar_url')
            .in('id', profileIds)

          if (error) throw error
          if (cancelled) return

          const profiles = (data || []) as Profile[]
          setCurrentProfile(profiles.find(profile => profile.id === currentUserId) || null)

          const birthdayProfile = event.birthday_person_user_id
            ? profiles.find(profile => profile.id === event.birthday_person_user_id)
            : null
          setBirthdayFirstName(event.birthdayFirstName || birthdayProfile?.first_name || event.name)
        } else {
          setBirthdayFirstName(event.birthdayFirstName || event.name)
        }
      } catch (error) {
        console.error('[CollectiveCardContributorView] load error:', error)
        if (!cancelled) setErrorMessage('Impossible de charger la carte collective.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [event.id, event.name, event.birthdayFirstName, event.birthday_person_user_id, currentUserId])

  async function handleDelete(memoryId: string) {
    if (!window.confirm('Supprimer ce souvenir ?')) return

    try {
      await deleteMemory(memoryId)
      await refresh()
    } catch (error) {
      console.error('[CollectiveCardContributorView] delete error:', error)
      setErrorMessage('Impossible de supprimer ce souvenir.')
    }
  }

  async function handleReaction(memoryId: string, emoji: string) {
    try {
      await toggleReaction(memoryId, currentUserId, emoji)
      await refresh()
    } catch (error) {
      console.error('[CollectiveCardContributorView] reaction error:', error)
      setErrorMessage("Impossible d'enregistrer la réaction.")
    }
  }

  if (loading) {
    return (
      <section style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 13, color: '#8E8E93' }}>Chargement...</div>
      </section>
    )
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: GRADIENT, borderRadius: 14, padding: '14px 16px', color: '#fff', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 20, lineHeight: 1 }}>🔒</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>
            {birthdayFirstName} découvrira tout le {reveal.day} à {reveal.time}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 3 }}>
            Tes souvenirs sont cachés jusqu&apos;au jour J
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1E' }}>
            {progress.contributed} / {progress.total} ont contribué
          </div>
          <div style={{ borderRadius: 999, background: '#FFF3E0', color: '#f5a623', fontSize: 12, fontWeight: 700, padding: '5px 9px', flexShrink: 0 }}>
            {dayBadge(event.date)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', minHeight: 28, marginBottom: 12 }}>
          {progress.contributors.map((profile, index) => (
            <div
              key={profile.id}
              title={firstName(profile)}
              style={{ width: 28, height: 28, borderRadius: 14, background: colorFromId(profile.id), border: '2px solid #fff', marginLeft: index === 0 ? 0 : -7, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 800, position: 'relative', zIndex: progress.contributors.length - index }}
            >
              {firstName(profile, '?').charAt(0).toUpperCase()}
            </div>
          ))}
          {progress.contributed > 5 && (
            <div style={{ color: '#8E8E93', fontSize: 12, marginLeft: 8 }}>
              et {progress.contributed - 5} autres
            </div>
          )}
        </div>

        <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#E5E5EA', overflow: 'hidden' }}>
          <div style={{ width: `${percent}%`, height: '100%', borderRadius: 3, background: GRADIENT }} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>
          Mes souvenirs ajoutés ({memories.length})
        </div>

        {memories.length === 0 ? (
          <div style={{ border: '1.5px dashed #AEAEB2', borderRadius: 14, padding: 24, textAlign: 'center', background: '#fff' }}>
            <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 10 }}>🎁</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', marginBottom: 4 }}>Sois le premier à contribuer !</div>
            <div style={{ fontSize: 13, color: '#8E8E93' }}>Partage un souvenir avec {birthdayFirstName}</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {memories.map(memory => (
              <article key={memory.id} style={{ position: 'relative', height: 170, borderRadius: 14, overflow: 'hidden', background: memory.bg_color, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, minHeight: 0, background: memory.bg_color }}>
                  {memory.image_url && <img src={memory.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </div>

                <div style={{ background: '#fff', padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {firstName(currentProfile)}
                  </div>
                  {memory.text && (
                    <div style={{ fontSize: 11, lineHeight: 1.25, color: '#6B6B6B', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: memory.reactions.length > 0 ? 6 : 0 }}>
                      {memory.text}
                    </div>
                  )}
                  {memory.reactions.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      {memory.reactions.map(reaction => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          onClick={() => handleReaction(memory.id, reaction.emoji)}
                          style={{ border: 'none', borderRadius: 10, padding: '3px 7px', background: reaction.userReacted ? '#FFF3E0' : '#F5F5F5', color: '#1C1C1E', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {reaction.emoji} {reaction.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" onClick={() => handleDelete(memory.id)} aria-label="Supprimer le souvenir" title="Supprimer le souvenir" style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, border: 'none', borderRadius: 15, background: 'rgba(255,255,255,0.88)', color: '#1C1C1E', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}>
                  <MoreHorizontal size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => setShowModal(true)} style={{ width: '100%', height: 52, border: '1.5px dashed #AEAEB2', borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
        <span style={{ width: 28, height: 28, borderRadius: 14, background: GRADIENT, color: '#fff', display: 'grid', placeItems: 'center' }}>
          <Plus size={18} strokeWidth={2.4} />
        </span>
        <span style={{ fontSize: 14, color: '#8E8E93', fontWeight: 700 }}>Ajouter un souvenir</span>
      </button>

      {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12 }}>{errorMessage}</div>}

      {showModal && card && (
        <AddMemoryModal
          cardId={card.id}
          eventId={event.id}
          contributorId={currentUserId}
          birthdayFirstName={birthdayFirstName}
          onClose={() => setShowModal(false)}
          onAdded={() => refresh()}
        />
      )}
    </section>
  )
}
