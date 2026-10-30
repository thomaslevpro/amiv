import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BellRing, CalendarCheck, ClipboardList, Gift, Images, Lock, MessageCircle, MessagesSquare, Sparkles } from 'lucide-react'
import prochesWebp from '../../assets/onboarding/onboarding-proches.webp'
import prochesJpg from '../../assets/onboarding/onboarding-proches.jpg'
import feteWebp from '../../assets/onboarding/onboarding-fete.webp'
import feteJpg from '../../assets/onboarding/onboarding-fete.jpg'
import surpriseWebp from '../../assets/onboarding/onboarding-surprise.webp'
import surpriseJpg from '../../assets/onboarding/onboarding-surprise.jpg'
import { BLACK, GRADIENT, GRAY, OnboardingScreen, PrimaryButton, SecondaryButton } from './OnboardingUI'

const CARDS = [
  {
    title: 'Ne rate plus aucun moment avec tes proches',
    photo: { webp: prochesWebp, jpg: prochesJpg },
    features: [
      { icon: BellRing, name: 'Rappels d\'anniversaire', text: 'Tous ceux de tes amis, prévenus avant le jour J' },
      { icon: CalendarCheck, name: 'Dispos de tes amis proches', text: 'Un calendrier pour voir qui est libre et se retrouver' },
      { icon: MessageCircle, name: 'Messagerie intégrée', text: 'Discute en privé ou en groupe, sans changer d\'app' },
    ],
  },
  {
    title: 'Organise la fête en deux minutes',
    photo: { webp: feteWebp, jpg: feteJpg },
    features: [
      { icon: ClipboardList, name: 'Espace organisateur', text: 'Invitations, réponses en temps réel, sondages et relances' },
      { icon: MessagesSquare, name: 'Chat de l\'événement', text: 'Tous les invités au même endroit' },
      { icon: Images, name: 'Album partagé', text: 'Chacun ajoute ses photos de la soirée' },
    ],
  },
  {
    title: 'Prépare la surprise en secret',
    photo: { webp: surpriseWebp, jpg: surpriseJpg },
    features: [
      { icon: Lock, name: 'Espace secret', text: 'Invisible pour la personne fêtée, avec sa propre discussion' },
      { icon: Gift, name: 'Cagnotte et idées cadeaux', text: 'Financez le cadeau ensemble, simplement' },
      { icon: Sparkles, name: 'Flashback', text: 'Des souvenirs rassemblés et révélés le jour J' },
    ],
  },
]
const AUTOPLAY_MS = 4000
// Glissement minimal (en part de la largeur) pour changer de carte
const SWIPE_RATIO = 0.18

const CARD_PADDING = 8
const MIN_PHOTO = 72

function Card({ card, active, photoHeight, textRef }) {
  return (
    <div
      aria-hidden={!active}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: CARD_PADDING, boxSizing: 'border-box', overflow: 'hidden' }}
    >
      {/* Photo : 55 % de la carte au plus, même hauteur sur les trois cartes ;
          sur petit écran, c'est elle qui rétrécit, jamais le texte */}
      <picture style={{ ...(photoHeight ? { height: photoHeight, flex: 'none' } : { flex: '0 1 55%', minHeight: MIN_PHOTO }), display: 'block', borderRadius: 18, overflow: 'hidden', background: '#F5F5F5' }}>
        <source srcSet={card.photo.webp} type="image/webp" />
        <img src={card.photo.jpg} alt="" draggable={false} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
      </picture>
      <div ref={textRef} style={{ flex: 'none', padding: '14px 8px 6px' }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, color: BLACK, letterSpacing: -0.3, lineHeight: 1.2, margin: '0 0 12px' }}>{card.title}</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {card.features.map(({ icon: Icon, name, text }) => (
            <li key={name} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF0F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} strokeWidth={1.9} color="#e055aa" />
              </span>
              <span style={{ minWidth: 0, fontSize: 14, lineHeight: 1.35 }}>
                <span style={{ display: 'block', fontWeight: 600, color: BLACK, fontSize: 15 }}>{name}</span>
                <span style={{ display: 'block', color: GRAY }}>{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Étape 0 : avant d'avoir un compte
export default function Welcome({ onSignup, onLogin }) {
  const [index, setIndex] = useState(0)
  // Défilement automatique arrêté dès le premier contact
  const [autoplay, setAutoplay] = useState(true)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [photoHeight, setPhotoHeight] = useState(null)
  const viewport = useRef(null)
  const drag = useRef(null)
  const cardRefs = useRef([])
  const textRefs = useRef([])

  // Hauteur commune de la photo : 55 % de la carte, moins si le texte le plus
  // long ne tiendrait pas en dessous
  useLayoutEffect(() => {
    const measure = () => {
      const cardHeight = cardRefs.current[0]?.offsetHeight
      if (!cardHeight) return
      const textHeight = Math.max(...textRefs.current.map(el => el?.offsetHeight ?? 0))
      const available = cardHeight - CARD_PADDING * 2 - textHeight
      setPhotoHeight(Math.max(MIN_PHOTO, Math.min(Math.round(cardHeight * 0.55), available)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!autoplay) return undefined
    const timer = window.setInterval(() => setIndex(i => (i + 1) % CARDS.length), AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [autoplay])

  const go = next => setIndex(Math.min(CARDS.length - 1, Math.max(0, next)))

  const onPointerDown = event => {
    setAutoplay(false)
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, horizontal: null }
  }
  const onPointerMove = event => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (d.horizontal == null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      d.horizontal = Math.abs(dx) > Math.abs(dy)
      if (d.horizontal) {
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
      }
    }
    if (!d.horizontal) return
    // Résistance au-delà de la première et de la dernière carte
    const atEdge = (index === 0 && dx > 0) || (index === CARDS.length - 1 && dx < 0)
    setDragX(atEdge ? dx / 3 : dx)
  }
  const onPointerEnd = event => {
    const d = drag.current
    if (!d || d.id !== event.pointerId) return
    drag.current = null
    if (d.horizontal) {
      const width = viewport.current?.offsetWidth || 1
      if (dragX < -width * SWIPE_RATIO) go(index + 1)
      else if (dragX > width * SWIPE_RATIO) go(index - 1)
    }
    setDragging(false)
    setDragX(0)
  }

  return (
    <OnboardingScreen
      screenKey="welcome"
      contentStyle={{ display: 'flex', flexDirection: 'column', padding: '8px 0 0' }}
      footer={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryButton onClick={onSignup}>Créer un compte</PrimaryButton>
          <SecondaryButton onClick={onLogin}>J'ai déjà un compte</SecondaryButton>
        </div>
      )}
    >
      <div className="ob-rise" style={{ textAlign: 'center', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1, background: GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Amiv
        </div>
        <div style={{ fontSize: 15, color: BLACK, fontWeight: 600, marginTop: 6 }}>
          L'essentiel, c'est d'être ensemble
        </div>
      </div>

      <div
        ref={viewport}
        role="region"
        aria-roledescription="carrousel"
        aria-label="Ce que permet Amiv"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', marginTop: 14, touchAction: 'pan-y', userSelect: 'none' }}
      >
        <div
          aria-live={autoplay ? 'off' : 'polite'}
          style={{
            height: '100%',
            display: 'flex',
            transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
            transition: dragging ? 'none' : 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {CARDS.map((card, i) => (
            <div key={card.title} ref={el => { cardRefs.current[i] = el?.firstChild ?? null }} style={{ flex: '0 0 100%', height: '100%', padding: '4px 20px 8px', boxSizing: 'border-box' }}>
              <Card card={card} active={i === index} photoHeight={photoHeight} textRef={el => { textRefs.current[i] = el }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '6px 0 2px', flexShrink: 0 }}>
        {CARDS.map((card, i) => (
          <button
            key={card.title}
            type="button"
            aria-label={`Carte ${i + 1} sur ${CARDS.length} : ${card.title}`}
            aria-current={i === index}
            onClick={() => { setAutoplay(false); go(i) }}
            style={{ height: 8, width: i === index ? 22 : 8, borderRadius: 4, border: 'none', padding: 0, cursor: 'pointer', background: i === index ? GRADIENT : 'rgba(0,0,0,0.12)', transition: 'all 0.3s ease' }}
          />
        ))}
      </div>
    </OnboardingScreen>
  )
}
