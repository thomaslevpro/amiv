import { useState, useEffect } from 'react'
import { Cake, PartyPopper, CookingPot, Coffee, Pencil, CalendarDays, MapPin, FileText, Link } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriends } from '../lib/friendships'

const types = [
  <><Cake size={13} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Anniversaire</>,
  <><PartyPopper size={13} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Soirée</>,
  <><CookingPot size={13} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Repas</>,
  <><Coffee size={13} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Café</>,
  '🎉 Autre',
]
const typeValues = ['Anniversaire', 'Soirée', 'Repas', 'Café', 'Autre']
const emojiTypeMap = {
  '🍽️': 'Repas',
  '🥂': 'Soirée',
  '🎬': 'Soirée',
}

const fieldStyle = {
  width: '100%', border: 'none', outline: 'none', fontSize: 15,
  color: '#1C1C1E', background: 'transparent', fontFamily: 'inherit',
}
const cardStyle = {
  background: '#fff', borderRadius: 16, padding: '14px 16px',
  marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
}
const labelStyle = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#8E8E93', marginBottom: 6,
}

function friendProfile(f) {
  return { id: f.friend_id, name: f.friend_name, first_name: f.friend_first_name, username: f.friend_username, avatar_url: f.friend_avatar }
}

function birthdayFriendName(friend) {
  return friend?.first_name || friend?.name || 'Ami'
}

function birthdayFriendInitial(friend) {
  return birthdayFriendName(friend).charAt(0).toUpperCase()
}

function inviteeLabel(friend) {
  return friend?.first_name || friend?.name?.split(' ')[0] || friend?.username || 'Ami'
}

function inviteeInitial(friend) {
  return inviteeLabel(friend).charAt(0).toUpperCase()
}

export default function Create({ onBack, session, initialData = null }) {
  const userId = session?.user?.id

  const initialType = typeValues.indexOf(initialData?.type ?? emojiTypeMap[initialData?.emoji] ?? 'Autre')
  const [type, setType] = useState(initialType >= 0 ? initialType : 3)
  const [form, setForm] = useState({ name: initialData?.title ?? '', date: '', location: '', desc: initialData?.desc ?? initialData?.description ?? '' })
  const [coverImage, setCoverImage] = useState(initialData?.coverImage ?? initialData?.cover_image ?? '')
  const [birthdayPersonId, setBirthdayPersonId] = useState(initialData?.birthday_person_user_id ?? null)
  const [birthdayFriends, setBirthdayFriends] = useState([])
  const [usePoll, setUsePoll] = useState(false)
  const [pollDates, setPollDates] = useState([{ date: '', time: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [friends, setFriends] = useState([])
  const [selectedFriendIds, setSelectedFriendIds] = useState([])
  const [copied, setCopied] = useState(false)
  const [createdEvent, setCreatedEvent] = useState(null)

  useEffect(() => {
    if (!userId) return
    getFriends(userId).then(({ data }) => {
      if (data) setFriends(data)
    })
  }, [userId])

  useEffect(() => {
    setCoverImage(initialData?.coverImage ?? initialData?.cover_image ?? '')
  }, [initialData])

  useEffect(() => {
    if (type !== 0) setBirthdayPersonId(null)
  }, [type])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadBirthdayFriends() {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted')

      if (cancelled) return

      const friendIds = (friendships || []).map(f =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      )

      const [{ data: friendProfiles }, { data: selfProfile }] = await Promise.all([
        friendIds.length > 0
          ? supabase
            .from('profiles')
            .select('id, first_name, name, avatar_url')
            .in('id', friendIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('profiles')
          .select('id, first_name, name, avatar_url')
          .eq('id', userId)
          .single(),
      ])

      const allPickerProfiles = [
        ...(selfProfile ? [{ ...selfProfile, _isSelf: true, first_name: 'Moi' }] : []),
        ...(friendProfiles || []),
      ]

      if (!cancelled) setBirthdayFriends(allPickerProfiles)
    }

    loadBirthdayFriends()
    return () => { cancelled = true }
  }, [userId])

  function toggleFriend(id) {
    setSelectedFriendIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleBirthdayPerson(id) {
    setBirthdayPersonId(prev => prev === id ? null : id)
  }

  function updatePollDate(i, field, value) {
    setPollDates(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  async function handleCreate() {
    setError(null)
    if (!form.name.trim()) {
      setError("Le nom de l'événement est obligatoire.")
      return
    }
    if (!usePoll && !form.date) {
      setError("Merci de sélectionner une date et heure.")
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const isoDate = form.date ? new Date(form.date).toISOString() : null
      const { data: eventData, error } = await supabase.from('events').insert({
        name: form.name,
        date: usePoll ? null : isoDate,
        location: form.location,
        description: form.desc,
        type: typeValues[type],
        visibility: 'Sur invitation',
        user_id: user.id,
        cover_image: coverImage || null,
        birthday_person_user_id: birthdayPersonId,
      }).select().single()
      if (error) throw error

      await supabase.from('event_organizers').insert({
        event_id: eventData.id,
        user_id: user.id,
        role: 'owner',
      })

      if (usePoll) {
        const validDates = pollDates.filter(d => d.date)
        if (validDates.length > 0) {
          const { error: optErr } = await supabase.from('event_date_options').insert(
            validDates.map(d => ({
              event_id: eventData.id,
              proposed_date: d.date,
              proposed_time: d.time || null,
            }))
          )
          if (optErr) console.error('Error inserting date options:', optErr)
        }
      }

      if (selectedFriendIds.length > 0) {
        const { error: rsvpErr } = await supabase.rpc('invite_friends_to_event', {
          p_event_id: eventData.id,
          p_user_ids: selectedFriendIds
        })
        if (rsvpErr) console.error('Error inviting friends:', rsvpErr)
      }

      setCreatedEvent(eventData)
    } catch (err) {
      console.error('Erreur lors de la création de l\'événement :', err)
      setError(err.message || 'Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}>
      <div style={{
        background: 'linear-gradient(135deg, #e055aa, #f5a623)',
        padding: '16px 20px 28px',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.12) 0%, transparent 55%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', width: 'fit-content', marginBottom: 18 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize: 15 }}>Retour</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px' }}>Nouvel événement</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>Crée et invite tes amis en quelques secondes</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
        {/* Type */}
        <div style={{ padding: '0 16px', marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[
              <><Cake size={14} /> Anniversaire</>,
              <><PartyPopper size={14} /> Soirée</>,
              <><CookingPot size={14} /> Repas</>,
              <><Coffee size={14} /> Café</>,
              <>✨ Autre</>,
            ].map((t, i) => (
              <div
                key={i}
                onClick={() => setType(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '8px 13px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  background: i === type ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#fff',
                  color: i === type ? '#fff' : '#8E8E93',
                  boxShadow: i === type ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Cover */}
        {coverImage && (
          <div style={{ padding: '0 16px', marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 8 }}>Cover</div>
            <img
              src={coverImage}
              alt=""
              style={{
                width: '100%',
                height: 200,
                objectFit: 'cover',
                borderRadius: 16,
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Details */}
        <div style={{ padding: '0 16px', marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 8 }}>Détails</div>
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(224,85,170,0.10)' }}>
                <Pencil size={15} color="#e055aa" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Nom</div>
                <input
                  type="text"
                  placeholder="Ex: Anniversaire de Sophie"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={fieldStyle}
                />
              </div>
            </div>
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.07)', margin: 0 }} />
            <div style={{ display: 'flex', alignItems: usePoll ? 'flex-start' : 'center', gap: 10, padding: '12px 14px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(0,122,255,0.10)' }}>
                <CalendarDays size={15} color="#007AFF" />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {usePoll ? 'Sondage 📊' : 'Date et heure'}
                  </div>
                  {usePoll ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 7 }}>
                      {pollDates.map((pd, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="date"
                            value={pd.date}
                            onChange={e => updatePollDate(i, 'date', e.target.value)}
                            style={{
                              flex: 2, border: '1px solid #E5E5EA', borderRadius: 10,
                              padding: '8px 10px', fontSize: 13, color: '#1C1C1E', outline: 'none',
                              fontFamily: 'inherit', minWidth: 0,
                            }}
                          />
                          <input
                            type="time"
                            value={pd.time}
                            onChange={e => updatePollDate(i, 'time', e.target.value)}
                            style={{
                              flex: 1, border: '1px solid #E5E5EA', borderRadius: 10,
                              padding: '8px 10px', fontSize: 13, color: '#1C1C1E', outline: 'none',
                              fontFamily: 'inherit', minWidth: 0,
                            }}
                          />
                          {pollDates.length > 1 && (
                            <div
                              onClick={() => setPollDates(prev => prev.filter((_, idx) => idx !== i))}
                              style={{ fontSize: 18, color: '#FF3B30', cursor: 'pointer', padding: '0 4px', fontWeight: 700 }}
                            >
                              −
                            </div>
                          )}
                        </div>
                      ))}
                      {pollDates.length < 4 && (
                        <div
                          onClick={() => setPollDates(prev => [...prev, { date: '', time: '' }])}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6, padding: '9px', borderRadius: 10,
                            border: '1.5px dashed #E5E5EA', color: '#8E8E93',
                            fontSize: 13, cursor: 'pointer', fontWeight: 600,
                          }}
                        >
                          + Ajouter une date proposée
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="datetime-local"
                      placeholder="Sélectionner une date..."
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      style={fieldStyle}
                    />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: usePoll ? 2 : 0 }}>
                  <span style={{ fontSize: 12, color: '#8E8E93' }}>Sondage</span>
                  <div
                    onClick={() => setUsePoll(p => !p)}
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 12,
                      position: 'relative',
                      cursor: 'pointer',
                      background: usePoll ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#E5E5EA',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 2,
                      left: usePoll ? 20 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.07)', margin: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(52,199,89,0.10)' }}>
                <MapPin size={15} color="#34C759" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Lieu</div>
                <input
                  type="text"
                  placeholder="Adresse ou lieu"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  style={fieldStyle}
                />
              </div>
              <div style={{ color: '#C7C7CC', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>›</div>
            </div>
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.07)', margin: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(255,149,0,0.10)' }}>
                <FileText size={15} color="#FF9500" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description</div>
                <input
                  type="text"
                  placeholder="Optionnel…"
                  value={form.desc}
                  onChange={e => setForm({ ...form, desc: e.target.value })}
                  style={fieldStyle}
                />
              </div>
              <div style={{ color: '#C7C7CC', fontSize: 22, lineHeight: 1, flexShrink: 0 }}>›</div>
            </div>
          </div>
        </div>

        {/* Birthday person */}
        {type === 0 && (
          <div style={{ padding: '0 16px', marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 8 }}>
              Personne fêtée
            </div>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', padding: '12px 14px' }}>
              {birthdayFriends.length === 0 ? (
                <div style={{ fontSize: 13, color: '#8E8E93' }}>Ajoute des amis pour les sélectionner ici</div>
              ) : (
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 2px' }}>
                  {birthdayFriends.map(friend => {
                    const selected = birthdayPersonId === friend.id
                    const name = birthdayFriendName(friend)
                    return (
                      <div
                        key={friend.id}
                        onClick={() => toggleBirthdayPerson(friend.id)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, width: 54, cursor: 'pointer' }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', position: 'relative', boxShadow: selected ? '0 0 0 2.5px #e055aa' : 'none' }}>
                          {friend.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt={name}
                              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FBBF9A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                              {birthdayFriendInitial(friend)}
                            </div>
                          )}
                          {selected && (
                            <div style={{ position: 'absolute', top: -3, right: -3, width: 15, height: 15, borderRadius: '50%', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              ✓
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#1C1C1E', maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invitees */}
        <div style={{ padding: '0 16px', marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 8 }}>Invités</div>
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {friends.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '12px 14px' }}>
                {friends.map(f => {
                  const p = friendProfile(f)
                  if (!p) return null
                  const selected = selectedFriendIds.includes(p.id)
                  const label = inviteeLabel(p)
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleFriend(p.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px 6px 6px',
                        borderRadius: 20,
                        background: selected ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F5F5F5',
                        color: selected ? '#fff' : '#1C1C1E',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={p.name || p.username || label}
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FBBF9A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                          {inviteeInitial(p)}
                        </div>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ height: 0.5, background: 'rgba(0,0,0,0.07)', margin: 0 }} />
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8E8E93', fontSize: 13, fontWeight: 500, opacity: 0.4, cursor: 'default' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Link size={14} color="#8E8E93" />
                </div>
                <span>Copier le lien d'invitation</span>
              </div>
              <div style={{ fontSize: 11, color: '#C7C7CC', marginTop: 6 }}>Disponible après création</div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#FFF0F0', border: '1px solid #FF3B30', borderRadius: 12,
            padding: '10px 14px', margin: '14px 16px 0', color: '#FF3B30',
            fontSize: 13, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ padding: '16px 16px 0' }}>
          <div onClick={loading ? undefined : handleCreate} style={{
            width: '100%',
            padding: 15,
            background: loading ? '#AEAEB2' : 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff',
            borderRadius: 16,
            fontSize: 15,
            fontWeight: 700,
            textAlign: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 18px rgba(224,85,170,0.28)',
            transition: 'background 0.2s',
            boxSizing: 'border-box',
          }}>
            {loading ? 'Création…' : 'Créer l\'événement 🎉'}
          </div>
        </div>
      </div>
      {createdEvent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '28px 24px',
            textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16,
            margin: 32, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>Événement créé !</div>
            <div style={{ fontSize: 14, color: '#8E8E93' }}>Partage le lien pour inviter tes amis</div>
            <div
              onClick={async () => {
                await navigator.clipboard.writeText(`https://amiv.app/invite/${createdEvent.share_token}`)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              style={{
                padding: 14, background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                color: '#fff', borderRadius: 14, fontSize: 15, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copied ? 'Lien copié ✓' : "Partager le lien d'invitation"}
            </div>
            <div
              onClick={onBack}
              style={{
                padding: 14, background: '#F5F5F5', color: '#1C1C1E',
                borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Continuer
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
