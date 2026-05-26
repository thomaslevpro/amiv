import { useState, useEffect } from 'react'
import { Bell, Link2, Pencil, Trash2, X } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { supabase } from '../lib/supabase'

dayjs.locale('fr')

function calcStats(birthdate) {
  const today = dayjs().startOf('day')
  const bday = dayjs(birthdate)
  const thisYear = bday.year(today.year())
  const nextBday = thisYear.isBefore(today) ? thisYear.add(1, 'year') : thisYear
  const daysUntil = nextBday.diff(today, 'day')
  const age = nextBday.year() - bday.year()
  return { daysUntil, age }
}

function formatDateFR(birthdate) {
  return dayjs(birthdate).locale('fr').format('D MMMM')
}

const gradientTextStyle = {
  background: 'linear-gradient(90deg, #e055aa, #f5a623)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  color: 'transparent',
  display: 'inline-block',
}

const REMINDER_OPTIONS = [1, 3, 7, 14, 30]

function getProfileName(profile) {
  return profile?.first_name || profile?.name || 'Ami'
}

function getInitials(profile) {
  return getProfileName(profile)
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function FriendAvatar({ profile, size = 38 }) {
  const name = getProfileName(profile)
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      flexShrink: 0,
      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size > 44 ? 18 : 13,
      fontWeight: 800,
      boxShadow: '0 2px 8px rgba(224,85,170,0.16)',
    }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        getInitials(profile)
      )}
    </div>
  )
}

export default function BirthdayBottomSheet({ birthday, onClose, onEdit, onDeleted, onLinkedProfileChanged, onToast, userId }) {
  const [visible, setVisible] = useState(false)
  const [reminder, setReminder] = useState(birthday.reminder_enabled ?? true)
  const [reminderDays, setReminderDays] = useState(
    Array.isArray(birthday.reminder_days)
      ? birthday.reminder_days
      : birthday.reminder_days != null ? [birthday.reminder_days] : [7]
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [linkedProfile, setLinkedProfile] = useState(birthday.linked_profile ?? null)
  const [linkedProfileId, setLinkedProfileId] = useState(birthday.linked_profile_id ?? null)
  const [friendPickerOpen, setFriendPickerOpen] = useState(false)
  const [friends, setFriends] = useState([])
  const [friendsLoaded, setFriendsLoaded] = useState(false)
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [linkingId, setLinkingId] = useState(null)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    setReminder(birthday.reminder_enabled ?? true)
    setReminderDays(
      Array.isArray(birthday.reminder_days)
        ? birthday.reminder_days
        : birthday.reminder_days != null ? [birthday.reminder_days] : [7]
    )
    setLinkedProfile(birthday.linked_profile ?? null)
    setLinkedProfileId(birthday.linked_profile_id ?? null)
    setFriendPickerOpen(false)
  }, [birthday])

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  function handleEdit() {
    setVisible(false)
    setTimeout(() => { onClose(); onEdit() }, 280)
  }

  async function handleReminderDays(value) {
    const prev = reminderDays
    const next = prev.includes(value)
      ? prev.filter(v => v !== value)
      : [...prev, value].sort((a, b) => a - b)
    const payload = { reminder_days: next.map(Number) }
    setReminderDays(next)
    const { error } = await supabase
      .from('birthdays')
      .update(payload)
      .eq('id', birthday.id)
    if (error) {
      setReminderDays(prev)
      onToast?.('Erreur lors de la mise à jour 😕', true)
    }
  }

  async function handleToggleReminder() {
    const next = !reminder
    const payload = { reminder_enabled: next }
    setReminder(next)
    const { error } = await supabase
      .from('birthdays')
      .update(payload)
      .eq('id', birthday.id)
    if (error) {
      setReminder(!next)
      onToast?.('Erreur lors de la mise à jour 😕', true)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('birthdays').delete().eq('id', birthday.id)
    if (error) {
      onToast?.('Erreur lors de la suppression 😕', true)
      setDeleting(false)
    } else {
      onToast?.('Anniversaire supprimé 🗑️')
      setVisible(false)
      setTimeout(() => { onClose(); onDeleted?.() }, 280)
    }
  }

  async function loadFriends() {
    if (!userId || friendsLoaded || friendsLoading) return
    setFriendsLoading(true)
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted')

    if (error) {
      console.error('Erreur lors du chargement des amis :', error)
      onToast?.('Impossible de charger les amis 😕', true)
      setFriendsLoading(false)
      return
    }

    const friendIds = [...new Set((friendships || []).map(friendship =>
      friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
    ))]

    if (friendIds.length === 0) {
      setFriends([])
      setFriendsLoaded(true)
      setFriendsLoading(false)
      return
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, name, avatar_url')
      .in('id', friendIds)

    if (profileError) {
      console.error('Erreur lors du chargement des profils amis :', profileError)
      onToast?.('Impossible de charger les amis 😕', true)
    } else {
      setFriends(profiles ?? [])
      setFriendsLoaded(true)
    }
    setFriendsLoading(false)
  }

  function openFriendPicker() {
    setFriendPickerOpen(true)
    loadFriends()
  }

  async function linkFriend(profile) {
    setLinkingId(profile.id)
    const previousProfile = linkedProfile
    const previousId = linkedProfileId
    setLinkedProfile(profile)
    setLinkedProfileId(profile.id)

    const payload = { linked_profile_id: profile.id }
    const { data, error } = await supabase
      .from('birthdays')
      .update(payload)
      .eq('id', birthday.id)
      .select()

    console.log('[linkFriend] update result:', { data, error })

    if (error) {
      setLinkedProfile(previousProfile)
      setLinkedProfileId(previousId)
      onToast?.('Erreur lors de la liaison 😕', true)
    } else {
      setFriendPickerOpen(false)
      onLinkedProfileChanged?.(birthday.id, profile)
      onToast?.('Ami lié à cet anniversaire')
    }
    setLinkingId(null)
  }

  async function unlinkFriend() {
    setLinkingId('unlink')
    const previousProfile = linkedProfile
    const previousId = linkedProfileId
    setLinkedProfile(null)
    setLinkedProfileId(null)

    const payload = { linked_profile_id: null }
    const { error } = await supabase
      .from('birthdays')
      .update(payload)
      .eq('id', birthday.id)

    if (error) {
      setLinkedProfile(previousProfile)
      setLinkedProfileId(previousId)
      onToast?.('Erreur lors de la suppression du lien 😕', true)
    } else {
      setFriendPickerOpen(false)
      onLinkedProfileChanged?.(birthday.id, null)
      onToast?.('Anniversaire délié')
    }
    setLinkingId(null)
  }

  const { daysUntil, age } = calcStats(birthday.birthdate)
  const dateShort = formatDateFR(birthday.birthdate)
  const isToday = daysUntil === 0
  const daysDisplay = isToday ? 'Auj.' : `J-${daysUntil}`
  const monthLabel = dayjs(birthday.birthdate).locale('fr').format('D MMM').toUpperCase()

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)',
        transition: 'background 0.28s ease',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#F2F2F7',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
        }}
      >
        {/* ── Drag handle ── */}
        <div style={{ paddingTop: 12, display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, background: '#C7C7CC', borderRadius: 2 }} />
        </div>

        {/* ── 1. HERO ── */}
        <div style={{
          margin: '0 16px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #FFF0F5 0%, #FFF8F0 100%)',
          padding: '20px 18px 18px',
          position: 'relative',
        }}>
          <button
            onClick={dismiss}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, color: '#8E8E93',
            }}
          >
            ×
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#FBBF9A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, flexShrink: 0,
              boxShadow: '0 2px 10px rgba(224,85,170,0.18)',
            }}>
              🎂
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E', lineHeight: 1.2 }}>
                {birthday.name}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 10,
                background: 'rgba(224,85,170,0.08)',
                borderRadius: 20, padding: '4px 11px',
                fontSize: 12, fontWeight: 600,
              }}>
                <span>🎂</span>
                <span style={gradientTextStyle}>{dateShort} · {age} ans</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. STATS ── */}
        <div style={{
          margin: '10px 16px 0',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          display: 'flex',
          overflow: 'hidden',
        }}>
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '18px 12px',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, ...gradientTextStyle }}>
              {daysDisplay}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#8E8E93',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 6,
              textAlign: 'center',
            }}>
              {isToday ? "C'EST AUJOURD'HUI !" : 'AVANT SON ANNIVERSAIRE'}
            </div>
          </div>

          <div style={{ width: 1, background: '#F2F2F7', margin: '14px 0' }} />

          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '18px 12px',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1C1C1E', lineHeight: 1 }}>
              {age}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#8E8E93',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 6,
              textAlign: 'center',
            }}>
              ANS LE {monthLabel}
            </div>
          </div>
        </div>

        {/* ── 3. REMINDER ── */}
        <div style={{
          margin: '10px 16px 0',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(224,85,170,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Bell size={18} strokeWidth={1.6} color="#e055aa" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>
              {reminder ? 'Rappel activé' : 'Rappel désactivé'}
            </div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 1 }}>
              {reminderDays.length
                ? `J-${reminderDays.join(', J-')} · notification push`
                : 'Aucun rappel configuré'}
            </div>
          </div>

          <div
            onClick={handleToggleReminder}
            style={{
              width: 50, height: 30, borderRadius: 15, cursor: 'pointer',
              background: reminder
                ? 'linear-gradient(90deg, #e055aa, #f5a623)'
                : '#E5E5EA',
              transition: 'background 0.22s',
              position: 'relative', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 3,
              left: reminder ? 23 : 3,
              width: 24, height: 24, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
              transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>

        {/* ── 3b. REMINDER DELAY ── */}
        {reminder && (
          <div style={{
            margin: '8px 16px 0',
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            padding: '12px 14px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#8E8E93',
              letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10,
            }}>
              Rappeler moi
            </div>
            <div style={{
              display: 'flex', gap: 8,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}>
              {REMINDER_OPTIONS.map(opt => {
                const active = reminderDays.includes(opt)
                return (
                  <button
                    key={opt}
                    onClick={() => handleReminderDays(opt)}
                    style={{
                      flexShrink: 0,
                      padding: '7px 16px',
                      borderRadius: 20,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      background: active
                        ? 'linear-gradient(90deg, #e055aa, #f5a623)'
                        : '#F2F2F7',
                      color: active ? '#fff' : '#8E8E93',
                      transition: 'background 0.18s, color 0.18s',
                    }}
                  >
                    J-{opt}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 3c. LINKED FRIEND ── */}
        <div style={{
          margin: '8px 16px 0',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          padding: '14px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Lier à un ami
              </div>
              <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 3 }}>
                {linkedProfileId ? 'Profil connecté associé' : 'Associe ce rappel à un ami Amiv'}
              </div>
            </div>
            {!linkedProfileId && (
              <button
                type="button"
                onClick={openFriendPicker}
                style={{
                  border: 'none',
                  borderRadius: 18,
                  padding: '8px 12px',
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                <Link2 size={14} strokeWidth={2} />
                Lier à un ami
              </button>
            )}
          </div>

          {linkedProfileId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 12,
              padding: '10px 11px',
              borderRadius: 12,
              background: '#F8F8FA',
            }}>
              <FriendAvatar profile={linkedProfile || { first_name: birthday.name }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getProfileName(linkedProfile || { first_name: birthday.name })}
                </div>
              </div>
              <button
                type="button"
                onClick={unlinkFriend}
                disabled={linkingId === 'unlink'}
                aria-label="Délier cet ami"
                style={{
                  minWidth: 78,
                  height: 34,
                  border: 'none',
                  borderRadius: 17,
                  background: '#fff',
                  color: '#FF3B30',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: linkingId === 'unlink' ? 'default' : 'pointer',
                  opacity: linkingId === 'unlink' ? 0.55 : 1,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                <X size={17} strokeWidth={2.2} />
                Délier
              </button>
            </div>
          )}

          {friendPickerOpen && !linkedProfileId && (
            <div style={{
              marginTop: 12,
              borderRadius: 12,
              border: '1px solid #F2F2F7',
              overflow: 'hidden',
            }}>
              {friendsLoading ? (
                <div style={{ padding: 13, color: '#8E8E93', fontSize: 13 }}>Chargement...</div>
              ) : friends.length === 0 ? (
                <div style={{ padding: 13, color: '#8E8E93', fontSize: 13 }}>Aucun ami connecté pour le moment</div>
              ) : (
                friends.map((friend, index) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => linkFriend(friend)}
                    disabled={linkingId === friend.id}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderBottom: index < friends.length - 1 ? '1px solid #F2F2F7' : 'none',
                      background: '#fff',
                      padding: '10px 11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: linkingId === friend.id ? 'default' : 'pointer',
                      opacity: linkingId === friend.id ? 0.6 : 1,
                      textAlign: 'left',
                    }}
                  >
                    <FriendAvatar profile={friend} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getProfileName(friend)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── 4. ACTION ROW ── */}
        {!confirmDelete ? (
          <div style={{
            margin: '10px 16px 16px',
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            padding: '18px 0',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 48,
          }}>
            <button
              onClick={handleEdit}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0,
              }}
            >
              <Pencil size={24} strokeWidth={1.6} color="#1C1C1E" />
              <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>Modifier</span>
            </button>

            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0,
              }}
            >
              <Trash2 size={24} strokeWidth={1.6} color="#FF3B30" />
              <span style={{ fontSize: 11, color: '#FF3B30', fontWeight: 500 }}>Supprimer</span>
            </button>
          </div>
        ) : (
          <div style={{ margin: '10px 16px 16px' }}>
            <div style={{
              textAlign: 'center', fontSize: 14, fontWeight: 600,
              color: '#1C1C1E', marginBottom: 10,
            }}>
              Supprimer {birthday.name} ?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: 13, borderRadius: 12, border: 'none',
                  background: '#FF3B30', color: '#fff',
                  fontSize: 14, fontWeight: 700,
                  cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                Oui, supprimer
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1, padding: 13, borderRadius: 12, border: 'none',
                  background: '#E5E5EA', color: '#1C1C1E',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
