import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, Gift, Image, Lock, MessageCircle, Plus, Upload, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { captureSupabaseError } from '../lib/monitoring'
import { daysUntilReveal, fetchSecretUnreadCount, formatEuros, formatRevealDay, hiddenFromLabel, memoriesRevealed, SECRET_ACCENT, SECRET_ACCENT_ON_DARK, SECRET_ACCENT_SOFT, SECRET_SPACE_TABS, secretRevealDay } from '../lib/secretSpace'
import GuestLeaderBanner from '../components/GuestLeaderBanner'
import PendingCandidatesPanel from '../components/PendingCandidatesPanel'
import { useGuestLeader } from '../hooks/useGuestLeader'
import { COLORS, EmptyCard, Input, PrimaryButton, SecondaryButton, Sheet } from '../components/secretSpace/ui'
import CagnotteTab from '../components/secretSpace/CagnotteTab'
import MemoryCard from '../components/secretSpace/MemoryCard'
import MemoryActionSheet from '../components/secretSpace/MemoryActionSheet'
import { MEMORY_IMAGES_BUCKET, uploadMemoryImage, withMemoryImageUrls } from '../lib/memories'
import { sortGuests } from '../lib/eventGuests'
import { profileFullName } from '../utils/displayName'

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

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return null
  return formatEuros(value)
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
    .select('id, first_name, name, username, avatar_url')
    .in('id', uniqueIds)

  if (error) throw error
  return (data ?? []).reduce((acc, profile) => {
    acc[profile.id] = profile
    return acc
  }, {})
}

// Écran de MainApp (App.jsx) : le retour et le lien vers le chat Secret
// passent par l'historique de l'app.
export default function SecretSpacePage({ eventId, initialTab = 'flashback', focusItemId = null, onTabChange, onBack, onOpenSecretChat }) {
  const memoryFileInputRef = useRef(null)
  const [event, setEvent] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [activeTab, setActiveTabState] = useState(SECRET_SPACE_TABS.includes(initialTab) ? initialTab : 'flashback')
  const [highlightedId, setHighlightedId] = useState(focusItemId)
  const [secretUnread, setSecretUnread] = useState(0)
  const [remindedIds, setRemindedIds] = useState(() => new Set())
  const [remindingId, setRemindingId] = useState(null)
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
  const [memoriesLoaded, setMemoriesLoaded] = useState(false)
  // Remplacement : souvenir d'origine, et son image du bucket gardée tant
  // qu'on n'en choisit pas une autre
  const [replacingMemory, setReplacingMemory] = useState(null)
  const [keptImage, setKeptImage] = useState(null)
  const [memoryAction, setMemoryAction] = useState(null)
  const [memoryDeleting, setMemoryDeleting] = useState(false)

  const [giftItems, setGiftItems] = useState([])
  const [collectiveGifts, setCollectiveGifts] = useState([])
  const [confirmDeleteGiftId, setConfirmDeleteGiftId] = useState(null)
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [giftForm, setGiftForm] = useState(EMPTY_GIFT_FORM)
  const [giftSaving, setGiftSaving] = useState(false)

  const revealDay = useMemo(() => secretRevealDay(event?.date), [event?.date])
  const revealDays = useMemo(() => daysUntilReveal(event?.date), [event?.date])
  const revealed = useMemo(() => memoriesRevealed(event?.date), [event?.date])
  const birthdayFirstName = firstName(event?.birthdayProfile, 'la personne fêtée')
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
  // Même règle que can_manage_cagnotte : organisateurs et coordinateur approuvé
  const isOrganizer = ['owner', 'co_organizer'].includes(currentUserRole)
  const canManageCagnotte = isOrganizer || isGuestLeader
  const cagnotteMembers = useMemo(() => contributors.map(contributor => ({
    user_id: contributor.invited_user_id,
    name: contributor.profile?.name,
    status: contributor.status,
  })), [contributors])

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError })
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  function setActiveTab(tab) {
    setActiveTabState(tab)
    setHighlightedId(null)
    onTabChange?.(tab)
  }

  // Bouton « Discussion secrète » : non lus du chat Secret, en direct
  const refreshSecretChat = useCallback(async () => {
    if (!eventId || !currentUserId) return
    try {
      setSecretUnread(await fetchSecretUnreadCount(eventId, currentUserId))
    } catch (error) {
      captureSupabaseError(error, { operation: 'fetch_secret_unread_count' })
    }
    // Personnes déjà relancées (une relance par 24 h, règle du serveur)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('messages')
      .select('system_data')
      .eq('event_id', eventId)
      .eq('is_secret', true)
      .eq('system_type', 'secret_reminder')
      .gt('created_at', since)
    if (error) { captureSupabaseError(error, { operation: 'fetch_secret_reminders' }); return }
    setRemindedIds(new Set((data ?? []).map(row => row.system_data?.target_id).filter(Boolean)))
  }, [eventId, currentUserId])

  useEffect(() => {
    if (!event || !currentUserId) return undefined
    refreshSecretChat()
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`secret-space-chat:${eventId}:${suffix}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, payload => {
        if (payload.new?.is_secret) refreshSecretChat()
      })
      .subscribe()
    const handleVisibility = () => { if (document.visibilityState === 'visible') refreshSecretChat() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [event, currentUserId, eventId, refreshSecretChat])

  // Élément ouvert depuis un message du chat Secret : visible et surligné
  useEffect(() => {
    if (!highlightedId) return undefined
    const element = document.getElementById(`secret-item-${highlightedId}`)
    if (!element) {
      // Lien du chat vers un souvenir supprimé entre-temps
      if (activeTab === 'flashback' && memoriesLoaded && !memories.some(memory => memory.id === highlightedId)) {
        setHighlightedId(null)
        showToast('Ce souvenir a été supprimé')
      }
      return undefined
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = window.setTimeout(() => setHighlightedId(null), 2400)
    return () => window.clearTimeout(timer)
  }, [highlightedId, memories, memoriesLoaded, giftItems, activeTab, showToast])

  async function handleRemind(contributor) {
    if (!contributor.invited_user_id || remindingId) return
    setRemindingId(contributor.invited_user_id)
    const { data, error } = await supabase.rpc('remind_secret_space_guest', { p_event_id: eventId, p_user_id: contributor.invited_user_id })
    setRemindingId(null)
    if (error) {
      captureSupabaseError(error, { operation: 'remind_secret_space_guest' })
      showToast('Impossible de relancer pour le moment.', true)
      return
    }
    setRemindedIds(prev => new Set([...prev, contributor.invited_user_id]))
    const name = contributor.profile?.name || 'Cette personne'
    showToast(data === 'too_soon' ? `${name} a déjà été relancé·e aujourd’hui` : `Relance envoyée dans la discussion secrète`)
  }


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

    // Tous les souvenirs sans contenu (auteur, date), puis le contenu de ceux
    // que la RLS laisse lire : les siens avant la révélation. Les autres
    // restent des cartes masquées.
    const [entriesRes, contentRes] = await Promise.all([
      supabase.rpc('get_flashback_entries', { p_event_id: eventId }),
      supabase
        .from('collective_memories')
        .select('id, card_id, event_id, contributor_id, text, image_url, emoji, bg_color, created_at')
        .eq('event_id', eventId),
    ])
    if (entriesRes.error) throw entriesRes.error
    if (contentRes.error) throw contentRes.error
    const entries = entriesRes.data ?? []
    // Liste complète pour tout membre (les invitations des autres ne sont
    // lisibles que par les organisateurs)
    const { data: guestRows, error: guestError } = await supabase.rpc('get_event_guest_list', { p_event_id: eventId })
    if (guestError) throw guestError
    const profilesById = await fetchProfilesByIds(entries.map(entry => entry.contributor_id))
    const readable = await withMemoryImageUrls(contentRes.data ?? [])
    const contentById = Object.fromEntries(readable.map(memory => [memory.id, memory]))
    setMemories(entries.map(entry => ({
      ...(contentById[entry.id] ?? { ...entry, hidden: true }),
      profile: profilesById[entry.contributor_id] ?? null,
    })))
    setMemoriesLoaded(true)

    const counts = entries.reduce((acc, memory) => {
      if (!memory.contributor_id) return acc
      acc[memory.contributor_id] = (acc[memory.contributor_id] ?? 0) + 1
      return acc
    }, {})

    // Comptes Amiv seulement ; la personne fêtée n'est jamais listée (ni
    // relancée) dans son propre espace secret
    const birthdayPersonId = event?.birthday_person_user_id
    setContributors(sortGuests(guestRows ?? [])
      .filter(guest => guest.user_id && guest.user_id !== birthdayPersonId)
      .map(guest => ({
        id: guest.guest_key,
        invited_user_id: guest.user_id,
        status: guest.status,
        profile: { name: guest.display_name, avatar_url: guest.avatar_url },
        nb_memories: counts[guest.user_id] ?? 0,
      })))
  }, [eventId, event?.birthday_person_user_id])

  const fetchGifts = useCallback(async () => {
    if (!eventId) return

    const [itemsRes, giftsRes] = await Promise.all([
      supabase
        .from('gift_items')
        .select('id, event_id, label, price_estimate, added_by, claimed_by, collective_gift_id, created_at')
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

    // Passées « Via la cagnotte » : affichées dans Cadeaux collectifs
    setGiftItems(items.filter(item => !item.collective_gift_id).map(item => ({
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
    // Ligne complète : elle sert aussi à ouvrir le chat de l'événement
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Événement introuvable.')
    if (data.birthday_person_user_id && data.birthday_person_user_id === userId) {
      throw new Error('Cet espace n’est pas accessible.')
    }

    const { data: canAccess, error: accessError } = await supabase.rpc('can_access_secret_space', { p_event_id: eventId })
    if (accessError) throw accessError
    if (!canAccess) {
      throw new Error('L’espace secret est réservé aux invités ayant accepté l’invitation et aux organisateurs.')
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
  }, [eventId])

  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      setErrorMessage('')
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!user || cancelled) return
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
  }, [eventId, fetchEvent])

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

  async function handleAddMemory(event) {
    event.preventDefault()
    if (!cardId || !currentUserId || memorySaving) return
    const text = memoryForm.text.trim()
    const emoji = memoryForm.emoji.trim()
    const imageUrl = memoryForm.image_url.trim()
    const keptPath = keptImage?.path ?? null
    if (!text && !emoji && !imageUrl && !memoryImageFile && !keptPath) return

    setMemorySaving(true)
    let uploadedUrl = null
    try {
      if (memoryImageFile && currentUserId) uploadedUrl = await uploadMemoryImage(memoryImageFile, eventId, currentUserId)
    } catch (error) {
      console.error('[SecretSpace] memory image upload error:', error)
      setMemorySaving(false)
      setErrorMessage("Impossible d'envoyer l'image.")
      return
    }

    const image = uploadedUrl || imageUrl || keptPath || null
    const bgColor = memoryForm.bg_color || '#fbeaf0'
    // Remplacement : nouveau souvenir puis suppression de l'ancien, dans une
    // seule transaction (l'ancienne image est purgée côté serveur)
    const { error } = replacingMemory
      ? await supabase.rpc('replace_flashback_memory', {
        p_memory_id: replacingMemory.id,
        p_text: text,
        p_emoji: emoji,
        p_image_url: image,
        p_bg_color: bgColor,
      })
      : await supabase
        .from('collective_memories')
        .insert({
          card_id: cardId,
          event_id: eventId,
          contributor_id: currentUserId,
          text: text || null,
          emoji: emoji || null,
          image_url: image,
          bg_color: bgColor,
        })

    setMemorySaving(false)
    if (error) {
      console.error('[SecretSpace] memory save error:', error)
      if (uploadedUrl) supabase.storage.from(MEMORY_IMAGES_BUCKET).remove([uploadedUrl])
      setErrorMessage(replacingMemory ? 'Impossible de remplacer le souvenir.' : "Impossible d'ajouter le souvenir.")
      return
    }
    resetMemoryForm()
    setMemoryModalOpen(false)
    if (replacingMemory) showToast('Souvenir remplacé')
    await fetchFlashback()
  }

  function resetMemoryForm() {
    setMemoryForm(EMPTY_MEMORY_FORM)
    setMemoryImageFile(null)
    setReplacingMemory(null)
    setKeptImage(null)
  }

  function closeMemorySheet() {
    if (memorySaving) return
    setMemoryModalOpen(false)
    if (replacingMemory) resetMemoryForm()
    else setMemoryImageFile(null)
  }

  function openReplaceMemory(memory) {
    const storedImage = memory.image_url && !/^https?:\/\//i.test(memory.image_url)
    setMemoryAction(null)
    setReplacingMemory(memory)
    setMemoryForm({
      text: memory.text ?? '',
      emoji: memory.emoji ?? '',
      image_url: storedImage ? '' : memory.image_url ?? '',
      bg_color: memory.bg_color || EMPTY_MEMORY_FORM.bg_color,
    })
    setKeptImage(storedImage ? { path: memory.image_url, url: memory.display_image_url } : null)
    setMemoryImageFile(null)
    setMemoryModalOpen(true)
  }

  function removeMemoryImage() {
    setMemoryImageFile(null)
    setKeptImage(null)
    setMemoryForm(current => ({ ...current, image_url: '' }))
    if (memoryFileInputRef.current) memoryFileInputRef.current.value = ''
  }

  // Auteur seulement, avant la révélation (RLS) : 0 ligne supprimée = refus
  async function handleDeleteMemory() {
    if (!memoryAction || memoryDeleting) return
    const memoryId = memoryAction.id
    setMemoryDeleting(true)
    const { data, error } = await supabase
      .from('collective_memories')
      .delete()
      .eq('id', memoryId)
      .select('id')
    setMemoryDeleting(false)
    setMemoryAction(null)
    if (error || !data?.length) {
      if (error) captureSupabaseError(error, { operation: 'delete_flashback_memory' })
      showToast('Impossible de supprimer ce souvenir.', true)
      return
    }
    setMemories(current => current.filter(memory => memory.id !== memoryId))
    showToast('Souvenir supprimé')
    await fetchFlashback()
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

  // La base n'accepte l'annulation que de la personne qui a pris le cadeau
  async function handleUnclaimGiftItem(giftItemId) {
    if (!currentUserId) return
    const { error } = await supabase
      .from('gift_items')
      .update({ claimed_by: null })
      .eq('id', giftItemId)
      .eq('claimed_by', currentUserId)

    if (error) {
      console.error('[SecretSpace] gift item unclaim error:', error)
      setErrorMessage("Impossible d'annuler.")
      return
    }
    await fetchGifts()
  }

  async function handleMoveGiftItemToCagnotte(giftItemId) {
    if (!currentUserId) return
    const { error } = await supabase.rpc('move_gift_item_to_cagnotte', { p_item_id: giftItemId })

    if (error) {
      console.error('[SecretSpace] gift item to cagnotte error:', error)
      setErrorMessage(error.code === '55000' ? 'Ce cadeau est déjà pris.' : 'Impossible de passer ce cadeau en cagnotte.')
      await fetchGifts()
      return
    }
    showToast('Ajouté aux cadeaux collectifs')
    await fetchGifts()
  }

  // Organisateurs et coordinateur seulement (vérifié par la base) ; l'idée
  // d'origine revient dans la wishlist.
  async function handleDeleteCollectiveGift(giftId) {
    setConfirmDeleteGiftId(null)
    const { data, error } = await supabase
      .from('gifts')
      .delete()
      .eq('id', giftId)
      .select('id')

    if (error || !data?.length) {
      if (error) console.error('[SecretSpace] collective gift delete error:', error)
      setErrorMessage('Impossible de supprimer ce cadeau.')
      return
    }
    await fetchGifts()
  }


  if (loading) {
    return (
      <div style={{ flex: 1, minHeight: 0, background: COLORS.bg, display: 'grid', placeItems: 'center', color: COLORS.muted, fontSize: 14 }}>
        Chargement...
      </div>
    )
  }

  if (errorMessage && !event) {
    return (
      <div style={{ flex: 1, minHeight: 0, background: COLORS.bg, padding: 16 }}>
        <button type="button" onClick={() => onBack?.(null)} style={{ color: '#007AFF', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Retour</button>
        <EmptyCard>{errorMessage}</EmptyCard>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: COLORS.bg, color: COLORS.text }}>
      <main style={{ width: '100%', maxWidth: 430, minHeight: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          @keyframes secretHighlight {
            0%, 60% { box-shadow: 0 0 0 3px ${SECRET_ACCENT_ON_DARK}; }
            100% { box-shadow: 0 0 0 0 rgba(175,169,236,0); }
          }
          @keyframes secretPulse {
            0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(245,166,35,0.35); }
            50% { transform: scale(1.15); opacity: 0.78; box-shadow: 0 0 0 7px rgba(245,166,35,0); }
          }
        `}</style>
        <header style={{ position: 'relative', overflow: 'hidden', background: '#1c1c1e', padding: '12px 16px 18px' }}>
          <div style={{ position: 'absolute', top: -68, right: -62, width: 184, height: 184, borderRadius: '50%', background: 'radial-gradient(circle, rgba(224,85,170,0.35) 0%, rgba(224,85,170,0.16) 38%, rgba(224,85,170,0) 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" aria-label="Retour" onClick={() => onBack?.(event)} style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.10)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <ChevronLeft size={23} />
            </button>
            <div style={{ minWidth: 0, flex: 1, color: 'rgba(255,255,255,0.68)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Anniv de {birthdayFirstName} · {formatHeroDate(event?.date)}
            </div>
          </div>

          {!revealed && (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, borderRadius: 999, background: 'rgba(175,169,236,0.14)', border: '1px solid rgba(175,169,236,0.30)', color: SECRET_ACCENT_ON_DARK, padding: '6px 12px', fontSize: 11, fontWeight: 700 }}>
              <Lock size={12} strokeWidth={2.4} />
              Espace secret · {hiddenFromLabel(birthdayFirstName)}
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
              Révélation le {formatRevealDay(revealDay)} à 00:00
            </span>
            <span style={{ color: COLORS.orange, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
              {revealDays === null ? 'J-?' : revealDays > 0 ? `J-${revealDays}` : 'J'}
            </span>
          </div>

          {onOpenSecretChat && (
            <button type="button" onClick={() => onOpenSecretChat(event)} style={{ position: 'relative', width: '100%', minHeight: 44, marginTop: 10, borderRadius: 14, background: 'rgba(175,169,236,0.14)', border: '1px solid rgba(175,169,236,0.30)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, color: '#fff', cursor: 'pointer' }}>
              <Lock size={15} strokeWidth={2.4} color={SECRET_ACCENT_ON_DARK} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 13, fontWeight: 800 }}>Discussion secrète</span>
              {secretUnread > 0 ? (
                <span aria-label={`${secretUnread} message${secretUnread > 1 ? 's' : ''} non lu${secretUnread > 1 ? 's' : ''}`} style={{ minWidth: 22, height: 22, borderRadius: 11, padding: '0 7px', background: SECRET_ACCENT_ON_DARK, color: '#1c1c1e', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {secretUnread > 99 ? '99+' : secretUnread}
                </span>
              ) : (
                <MessageCircle size={16} strokeWidth={2.2} color="rgba(255,255,255,0.55)" style={{ flexShrink: 0 }} />
              )}
            </button>
          )}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, alignItems: 'start' }}>
                  {memories.map((memory, index) => {
                    const author = profileFullName(memory.profile, 'Ami')
                    return (
                      <MemoryCard
                        key={memory.id}
                        memory={memory}
                        author={author}
                        palette={memoryPalette(memory, index)}
                        avatarColor={avatarColor(memory.contributor_id || author)}
                        highlighted={highlightedId === memory.id}
                        onMenu={!revealed && !memory.hidden && memory.contributor_id === currentUserId ? setMemoryAction : undefined}
                      />
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
                      const name = contributor.profile?.name || 'Invité'
                      const contributed = contributor.nb_memories > 0
                      // Relance seulement pour qui a accepté (le serveur vérifie)
                      const canRemind = !contributed && contributor.status === 'confirmed' && !!contributor.invited_user_id && contributor.invited_user_id !== currentUserId
                      const reminded = remindedIds.has(contributor.invited_user_id)

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
                          {canRemind ? (
                            <button
                              type="button"
                              disabled={reminded || remindingId === contributor.invited_user_id}
                              onClick={() => handleRemind(contributor)}
                              style={{ borderRadius: 999, background: reminded ? COLORS.bg : SECRET_ACCENT_SOFT, color: reminded ? COLORS.muted : SECRET_ACCENT, fontSize: 11, fontWeight: 800, padding: '6px 10px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: reminded ? 'default' : 'pointer' }}
                            >
                              {reminded ? <><Check size={12} strokeWidth={2.6} /> Relancé</> : remindingId === contributor.invited_user_id ? 'Envoi…' : 'À relancer'}
                            </button>
                          ) : (
                            <span style={{ borderRadius: 999, background: contributed ? 'rgba(52,199,89,0.12)' : COLORS.bg, color: contributed ? '#1e7a35' : COLORS.muted, fontSize: 11, fontWeight: 700, padding: '5px 9px', flexShrink: 0 }}>
                              {contributed ? 'Contribué' : contributor.invited_user_id === currentUserId ? 'Toi' : contributor.status === 'declined' ? 'Absent' : 'Pas encore confirmé'}
                            </span>
                          )}
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
                <article key={item.id} id={`secret-item-${item.id}`} style={{ background: COLORS.card, borderRadius: 16, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', animation: highlightedId === item.id ? 'secretHighlight 2.4s ease-out' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 13, background: 'rgba(224,85,170,0.11)', color: COLORS.pink, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Gift size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 850, lineHeight: 1.25 }}>{item.label}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                        {formatMoney(item.price_estimate) && <span style={{ borderRadius: 999, background: 'rgba(224,85,170,0.10)', color: COLORS.pink, fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>{formatMoney(item.price_estimate)}</span>}
                        {item.claimed_by && <span style={{ borderRadius: 999, background: 'rgba(52,199,89,0.12)', color: COLORS.green, fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>Pris par {profileFullName(item.claimedProfile, 'Quelqu’un')}</span>}
                        {item.claimed_by && item.claimed_by === currentUserId && (
                          <button type="button" onClick={() => handleUnclaimGiftItem(item.id)} style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textDecoration: 'underline', padding: '4px 2px' }}>
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {!item.claimed_by && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <PrimaryButton onClick={() => handleClaimGiftItem(item.id)} style={{ flex: 1, minHeight: 42, fontSize: 13 }}>
                        Je prends en charge
                      </PrimaryButton>
                      <SecondaryButton onClick={() => handleMoveGiftItemToCagnotte(item.id)} style={{ flex: 1, minHeight: 42, fontSize: 13 }}>
                        Via la cagnotte
                      </SecondaryButton>
                    </div>
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
                    {gift.claimed_by && <span style={{ borderRadius: 999, background: 'rgba(52,199,89,0.12)', color: COLORS.green, fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>Pris par {profileFullName(gift.claimedProfile, 'Quelqu’un')}</span>}
                  </div>
                  {canManageCagnotte && (
                    confirmDeleteGiftId === gift.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: COLORS.muted }}>Supprimer ce cadeau ?</span>
                        <button type="button" onClick={() => handleDeleteCollectiveGift(gift.id)} style={{ color: COLORS.red, fontWeight: 800 }}>Supprimer</button>
                        <button type="button" onClick={() => setConfirmDeleteGiftId(null)} style={{ color: COLORS.muted }}>Non</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteGiftId(gift.id)} style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: COLORS.muted, textDecoration: 'underline' }}>
                        Supprimer
                      </button>
                    )
                  )}
                </article>
              ))}
            </>
          )}

          {activeTab === 'cagnotte' && (
            <CagnotteTab
              eventId={eventId}
              currentUserId={currentUserId}
              canManage={canManageCagnotte}
              isOrganizer={isOrganizer}
              roleLoading={guestLeaderLoading}
              members={cagnotteMembers}
              collectiveGifts={collectiveGifts}
              onToast={showToast}
            />
          )}

          {errorMessage && event && <div style={{ color: COLORS.red, fontSize: 12, fontWeight: 700 }}>{errorMessage}</div>}
        </section>
      </main>

      {memoryModalOpen && (
        <Sheet title={replacingMemory ? 'Remplacer le souvenir' : 'Ajouter un souvenir'} onClose={closeMemorySheet}>
          <form onSubmit={handleAddMemory} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Texte</span>
              <textarea
                autoFocus
                value={memoryForm.text}
                onChange={event => setMemoryForm(current => ({ ...current, text: event.target.value }))}
                placeholder="Un souvenir, une private joke, un mot doux..."
                rows={4}
                style={{ width: '100%', border: 'none', borderRadius: 12, padding: '12px 13px', fontSize: 16, color: COLORS.text, background: COLORS.bg, outline: 'none', resize: 'none' }}
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
                {memoryImagePreview || keptImage?.url ? (
                  <img src={memoryImagePreview || keptImage.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
              {(memoryImageFile || keptImage) && (
                <button type="button" onClick={removeMemoryImage} style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: COLORS.red }}>
                  Retirer l’image
                </button>
              )}
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

            <PrimaryButton disabled={memorySaving || (!memoryForm.text.trim() && !memoryForm.emoji.trim() && !memoryForm.image_url.trim() && !memoryImageFile && !keptImage)} style={{ marginTop: 3 }} type="submit">
              {replacingMemory ? (memorySaving ? 'Remplacement...' : 'Remplacer') : (memorySaving ? 'Ajout...' : 'Ajouter')}
            </PrimaryButton>
          </form>
        </Sheet>
      )}

      {memoryAction && (
        <MemoryActionSheet
          busy={memoryDeleting}
          onReplace={() => openReplaceMemory(memoryAction)}
          onDelete={handleDeleteMemory}
          onClose={() => setMemoryAction(null)}
        />
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
