import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CollectiveCardContributorView from '../components/CollectiveCardContributorView'

function frenchDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }
      console.log('[SecretSpace] currentUser.id:', user.id)
      setCurrentUserId(user.id)
      setCurrentUserEmail(user.email ?? null)

      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, user_id, birthday_person_user_id')
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

      setEvent(data)
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

  if (!event) return null

  const firstName = event.organizerName?.split(' ')[0] ?? ''
  const secretFirstName = event.birthdayFirstName ?? firstName

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
        {activeTab === 'cagnotte' && <p style={{ color: '#8E8E93', fontSize: 14 }}>Section cagnotte — à venir</p>}
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
