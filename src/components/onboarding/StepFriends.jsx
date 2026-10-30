import { useEffect, useState } from 'react'
import { QrCode, Search, Share2, X } from 'lucide-react'
import { getFriendSuggestions, searchPeople, sendFriendRequest } from '../../lib/friendships'
import { shareLink } from '../../lib/share'
import { captureSupabaseError } from '../../lib/monitoring'
import { hapticLight } from '../../lib/haptics'
import AmivQrModal from '../profile/AmivQrModal'
import { Avatar } from '../messages/MessageUI'
import { BLACK, FONT, GRADIENT, GRAY, LIGHT, OnboardingScreen, PrimaryButton, StepTitle } from './OnboardingUI'

function PersonRow({ person, sent, onAdd }) {
  const title = person.name || `@${person.username}`
  const done = sent || person.is_friend
  return (
    <div className="ob-rise" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <Avatar name={person.name || person.username} url={person.avatar_url} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 650, color: BLACK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 13, color: GRAY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {person.reason || (person.username ? `@${person.username}` : '')}
        </div>
      </div>
      <button
        type="button"
        disabled={done}
        onClick={onAdd}
        className="ob-press"
        style={{ border: 'none', borderRadius: 12, padding: '9px 13px', fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: FONT, cursor: done ? 'default' : 'pointer', background: done ? LIGHT : GRADIENT, color: done ? GRAY : '#fff' }}
      >
        {person.is_friend ? 'Ami' : sent ? 'Envoyée ✓' : 'Ajouter'}
      </button>
    </div>
  )
}

// Étape 5 (facultative) : recherche par pseudo, lien et QR code, suggestions.
export default function StepFriends({ userId, profile, header, direction, onDone }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [sentIds, setSentIds] = useState(() => new Set())
  const [showQr, setShowQr] = useState(false)
  const [shareFeedback, setShareFeedback] = useState(null)

  const inviteLink = profile?.username ? `https://amiv.app/u/${profile.username}` : 'https://amiv.app'
  const search = query.trim().replace(/^@/, '')

  useEffect(() => {
    let cancelled = false
    getFriendSuggestions(userId).then(({ data, error }) => {
      if (error) captureSupabaseError(error, { operation: 'onboarding_friend_suggestions' })
      if (!cancelled) setSuggestions((data ?? []).slice(0, 8))
    })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (search.length < 2) { setResults([]); setSearching(false); return undefined }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(async () => {
      const { data, error } = await searchPeople(search)
      if (error) captureSupabaseError(error, { operation: 'onboarding_search_people' })
      if (!cancelled) { setResults(data ?? []); setSearching(false) }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search])

  async function add(person) {
    if (sentIds.has(person.user_id)) return
    hapticLight()
    setSentIds(prev => new Set([...prev, person.user_id]))
    const { error } = await sendFriendRequest(userId, person.user_id)
    if (error) {
      captureSupabaseError(error, { operation: 'onboarding_friend_request' })
      setSentIds(prev => { const next = new Set(prev); next.delete(person.user_id); return next })
    }
  }

  async function share() {
    const result = await shareLink({ title: 'Rejoins-moi sur Amiv', text: 'Retrouve-moi sur Amiv pour ne rater aucun anniversaire 🎂', url: inviteLink })
    if (result === 'copied') setShareFeedback('Lien copié ✓')
    else if (result === 'failed') setShowQr(true)
  }

  const list = search.length >= 2 ? results : suggestions

  return (
    <OnboardingScreen
      header={header}
      direction={direction}
      screenKey="friends"
      footer={<PrimaryButton onClick={() => onDone({ friendRequests: sentIds.size })}>Continuer</PrimaryButton>}
    >
      <StepTitle emoji="🤝" title="Retrouve tes amis" subtitle="Ajoute ceux qui sont déjà sur Amiv, invite les autres." />

      <div style={{ height: 48, borderRadius: 14, background: LIGHT, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', marginBottom: 12 }}>
        <Search size={18} strokeWidth={2.2} color={GRAY} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Pseudo ou prénom"
          aria-label="Rechercher un ami par pseudo"
          autoCapitalize="none"
          autoCorrect="off"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: BLACK, fontFamily: FONT }}
        />
        {query && (
          <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} style={{ width: 22, height: 22, border: 'none', borderRadius: '50%', background: '#C7C7CC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}>
            <X size={13} strokeWidth={2.6} color="#fff" />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={share} className="ob-press" style={chipStyle}>
          <Share2 size={17} strokeWidth={2.2} color="#e055aa" /> {shareFeedback ?? 'Partager mon lien'}
        </button>
        <button type="button" onClick={() => setShowQr(true)} className="ob-press" style={chipStyle}>
          <QrCode size={17} strokeWidth={2.2} color="#e055aa" /> Mon QR code
        </button>
      </div>

      {search.length >= 2 ? (
        <div style={sectionTitle}>Résultats</div>
      ) : suggestions.length > 0 && (
        <div style={sectionTitle}>Tu les connais peut-être</div>
      )}

      {searching && <div style={{ color: GRAY, fontSize: 14, padding: '10px 0' }}>Recherche…</div>}
      {!searching && search.length >= 2 && results.length === 0 && (
        <div style={{ color: GRAY, fontSize: 14, padding: '10px 0', lineHeight: 1.5 }}>
          Personne avec ce nom pour l'instant. Envoie-lui ton lien pour qu'il te rejoigne.
        </div>
      )}
      {!searching && list.map(person => (
        <PersonRow key={person.user_id} person={person} sent={sentIds.has(person.user_id)} onAdd={() => add(person)} />
      ))}

      <AmivQrModal isOpen={showQr} link={inviteLink} onClose={() => setShowQr(false)} />
    </OnboardingScreen>
  )
}

const chipStyle = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', borderRadius: 14, background: '#FFF0F7', color: BLACK, padding: '12px 10px', fontSize: 14, fontWeight: 650, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' }
const sectionTitle = { fontSize: 12, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }
