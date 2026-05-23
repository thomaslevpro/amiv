import { useState, useEffect } from 'react'
import { Cake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriends } from '../lib/friendships'

const types = [<><Cake size={13} strokeWidth={1.5} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Anniversaire</>, '🥂 Soirée', '🍽️ Repas', '🎉 Autre']
const typeValues = ['Anniversaire', 'Soirée', 'Repas', 'Autre']
const visibilities = ['Privé 🔒', 'Sur invitation', 'Public 🌍']

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
  return { id: f.friend_id, name: f.friend_name, avatar_url: f.friend_avatar }
}

function birthdayFriendName(friend) {
  return friend?.first_name || friend?.name || 'Ami'
}

function birthdayFriendInitial(friend) {
  return birthdayFriendName(friend).charAt(0).toUpperCase()
}

export default function Create({ onBack, session, initialData = null }) {
  const userId = session?.user?.id

  const [type, setType] = useState(0)
  const [vis, setVis] = useState(1)
  const [form, setForm] = useState({ name: initialData?.title ?? '', date: '', location: '', desc: '' })
  const [birthdayPersonId, setBirthdayPersonId] = useState(initialData?.birthday_person_user_id ?? null)
  const [birthdayFriends, setBirthdayFriends] = useState([])
  const [usePoll, setUsePoll] = useState(false)
  const [pollDates, setPollDates] = useState([{ date: '', time: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [friends, setFriends] = useState([])
  const [selectedFriendIds, setSelectedFriendIds] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [emailInvitees, setEmailInvitees] = useState([])

  useEffect(() => {
    if (!userId) return
    getFriends(userId).then(({ data }) => {
      if (data) setFriends(data)
    })
  }, [userId])

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
        ...(selfProfile ? [{ ...selfProfile, first_name: `${selfProfile.first_name || selfProfile.name || 'Moi'} (moi)` }] : []),
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

  function addEmail() {
    const email = emailInput.trim().toLowerCase()
    if (!email || emailInvitees.includes(email)) return
    setEmailInvitees(prev => [...prev, email])
    setEmailInput('')
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
        visibility: visibilities[vis],
        user_id: user.id,
        birthday_person_user_id: birthdayPersonId,
      }).select().single()
      if (error) throw error

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

      onBack()
    } catch (err) {
      console.error('Erreur lors de la création de l\'événement :', err)
      setError(err.message || 'Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf9fb', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', color: '#007AFF', cursor: 'pointer', minWidth: 60 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize: 16 }}>Retour</span>
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: '#1C1C1E' }}>Nouvel événement</div>
          <div style={{ minWidth: 60 }}/>
        </div>

        {/* Type */}
        <div style={cardStyle}>
          <div style={labelStyle}>Type d'événement</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {types.map((t, i) => (
              <div key={i} onClick={() => setType(i)} style={{
                padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                background: i === type ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                color: i === type ? '#fff' : '#8E8E93', cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s',
              }}>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Name */}
        <div style={cardStyle}>
          <div style={labelStyle}>Nom de l'événement</div>
          <input
            type="text"
            placeholder="Ex: Anniversaire de Sophie"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            style={fieldStyle}
          />
        </div>

        {/* Birthday person */}
        <div style={cardStyle}>
          <div style={labelStyle}>
            Personne fêtée <span style={{ color: '#AEAEB2', fontWeight: 600 }}>(optionnel)</span>
          </div>
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
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0, width: 58 }}
                  >
                    <div style={{ position: 'relative' }}>
                      {friend.avatar_url ? (
                        <img
                          src={friend.avatar_url}
                          alt={name}
                          style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: selected ? '0 0 0 2px #e055aa' : 'none' }}
                        />
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FBBF9A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, boxShadow: selected ? '0 0 0 2px #e055aa' : 'none' }}>
                          {birthdayFriendInitial(friend)}
                        </div>
                      )}
                      {selected && (
                        <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                          ✓
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#1C1C1E', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Date — fixed or poll */}
        <div style={{ ...cardStyle, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: usePoll ? 12 : 0 }}>
            <div style={{ ...labelStyle, marginBottom: 0 }}>Date{usePoll ? ' — sondage 📊' : ' et heure'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#8E8E93' }}>Sondage</span>
              <div
                onClick={() => setUsePoll(p => !p)}
                style={{
                  width: 44, height: 26, borderRadius: 13, position: 'relative',
                  cursor: 'pointer',
                  background: usePoll ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#E5E5EA',
                  transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: usePoll ? 21 : 3, width: 20, height: 20,
                  borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                }} />
              </div>
            </div>
          </div>

          {usePoll ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pollDates.map((pd, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="date"
                    value={pd.date}
                    onChange={e => updatePollDate(i, 'date', e.target.value)}
                    style={{
                      flex: 2, border: '1px solid #E5E5EA', borderRadius: 10,
                      padding: '8px 10px', fontSize: 13, color: '#1C1C1E', outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <input
                    type="time"
                    value={pd.time}
                    onChange={e => updatePollDate(i, 'time', e.target.value)}
                    style={{
                      flex: 1, border: '1px solid #E5E5EA', borderRadius: 10,
                      padding: '8px 10px', fontSize: 13, color: '#1C1C1E', outline: 'none',
                      fontFamily: 'inherit',
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
              style={{ ...fieldStyle, marginTop: 6 }}
            />
          )}
        </div>

        {/* Location */}
        <div style={cardStyle}>
          <div style={labelStyle}>Lieu</div>
          <input
            type="text"
            placeholder="Adresse ou lieu"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
            style={fieldStyle}
          />
        </div>

        {/* Description */}
        <div style={cardStyle}>
          <div style={labelStyle}>Description (optionnel)</div>
          <input
            type="text"
            placeholder="Décrivez l'événement..."
            value={form.desc}
            onChange={e => setForm({ ...form, desc: e.target.value })}
            style={fieldStyle}
          />
        </div>

        {/* Invitees */}
        <div style={{ ...cardStyle, marginBottom: 10 }}>
          <div style={labelStyle}>Invités</div>
          {friends.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {friends.map(f => {
                const p = friendProfile(f)
                if (!p) return null
                const selected = selectedFriendIds.includes(p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleFriend(p.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      background: selected ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                      color: selected ? '#fff' : '#1C1C1E',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {p.name}
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="email"
              placeholder="Inviter par email…"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEmail())}
              style={{ ...fieldStyle, flex: 1 }}
            />
            {emailInput.trim() && (
              <div
                onClick={addEmail}
                style={{
                  padding: '6px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', cursor: 'pointer',
                }}
              >
                +
              </div>
            )}
          </div>
          {emailInvitees.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {emailInvitees.map(email => (
                <div
                  key={email}
                  onClick={() => setEmailInvitees(prev => prev.filter(e => e !== email))}
                  style={{
                    padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: 'rgba(224,85,170,0.10)', color: '#e055aa', cursor: 'pointer',
                  }}
                >
                  {email} ×
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visibility */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={labelStyle}>Visibilité</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {visibilities.map((v, i) => (
              <div key={i} onClick={() => setVis(i)} style={{
                flex: 1, padding: 10, borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: i === vis ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                color: i === vis ? '#fff' : '#8E8E93', cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.15s',
              }}>
                {v}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#FFF0F0', border: '1px solid #FF3B30', borderRadius: 12,
            padding: '10px 14px', marginBottom: 10, color: '#FF3B30',
            fontSize: 13, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div onClick={loading ? undefined : handleCreate} style={{
          padding: 16, background: loading ? '#AEAEB2' : 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff',
          borderRadius: 16, fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}>
          {loading ? 'Création…' : 'Créer l\'événement 🎉'}
        </div>
      </div>
    </div>
  )
}
