import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Camera, ImagePlus, Pencil, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cardStyles, CARD_GRADIENT } from './cardUtils'

const REACTION_EMOJIS = ['❤️', '😂', '🥹']
const SOFT_GRADIENT = 'linear-gradient(135deg, rgba(224,85,170,0.06), rgba(245,166,35,0.06))'
const SELECTED_REACTION_BG = 'linear-gradient(135deg, rgba(224,85,170,0.15), rgba(245,166,35,0.15))'

function formatEventDate(value) {
  if (!value) return 'jour J'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'jour J'
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function contributorName(profile, fallback = 'Ami') {
  return profile?.first_name || profile?.name || fallback
}

function firstNameFromProfile(profile, fallback = 'Sophie') {
  const name = contributorName(profile, '')
  return name ? name.split(' ')[0] : fallback
}

function ageAtDate(birthday, dateValue) {
  if (!birthday || !dateValue) return null
  const birthDate = new Date(birthday)
  const eventDate = new Date(dateValue)
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(eventDate.getTime())) return null

  let age = eventDate.getFullYear() - birthDate.getFullYear()
  const birthdayThisYear = new Date(eventDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())
  if (eventDate < birthdayThisYear) age -= 1
  return age >= 0 ? age : null
}

function initialsFromUserId(userId) {
  return (userId || '?').slice(0, 2).toUpperCase()
}

function reactionCounts(reactions = []) {
  return reactions.reduce((counts, reaction) => {
    counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1
    return counts
  }, {})
}

function hasCurrentUserReaction(reactions = [], emoji, currentUserId) {
  return reactions.some(reaction => reaction.emoji === emoji && reaction.user_id === currentUserId)
}

function buildMessagesWithReactions(messages = [], reactions = []) {
  const reactionsByMessage = reactions.reduce((grouped, reaction) => {
    if (!grouped[reaction.message_id]) grouped[reaction.message_id] = []
    grouped[reaction.message_id].push({ emoji: reaction.emoji, user_id: reaction.user_id })
    return grouped
  }, {})

  return messages.map(message => ({
    ...message,
    reactions: reactionsByMessage[message.id] || [],
  }))
}

async function fetchProfilesByIds(userIds) {
  if (userIds.length === 0) return {}

  let profileRes = await supabase
    .from('profiles')
    .select('id, first_name, name, avatar_url, birthday')
    .in('id', userIds)

  if (profileRes.error) {
    profileRes = await supabase
      .from('profiles')
      .select('id, first_name, name, avatar_url, birthday')
      .in('id', userIds)
  }

  if (profileRes.error) {
    console.error('[CardContribute] profiles error:', profileRes.error)
    return {}
  }

  return Object.fromEntries((profileRes.data || []).map(profile => [profile.id, profile]))
}

export default function CardContribute({ eventId, currentUserId }) {
  const [message, setMessage] = useState('')
  const [memoryYear, setMemoryYear] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [existing, setExisting] = useState(null)
  const [contributorCount, setContributorCount] = useState(0)
  const [card, setCard] = useState(null)
  const [eventRow, setEventRow] = useState(null)
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [isBirthdayPerson, setIsBirthdayPerson] = useState(false)
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const inputRef = useRef(null)

  const cardStatus = card?.status
  const isRevealed = cardStatus === 'revealed'
  const birthdayName = firstNameFromProfile(ownerProfile, eventRow?.name || 'Sophie')
  const birthdayAge = ageAtDate(ownerProfile?.birthday, eventRow?.date)
  const revealDate = formatEventDate(eventRow?.date || card?.revealed_at)

  const canSubmit = useMemo(() => {
    const hasExistingPhoto = editing && !!existing?.photo_url && !!photoPreview && !photoPreview.startsWith('blob:')
    return (!!message.trim() || !!photoFile || hasExistingPhoto) && !submitting
  }, [message, photoFile, editing, existing, photoPreview, submitting])

  useEffect(() => {
    if (!eventId || !currentUserId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const [existingRes, countRes, cardRes, eventRes] = await Promise.all([
        supabase
          .from('group_card_messages')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', currentUserId)
          .maybeSingle(),
        supabase
          .from('group_card_messages')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('group_cards')
          .select('*')
          .eq('event_id', eventId)
          .maybeSingle(),
        supabase
          .from('events')
          .select('name, date, birthday_person_user_id')
          .eq('id', eventId)
          .single(),
      ])

      if (cancelled) return
      let cardData = cardRes.data || null

      if (existingRes.error) {
        console.error('[CardContribute] existing contribution error:', existingRes.error)
        setErrorMessage('Impossible de charger ta contribution.')
      } else {
        setExisting(existingRes.data || null)
      }

      if (countRes.error) {
        console.error('[CardContribute] count error:', countRes.error)
      } else {
        setContributorCount(countRes.count || 0)
      }

      if (cardRes.error) {
        console.error('[CardContribute] card error:', cardRes.error)
      } else {
        setCard(cardData)
      }

      if (eventRes.error) {
        console.error('[CardContribute] event error:', eventRes.error)
      } else {
        setEventRow(eventRes.data || null)
      }

      const eventData = eventRes.data || null
      const eventDate = eventData?.date ? new Date(eventData.date) : null
      const isPast = eventDate && eventDate <= new Date()
      const isCollecting = cardData?.status === 'collecting'

      if (isPast && isCollecting) {
        const revealedAt = new Date().toISOString()
        const { error: revealError } = await supabase
          .from('group_cards')
          .update({
            status: 'revealed',
            revealed_at: revealedAt,
            revealed_by: currentUserId,
          })
          .eq('event_id', eventId)

        if (revealError) {
          console.error('[CardContribute] lazy reveal error:', revealError)
        } else {
          cardData = { ...cardData, status: 'revealed', revealed_at: revealedAt, revealed_by: currentUserId }
          if (!cancelled) setCard(cardData)
        }
      }

      if (!cancelled) setIsBirthdayPerson(eventData?.birthday_person_user_id === currentUserId)

      const birthdayPersonId = eventData?.birthday_person_user_id
      if (birthdayPersonId) {
        const profilesById = await fetchProfilesByIds([birthdayPersonId])
        if (!cancelled) setOwnerProfile(profilesById[birthdayPersonId] || null)
      }

      if (cardData?.status === 'revealed') {
        const messagesRes = await supabase
          .from('group_card_messages')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })

        if (cancelled) return

        if (messagesRes.error) {
          console.error('[CardContribute] revealed messages error:', messagesRes.error)
          setErrorMessage('Impossible de charger les souvenirs.')
        } else {
          const messageIds = (messagesRes.data || []).map(row => row.id)
          const reactionsRes = messageIds.length > 0
            ? await supabase
              .from('group_card_reactions')
              .select('message_id, user_id, emoji, created_at')
              .in('message_id', messageIds)
            : { data: [], error: null }

          if (cancelled) return

          if (reactionsRes.error) {
            console.error('[CardContribute] reactions error:', reactionsRes.error)
            setErrorMessage('Impossible de charger les réactions.')
            setMemories(buildMessagesWithReactions(messagesRes.data || [], []))
            setLoading(false)
            return
          }

          const rows = buildMessagesWithReactions(messagesRes.data || [], reactionsRes.data || [])
          const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))]
          const profilesById = await fetchProfilesByIds(userIds)
          if (!cancelled) {
            setMemories(rows.map(row => ({ ...row, profile: profilesById[row.user_id] || null })))
          }
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId, currentUserId])

  useEffect(() => {
    if (!photoFile) return undefined
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  function startEditing() {
    setMessage(existing?.message || '')
    setMemoryYear(existing?.memory_year || '')
    setPhotoPreview(existing?.photo_url || '')
    setPhotoFile(null)
    setEditing(true)
    setErrorMessage('')
  }

  function stopEditing() {
    if (!existing) return
    setMessage('')
    setMemoryYear('')
    setPhotoPreview('')
    setPhotoFile(null)
    setEditing(false)
    setErrorMessage('')
  }

  function clearPhoto() {
    setPhotoFile(null)
    setPhotoPreview('')
  }

  async function uploadPhoto() {
    if (!photoFile) return existing?.photo_url || null

    const path = `${eventId}/${currentUserId}_${Date.now()}.jpg`
    const { error } = await supabase.storage
      .from('card-photos')
      .upload(path, photoFile, { cacheControl: '3600', upsert: false, contentType: photoFile.type || 'image/jpeg' })

    if (error) throw error

    const { data } = supabase.storage.from('card-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit || !eventId || !currentUserId) return

    setSubmitting(true)
    setErrorMessage('')

    try {
      const photoUrl = await uploadPhoto()

      const { error: cardError } = await supabase
        .from('group_cards')
        .upsert(
          { event_id: eventId, status: 'collecting' },
          { onConflict: 'event_id', ignoreDuplicates: true }
        )
      if (cardError) {
        console.warn('[CardContribute] group card upsert skipped:', cardError)
      }

      if (existing?.id) {
        const { error: deleteError } = await supabase
          .from('group_card_messages')
          .delete()
          .eq('id', existing.id)
        if (deleteError) throw deleteError
      }

      const payload = {
        event_id: eventId,
        user_id: currentUserId,
        message: message.trim() || null,
        photo_url: photoUrl || null,
        memory_year: memoryYear.trim() || null,
      }
      const { data, error } = await supabase
        .from('group_card_messages')
        .insert(payload)
        .select('*')
        .single()
      if (error) throw error

      setExisting(data)
      setContributorCount(count => count + (existing?.id ? 0 : 1))
      setMessage('')
      setMemoryYear('')
      setPhotoFile(null)
      setPhotoPreview('')
      setEditing(false)
    } catch (error) {
      console.error('[CardContribute] submit error:', error)
      setErrorMessage(error.message || 'Impossible d’enregistrer ton souvenir.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleReaction(messageId, emoji) {
    if (!messageId || !currentUserId) return

    const previousMemories = memories
    const target = memories.find(memory => memory.id === messageId)
    const selected = hasCurrentUserReaction(target?.reactions || [], emoji, currentUserId)

    const nextMemories = memories.map(memory => {
      if (memory.id !== messageId) return memory
      const reactions = selected
        ? memory.reactions.filter(reaction => !(reaction.emoji === emoji && reaction.user_id === currentUserId))
        : [...memory.reactions, { emoji, user_id: currentUserId }]
      return { ...memory, reactions }
    })

    setMemories(nextMemories)
    setErrorMessage('')

    try {
      if (selected) {
        const { error } = await supabase
          .from('group_card_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', currentUserId)
          .eq('emoji', emoji)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('group_card_reactions')
          .insert({ message_id: messageId, user_id: currentUserId, emoji })
        if (error) throw error
      }
    } catch (error) {
      console.error('[CardContribute] reaction toggle error:', error)
      setMemories(previousMemories)
      setErrorMessage('Impossible d’enregistrer ta réaction.')
    }
  }

  function renderReactionPills(reactions = [], messageId = null, interactive = false) {
    const counts = reactionCounts(reactions)
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        {REACTION_EMOJIS.map(emoji => {
          const count = counts[emoji] || 0
          const selected = hasCurrentUserReaction(reactions, emoji, currentUserId)
          if (!interactive && count === 0) return null

          return (
            <button
              key={emoji}
              type="button"
              onClick={interactive ? () => toggleReaction(messageId, emoji) : undefined}
              disabled={!interactive}
              style={{
                border: selected ? '1px solid rgba(224,85,170,0.42)' : '1px solid transparent',
                borderRadius: 999,
                background: selected ? SELECTED_REACTION_BG : '#F5F5F5',
                color: selected ? '#993556' : '#1C1C1E',
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 8px',
                cursor: interactive ? 'pointer' : 'default',
                display: count === 0 && !selected ? 'none' : 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <section style={cardStyles.section}>
        <div style={cardStyles.eyebrow}>Carte collective</div>
        <div style={cardStyles.muted}>Chargement…</div>
      </section>
    )
  }

  if (isBirthdayPerson && cardStatus !== 'revealed') {
    return (
      <section style={{ ...cardStyles.section, textAlign: 'center', padding: '32px 18px' }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🎁</div>
        <div style={{ ...cardStyles.title, marginBottom: 8 }}>
          Une surprise se prépare…
        </div>
        <div style={cardStyles.muted}>
          Tu découvriras tout le jour J
        </div>
      </section>
    )
  }

  if (isRevealed) {
    return (
      <section style={{ marginBottom: 14 }}>
        <div style={{ ...cardStyles.section, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>{isBirthdayPerson ? '🎂' : '🎉'}</div>
          <div style={{ ...cardStyles.title, fontSize: isBirthdayPerson ? 24 : 20, marginBottom: 6 }}>
            {isBirthdayPerson ? 'Joyeux anniversaire !' : birthdayAge == null ? `Joyeux anniversaire, ${birthdayName} !` : `Joyeux ${birthdayAge} ans, ${birthdayName} !`}
          </div>
          <div style={cardStyles.muted}>
            {isBirthdayPerson ? (
              <>
                {memories.length} souvenir{memories.length > 1 ? 's' : ''} partagé{memories.length > 1 ? 's' : ''} rien que pour toi
              </>
            ) : (
              <>De la part de {contributorCount} ami{contributorCount > 1 ? 's' : ''} qui t'aiment</>
            )}
          </div>
          {!isBirthdayPerson && (
            <div style={{
              display: 'inline-block',
              background: 'rgba(245,166,35,0.12)',
              borderRadius: 12,
              padding: '8px 20px',
              marginTop: 10,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f5a623' }}>
                {contributorCount} souvenir{contributorCount > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f5a623', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
                Partagés pour toi
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '14px 2px 10px' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#1C1C1E' }}>Tous vos souvenirs</div>
          <div style={{ borderRadius: 999, padding: '4px 9px', background: '#F5F5F5', color: '#8E8E93', fontSize: 12, fontWeight: 800 }}>
            {memories.length}
          </div>
        </div>

        {memories.length === 0 ? (
          <section style={cardStyles.section}>
            <div style={cardStyles.muted}>Aucun souvenir à afficher pour le moment.</div>
          </section>
        ) : (
          <div style={{ columnCount: 2, columnGap: 10 }}>
            {memories.map(memory => {
              const name = contributorName(memory.profile)
              return (
                <article
                  key={memory.id}
                  style={{
                    breakInside: 'avoid',
                    marginBottom: 10,
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
                  }}
                >
                  {memory.photo_url && (
                    <div style={{ position: 'relative' }}>
                      <img src={memory.photo_url} alt="" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                      {memory.memory_year && (
                        <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px', background: 'rgba(0,0,0,0.54)', color: '#fff', fontSize: 10, fontWeight: 800 }}>
                          {memory.memory_year}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ padding: 10 }}>
                    {!memory.photo_url && memory.memory_year && (
                      <div style={{ display: 'inline-flex', borderRadius: 999, padding: '3px 8px', background: '#F5F5F5', color: '#8E8E93', fontSize: 10, fontWeight: 800, marginBottom: 8 }}>
                        {memory.memory_year}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: memory.message ? 8 : 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: '#FBBF9A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                        {initialsFromUserId(memory.user_id)}
                      </div>
                      <div style={{ minWidth: 0, fontSize: 12, fontWeight: 900, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name.split(' ')[0]}
                      </div>
                    </div>
                    {memory.message && (
                      <div style={{ fontSize: 12, lineHeight: 1.4, color: '#1C1C1E', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 9 }}>
                        {memory.message}
                      </div>
                    )}
                    {renderReactionPills(memory.reactions, memory.id, true)}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                      {REACTION_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(memory.id, emoji)}
                          aria-label={`Réagir ${emoji}`}
                          title={`Réagir ${emoji}`}
                          style={{
                            border: 'none',
                            borderRadius: 999,
                            background: hasCurrentUserReaction(memory.reactions, emoji, currentUserId) ? SELECTED_REACTION_BG : '#F5F5F5',
                            color: '#993556',
                            fontSize: 13,
                            lineHeight: 1,
                            width: 28,
                            height: 26,
                            cursor: 'pointer',
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12, marginTop: 10 }}>{errorMessage}</div>}
      </section>
    )
  }

  if (existing && !editing) {
    return (
      <section style={cardStyles.section}>
        <div style={cardStyles.eyebrow}>Ton souvenir</div>
        <div style={{ border: '1px solid #F5F5F5', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          {existing.photo_url ? (
            <div style={{ position: 'relative' }}>
              <img src={existing.photo_url} alt="Ton souvenir" style={{ width: '100%', maxHeight: 208, objectFit: 'cover', display: 'block' }} />
              {existing.memory_year && (
                <div style={{ position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '4px 9px', background: '#fff', color: '#8E8E93', fontSize: 11, fontWeight: 800 }}>
                  {existing.memory_year}
                </div>
              )}
            </div>
          ) : existing.memory_year ? (
            <div style={{ padding: '12px 12px 0' }}>
              <div style={{ display: 'inline-flex', borderRadius: 999, padding: '4px 9px', background: '#fff', border: '1px solid #F5F5F5', color: '#8E8E93', fontSize: 11, fontWeight: 800 }}>
                {existing.memory_year}
              </div>
            </div>
          ) : null}
          {existing.message && (
            <div style={{ padding: 12, fontSize: 14, lineHeight: 1.45, color: '#1C1C1E', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {existing.message}
            </div>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          {renderReactionPills(existing.reactions || [])}
        </div>
        <button type="button" onClick={startEditing} style={{ ...cardStyles.secondaryButton, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Pencil size={15} />
          Modifier
        </button>
        <div style={{ ...cardStyles.muted, marginTop: 12 }}>
          {birthdayName} le découvrira le {revealDate}
        </div>
        {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12, marginTop: 10 }}>{errorMessage}</div>}
      </section>
    )
  }

  return (
    <section style={cardStyles.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          onClick={editing ? stopEditing : () => window.history.back()}
          aria-label="Retour"
          title="Retour"
          style={{ border: 'none', background: '#F5F5F5', color: '#1C1C1E', width: 34, height: 34, borderRadius: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ ...cardStyles.title, fontSize: 18 }}>Ajouter un souvenir</div>
      </div>

      <div style={{ borderRadius: 14, background: '#F3EEFF', color: '#7c5cbf', padding: 12, display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 20, lineHeight: 1 }}>🔒</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 3 }}>Révélation le jour J</div>
          <div style={{ fontSize: 12, lineHeight: 1.35 }}>{birthdayName} découvrira tout le {revealDate}</div>
        </div>
      </div>

      <div style={{ borderRadius: 14, background: '#fff', border: '1px solid #F5F5F5', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#1C1C1E' }}>
            {contributorCount} personne{contributorCount > 1 ? 's' : ''} ont déjà contribué
          </div>
          <div style={{ ...cardStyles.muted, marginTop: 2 }}>Sois parmi les premiers !</div>
        </div>
        <div style={{ borderRadius: 999, padding: '5px 10px', background: 'rgba(224,85,170,0.10)', color: '#993556', fontSize: 12, fontWeight: 900 }}>
          {contributorCount}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {photoPreview ? (
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1px solid #E5E5EA' }}>
            <img src={photoPreview} alt="Aperçu" style={{ width: '100%', maxHeight: 224, objectFit: 'cover', display: 'block' }} />
            <button
              type="button"
              onClick={clearPhoto}
              aria-label="Retirer la photo"
              title="Retirer la photo"
              style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, border: 'none', borderRadius: 16, background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{ border: '1px dashed rgba(224,85,170,0.35)', borderRadius: 14, padding: '22px 14px', background: SOFT_GRADIENT, color: '#993556', fontSize: 14, fontWeight: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
          >
            <ImagePlus size={24} />
            Ajouter une photo souvenir
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={event => setPhotoFile(event.target.files?.[0] || null)}
          style={{ display: 'none' }}
        />

        <textarea
          value={message}
          onChange={event => setMessage(event.target.value)}
          placeholder="Un mot sur ce souvenir…"
          rows={3}
          style={{ ...cardStyles.input, resize: 'vertical', minHeight: 88 }}
        />

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#8E8E93' }}>Année ou période</span>
          <input
            value={memoryYear}
            onChange={event => setMemoryYear(event.target.value)}
            placeholder="Année ou période (ex: Été 2023)"
            style={cardStyles.input}
          />
        </label>

        {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12 }}>{errorMessage}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...cardStyles.primaryButton,
            background: canSubmit ? CARD_GRADIENT : '#D1D1D6',
            opacity: submitting ? 0.7 : 1,
            cursor: canSubmit ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Camera size={17} />
          {submitting ? 'Envoi…' : 'Envoyer mon souvenir 🎉'}
        </button>
      </form>
    </section>
  )
}
