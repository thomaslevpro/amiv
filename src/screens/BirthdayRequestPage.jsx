import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Lock, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

const COLORS = {
  page: '#FFFFFF',
  card: '#fff',
  text: '#1C1C1E',
  secondary: '#8E8E93',
  error: '#FF3B30',
  gradient: 'linear-gradient(135deg,#e055aa,#f5a623)',
}

const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1.5px solid #F0F0F0',
  borderRadius: 12,
  padding: '13px 12px',
  fontSize: 16,
  outline: 'none',
  color: COLORS.text,
  background: '#FAFAFA',
  fontFamily: FONT,
  WebkitAppearance: 'none',
  appearance: 'none',
}

const labelStyle = { fontSize: 12, fontWeight: 700, color: COLORS.secondary, marginBottom: 6, display: 'block', textAlign: 'left' }

function primaryButton(disabled) {
  return {
    width: '100%', minHeight: 52, borderRadius: 16, border: 'none',
    background: disabled ? '#F5F5F5' : COLORS.gradient,
    color: disabled ? COLORS.secondary : '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 16, fontWeight: 800, cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : '0 4px 18px rgba(224,85,170,0.30)',
    fontFamily: 'inherit',
  }
}

function dateLabel(day, month) {
  return `${day}${Number(day) === 1 ? 'er' : ''} ${MONTHS[Number(month) - 1]}`
}

function Shell({ title, children }) {
  return (
    <div style={{ minHeight: '100dvh', background: COLORS.page, display: 'flex', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: COLORS.gradient, padding: 'calc(56px + env(safe-area-inset-top, 0px)) 24px 84px', color: '#fff', textAlign: 'center', borderRadius: '0 0 28px 28px' }}>
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 14 }}>🎂</div>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{title}</div>
        </div>
        <div style={{ padding: '0 18px 32px', marginTop: -44 }}>
          <div style={{ background: COLORS.card, borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,0.10)', padding: 20 }}>
            {children}
          </div>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: COLORS.secondary }}>
            <a href="/confidentialite" style={{ color: COLORS.secondary }}>Confidentialité</a>
            {' · '}
            <span style={{ fontWeight: 800 }}>Amiv</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Message({ children }) {
  return <div style={{ color: COLORS.secondary, fontSize: 14, lineHeight: 1.5, textAlign: 'center' }}>{children}</div>
}

function JoinAmiv({ navigate }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '0.5px solid rgba(0,0,0,0.08)', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 700, lineHeight: 1.45, marginBottom: 12 }}>
        Crée ton compte Amiv pour ne rater aucun anniversaire non plus
      </div>
      <button type="button" onClick={() => navigate('/register')} style={{ ...primaryButton(false), minHeight: 46, fontSize: 15, boxShadow: 'none' }}>
        Créer mon compte
      </button>
      <div style={{ fontSize: 12, color: COLORS.secondary, marginTop: 8 }}>Gratuit, et complètement facultatif.</div>
    </div>
  )
}

export default function BirthdayRequestPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState(null)
  const [session, setSession] = useState(null)
  const [name, setName] = useState('')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [friendship, setFriendship] = useState(null)
  const [friendBusy, setFriendBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: authData }, requestRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc('get_birthday_request', { p_code: code }),
      ])
      if (cancelled) return
      const currentSession = authData?.session ?? null
      setSession(currentSession)
      const data = requestRes.error ? { status: 'error' } : requestRes.data
      setRequest(data)
      if (data?.friend_name) setName(data.friend_name)

      // Personne connectée : on préremplit avec son profil.
      if (currentSession && data?.status === 'pending' && !data.is_own) {
        const { data: me } = await supabase.rpc('get_my_profile').select('first_name, birthday').maybeSingle()
        if (cancelled) return
        if (me?.first_name && !data.friend_name) setName(me.first_name)
        if (me?.birthday) {
          const [y, m, d] = me.birthday.split('-')
          setDay(String(Number(d)))
          setMonth(String(Number(m)))
          setYear(y)
        }
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [code])

  async function loadFriendship(requesterId) {
    const me = session?.user?.id
    if (!me || !requesterId || me === requesterId) return
    const { data } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${me},addressee_id.eq.${requesterId}),and(requester_id.eq.${requesterId},addressee_id.eq.${me})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setFriendship(data ?? { status: 'none' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (!name.trim()) { setError('Indique ton prénom.'); return }
    if (!day || !month) { setError('Choisis le jour et le mois.'); return }
    const yearValue = year.trim() ? Number(year.trim()) : null
    if (yearValue !== null && (!Number.isInteger(yearValue) || yearValue < 1900 || yearValue > new Date().getFullYear())) {
      setError('Année invalide (ou laisse-la vide).')
      return
    }
    // Champ caché rempli : robot, on n'envoie rien.
    if (website) { setResult({ status: 'ok' }); return }

    setSubmitting(true)
    const { data, error: rpcError } = await supabase.rpc('submit_birthday_request', {
      p_code: code,
      p_name: name.trim(),
      p_day: Number(day),
      p_month: Number(month),
      p_year: yearValue,
    })
    setSubmitting(false)

    const status = rpcError ? 'error' : data?.status
    if (status === 'ok') {
      setResult({ status: 'ok', day, month })
      if (data.requester_id) loadFriendship(data.requester_id)
    } else if (status === 'invalid') {
      setError('Cette date n’existe pas. Vérifie le jour et le mois.')
    } else if (status === 'rate_limited') {
      setError('Trop d’envois depuis cet appareil. Réessaie dans une heure.')
    } else if (status === 'own_request') {
      setRequest(current => ({ ...current, is_own: true }))
    } else if (status === 'used' || status === 'expired' || status === 'not_found') {
      setRequest(current => ({ ...current, status }))
    } else {
      setError('Envoi impossible. Vérifie ta connexion et réessaie.')
    }
  }

  async function handleAddFriend() {
    const requesterId = request?.requester_id
    if (!session || !requesterId || friendBusy) return
    setFriendBusy(true)
    const { data, error: friendError } = await supabase
      .from('friendships')
      .insert({ requester_id: session.user.id, addressee_id: requesterId, status: 'pending' })
      .select('id, status')
      .single()
    setFriendBusy(false)
    if (friendError) {
      setError('Impossible d’envoyer la demande d’ami.')
      return
    }
    setFriendship(data)
  }

  const requester = request?.requester_first_name || 'Ton ami'

  if (loading) return <Shell title="Amiv"><Message>Chargement…</Message></Shell>

  if (request?.status === 'error') {
    return <Shell title="Oups"><Message>Impossible de charger ce lien. Vérifie ta connexion et recharge la page.</Message></Shell>
  }
  if (!request || request.status === 'not_found') {
    return <Shell title="Lien introuvable"><Message>Ce lien n’existe pas. Vérifie qu’il a été copié en entier, ou demande un nouveau lien à la personne qui te l’a envoyé.</Message></Shell>
  }

  if (result?.status === 'ok') {
    const friendLabel = friendship?.status === 'accepted'
      ? 'Vous êtes déjà amis 🎉'
      : friendship?.status === 'pending'
        ? 'Demande d’ami envoyée'
        : `Ajouter ${requester} en ami`
    return (
      <Shell title="Merci ! 🎉">
        <Message>
          {result.day
            ? <>{requester} a bien reçu ta date d’anniversaire ({dateLabel(result.day, result.month)}). Plus d’anniversaire oublié !</>
            : <>{requester} a bien reçu ta date d’anniversaire.</>}
        </Message>
        {session && friendship && (
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              disabled={friendship.status !== 'none' || friendBusy}
              onClick={handleAddFriend}
              style={primaryButton(friendship.status !== 'none')}
            >
              {friendship.status === 'none' && <UserPlus size={18} strokeWidth={2.2} />}
              <span>{friendBusy ? 'Envoi…' : friendLabel}</span>
            </button>
          </div>
        )}
        {error && <div style={{ color: COLORS.error, fontSize: 13, fontWeight: 700, marginTop: 12, textAlign: 'center' }}>{error}</div>}
        {!session && <JoinAmiv navigate={navigate} />}
      </Shell>
    )
  }

  if (request.status === 'used') {
    return (
      <Shell title="Lien déjà utilisé">
        <Message>Une date d’anniversaire a déjà été envoyée avec ce lien. Chaque lien ne sert qu’une fois : si tu veux en envoyer une autre, demande un nouveau lien à {requester}.</Message>
        {!session && <JoinAmiv navigate={navigate} />}
      </Shell>
    )
  }
  if (request.status === 'expired') {
    return (
      <Shell title="Lien expiré">
        <Message>Ce lien n’est plus valable (il expire 30 jours après l’envoi). Demande un nouveau lien à {requester}.</Message>
        {!session && <JoinAmiv navigate={navigate} />}
      </Shell>
    )
  }
  if (request.is_own) {
    return (
      <Shell title="C’est ton lien">
        <Message>Ce lien sert à ton ami pour te donner sa date d’anniversaire. Envoie-le-lui par message : tu seras prévenu dès qu’il aura répondu.</Message>
      </Shell>
    )
  }

  return (
    <Shell title={`${requester} aimerait connaître la date de ton anniversaire`}>
      <form onSubmit={handleSubmit} noValidate>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>Ton prénom</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            autoComplete="given-name"
            placeholder="Prénom"
            style={fieldStyle}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Jour</span>
            <select value={day} onChange={e => setDay(e.target.value)} style={fieldStyle} aria-label="Jour">
              <option value="">—</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label style={{ flex: 2 }}>
            <span style={labelStyle}>Mois</span>
            <select value={month} onChange={e => setMonth(e.target.value)} style={fieldStyle} aria-label="Mois">
              <option value="">—</option>
              {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
            </select>
          </label>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={labelStyle}>Année (facultatif)</span>
          <input
            type="number"
            inputMode="numeric"
            value={year}
            onChange={e => setYear(e.target.value.slice(0, 4))}
            placeholder="AAAA"
            min="1900"
            max={new Date().getFullYear()}
            style={fieldStyle}
          />
          <span style={{ fontSize: 12, color: COLORS.secondary, marginTop: 6, display: 'block' }}>
            Pour qu’il connaisse ton âge.
          </span>
        </label>

        {/* Piège à robots : invisible pour les personnes */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={e => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#F7F7F8', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
          <Lock size={16} strokeWidth={2} color={COLORS.secondary} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.45 }}>
            Seule la personne qui t’a envoyé ce lien ({requester}) verra ta date. Elle n’est ni publiée ni partagée, et sert uniquement à lui rappeler ton anniversaire. Pas besoin de compte.
          </div>
        </div>

        {error && <div style={{ color: COLORS.error, fontSize: 13, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

        <button type="submit" disabled={submitting} style={primaryButton(false)}>
          {submitting ? 'Envoi…' : 'Envoyer'}
        </button>
      </form>
    </Shell>
  )
}
