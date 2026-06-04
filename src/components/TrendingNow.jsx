import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} title
 * @property {string} createType
 * @property {string} eventType
 * @property {string} image
 * @property {string} coverImage
 */

/**
 * @typedef {Object} TrendingNowProps
 * @property {(data: { title: string, type: string, eventType: string, emoji: string, coverImage: string }) => void} [onCardClick]
 */

/** @type {Card[]} */
const cards = [
  {
    id: 'brunch',
    title: "It's Brunch o'Clock",
    createType: 'Repas',
    eventType: 'brunch',
    image: '/trending/brunch.png',
    coverImage: '/trending/brunch.png',
  },
  {
    id: 'apero',
    title: 'Apéro surprise',
    createType: 'Soirée',
    eventType: 'apero',
    image: '/trending/Apero.png',
    coverImage: '/trending/Apero.png',
  },
  {
    id: 'cremaillere',
    title: 'Crémai\nllère',
    createType: 'Soirée',
    eventType: 'cremaillere',
    image: '/trending/cremaillere.png',
    coverImage: '/trending/cremaillere.png',
  },
  {
    id: 'jeux',
    title: 'JEUX',
    createType: 'Soirée',
    eventType: 'games',
    image: '/trending/Jeux.png',
    coverImage: '/trending/Jeux.png',
  },
  {
    id: 'netflix',
    title: 'Soirée\nNetflix',
    createType: 'Soirée',
    eventType: 'netflix',
    image: '/trending/netflix.png',
    coverImage: '/trending/netflix.png',
  },
  {
    id: 'dinner',
    title: 'Dîner',
    createType: 'Repas',
    eventType: 'dinner',
    image: '/trending/Diner.png',
    coverImage: '/trending/Diner.png',
  },
  {
    id: 'soleil',
    title: 'Bain de\nsoleil',
    createType: 'Autre',
    eventType: 'soleil',
    image: '/trending/soleil.png',
    coverImage: '/trending/soleil.png',
  },
  {
    id: 'expo',
    title: 'Expo\ntime',
    createType: 'Autre',
    eventType: 'expo',
    image: '/trending/expo.png',
    coverImage: '/trending/expo.png',
  },
  {
    id: 'musee',
    title: 'Musée',
    createType: 'Autre',
    eventType: 'musee',
    image: '/trending/musee.jpg',
    coverImage: '/trending/musee.jpg',
  },
  {
    id: 'dancing',
    title: 'Dancing\nQueen',
    createType: 'Soirée',
    eventType: 'dancing',
    image: '/trending/dancing.png',
    coverImage: '/trending/dancing.png',
  },
]

const CARD_WIDTH = 200
const CARD_GAP = 16
const CARD_STEP = CARD_WIDTH + CARD_GAP

/** @param {TrendingNowProps} props */
export default function TrendingNow({ onCardClick }) {
  const scrollRef = useRef(null)
  const isResettingRef = useRef(false)
  const [availableImages, setAvailableImages] = useState(null)
  const [scrollLeft, setScrollLeft] = useState(0)

  const imageCards = cards.filter(card => card.image)
  const visibleCards = availableImages
    ? imageCards.filter(card => availableImages.has(card.image))
    : []
  const CARDS = [...visibleCards, ...visibleCards, ...visibleCards].filter(card => card.image)
  const loopOffset = visibleCards.length * CARD_STEP

  useEffect(() => {
    let cancelled = false

    Promise.all(
      imageCards.map(
        card =>
          new Promise(resolve => {
            const img = new Image()
            img.onload = () => resolve(card.image)
            img.onerror = () => resolve(null)
            img.src = card.image
          })
      )
    ).then(results => {
      if (!cancelled) setAvailableImages(new Set(results.filter(Boolean)))
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !loopOffset) return
    el.scrollLeft = loopOffset
    setScrollLeft(loopOffset)
  }, [loopOffset])

  function resetScrollPosition(el, nextScrollLeft) {
    if (isResettingRef.current) return
    isResettingRef.current = true
    const previousBehavior = el.style.scrollBehavior
    el.style.scrollBehavior = 'auto'
    el.scrollLeft = nextScrollLeft
    setScrollLeft(nextScrollLeft)
    requestAnimationFrame(() => {
      el.style.scrollBehavior = previousBehavior || 'smooth'
      isResettingRef.current = false
    })
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el || isResettingRef.current || !loopOffset) return

    setScrollLeft(el.scrollLeft)

    if (el.scrollLeft < loopOffset) {
      resetScrollPosition(el, el.scrollLeft + loopOffset)
    } else if (el.scrollLeft >= loopOffset * 2) {
      resetScrollPosition(el, el.scrollLeft - loopOffset)
    }
  }

  function handleCardClick(card) {
    onCardClick?.({
      title: card.title.replace(/\n/g, ' '),
      type: card.createType,
      eventType: card.eventType,
      emoji: '🎉',
      coverImage: card.coverImage,
    })
  }

  const containerCenter = scrollRef.current ? scrollRef.current.offsetWidth / 2 : 0

  return (
    <section style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 12,
          padding: '0 2px',
        }}
      >
        <ArrowUpRight size={15} color="#e055aa" strokeWidth={2.7} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--gray1)',
          }}
        >
          TRENDING NOW
        </span>
      </div>

      <style>{`[data-trending-now]::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={scrollRef}
        data-trending-now
        onScroll={handleScroll}
        style={{
          display: 'flex',
          gap: CARD_GAP,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: `4px calc(50% - ${CARD_WIDTH / 2}px) 8px`,
          margin: 0,
          perspective: '800px',
          scrollBehavior: 'smooth',
          transformStyle: 'preserve-3d',
        }}
      >
        {CARDS.map((card, index) => {
          const cardCenter = index * CARD_STEP + CARD_WIDTH / 2
          const distanceFromCenter = cardCenter - scrollLeft - containerCenter
          const absDistance = Math.abs(distanceFromCenter)
          const maxDist = CARD_STEP
          const scale = Math.max(0.75, 1 - (absDistance / maxDist) * 0.25)
          const rotateY = Math.max(-45, Math.min(45, (distanceFromCenter / maxDist) * 45))
          const translateX = distanceFromCenter > 0 ? -absDistance * 0.08 : absDistance * 0.08
          const opacity = Math.max(0.5, 1 - (absDistance / maxDist) * 0.5)
          const zIndex = Math.round(100 - absDistance)

          return (
            <button
              type="button"
              key={`${card.id}-${index}`}
              onClick={() => handleCardClick(card)}
              style={{
                position: 'relative',
                width: CARD_WIDTH,
                height: CARD_WIDTH,
                flexShrink: 0,
                border: 'none',
                borderRadius: 20,
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                backgroundImage: `url(${card.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity,
                transform: `perspective(800px) rotateY(${rotateY}deg) scale(${scale}) translateX(${translateX}px)`,
                transformStyle: 'preserve-3d',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
                zIndex,
              }}
            />
          )
        })}
      </div>
    </section>
  )
}
