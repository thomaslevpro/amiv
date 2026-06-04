import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ExternalLink, Gift, Image, Plus, Sparkles, Upload, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import GuestLeaderBanner from '../components/GuestLeaderBanner'
import PendingCandidatesPanel from '../components/PendingCandidatesPanel'
import { useGuestLeader } from '../hooks/useGuestLeader'

const COLORS = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1C1C1E',
  muted: '#8E8E93',
  line: '#E5E5EA',
  pink: '#e055aa',
  orange: '#f5a623',
  green: '#34C759',
  red: '#FF3B30',
  gradient: 'linear-gradient(135deg, #e055aa, #f5a623)',
}

const TABS = [
  { id: 'flashback', label: 'Flashback' },
  { id: 'gifts', label: 'Cadeaux' },
  { id: 'cagnotte', label: 'Cagnotte' },
]

const EMPTY_MEMORY_FORM = {
  text: '',
  emoji: '',
  image_url: '',
  bg_color: '#fbeaf0',
}

const MEMORY_PASTELS = [
  { bg: '#fbeaf0', icon: '#ed93b1' },
  { bg: '#faeeda', icon: '#efa727' },
  { bg: '#eeedfe', icon: '#afa9ec' },
  { bg: '#e1f5ee', icon: '#5dcaa5' },
]

const EMOJI_OPTIONS = ['✨', '🎂', '💛', '📸', '🥳', '🫶']

const AVATAR_COLORS = ['#FBBF9A', '#B5CAF0', '#C5E8C5', '#F9DDB3', '#E2C9F0', '#F0C5C5', '#A7D8F0', '#F3B7C4']

const EMPTY_GIFT_FORM = {
  label: '',
  price_estimate: '',
}

function formatHeroDate(value) {
  if (!value) return 'date à définir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'date à définir'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function addDays(value, amount) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + amount)
  date.setHours(0, 0, 0, 0)
  return date
}

function daysUntil(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date - today) / 86400000)
}

function isRevealed(value) {
  const days = daysUntil(value)
  return days !== null && days <= 0
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return `${numeric.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`
}

function firstName(profile, fallback = 'Quelqu’un') {
  return profile?.first_name || profile?.name?.split(' ')?.[0] || fallback
}

function hashIndex(value = '', modulo = AVATAR_COLORS.length) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash + value.charCodeAt(index) * (index + 1)) % 997
  }
  return hash % modulo
}

function avatarColor(value = '') {
  return AVATAR_COLORS[hashIndex(value)]
}

function memoryPalette(memory, index) {
  const exact = MEMORY_PASTELS.find(color => color.bg.toLowerCase() === String(memory?.bg_color || '').toLowerCase())
  return exact || MEMORY_PASTELS[index % MEMORY_PASTELS.length]
}

async function fetchProfilesByIds(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (uniqueIds.length === 0) return {}

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, name, avatar_url')
    .in('id', uniqueIds)

  if (error) throw error
  return (data ?? []).reduce((acc, profile) => {
    acc[profile.id] = profile
    return acc
  }, {})
}

function Input({ label, ...props }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>{label}</span>
      <input
        {...props}
        style={{
          width: '100%',
          border: `1px solid ${COLORS.line}`,
          borderRadius: 12,
          padding: '12px 13px',
          fontSize: 14,
          color: COLORS.text,
          background: COLORS.card,
          outline: 'none',
          ...props.style,
        }}
      />
    </label>
  )
}

function Sheet({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.24)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          background: COLORS.card,
          borderRadius: '20px 20px 0 0',
          padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ width: 42, height: 5, borderRadius: 999, background: COLORS.line, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, lineHeight: 1.2, color: COLORS.text }}>{title}</h2>
          <button type="button" aria-label="Fermer" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 17, background: COLORS.bg, display: 'grid', placeItems: 'center' }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PrimaryButton({ children, disabled, style, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 48,
        borderRadius: 14,
        background: disabled ? '#C7C7CC' : COLORS.gradient,
        color: '#fff',
        fontSize: 14,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

function EmptyCard({ children }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', color: COLORS.muted, fontSize: 14 }}>
      {children}
    </div>
  )
}

export default function SecretSpacePage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const memoryFileInputRef = useRef(null)
  const [event, setEvent] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('flashback')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toast, setToast] = useState(null)

  const [cardId, setCardId] = useState(null)
  const [memories, setMemories] = useState([])
  const [contributors, setContributors] = useState([])
  const [memoryModalOpen, setMemoryModalOpen] = useState(false)
  const [memoryForm, setMemoryForm] = useState(EMPTY_MEMORY_FORM)
  const [memoryImageFile, setMemoryImageFile] = useState(null)
  const [memoryImagePreview, setMemoryImagePreview] = useState('')
  const [memorySaving, setMemorySaving] = useState(false)

  const [giftItems, setGiftItems] = useState([])
  const [collectiveGifts, setCollectiveGifts] = useState([])
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [giftForm, setGiftForm] = useState(EMPTY_GIFT_FORM)
  const [giftSaving, setGiftSaving] = useState(false)

  const [cagnotteUrl, setCagnotteUrl] = useState('')
  const [cagnotteGoal, setCagnotteGoal] = useState('')
  const [cagnotteGiftId, setCagnotteGiftId] = useState('')
  const [cagnotteSaving, setCagnotteSaving] = useState(false)

  const revealDate = useMemo(() => addDays(event?.date, 1), [event?.date])
  const revealDays = useMemo(() => daysUntil(revealDate), [revealDate])
  const revealed = useMemo(() => isRevealed(event?.date), [event?.date])
  const birthdayFirstName = firstName(event?.birthdayProfile, 'Thomas')
  const contributorCount = contributors.filter(contributor => contributor.nb_memories > 0).length
  const guestCount = contributors.length
  const {
    pendingCandidates,
    currentUserRole,
    isGuestLeader,
    hasPendingRequest,
    isConfirmedGuest,
    loading: guestLeaderLoading,
    applyAsGuestLeader,
    approveCandidate,
    rejectCandidate,
  } = useGuestLeader(eventId)
  const canManageCagnotte = ['owner', 'co_organizer'].includes(currentUserRole) || isGuestLeader

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError })
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const fetchFlashback = useCallback(async () => {
    if (!eventId) return

    const { data: cardRows, error: cardError } = await supabase
      .from('collective_cards')
      .select('id')
      .eq('event_id', eventId)
      .limit(1)

    if (cardError) throw cardError

    let nextCardId = cardRows?.[0]?.id ?? null
    if (!nextCardId) {
      const { data: createdCard, error: createError } = await supabase
        .from('collective_cards')
        .insert({ event_id: eventId })
        .select('id')
        .single()
      if (createError) throw createError
      nextCardId = createdCard.id
    }
    setCardId(nextCardId)

    const { data: memoryRows, error: memoriesError } = await supabase
      .from('collective_memories')
      .select('id, card_id, event_id, contributor_id, text, image_url, emoji, bg_color, created_at, collective_cards!inner(event_id)')
      .eq('collective_cards.event_id', eventId)
      .order('created_at', { ascending: false })

    if (memoriesError) throw memoriesError
    const loadedMemories = memoryRows ?? []
    const { data: invitationRows, error: invitationError } = await supabase
      .from('invitations')
      .select('id, invited_user_id, status')
      .eq('event_id', eventId)

    if (invitationError) throw invitationError
    const profilesById = await fetchProfilesByIds([
      ...loadedMemories.map(memory => memory.contributor_id),
      ...(invitationRows ?? []).map(invitation => invitation.invited_user_id),
    ])
    setMemories(loadedMemories.map(memory => ({
      ...memory,
      profile: profilesById[memory.contributor_id] ?? null,
    })))

    const counts = loadedMemories.reduce((acc, memory) => {
      if (!memory.contributor_id) return acc
      acc[memory.contributor_id] = (acc[memory.contributor_id] ?? 0) + 1
      return acc
    }, {})

    setContributors((invitationRows ?? []).map(invitation => ({
      ...invitation,
      profile: profilesById[invitation.invited_user_id] ?? null,
      nb_memories: counts[invitation.invited_user_id] ?? 0,
    })))
  }, [eventId])

  const fetchGifts = useCallback(async () => {
    if (!eventId) return

    const [itemsRes, giftsRes] = await Promise.all([
      supabase
        .from('gift_items')
        .select('id, event_id, label, price_estimate, added_by, claimed_by, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
      supabase
        .from('gifts')
        .select('id, event_id, name, price, added_by, claimed_by, needs_contribution, contribution_amount, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
    ])

    if (itemsRes.error) throw itemsRes.error
    if (giftsRes.error) throw giftsRes.error
    const items = itemsRes.data ?? []
    const gifts = giftsRes.data ?? []
    const profilesById = await fetchProfilesByIds([
      ...items.flatMap(item => [item.added_by, item.claimed_by]),
      ...gifts.flatMap(gift => [gift.added_by, gift.claimed_by]),
    ])

    setGiftItems(items.map(item => ({
      ...item,
      addedProfile: profilesById[item.added_by] ?? null,
      claimedProfile: profilesById[item.claimed_by] ?? null,
    })))
    setCollectiveGifts(gifts.map(gift => ({
      ...gift,
      addedProfile: profilesById[gift.added_by] ?? null,
      claimedProfile: profilesById[gift.claimed_by] ?? null,
    })))
  }, [eventId])

  const fetchEvent = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('events')
      .select('id, name, date, user_id, birthday_person_user_id, cagnotte_url, cagnotte_goal, cagnotte_gift_id, cagnotte_created_by')
      .eq('id', eventId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Événement introuvable.')
    if (data.birthday_person_user_id && data.birthday_person_user_id === userId) {
      throw new Error('Cet espace est caché jusqu’au jour J.')
    }

    let birthdayProfile = null
    if (data.birthday_person_user_id) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, name')
        .eq('id', data.birthday_person_user_id)
        .maybeSingle()
      if (profileError) throw profileError
      birthdayProfile = profileData
    }

    setEvent({ ...data, birthdayProfile })
    setCagnotteUrl(data.cagnotte_url ?? '')
    setCagnotteGoal(data.cagnotte_goal ?? '')
    setCagnotteGiftId(data.cagnotte_gift_id ?? '')
  }, [eventId])

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      setErrorMessage('')
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!user) {
          navigate(`/login?redirect=/events/${eventId}/secret-space`)
          return
        }
        if (cancelled) return
        setCurrentUserId(user.id)
        await fetchEvent(user.id)
      } catch (error) {
        console.error('[SecretSpace] init error:', error)
        if (!cancelled) setErrorMessage(error.message ?? 'Impossible de charger l’espace secret.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [eventId, fetchEvent, navigate])

  useEffect(() => {
    if (!event) return
    fetchFlashback().catch(error => {
      console.error('[SecretSpace] flashback error:', error)
      setErrorMessage('Impossible de charger les souvenirs.')
    })
    fetchGifts().catch(error => {
      console.error('[SecretSpace] gifts error:', error)
      setErrorMessage('Impossible de charger les cadeaux.')
    })
  }, [event, fetchFlashback, fetchGifts])

  useEffect(() => {
    if (!memoryImageFile) {
      setMemoryImagePreview('')
      return undefined
    }

    const url = URL.createObjectURL(memoryImageFile)
    setMemoryImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [memoryImageFile])

  async function uploadMemoryImage() {
    if (!memoryImageFile || !currentUserId) return null

    const ext = memoryImageFile.name.split('.').pop() || 'jpg'
    const path = `${eventId}/${currentUserId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('memory-images')
      .upload(path, memoryImageFile, {
        cacheControl: '3600',
        contentType: memoryImageFile.type || 'image/jpeg',
        upsert: false,
      })

    if (error) throw error
    return supabase.storage.from('memory-images').getPublicUrl(path).data.publicUrl
  }

  async function handleAddMemory(event) {
    event.preventDefault()
    if (!cardId || !currentUserId || memorySaving) return
    const text = memoryForm.text.trim()
    const emoji = memoryForm.emoji.trim()
    const imageUrl = memoryForm.image_url.trim()
    if (!text && !emoji && !imageUrl && !memoryImageFile) return

    setMemorySaving(true)
    let uploadedUrl = null
    try {
      uploadedUrl = await uploadMemoryImage()
    } catch (error) {
      console.error('[SecretSpace] memory image upload error:', error)
      setMemorySaving(false)
      setErrorMessage("Impossible d'envoyer l'image.")
      return
    }

    const { error } = await supabase
      .from('collective_memories')
      .insert({
        card_id: cardId,
        event_id: eventId,
        contributor_id: currentUserId,
        text: text || null,
        emoji: emoji || null,
        image_url: uploadedUrl || imageUrl || null,
        bg_color: memoryForm.bg_color || '#fbeaf0',
      })

    setMemorySaving(false)
    if (error) {
      console.error('[SecretSpace] memory insert error:', error)
      setErrorMessage("Impossible d'ajouter le souvenir.")
      return
    }
    setMemoryForm(EMPTY_MEMORY_FORM)
    setMemoryImageFile(null)
    setMemoryModalOpen(false)
    await fetchFlashback()
  }

  function closeMemorySheet() {
    if (memorySaving) return
    setMemoryModalOpen(false)
    setMemoryImageFile(null)
  }

  async function handleAddGift(event) {
    event.preventDefault()
    if (!currentUserId || !giftForm.label.trim() || giftSaving) return

    setGiftSaving(true)
    const { error } = await supabase
      .from('gift_items')
      .insert({
        event_id: eventId,
        label: giftForm.label.trim(),
        price_estimate: giftForm.price_estimate === '' ? null : Number(giftForm.price_estimate),
        added_by: currentUserId,
      })

    setGiftSaving(false)
    if (error) {
      console.error('[SecretSpace] gift item insert error:', error)
      setErrorMessage("Impossible d'ajouter le cadeau.")
      return
    }
    setGiftForm(EMPTY_GIFT_FORM)
    setGiftModalOpen(false)
    await fetchGifts()
  }

  async function handleClaimGiftItem(giftItemId) {
    if (!currentUserId) return
    const { error } = await supabase
      .from('gift_items')
      .update({ claimed_by: currentUserId })
      .eq('id', giftItemId)
      .is('claimed_by', null)

    if (error) {
      console.error('[SecretSpace] gift item claim error:', error)
      setErrorMessage('Impossible de prendre ce cadeau.')
      return
    }
    await fetchGifts()
  }

  async function handleCagnotteSubmit(event) {
    event.preventDefault()
    if (!currentUserId || cagnotteSaving || !cagnotteUrl.trim()) return

    setCagnotteSaving(true)
    const next = {
      cagnotte_url: cagnotteUrl.trim(),
      cagnotte_goal: cagnotteGoal === '' ? null : Number(cagnotteGoal),
      cagnotte_gift_id: cagnotteGiftId || null,
      cagnotte_created_by: currentUserId,
    }
    const { error } = await supabase
      .from('events')
      .update(next)
      .eq('id', eventId)

    setCagnotteSaving(false)
    if (error) {
      console.error('[SecretSpace] cagnotte update error:', error)
      setErrorMessage("Impossible d'enregistrer la cagnotte.")
      return
    }
    setEvent(current => current ? { ...current, ...next } : current)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: COLORS.bg, display: 'grid', placeItems: 'center', color: COLORS.muted, fontSize: 14 }}>
        Chargement...
      </div>
    )
  }

  if (errorMessage && !event) {
    return (
      <div style={{ minHeight: '100dvh', background: COLORS.bg, padding: 16 }}>
        <button type="button" onClick={() => navigate(-1)} style={{ color: '#007AFF', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Retour</button>
        <EmptyCard>{errorMessage}</EmptyCard>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: COLORS.bg, color: COLORS.text, display: 'flex', justifyContent: 'center' }}>
      <main style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          @keyframes secretPulse {
            0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(245,166,35,0.35); }
            50% { transform: scale(1.15); opacity: 0.78; box-shadow: 0 0 0 7px rgba(245,166,35,0); }
          }
        `}</style>
        <header style={{ position: 'relative', overflow: 'hidden', background: '#1c1c1e', padding: '16px 16px 18px' }}>
          <div style={{ position: 'absolute', top: -68, right: -62, width: 184, height: 184, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,85,170,0.35) 0%, rgba(224,85,170,0.16) 38%, rgba(224,85,170,0) 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" aria-label="Retour" onClick={() => navigate(-1)} style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.10)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <ChevronLeft size={23} />
            </button>
            <div style={{ minWidth: 0, flex: 1, color: 'rgba(255,255,255,0.68)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Amiv de {birthdayFirstName} · {formatHeroDate(event?.date)}
            </div>
          </div>

          {!revealed && (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.74)', padding: '6px 12px', fontSize: 11, fontWeight: 600 }}>
              <span aria-hidden="true">🔒</span>
              Espace secret · caché de {birthdayFirstName}
            </div>
          )}

          <h1 style={{ position: 'relative', color: '#fff', fontSize: 24, fontWeight: 800, lineHeight: 1.12, marginTop: 16, letterSpacing: 0 }}>
            On prépare quelque chose de beau
          </h1>
          <div style={{ position: 'relative', color: 'rgba(255,255,255,0.58)', fontSize: 13, fontWeight: 500, marginTop: 8 }}>
            {guestCount} invité{guestCount > 1 ? 's' : ''} · 1 surprise collective
          </div>

          <div style={{ position: 'relative', minHeight: 42, borderRadius: 14, background: 'rgba(255,255,255,0.06)', padding: '10px 14px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.orange, animation: 'secretPulse 1.45s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ minWidth: 0, flex: 1, color: 'rgba(255,255,255,0.76)', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Révélation le {formatHeroDate(revealDate)} à 00:00
            </span>
            <span style={{ color: COLORS.orange, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
              {revealDays === null ? 'J-?' : revealDays > 0 ? `J-${revealDays}` : 'J'}
            </span>
          </div>
        </header>

        <div style={{ background: '#1c1c1e', padding: '0 16px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 3 }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  minHeight: 34,
                  borderRadius: activeTab === tab.id ? 9 : 8,
                  background: activeTab === tab.id ? COLORS.card : 'transparent',
                  color: activeTab === tab.id ? '#000' : 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <section style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          <GuestLeaderBanner
            currentUserRole={currentUserRole}
            isConfirmedGuest={isConfirmedGuest}
            isGuestLeader={isGuestLeader}
            hasPendingRequest={hasPendingRequest}
            applyAsGuestLeader={applyAsGuestLeader}
            onToast={showToast}
          />
          <PendingCandidatesPanel
            pendingCandidates={pendingCandidates}
            currentUserRole={currentUserRole}
            approveCandidate={approveCandidate}
            rejectCandidate={rejectCandidate}
            onToast={showToast}
          />

          {activeTab === 'flashback' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ background: COLORS.card, borderRadius: 16, padding: 14, minHeight: 88, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fbeaf0', color: '#ed93b1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Image size={19} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{memories.length}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, lineHeight: 1.2, marginTop: 5 }}>Souvenirs ajoutés</div>
                  </div>
                </div>
                <div style={{ background: COLORS.card, borderRadius: 16, padding: 14, minHeight: 88, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fbeaf0', color: '#ed93b1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Users size={19} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>{contributorCount} / {guestCount || 0}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, lineHeight: 1.2, marginTop: 5 }}>Invités ont contribué</div>
                  </div>
                </div>
              </div>

              {memories.length === 0 ? (
                <EmptyCard>Aucun souvenir pour le moment.</EmptyCard>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  {memories.map((memory, index) => {
                    const palette = memoryPalette(memory, index)
                    const author = firstName(memory.profile, 'Ami')
                    const color = avatarColor(memory.contributor_id || author)

                    return (
                      <article key={memory.id} style={{ background: COLORS.card, borderRadius: 16, overflow: 'hidden' }}>
                        <div style={{ height: 110, background: palette.bg, display: 'grid', placeItems: 'center' }}>
                        {memory.image_url ? (
                          <img src={memory.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <Image size={30} color={palette.icon} strokeWidth={2.1} />
                        )}
                      </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 10px 6px' }}>
                          {memory.profile?.avatar_url ? (
                            <img src={memory.profile.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 22, height: 22, borderRadius: 11, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                              {author.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {author}
                          </div>
                        </div>
                        {memory.text && (
                          <p style={{ fontSize: 11, lineHeight: 1.28, color: COLORS.muted, fontWeight: 500, padding: '0 10px 10px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {memory.text}
                          </p>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setMemoryModalOpen(true)}
                style={{ width: '100%', minHeight: 52, border: '1.5px dashed #d1d1d6', borderRadius: 14, background: COLORS.card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: COLORS.text, fontSize: 14, fontWeight: 700 }}
              >
                <Plus size={18} color={COLORS.pink} strokeWidth={2.6} />
                Ajouter un souvenir
              </button>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, padding: '0 2px' }}>Qui a contribué</div>
                {contributors.length === 0 ? (
                  <EmptyCard>Aucun invité lié à cet événement.</EmptyCard>
                ) : (
                  <div style={{ background: COLORS.card, borderRadius: 16, overflow: 'hidden' }}>
                    {contributors.map((contributor, index) => {
                      const name = firstName(contributor.profile, 'Invité')
                      const contributed = contributor.nb_memories > 0

                      return (
                        <div key={contributor.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px' }}>
                          {index > 0 && <div style={{ position: 'absolute', top: 0, left: 58, right: 0, height: 0.5, background: COLORS.line }} />}
                          {contributor.profile?.avatar_url ? (
                            <img src={contributor.profile.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: 17, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: 17, background: avatarColor(contributor.invited_user_id || name), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </div>
                            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, marginTop: 2 }}>{contributor.nb_memories} souvenir{contributor.nb_memories > 1 ? 's' : ''}</div>
                          </div>
                          <span style={{ borderRadius: 999, background: contributed ? 'rgba(52,199,89,0.12)' : COLORS.bg, color: contributed ? '#1e7a35' : COLORS.muted, fontSize: 11, fontWeight: 700, padding: '5px 9px', flexShrink: 0 }}>
                            {contributed ? 'Contribué' : 'À relancer'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'gifts' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <h2 style={{ fontSize: 15, fontWeight: 900 }}>Wishlist</h2>
                <button type="button" onClick={() => setGiftModalOpen(true)} style={{ height: 34, padding: '0 12px', borderRadius: 17, background: COLORS.gradient, color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} /> Ajouter
                </button>
              </div>

              {giftItems.length === 0 ? (
                <EmptyCard>Aucune idée cadeau ajoutée.</EmptyCard>
              ) : giftItems.map(item => (
                <article key={item.id} style={{ background: COLORS.card, borderRadius: 16, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 13, background: 'rgba(224,85,170,0.11)', color: COLORS.pink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Gift size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 850, lineHeight: 1.25 }}>{item.label}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                        {formatMoney(item.price_estimate) && <span style={{ borderRadius: 999, background: 'rgba(224,85,170,0.10)', color: COLORS.pink, fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>{formatMoney(item.price_estimate)}</span>}
                        {item.claimed_by && <span style={{ borderRadius: 999, background: 'rgba(52,199,89,0.12)', color: COLORS.green, fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>Pris par {firstName(item.claimedProfile)}</span>}
                      </div>
                    </div>
                  </div>
                  {!item.claimed_by && (
                    <PrimaryButton onClick={() => handleClaimGiftItem(item.id)} style={{ marginTop: 12, minHeight: 42, fontSize: 13 }}>
                      Je m&apos;en charge
                    </PrimaryButton>
                  )}
                </article>
              ))}

              <h2 style={{ fontSize: 15, fontWeight: 900, marginTop: 4 }}>Cadeaux collectifs</h2>
              {collectiveGifts.length === 0 ? (
                <EmptyCard>Aucun cadeau collectif pour le moment.</EmptyCard>
              ) : collectiveGifts.map(gift => (
                <article key={gift.id} style={{ background: COLORS.card, borderRadius: 16, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: 15, fontWeight: 850, lineHeight: 1.25 }}>{gift.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {formatMoney(gift.price) && <span style={{ borderRadius: 999, background: 'rgba(224,85,170,0.10)', color: COLORS.pink, fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>{formatMoney(gift.price)}</span>}
                    {gift.needs_contribution && <span style={{ borderRadius: 999, background: '#FFF3E0', color: '#A76500', fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>Contribution {formatMoney(gift.contribution_amount) ?? 'ouverte'}</span>}
                    {gift.claimed_by && <span style={{ borderRadius: 999, background: 'rgba(52,199,89,0.12)', color: COLORS.green, fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>Pris par {firstName(gift.claimedProfile)}</span>}
                  </div>
                </article>
              ))}
            </>
          )}

          {activeTab === 'cagnotte' && (
            event.cagnotte_url ? (
              <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 15, background: 'rgba(245,166,35,0.15)', color: COLORS.orange, display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                  <Sparkles size={20} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Cagnotte prête</h2>
                {event.cagnotte_goal && (
                  <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700, marginBottom: 14 }}>
                    Objectif : {formatMoney(event.cagnotte_goal)}
                  </div>
                )}
                <a href={event.cagnotte_url} target="_blank" rel="noreferrer" style={{ minHeight: 48, borderRadius: 14, background: COLORS.gradient, color: '#fff', fontSize: 14, fontWeight: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                  Accéder à la cagnotte <ExternalLink size={17} />
                </a>
              </div>
            ) : guestLeaderLoading ? (
              <EmptyCard>Chargement...</EmptyCard>
            ) : canManageCagnotte ? (
              <form onSubmit={handleCagnotteSubmit} style={{ background: COLORS.card, borderRadius: 16, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 11 }}>
                <Input label="Lien de la cagnotte" type="text" value={cagnotteUrl} onChange={event => setCagnotteUrl(event.target.value)} placeholder="https://..." />
                <Input label="Objectif" type="number" min="0" step="0.01" value={cagnotteGoal} onChange={event => setCagnotteGoal(event.target.value)} placeholder="150" />
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>Cadeau associé</span>
                  <select value={cagnotteGiftId} onChange={event => setCagnotteGiftId(event.target.value)} style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '12px 13px', fontSize: 14, color: COLORS.text, background: COLORS.card, outline: 'none' }}>
                    <option value="">Aucun cadeau</option>
                    {collectiveGifts.map(gift => <option key={gift.id} value={gift.id}>{gift.name}</option>)}
                  </select>
                </label>
                <PrimaryButton disabled={cagnotteSaving || !cagnotteUrl.trim()} style={{ marginTop: 2 }} type="submit">
                  {cagnotteSaving ? 'Enregistrement...' : 'Créer la cagnotte'}
                </PrimaryButton>
              </form>
            ) : (
              <EmptyCard>La cagnotte n'a pas encore été créée.</EmptyCard>
            )
          )}

          {errorMessage && event && <div style={{ color: COLORS.red, fontSize: 12, fontWeight: 700 }}>{errorMessage}</div>}
        </section>
      </main>

      {memoryModalOpen && (
        <Sheet title="Ajouter un souvenir" onClose={closeMemorySheet}>
          <form onSubmit={handleAddMemory} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Texte</span>
              <textarea
                autoFocus
                value={memoryForm.text}
                onChange={event => setMemoryForm(current => ({ ...current, text: event.target.value }))}
                placeholder="Un souvenir, une private joke, un mot doux..."
                rows={4}
                style={{ width: '100%', border: 'none', borderRadius: 12, padding: '12px 13px', fontSize: 14, color: COLORS.text, background: COLORS.bg, outline: 'none', resize: 'none' }}
              />
            </label>

            <div>
              <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Emoji</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setMemoryForm(current => ({ ...current, emoji }))}
                    style={{ height: 38, borderRadius: 12, background: memoryForm.emoji === emoji ? '#fff3e0' : COLORS.bg, border: memoryForm.emoji === emoji ? `1.5px solid ${COLORS.orange}` : '1.5px solid transparent', fontSize: 18 }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Image</div>
              <button
                type="button"
                onClick={() => memoryFileInputRef.current?.click()}
                style={{ width: '100%', height: 126, borderRadius: 14, background: COLORS.bg, overflow: 'hidden', display: 'grid', placeItems: 'center', color: COLORS.muted }}
              >
                {memoryImagePreview ? (
                  <img src={memoryImagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                    <Upload size={22} color={COLORS.pink} />
                    Ajouter une image
                  </span>
                )}
              </button>
              <input
                ref={memoryFileInputRef}
                type="file"
                accept="image/*"
                onChange={event => setMemoryImageFile(event.target.files?.[0] ?? null)}
                style={{ display: 'none' }}
              />
              <Input label="Image URL" type="url" value={memoryForm.image_url} onChange={event => setMemoryForm(current => ({ ...current, image_url: event.target.value }))} placeholder="https://..." style={{ marginTop: 9, background: COLORS.bg, border: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Couleur de fond</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {MEMORY_PASTELS.map(palette => (
                  <button
                    key={palette.bg}
                    type="button"
                    aria-label={`Choisir la couleur ${palette.bg}`}
                    onClick={() => setMemoryForm(current => ({ ...current, bg_color: palette.bg }))}
                    style={{ width: 34, height: 34, borderRadius: 17, background: palette.bg, border: memoryForm.bg_color === palette.bg ? `2px solid ${COLORS.pink}` : '2px solid transparent', boxShadow: '0 0 0 1px #d1d1d6' }}
                  />
                ))}
              </div>
            </div>

            <PrimaryButton disabled={memorySaving || (!memoryForm.text.trim() && !memoryForm.emoji.trim() && !memoryForm.image_url.trim() && !memoryImageFile)} style={{ marginTop: 3 }} type="submit">
              {memorySaving ? 'Ajout...' : 'Ajouter'}
            </PrimaryButton>
          </form>
        </Sheet>
      )}

      {giftModalOpen && (
        <Sheet title="Ajouter un cadeau" onClose={() => setGiftModalOpen(false)}>
          <form onSubmit={handleAddGift} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Input autoFocus label="Cadeau" type="text" value={giftForm.label} onChange={event => setGiftForm(current => ({ ...current, label: event.target.value }))} placeholder="Nom du cadeau" />
            <Input label="Prix estimé" type="number" min="0" step="0.01" value={giftForm.price_estimate} onChange={event => setGiftForm(current => ({ ...current, price_estimate: event.target.value }))} placeholder="€" />
            <PrimaryButton disabled={giftSaving || !giftForm.label.trim()} style={{ marginTop: 2 }} type="submit">
              {giftSaving ? 'Ajout...' : 'Ajouter'}
            </PrimaryButton>
          </form>
        </Sheet>
      )}

      {toast?.message && (
        <div style={{ position: 'fixed', left: '50%', bottom: 26, zIndex: 950, transform: 'translateX(-50%)', background: toast.isError ? COLORS.red : COLORS.text, color: '#fff', borderRadius: 14, padding: '11px 16px', fontSize: 13, fontWeight: 750, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
