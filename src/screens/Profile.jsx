import { useState, useEffect } from 'react'
import {
  AlertCircle,
  Bell,
  CalendarCheck2,
  Cake,
  ChevronRight,
  FileText,
  Key,
  Copy,
  Link2,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  QrCode,
  Share2,
  UserCheck,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { supabase } from '../lib/supabase'
import { deleteCalendarToken, getOrCreateCalendarToken } from '../lib/calendarSync'
import EditProfileModal from '../components/profile/EditProfileModal'
import ChangePasswordModal from '../components/profile/ChangePasswordModal'
import AmivQrModal from '../components/profile/AmivQrModal'
import FriendsListModal from '../components/profile/FriendsListModal'

dayjs.locale('fr')

const COLORS = {
  page: '#faf9fb',
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
    .select('name, first_name, email, avatar_url, created_at, birthday, username, share_token, notif_birthdays, notif_invitations, notif_messages')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error

  return {
    id: user.id,
    name: data?.name ?? null,
    first_name: data?.first_name ?? null,
    email: data?.email ?? user.email ?? null,
    avatar_url: data?.avatar_url ?? null,
    created_at: data?.created_at ?? user.created_at ?? null,
    birthday: data?.birthday ?? null,
    username: data?.username ?? null,
    share_token: data?.share_token ?? user.id,
    notif_birthdays: data?.notif_birthdays ?? true,
    notif_invitations: data?.notif_invitations ?? true,
    notif_messages: data?.notif_messages ?? false,
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
  const [showQrModal, setShowQrModal] = useState(false)
  const [showFriendsList, setShowFriendsList] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [calendarToken, setCalendarToken] = useState(null)
  const [calendarPlatform, setCalendarPlatform] = useState(null)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarBusy, setCalendarBusy] = useState(false)
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

        const [profileData, statsData, calendarTokenData] = await Promise.all([
          fetchProfile(user),
          fetchStats(user),
          supabase
            .from('calendar_tokens')
            .select('token, platform')
            .eq('user_id', user.id)
            .maybeSingle(),
        ])
        if (cancelled) return

        if (calendarTokenData.error) throw calendarTokenData.error

        setProfile(profileData)
        setStats(statsData)
        setCalendarToken(calendarTokenData.data?.token ?? null)
        setCalendarPlatform(calendarTokenData.data?.platform ?? null)
        setNotifs({
          notif_birthdays: profileData.notif_birthdays,
          notif_invitations: profileData.notif_invitations,
          notif_messages: profileData.notif_messages,
        })
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Impossible de charger le profil.')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setCalendarLoading(false)
        }
      }
    }

    loadProfile()

    return () => { cancelled = true }
  }, [])

  const toggle = key => {
    setNotifs(n => {
      const newValue = !n[key]
      supabase
        .from('profiles')
        .update({ [key]: newValue })
        .eq('id', profile?.id)
        .then(({ error }) => { if (error) console.error('notif update failed', error) })
      return { ...n, [key]: newValue }
    })
  }

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
    const link = profile?.username ? `https://amiv.app/u/${profile.username}` : 'https://amiv.app'
    try {
      await navigator.clipboard.writeText(link)
      showToast('Lien copié ✓')
    } catch {
      showToast('Impossible de copier le lien')
    }
  }

  const getShareLink = () => publicProfileLink ?? 'https://amiv.app'

  const copyInviteLinkFromMenu = async () => {
    await copyInviteLink()
    setShowShareMenu(false)
  }

  const shareToWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(getShareLink())}`, '_blank')
    setShowShareMenu(false)
  }

  const shareToInstagram = async () => {
    try {
      await navigator.clipboard.writeText(getShareLink())
      showToast('Lien copié — colle-le dans ta story Instagram !')
    } catch {
      showToast('Impossible de copier le lien')
    } finally {
      setShowShareMenu(false)
    }
  }

  const shareToMessenger = () => {
    window.open(
      `https://www.facebook.com/dialog/send?link=${encodeURIComponent(getShareLink())}&app_id=291494419107518&redirect_uri=${encodeURIComponent('https://amiv.app')}`,
      '_blank'
    )
    setShowShareMenu(false)
  }

  const calendarHttpsLink = calendarToken ? `https://amiv.app/api/calendar/${calendarToken}.ics` : null

  const connectCalendar = async (platform) => {
    if (!profile?.id || calendarBusy) return

    setCalendarBusy(true)
    try {
      const data = await getOrCreateCalendarToken(profile.id, platform)
      setCalendarToken(data.token)
      setCalendarPlatform(platform)
      if (platform === 'apple') {
        window.location.href = `webcal://amiv.app/api/calendar/${data.token}.ics`
      } else {
        const encoded = encodeURIComponent(`https://amiv.app/api/calendar/${data.token}.ics`)
        window.open(`https://calendar.google.com/calendar/r/settings/addbyurl?url=${encoded}`, '_blank')
      }
    } catch (err) {
      console.error('calendar connect failed', err)
      showToast('Impossible de connecter le calendrier')
    } finally {
      setCalendarBusy(false)
    }
  }

  const copyCalendarLink = async () => {
    if (!calendarHttpsLink) return

    try {
      await navigator.clipboard.writeText(calendarHttpsLink)
      showToast('Lien calendrier copié ✓')
    } catch {
      showToast('Impossible de copier le lien')
    }
  }

  const disconnectCalendar = async () => {
    if (!profile?.id || calendarBusy) return

    setCalendarBusy(true)
    try {
      await deleteCalendarToken(profile.id)
      setCalendarToken(null)
      setCalendarPlatform(null)
      showToast('Calendrier déconnecté')
    } catch (err) {
      console.error('calendar disconnect failed', err)
      showToast('Impossible de déconnecter')
    } finally {
      setCalendarBusy(false)
    }
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

  const WhatsAppIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5a8.2 8.2 0 0 0-7 12.5l-1 3.7 3.8-1a8.2 8.2 0 1 0 4.2-15.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.7 8.7c.2-.5.4-.6.8-.6h.5c.2 0 .4.1.5.4l.8 1.9c.1.3 0 .5-.2.7l-.4.5c.8 1.3 1.8 2.3 3.2 3l.5-.6c.2-.2.5-.3.8-.1l1.8.9c.3.2.4.4.4.7v.4c0 .5-.4.9-.9 1-2.6.2-7.7-3-8.4-7.3-.1-.3 0-.6.1-.9Z" fill="currentColor" />
    </svg>
  )

  const InstagramIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.2" cy="7.8" r="1" fill="currentColor" />
    </svg>
  )

  const birthdayStats = getBirthdayStats(profile?.birthday)
  const memberSince = profile?.created_at ? dayjs(profile.created_at).format('MMMM YYYY') : '—'
  const displayName = getDisplayName(profile)
  const publicProfileLink = profile?.username ? `https://amiv.app/u/${profile.username}` : null
  const shareMenuItems = [
    { label: 'Copier le lien', icon: <Link2 size={18} strokeWidth={2} />, onClick: copyInviteLinkFromMenu },
    { label: 'WhatsApp', icon: <WhatsAppIcon />, onClick: shareToWhatsApp },
    { label: 'Instagram', icon: <InstagramIcon />, onClick: shareToInstagram },
    { label: 'Messenger', icon: <MessageCircle size={18} strokeWidth={2} />, onClick: shareToMessenger },
  ]
  const statsItems = [
    { label: 'Événements', value: stats.eventsCount, iconName: 'calendar-event', iconBg: 'rgba(83,74,183,0.10)', iconColor: '#534AB7' },
    { label: 'Amis', value: stats.friendsCount, iconName: 'users', iconBg: 'rgba(15,110,86,0.10)', iconColor: '#0F6E56' },
    { label: 'Anniversaires', value: stats.birthdaysCount, iconName: 'cake', iconBg: 'rgba(153,53,86,0.10)', iconColor: '#993556' },
  ]
  const STAT_ICONS = {
    'calendar-event': <CalendarCheck2 size={18} strokeWidth={1.8} />,
    'users': <Users size={18} strokeWidth={1.8} />,
    'cake': <Cake size={18} strokeWidth={1.8} />,
  }
  const notificationRows = [
    { key: 'notif_birthdays', icon: <Bell size={18} strokeWidth={1.7} color="#f5a623" />, bg: 'rgba(245,166,35,0.12)', label: 'Rappels anniversaires' },
    { key: 'notif_invitations', icon: <Mail size={18} strokeWidth={1.7} color="#007AFF" />, bg: 'rgba(0,122,255,0.10)', label: 'Nouvelles invitations' },
    { key: 'notif_messages', icon: <MessageCircle size={18} strokeWidth={1.7} color="#8E8E93" />, bg: 'rgba(142,142,147,0.10)', label: 'Messages' },
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
        <div style={{ background: COLORS.heroGradient, padding: '52px 16px 0', textAlign: 'center', color: '#fff', position: 'relative' }}>
          {showShareMenu && (
            <div
              onClick={() => setShowShareMenu(false)}
              style={{ position: 'absolute', inset: 0, zIndex: 9 }}
            />
          )}
          <button
            type="button"
            onClick={() => setShowShareMenu(open => !open)}
            style={{
              position: 'absolute',
              top: 14,
              left: 16,
              zIndex: 11,
              width: 38,
              height: 38,
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Share2 size={18} strokeWidth={2} color="#fff" />
          </button>
          {showShareMenu && (
            <div
              style={{
                position: 'absolute',
                top: 90,
                left: 16,
                zIndex: 10,
                background: 'rgba(255,255,255,0.22)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 16,
                overflow: 'hidden',
                minWidth: 200,
                textAlign: 'left',
              }}
            >
              {shareMenuItems.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: index < shareMenuItems.length - 1 ? '0.5px solid rgba(255,255,255,0.18)' : 'none',
                    background: 'transparent',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={!publicProfileLink}
            onClick={() => setShowQrModal(true)}
            aria-label="Voir mon QR code"
            style={{
              position: 'absolute',
              top: 14,
              right: 16,
              zIndex: 11,
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: publicProfileLink ? 'pointer' : 'default',
              opacity: publicProfileLink ? 1 : 0.5,
            }}
          >
            <QrCode size={18} strokeWidth={2.2} color="#fff" />
          </button>
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
          {statsItems.map(({ label, value, iconName, iconBg, iconColor }) => (
            <div
              key={label}
              onClick={label === 'Amis' ? () => setShowFriendsList(true) : undefined}
              style={{
                background: COLORS.card,
                borderRadius: 16,
                padding: '14px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: CARD_SHADOW,
                cursor: label === 'Amis' ? 'pointer' : 'default',
                opacity: 1,
                transition: label === 'Amis' ? 'opacity 0.15s' : undefined,
              }}
              onMouseEnter={label === 'Amis' ? e => { e.currentTarget.style.opacity = '0.85' } : undefined}
              onMouseLeave={label === 'Amis' ? e => { e.currentTarget.style.opacity = '1' } : undefined}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: iconColor,
              }}>
                {STAT_ICONS[iconName]}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, lineHeight: 1 }}>
                  {loading || error || value === null ? '—' : value}
                </div>
                <div style={{ fontSize: 11, color: COLORS.secondary, marginTop: 2, lineHeight: 1.2 }}>{label}</div>
              </div>
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
            <SectionTitle>Calendrier</SectionTitle>
            <div style={{ background: COLORS.card, borderRadius: 20, padding: 14, boxShadow: CARD_SHADOW }}>
              {calendarToken ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CalendarCheck2 size={18} strokeWidth={1.9} color="#248A3D" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                        {calendarPlatform === 'google' ? 'Google Calendar' : 'Apple Calendar'}
                      </div>
                      <div style={{ fontSize: 11, color: '#248A3D', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34C759', display: 'inline-block', flexShrink: 0 }} />
                        Connecté · synchronisation active
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyCalendarLink}
                      disabled={calendarBusy}
                      style={{ padding: '7px 12px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.12)', background: COLORS.card, color: COLORS.text, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: calendarBusy ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                    >
                      <Copy size={13} strokeWidth={2} color="#e055aa" />
                      Copier
                    </button>
                  </div>
                  <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.08)', margin: '12px 0' }} />
                  <button
                    type="button"
                    onClick={disconnectCalendar}
                    disabled={calendarBusy}
                    style={{ width: '100%', minHeight: 40, border: 'none', borderRadius: 12, background: 'rgba(255,59,48,0.08)', color: COLORS.destructive, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: calendarBusy ? 'default' : 'pointer', fontFamily: 'inherit' }}
                  >
                    Déconnecter le calendrier
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <CalendarCheck2 size={24} strokeWidth={1.7} color={COLORS.secondary} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Calendrier non connecté</div>
                  <div style={{ fontSize: 12, color: COLORS.secondary, lineHeight: 1.5, marginBottom: 16 }}>
                    Synchronise tes anniversaires et événements avec ton application calendrier.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => connectCalendar('apple')}
                      disabled={calendarLoading || calendarBusy || !profile?.id}
                      style={{ minHeight: 44, border: 'none', borderRadius: 12, background: calendarLoading || !profile?.id ? '#E5E5EA' : 'linear-gradient(135deg, #e055aa, #f5a623)', color: calendarLoading || !profile?.id ? COLORS.secondary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 600, cursor: calendarLoading || calendarBusy || !profile?.id ? 'default' : 'pointer', fontFamily: 'inherit' }}
                    >
                      <CalendarCheck2 size={15} strokeWidth={2.2} />
                      Apple
                    </button>
                    <button
                      type="button"
                      onClick={() => connectCalendar('google')}
                      disabled={calendarLoading || calendarBusy || !profile?.id}
                      style={{ minHeight: 44, border: 'none', borderRadius: 12, background: calendarLoading || !profile?.id ? '#E5E5EA' : '#4285F4', color: calendarLoading || !profile?.id ? COLORS.secondary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13, fontWeight: 600, cursor: calendarLoading || calendarBusy || !profile?.id ? 'default' : 'pointer', fontFamily: 'inherit' }}
                    >
                      <CalendarCheck2 size={15} strokeWidth={2.2} />
                      Google
                    </button>
                  </div>
                </div>
              )}
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
                    <div style={{ fontSize: 11, color: COLORS.secondary, marginTop: 2 }}>
                      {notifs[row.key] ? 'Activé' : 'Désactivé'}
                    </div>
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
      <AmivQrModal
        isOpen={showQrModal}
        link={publicProfileLink}
        onClose={() => setShowQrModal(false)}
        onToast={showToast}
      />
      <FriendsListModal
        isOpen={showFriendsList}
        onClose={() => setShowFriendsList(false)}
        currentUserId={profile?.id}
      />
    </div>
  )
}
