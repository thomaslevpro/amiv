import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CollectiveCardContributorView from '../components/CollectiveCardContributorView'

function frenchDate(dateStr) {
  if (!dateStr) return ''
  const [datePart] = dateStr.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 10 12" fill="none">
      <rect x="1" y="5" width="8" height="7" rx="1.5" stroke="#993556" strokeWidth="1.2" />
      <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="#993556" strokeWidth="1.2" />
    </svg>
  )
}

const TABS = [
  { id: 'carte', label: 'Flashback' },
  { id: 'cadeaux', label: 'Cadeaux' },
  { id: 'cagnotte', label: 'Cagnotte' },
]

const GRADIENT = 'linear-gradient(135deg,#e055aa,#f5a623)'

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return null
  return `${numeric.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`
}

export default function SecretSpacePage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [activeTab, setActiveTab] = useState('carte')
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [currentUserEmail, setCurrentUserEmail] = useState(null)
  const [gifts, setGifts] = useState([])
  const [giftsLoading, setGiftsLoading] = useState(false)
  const [giftSaving, setGiftSaving] = useState(false)
  const [cagnotteUrl, setCagnotteUrl] = useState('')
  const [cagnotteGiftId, setCagnotteGiftId] = useState('')
  const [cagnotteGoal, setCagnotteGoal] = useState('')
  const [cagnotteContributions, setCagnotteContributions] = useState([])
  const [cagnotteContributionsLoading, setCagnotteContributionsLoading] = useState(false)
  const [hasContributed, setHasContributed] = useState(false)
  const [availableGifts, setAvailableGifts] = useState([])
  const [cagnotteSaving, setCagnotteSaving] = useState(false)
  const [giftForm, setGiftForm] = useState({
    name: '',
    price: '',
    needsContribution: false,
    contributionAmount: '',
  })

  const isOrganizer = Boolean(event?.user_id && currentUserId === event.user_id)
  const visibleTabs = TABS.filter((tab) => tab.id !== 'cadeaux' || !isOrganizer)

  const ensureGiftAccessByEmail = useCallback(async () => {
    if (!eventId || !currentUserId || !currentUserEmail || isOrganizer) return

    const { data, error } = await supabase
      .from('invitations')
      .select('id, invited_email')
      .eq('event_id', eventId)
      .eq('invited_user_id', currentUserId)
      .limit(1)
      .maybeSingle()

    if (error || !data || data.invited_email === currentUserEmail) return

    const { error: updateError } = await supabase
      .from('invitations')
      .update({ invited_email: currentUserEmail })
      .eq('id', data.id)

    if (updateError) console.error('[SecretSpace] invitation email sync error:', updateError)
  }, [currentUserEmail, currentUserId, eventId, isOrganizer])

  const fetchGifts = useCallback(async () => {
    if (!eventId || isOrganizer) return
    await ensureGiftAccessByEmail()
    setGiftsLoading(true)
    const { data, error } = await supabase
      .from('gifts')
      .select('*, profiles:added_by(first_name), claimer:claimed_by(first_name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[SecretSpace] gifts query error:', error)
      setGifts([])
    } else {
      setGifts(data ?? [])
    }
    setGiftsLoading(false)
  }, [ensureGiftAccessByEmail, eventId, isOrganizer])

  const fetchCagnotteContributions = useCallback(async () => {
    if (!eventId) return

    setCagnotteContributionsLoading(true)
    const { data, error } = await supabase
      .from('cagnotte_contributions')
      .select('*, profiles:user_id(first_name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[SecretSpace] cagnotte contributions query error:', error)
      setCagnotteContributions([])
      setHasContributed(false)
    } else {
      const contributions = data ?? []
      setCagnotteContributions(contributions)
      setHasContributed(Boolean(currentUserId && contributions.some((contribution) => contribution.user_id === currentUserId)))
    }
    setCagnotteContributionsLoading(false)
  }, [currentUserId, eventId])

  const fetchAvailableGifts = useCallback(async () => {
    if (!eventId) return

    const { data, error } = await supabase
      .from('gifts')
      .select('id, name, price')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[SecretSpace] available gifts query error:', error)
      setAvailableGifts([])
    } else {
      setAvailableGifts(data ?? [])
    }
  }, [eventId])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }
      console.log('[SecretSpace] currentUser.id:', user.id)
      setCurrentUserId(user.id)
      setCurrentUserEmail(user.email ?? null)

      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, created_at, user_id, birthday_person_user_id, cagnotte_url, cagnotte_created_by, cagnotte_goal, cagnotte_gift_id')
        .eq('id', eventId)
        .maybeSingle()

      console.log('[SecretSpace] event query result:', data, 'error:', error)

      if (error || !data) { navigate('/'); return }

      console.log('[SecretSpace] event.user_id:', data.user_id, '=== currentUser?', data.user_id === user.id)

      if (data.user_id) {
        const { data: orgProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.user_id)
          .maybeSingle()
        data.organizerName = orgProfile?.name ?? ''
      }

      if (data.birthday_person_user_id) {
        const { data: birthdayProfile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', data.birthday_person_user_id)
          .maybeSingle()
        data.birthdayFirstName = birthdayProfile?.first_name ?? null
      }

      if (data.cagnotte_created_by) {
        const { data: cagnotteCreatorProfile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', data.cagnotte_created_by)
          .maybeSingle()
        data.cagnotteCreatorFirstName = cagnotteCreatorProfile?.first_name ?? 'quelqu’un'
      }

      setEvent(data)
      setCagnotteUrl(data.cagnotte_url ?? '')
      setCagnotteGiftId(data.cagnotte_gift_id ?? '')
      setCagnotteGoal(data.cagnotte_goal ?? '')
      setLoading(false)
    }
    init()
  }, [eventId, navigate])

  useEffect(() => {
    if (loading) return
    if (!event) { navigate('/'); return }
  }, [event, loading, navigate])

  useEffect(() => {
    if (isOrganizer && activeTab === 'cadeaux') setActiveTab('carte')
  }, [activeTab, isOrganizer])

  useEffect(() => {
    if (!event || isOrganizer || activeTab !== 'cadeaux') return
    fetchGifts()
  }, [activeTab, event, fetchGifts, isOrganizer])

  useEffect(() => {
    if (!event || activeTab !== 'cagnotte') return
    fetchCagnotteContributions()
    fetchAvailableGifts()
  }, [activeTab, event, fetchAvailableGifts, fetchCagnotteContributions])

  if (!event) return null

  const firstName = event.organizerName?.split(' ')[0] ?? ''
  const secretFirstName = event.birthdayFirstName ?? firstName
  const associatedGift = availableGifts.find((gift) => gift.id === event.cagnotte_gift_id)
  const cagnotteGoalNumber = Number(event.cagnotte_goal)
  const cagnotteProgress = event.cagnotte_goal && cagnotteGoalNumber > 0 ? Math.min(100, (cagnotteContributions.length / cagnotteGoalNumber) * 100) : 0
  const cagnotteGoalLabel = event.cagnotte_goal ? Number(event.cagnotte_goal).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : ''

  const handleGiftFormChange = (field, value) => {
    setGiftForm((current) => ({ ...current, [field]: value }))
  }

  const handleGiftSubmit = async (e) => {
    e.preventDefault()
    const name = giftForm.name.trim()
    if (!name || !currentUserId) return

    setGiftSaving(true)
    await ensureGiftAccessByEmail()
    const { error } = await supabase
      .from('gifts')
      .insert({
        event_id: eventId,
        name,
        price: giftForm.price === '' ? null : Number(giftForm.price),
        needs_contribution: giftForm.needsContribution,
        contribution_amount: giftForm.needsContribution && giftForm.contributionAmount !== '' ? Number(giftForm.contributionAmount) : null,
        added_by: currentUserId,
      })

    if (error) {
      console.error('[SecretSpace] gift insert error:', error)
    } else {
      setGiftForm({ name: '', price: '', needsContribution: false, contributionAmount: '' })
      await fetchGifts()
    }
    setGiftSaving(false)
  }

  const handleClaimGift = async (giftId) => {
    if (!currentUserId) return
    const { error } = await supabase
      .from('gifts')
      .update({ claimed_by: currentUserId })
      .eq('id', giftId)

    if (error) {
      console.error('[SecretSpace] gift claim error:', error)
    } else {
      await fetchGifts()
    }
  }

  const handleDeleteGift = async (giftId) => {
    const { error } = await supabase
      .from('gifts')
      .delete()
      .eq('id', giftId)

    if (error) {
      console.error('[SecretSpace] gift delete error:', error)
    } else {
      await fetchGifts()
    }
  }

  const handleCagnotteSubmit = async (e) => {
    e.preventDefault()

    const value = cagnotteUrl.trim()
    if (!value || !currentUserId || isOrganizer) return

    setCagnotteSaving(true)
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', currentUserId)
      .maybeSingle()

    const { error } = await supabase
      .from('events')
      .update({
        cagnotte_url: value,
        cagnotte_created_by: currentUserId,
        cagnotte_gift_id: cagnotteGiftId || null,
        cagnotte_goal: cagnotteGoal || null,
      })
      .eq('id', eventId)

    if (error) {
      console.error('[SecretSpace] cagnotte update error:', error)
      setCagnotteSaving(false)
      return
    }

    setEvent((current) => current ? {
      ...current,
      cagnotte_url: value,
      cagnotte_created_by: currentUserId,
      cagnotteCreatorFirstName: creatorProfile?.first_name ?? current.cagnotteCreatorFirstName ?? 'toi',
      cagnotte_gift_id: cagnotteGiftId || null,
      cagnotte_goal: cagnotteGoal || null,
    } : current)
    setCagnotteUrl(value)
    await fetchCagnotteContributions()
    setCagnotteSaving(false)
  }

  const handleCagnotteContribution = async () => {
    if (!currentUserId || isOrganizer || hasContributed) return

    const { error } = await supabase
      .from('cagnotte_contributions')
      .insert({
        event_id: eventId,
        user_id: currentUserId,
      })

    if (error) {
      console.error('[SecretSpace] cagnotte contribution insert error:', error)
    } else {
      await fetchCagnotteContributions()
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', minHeight: '100dvh' }}>
      <div style={{ background: '#fff', padding: '16px 16px 12px', borderBottom: '1px solid #F2F2F7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px 4px 0', display: 'flex', alignItems: 'center' }}
          >
            <svg width="10" height="17" viewBox="0 0 10 17" fill="none">
              <path d="M8.5 1.5L1.5 8.5L8.5 15.5" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>
              Amiv de {firstName}
            </div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 1 }}>
              {frenchDate(event.date)}
            </div>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(224,85,170,0.10)',
          border: '1px solid rgba(224,85,170,0.25)',
          borderRadius: 20,
          padding: '4px 12px',
          marginTop: 8,
        }}>
          <LockIcon />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#993556' }}>
            Espace secret · caché de {secretFirstName}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <div style={{
          display: 'flex',
          background: 'rgba(118,118,128,0.12)',
          borderRadius: 10,
          padding: 3,
        }}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '6px 0',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: activeTab === tab.id ? '#1C1C1E' : '#8E8E93',
                background: activeTab === tab.id ? '#fff' : 'transparent',
                borderRadius: activeTab === tab.id ? 8 : 0,
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {activeTab === 'cadeaux' && !isOrganizer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {giftsLoading ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', color: '#8E8E93', fontSize: 14 }}>
                Chargement des cadeaux...
              </div>
            ) : gifts.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', color: '#8E8E93', fontSize: 14 }}>
                Aucun cadeau ajouté pour le moment.
              </div>
            ) : (
              gifts.map((gift) => {
                const price = formatPrice(gift.price)
                const contributionAmount = formatPrice(gift.contribution_amount)
                const addedByMe = gift.added_by === currentUserId
                const canClaim = gift.needs_contribution && !gift.claimed_by && !addedByMe

                return (
                  <article key={gift.id} style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E', lineHeight: 1.25 }}>
                          {gift.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          {price && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#e055aa', background: 'rgba(224,85,170,0.10)', borderRadius: 999, padding: '4px 9px' }}>
                              {price}
                            </span>
                          )}
                          {gift.needs_contribution && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '4px 9px' }}>
                              Co-financement : {contributionAmount ?? '—'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 8 }}>
                          Ajouté par {gift.profiles?.first_name ?? 'quelqu’un'}
                        </div>
                        {gift.claimed_by && (
                          <div style={{ fontSize: 12, color: '#34C759', fontWeight: 700, marginTop: 8 }}>
                            ✓ Pris en charge par {gift.claimer?.first_name ?? 'quelqu’un'}
                          </div>
                        )}
                      </div>
                      {addedByMe && (
                        <button
                          type="button"
                          onClick={() => handleDeleteGift(gift.id)}
                          aria-label="Supprimer le cadeau"
                          title="Supprimer le cadeau"
                          style={{ width: 30, height: 30, border: 'none', borderRadius: 15, background: '#FFF1F0', color: '#FF3B30', fontSize: 18, lineHeight: '30px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {canClaim && (
                      <button
                        type="button"
                        onClick={() => handleClaimGift(gift.id)}
                        style={{ width: '100%', marginTop: 12, border: 'none', borderRadius: 12, padding: '11px 14px', background: GRADIENT, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                      >
                        Je participe
                      </button>
                    )}
                  </article>
                )
              })
            )}

            <form onSubmit={handleGiftSubmit} style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E' }}>
                Ajouter un cadeau
              </div>
              <input
                type="text"
                value={giftForm.name}
                onChange={(e) => handleGiftFormChange('name', e.target.value)}
                placeholder="Nom du cadeau"
                required
                style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
              />
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Prix estimé</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={giftForm.price}
                  onChange={(e) => handleGiftFormChange('price', e.target.value)}
                  placeholder="€"
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F2F2F7', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' }}>
                <span style={{ fontSize: 13, color: '#1C1C1E', fontWeight: 700 }}>J'ai besoin d'aide financière</span>
                <input
                  type="checkbox"
                  checked={giftForm.needsContribution}
                  onChange={(e) => handleGiftFormChange('needsContribution', e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#e055aa', flexShrink: 0 }}
                />
              </label>
              {giftForm.needsContribution && (
                <div>
                  <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Montant souhaité</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={giftForm.contributionAmount}
                    onChange={(e) => handleGiftFormChange('contributionAmount', e.target.value)}
                    placeholder="€"
                    style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={giftSaving || !giftForm.name.trim()}
                style={{ width: '100%', border: 'none', borderRadius: 14, padding: 14, background: giftSaving || !giftForm.name.trim() ? '#C7C7CC' : GRADIENT, color: '#fff', fontSize: 14, fontWeight: 800, cursor: giftSaving || !giftForm.name.trim() ? 'default' : 'pointer' }}
              >
                {giftSaving ? 'Ajout...' : 'Ajouter'}
              </button>
            </form>
          </div>
        )}
        {activeTab === 'cagnotte' && (
          event.cagnotte_url ? (
            <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>
                Créée par {event.cagnotteCreatorFirstName ?? 'quelqu’un'} · {frenchDate(event.cagnotte_created_at ?? event.created_at)}
              </div>
              {event.cagnotte_gift_id && associatedGift && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#e055aa', background: 'rgba(224,85,170,0.10)', borderRadius: 999, padding: '5px 10px' }}>
                    🎁 {associatedGift.name}
                  </span>
                </div>
              )}
              {event.cagnotte_goal && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600, marginBottom: 7 }}>
                    {cagnotteContributions.length} participants · objectif {cagnotteGoalLabel} €
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#F2F2F7', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${cagnotteProgress}%`, height: '100%', background: GRADIENT, borderRadius: 3 }} />
                  </div>
                </div>
              )}
              {cagnotteContributions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    {cagnotteContributions.slice(0, 5).map((contribution, index) => {
                      const firstName = contribution.profiles?.first_name ?? '?'
                      return (
                        <div
                          key={contribution.id}
                          style={{ width: 28, height: 28, borderRadius: 14, background: '#FF7A70', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2px solid #fff', marginLeft: index === 0 ? 0 : -6 }}
                        >
                          {firstName.charAt(0).toUpperCase()}
                        </div>
                      )
                    })}
                    {cagnotteContributions.length > 5 && (
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: '#C7C7CC', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2px solid #fff', marginLeft: -6 }}>
                        +{cagnotteContributions.length - 5}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#8E8E93' }}>
                    {cagnotteContributions.length} personne{cagnotteContributions.length > 1 ? 's' : ''} participent
                  </div>
                </div>
              )}
              <a
                href={event.cagnotte_url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', width: '100%', borderRadius: 14, padding: 14, background: GRADIENT, color: '#fff', fontSize: 14, fontWeight: 800, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', marginTop: 14 }}
              >
                Participer à la cagnotte →
              </a>
              {!isOrganizer && (
                hasContributed ? (
                  <div style={{ fontSize: 13, color: '#34C759', fontWeight: 700, marginTop: 12 }}>
                    ✓ Tu participes
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCagnotteContribution}
                    disabled={cagnotteContributionsLoading}
                    style={{ width: '100%', marginTop: 10, border: 'none', borderRadius: 14, padding: 14, background: cagnotteContributionsLoading ? '#C7C7CC' : '#F2F2F7', color: '#1C1C1E', fontSize: 14, fontWeight: 800, cursor: cagnotteContributionsLoading ? 'default' : 'pointer' }}
                  >
                    Je participe
                  </button>
                )
              )}
            </div>
          ) : !isOrganizer ? (
            <form onSubmit={handleCagnotteSubmit} style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Lien de la cagnotte</div>
                <input
                  type="text"
                  value={cagnotteUrl}
                  onChange={(e) => setCagnotteUrl(e.target.value)}
                  placeholder="https://leetchi.com/…"
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Cadeau financé (optionnel)</div>
                <select
                  value={cagnotteGiftId}
                  onChange={(e) => setCagnotteGiftId(e.target.value)}
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="">— Aucun cadeau associé</option>
                  {availableGifts.map((gift) => (
                    <option key={gift.id} value={gift.id}>{gift.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Objectif de collecte (optionnel)</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cagnotteGoal}
                  onChange={(e) => setCagnotteGoal(e.target.value)}
                  placeholder="150 €"
                  style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }}
                />
              </div>
              <button
                type="submit"
                disabled={cagnotteSaving || !cagnotteUrl.trim()}
                style={{ width: '100%', border: 'none', borderRadius: 14, padding: 14, background: cagnotteSaving || !cagnotteUrl.trim() ? '#C7C7CC' : GRADIENT, color: '#fff', fontSize: 14, fontWeight: 800, cursor: cagnotteSaving || !cagnotteUrl.trim() ? 'default' : 'pointer' }}
              >
                {cagnotteSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          ) : (
            <p style={{ color: '#8E8E93', fontSize: 14 }}>Aucune cagnotte ajoutée pour le moment.</p>
          )
        )}
        {activeTab === 'carte' && (
          <CollectiveCardContributorView
            event={event}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  )
}
