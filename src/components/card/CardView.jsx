import { useEffect, useState } from 'react'
import { Download, Heart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cardStyles, CARD_GRADIENT, displayName, enrichMessagesWithProfiles } from './cardUtils'

function MessageTile({ message, featured }) {
  const name = displayName(message.profile)

  return (
    <article style={{
      minHeight: featured ? 230 : 170,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      background: message.photo_url ? '#1C1C1E' : 'linear-gradient(135deg, rgba(224,85,170,0.12), rgba(245,166,35,0.14))',
      boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
    }}>
      {message.photo_url && (
        <img src={message.photo_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {message.photo_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.72))' }} />}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, color: message.photo_url ? '#fff' : '#1C1C1E' }}>
        <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, textShadow: message.photo_url ? '0 1px 6px rgba(0,0,0,0.35)' : 'none' }}>
          {name}
        </div>
        {message.message && (
          <div style={{ fontSize: featured ? 16 : 13, lineHeight: 1.35, fontWeight: featured ? 700 : 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textShadow: message.photo_url ? '0 1px 6px rgba(0,0,0,0.35)' : 'none' }}>
            {message.message}
          </div>
        )}
      </div>
    </article>
  )
}

export default function CardView({ eventId, currentUserId }) {
  const [eventOwnerId, setEventOwnerId] = useState(null)
  const [card, setCard] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageCount, setMessageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!eventId || !currentUserId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const [eventRes, cardRes] = await Promise.all([
        supabase.from('events').select('user_id').eq('id', eventId).maybeSingle(),
        supabase.from('group_cards').select('*').eq('event_id', eventId).maybeSingle(),
      ])

      if (cancelled) return
      setEventOwnerId(eventRes.data?.user_id || null)
      setCard(cardRes.data || null)

      const isRevealed = cardRes.data?.status === 'revealed'
      if (isRevealed) {
        const { data, error } = await supabase
          .from('group_card_messages')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })

        if (cancelled) return
        if (error) {
          console.error('[CardView] messages error:', error)
          setErrorMessage('Impossible d’afficher la carte.')
        } else {
          const enriched = await enrichMessagesWithProfiles(supabase, data || [])
          if (!cancelled) {
            setMessages(enriched)
            setMessageCount(enriched.length)
          }
        }
      } else {
        const { data, error } = await supabase.rpc('get_card_message_count', { p_event_id: eventId })
        if (cancelled) return
        if (error) {
          console.error('[CardView] count error:', error)
          setErrorMessage('Impossible de charger le nombre de messages.')
        } else {
          setMessageCount(data || 0)
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId, currentUserId])

  function saveMemory() {
    setToast('Sauvegardé !')
    setTimeout(() => setToast(''), 2200)
  }

  if (loading) {
    return (
      <section style={cardStyles.section}>
        <div style={cardStyles.eyebrow}>Carte collective</div>
        <div style={cardStyles.muted}>Chargement…</div>
      </section>
    )
  }

  if (card?.status !== 'revealed' && currentUserId === eventOwnerId) {
    return (
      <section style={{ ...cardStyles.section, textAlign: 'center', padding: '30px 18px', overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: 92, height: 66, borderRadius: 12, background: CARD_GRADIENT, margin: '0 auto 16px', position: 'relative', boxShadow: '0 8px 22px rgba(224,85,170,0.25)' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 38, clipPath: 'polygon(0 0, 50% 70%, 100% 0)', background: 'rgba(255,255,255,0.34)' }} />
          <Heart size={22} color="#fff" fill="rgba(255,255,255,0.35)" style={{ position: 'absolute', left: 35, top: 25 }} />
        </div>
        <div style={{ fontSize: 20, lineHeight: 1.25, fontWeight: 900, color: '#1C1C1E', marginBottom: 8 }}>
          {messageCount} ami{messageCount > 1 ? 's' : ''} t’ont écrit un message
        </div>
        <div style={cardStyles.muted}>Tu pourras le lire le jour J 💌</div>
        {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12, marginTop: 10 }}>{errorMessage}</div>}
      </section>
    )
  }

  if (card?.status !== 'revealed') return null

  return (
    <section style={{ marginBottom: 14, position: 'relative' }}>
      <div style={{ ...cardStyles.section, marginBottom: 10 }}>
        <div style={cardStyles.eyebrow}>Carte collective</div>
        <div style={{ ...cardStyles.title, marginBottom: 4 }}>Les messages de tes amis</div>
        <div style={cardStyles.muted}>{messages.length} souvenir{messages.length > 1 ? 's' : ''} à relire</div>
      </div>

      {messages.length === 0 ? (
        <div style={cardStyles.section}>
          <div style={cardStyles.muted}>Aucun message à afficher.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MessageTile message={messages[0]} featured />
          {messages.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {messages.slice(1).map(message => (
                <MessageTile key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={saveMemory}
        style={{ ...cardStyles.primaryButton, width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <Download size={17} />
        Garder en souvenir
      </button>

      {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12, marginTop: 10 }}>{errorMessage}</div>}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.82)', color: '#fff', borderRadius: 20, padding: '10px 18px', fontSize: 14, fontWeight: 700, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </section>
  )
}
