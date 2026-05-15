import { useState, useEffect } from 'react'
import {
  AlertCircle,
  Bell,
  Calendar,
  ChevronRight,
  FileText,
  Gift,
  Key,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  Share2,
  Star,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { supabase } from '../lib/supabase'
import EditProfileModal from '../components/profile/EditProfileModal'
import ChangePasswordModal from '../components/profile/ChangePasswordModal'

dayjs.locale('fr')

const COLORS = {
  page: '#F2F2F7',
  card: '#FFFFFF',
  gradient: 'linear-gradient(135deg, #e055aa, #f5a623)',
  heroGradient: 'linear-gradient(155deg, #e055aa, #f5a623)',
  text: '#1C1C1E',
  secondary: '#8E8E93',
  hint: '#AEAEB2',
  destructive: '#FF3B30',
}

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
const CARD_SHADOW = '0 1px 8px rgba(0,0,0,0.07)'

async function fetchProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, first_name, email, avatar_url, created_at, birthday')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error

  const { data: tokenData } = await supabase
    .from('profiles')
    .select('share_token')
    .eq('id', user.id)
    .maybeSingle()

  return {
    name: data?.name ?? null,
    first_name: data?.first_name ?? null,
    email: data?.email ?? user.email ?? null,
    avatar_url: data?.avatar_url ?? null,
    created_at: data?.created_at ?? user.created_at ?? null,
    birthday: data?.birthday ?? null,
    share_token: tokenData?.share_token ?? user.id,
  }
}

async function statCount(query) {
  try {
    const { count, error } = await query
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

async function fetchStats(user) {
  const [eventsCount, birthdaysCount, friendsCount] = await Promise.all([
    statCount(
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
    ),
    statCount(
      supabase
        .from('birthdays')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
    ),
    statCount(
      supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted')
    ),
  ])

  return { eventsCount, birthdaysCount, friendsCount }
}

function getDisplayName(profile) {
  const fullName = [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim()
  return fullName || profile?.email || 'Profil'
}

function getInitial(profile) {
  const source = profile?.first_name || profile?.name || profile?.email || 'A'
  return source.trim().charAt(0).toUpperCase()
}

function parseDateParts(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return { year, month: month - 1, day }
}

function getBirthdayStats(birthday) {
  const parts = parseDateParts(birthday)
  if (!parts) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let nextBirthday = new Date(today.getFullYear(), parts.month, parts.day)
  if (nextBirthday < today) {
    nextBirthday = new Date(today.getFullYear() + 1, parts.month, parts.day)
  }

  const daysUntil = Math.round((nextBirthday - today) / 86400000)
  const nextAge = nextBirthday.getFullYear() - parts.year

  return {
    daysUntil,
    nextAge,
    dateLabel: dayjs(nextBirthday).format('D MMMM'),
  }
}

function gradientText(extra = {}) {
  return {
    background: COLORS.gradient,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: '#e055aa',
    ...extra,
  }
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: COLORS.secondary,
      fontWeight: 700,
      marginBottom: 10,
      padding: '0 2px',
    }}>
      {children}
    </div>
  )
}

function IconBubble({ children, background, size = 34, radius = 9 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

export default function Profile({ session, onCalendarClick }) {
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState({ notif_birthdays: true, notif_invitations: true, notif_messages: false })
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ eventsCount: null, birthdaysCount: null, friendsCount: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setLoading(true)
      setError(null)
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('Utilisateur non connecté.')

        const [profileData, statsData] = await Promise.all([
          fetchProfile(user),
          fetchStats(user),
        ])
        if (cancelled) return

        setProfile(profileData)
        setStats(statsData)
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Impossible de charger le profil.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()

    return () => { cancelled = true }
  }, [])

  const toggle = key => setNotifs(n => ({ ...n, [key]: !n[key] }))

  const showToast = message => {
    setToastMsg(message)
    window.setTimeout(() => setToastMsg(null), 2000)
  }

  const handleSignOut = () => supabase.auth.signOut()

  const openEditProfile = () => {
    setShowEditProfile(true)
  }

  const openBirthdayEdit = () => {
    setShowEditProfile(true)
  }

  const copyInviteLink = async () => {
    const token = profile?.share_token ?? session?.user?.id ?? ''
    const link = `https://amiv.app/invite/${token}`
    try {
      await navigator.clipboard.writeText(link)
      showToast('Lien copié ✓')
    } catch {
      showToast('Impossible de copier le lien')
    }
  }

  const goToCalendar = () => {
    if (onCalendarClick) {
      onCalendarClick()
      return
    }
    navigate('/calendar')
  }

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{
      width: 51, height: 31, borderRadius: 20, position: 'relative', flexShrink: 0, cursor: 'pointer',
      background: on ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#E5E5EA',
      transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 3, width: 25, height: 25, background: '#fff',
        borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        left: on ? 'auto' : 3, right: on ? 3 : 'auto',
        transition: 'all 0.2s',
      }}/>
    </div>
  )

  const birthdayStats = getBirthdayStats(profile?.birthday)
  const memberSince = profile?.created_at ? dayjs(profile.created_at).format('MMMM YYYY') : '—'
  const displayName = getDisplayName(profile)
  const statsItems = [
    { label: 'Événements', value: stats.eventsCount, icon: '🎉' },
    { label: 'Amis', value: stats.friendsCount, icon: '👥' },
    { label: 'Anniversaires', value: stats.birthdaysCount, icon: '🎂' },
  ]
  const shortcutItems = [
    { label: 'Mon lien', icon: <Share2 size={18} strokeWidth={1.8} color="#e055aa" />, bg: 'rgba(224,85,170,0.10)', onClick: copyInviteLink },
    { label: 'Calendrier', icon: <Calendar size={18} strokeWidth={1.8} color="#007AFF" />, bg: 'rgba(0,122,255,0.10)', onClick: goToCalendar },
    { label: 'Cadeaux', icon: <Gift size={18} strokeWidth={1.8} color="#34C759" />, bg: 'rgba(52,199,89,0.10)', onClick: undefined },
    { label: 'Souhaits', icon: <Star size={18} strokeWidth={1.8} color="#f5a623" />, bg: 'rgba(245,166,35,0.12)', onClick: undefined },
  ]
  const notificationRows = [
    { key: 'notif_birthdays', icon: <Bell size={18} strokeWidth={1.7} color="#f5a623" />, bg: 'rgba(245,166,35,0.12)', label: 'Rappels anniversaires', desc: '7 jours avant' },
    { key: 'notif_invitations', icon: <Mail size={18} strokeWidth={1.7} color="#007AFF" />, bg: 'rgba(0,122,255,0.10)', label: 'Nouvelles invitations', desc: 'Activé' },
    { key: 'notif_messages', icon: <MessageCircle size={18} strokeWidth={1.7} color="#8E8E93" />, bg: COLORS.page, label: 'Messages', desc: 'Désactivé' },
  ]
  const accountRows = [
    { icon: <UserCheck size={18} strokeWidth={1.7} color="#7c5cbf" />, bg: 'rgba(124,92,191,0.10)', label: 'Informations personnelles', desc: 'Nom, prénom, date de naissance', onClick: openEditProfile },
    { icon: <Key size={18} strokeWidth={1.7} color="#007AFF" />, bg: 'rgba(0,122,255,0.10)', label: 'Changer le mot de passe', desc: 'Modifier votre mot de passe actuel', onClick: () => setShowChangePassword(true) },
    { icon: <FileText size={18} strokeWidth={1.7} color="#8E8E93" />, bg: COLORS.page, label: 'CGU & Politique de confidentialité', desc: "Conditions générales d'utilisation", onClick: () => window.open('https://amiv.app/legal', '_blank') },
    { icon: <AlertCircle size={18} strokeWidth={1.7} color="#e055aa" />, bg: 'rgba(224,85,170,0.10)', label: 'Contact & signaler un bug', desc: "Écrire à l'équipe Amiv", onClick: () => window.open('mailto:contact@amiv.app?subject=Bug%20Amiv', '_blank') },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: COLORS.page, overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
        <div style={{ background: COLORS.heroGradient, padding: '52px 16px 0', textAlign: 'center', color: '#fff' }}>
          <div
            onClick={openEditProfile}
            style={{ width: 86, height: 86, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.5)', margin: '0 auto 12px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FBBF9A', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 30, fontWeight: 800 }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : getInitial(profile)
              }
            </div>
            <div style={{ position: 'absolute', right: 0, bottom: 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 5px rgba(0,0,0,0.16)' }}>
              <Pencil size={12} strokeWidth={2} color="#e055aa" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{loading ? 'Profil' : displayName}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 5, overflowWrap: 'anywhere' }}>{profile?.email ?? session?.user?.email ?? '—'}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '5px 12px' }}>🎉 Membre depuis {memberSince}</div>
            <div style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '5px 12px' }}>⭐ Bêta</div>
          </div>
          <div style={{ height: 28, background: COLORS.page, borderRadius: '24px 24px 0 0', margin: '24px -16px 0' }} />
        </div>

        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          {statsItems.map(({ label, value, icon }) => (
            <div key={label} style={{ background: COLORS.card, borderRadius: 16, padding: '14px 8px', textAlign: 'center', boxShadow: CARD_SHADOW }}>
              <div style={{ fontSize: 20, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, lineHeight: 1.2, marginTop: 2 }}>{loading || error || value === null ? '—' : value}</div>
              <div style={{ fontSize: 11, color: COLORS.secondary, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 16px' }}>
          {error && (
            <div style={{ background: COLORS.card, borderRadius: 20, padding: 16, boxShadow: CARD_SHADOW, display: 'flex', gap: 12, marginBottom: 18 }}>
              <AlertCircle size={20} strokeWidth={1.6} color={COLORS.destructive} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>Erreur de chargement</div>
                <div style={{ fontSize: 13, color: COLORS.secondary, lineHeight: 1.4 }}>{error}</div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Mon anniversaire</SectionTitle>
            <div style={{ background: COLORS.card, borderRadius: 20, padding: '14px 16px', boxShadow: CARD_SHADOW, display: 'flex', alignItems: 'center', gap: 14 }}>
              <IconBubble background="rgba(224,85,170,0.12)" size={52} radius="50%">
                <span style={{ fontSize: 24 }}>🎂</span>
              </IconBubble>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: COLORS.secondary, fontWeight: 700, marginBottom: 3 }}>Prochain anniversaire</div>
                {birthdayStats ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{birthdayStats.dateLabel} · {birthdayStats.nextAge} ans</div>
                    <div style={{ fontSize: 11, color: COLORS.secondary, marginTop: 3 }}>Tes amis seront notifiés 7 j avant</div>
                  </>
                ) : (
                  <button type="button" onClick={openBirthdayEdit} style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 14, fontWeight: 800, ...gradientText() }}>
                    Ajouter ma date de naissance
                  </button>
                )}
              </div>
              {birthdayStats && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, ...gradientText() }}>J-{birthdayStats.daysUntil}</div>
                  <div style={{ fontSize: 10, color: COLORS.secondary, marginTop: 3 }}>jours</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Raccourcis</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {shortcutItems.map(item => (
                <button key={item.label} type="button" onClick={item.onClick} style={{ border: 'none', background: COLORS.card, borderRadius: 16, padding: '12px 6px', textAlign: 'center', boxShadow: CARD_SHADOW, cursor: item.onClick ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  <IconBubble background={item.bg} size={38} radius="50%">
                    {item.icon}
                  </IconBubble>
                  <div style={{ fontSize: 10, fontWeight: 800, color: COLORS.text, marginTop: 7, lineHeight: 1.1 }}>{item.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Notifications</SectionTitle>
            <div style={{ background: COLORS.card, borderRadius: 20, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
              {notificationRows.map((row, index) => (
                <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: index < notificationRows.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
                  <IconBubble background={row.bg}>{row.icon}</IconBubble>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: COLORS.secondary, marginTop: 2 }}>{row.desc}</div>
                  </div>
                  <Toggle on={notifs[row.key]} onToggle={() => toggle(row.key)} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Compte & confidentialité</SectionTitle>
            <div style={{ background: COLORS.card, borderRadius: 20, overflow: 'hidden', boxShadow: CARD_SHADOW }}>
              {accountRows.map((row, index) => (
                <button key={row.label} type="button" onClick={row.onClick} style={{ width: '100%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: index < accountRows.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <IconBubble background={row.bg}>{row.icon}</IconBubble>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{row.label}</div>
                    <div style={{ fontSize: 11, color: COLORS.secondary, marginTop: 2, lineHeight: 1.25 }}>{row.desc}</div>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.7} color={COLORS.hint} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: COLORS.card, borderRadius: 20, overflow: 'hidden', boxShadow: CARD_SHADOW, marginBottom: 18 }}>
            <button type="button" onClick={handleSignOut} style={{ width: '100%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <IconBubble background={COLORS.page}>
                <LogOut size={18} strokeWidth={1.7} color={COLORS.secondary} />
              </IconBubble>
              <div style={{ flex: 1, fontSize: 14, color: COLORS.text, fontWeight: 600 }}>Se déconnecter</div>
              <ChevronRight size={16} strokeWidth={1.7} color={COLORS.hint} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.confirm('Cette action est irréversible...')}
            style={{ width: '100%', border: 'none', background: COLORS.card, borderRadius: 20, padding: 14, boxShadow: CARD_SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: COLORS.destructive, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}
          >
            <Trash2 size={18} strokeWidth={1.8} color={COLORS.destructive} />
            <span>Supprimer mon compte</span>
          </button>

          <div style={{ textAlign: 'center', fontSize: 11, color: COLORS.hint, fontWeight: 500, padding: '10px 0 32px' }}>
            Amiv v1.0.0 · Made with ❤️ in France
          </div>
        </div>
      </div>

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: COLORS.text, color: '#fff', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 600, zIndex: 900, boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}>
          {toastMsg}
        </div>
      )}

      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profile={profile}
        onSaved={updatedProfile => setProfile(updatedProfile)}
      />
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  )
}
