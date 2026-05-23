import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cardStyles, displayName, enrichMessagesWithProfiles, formatRevealDate, initials } from './cardUtils'

export default function CardManage({ eventId, currentUserId }) {
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [card, setCard] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const photoCount = useMemo(() => messages.filter(message => !!message.photo_url).length, [messages])

  useEffect(() => {
    if (!eventId || !currentUserId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select('user_id')
        .eq('id', eventId)
        .maybeSingle()

      if (cancelled) return
      if (eventError || eventRow?.user_id !== currentUserId) {
        setIsOrganizer(false)
        setLoading(false)
        return
      }

      setIsOrganizer(true)
      const [cardRes, messagesRes] = await Promise.all([
        supabase.from('group_cards').select('*').eq('event_id', eventId).maybeSingle(),
        supabase.from('group_card_messages').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
      ])

      if (cancelled) return
      if (cardRes.error) {
        console.error('[CardManage] card error:', cardRes.error)
        setErrorMessage('Impossible de charger la carte.')
      } else {
        setCard(cardRes.data || null)
      }

      if (messagesRes.error) {
        console.error('[CardManage] messages error:', messagesRes.error)
        setErrorMessage('Impossible de charger les contributions.')
      } else {
        setMessages(await enrichMessagesWithProfiles(supabase, messagesRes.data || []))
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId, currentUserId])

  if (!isOrganizer && !loading) return null

  return (
    <section style={cardStyles.section}>
      <div style={cardStyles.eyebrow}>Gestion de la carte</div>
      {loading ? (
        <div style={cardStyles.muted}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={cardStyles.title}>Carte collective</div>
              <div style={{ ...cardStyles.muted, marginTop: 3 }}>
                {messages.length} message{messages.length > 1 ? 's' : ''} · {photoCount} photo{photoCount > 1 ? 's' : ''}
              </div>
            </div>
            {card?.status === 'revealed' && (
              <div style={{ borderRadius: 20, padding: '6px 10px', background: 'rgba(52,199,89,0.10)', color: '#34C759', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                Carte révélée
              </div>
            )}
          </div>

          {card?.status === 'revealed' && card.revealed_at && (
            <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 12 }}>
              Révélée le {formatRevealDate(card.revealed_at)}
            </div>
          )}

          {messages.length === 0 ? (
            <div style={{ background: '#F2F2F7', borderRadius: 14, padding: 16, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>
              Aucune contribution pour l’instant.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map(message => {
                const name = displayName(message.profile)
                return (
                  <div key={message.id} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 14, background: '#F2F2F7' }}>
                    {message.photo_url ? (
                      <img src={message.photo_url} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 54, height: 54, borderRadius: 12, background: 'rgba(224,85,170,0.10)', color: '#993556', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, background: '#FBBF9A', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {initials(name)}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1C1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {name}
                        </div>
                      </div>
                      {message.message && (
                        <div style={{ fontSize: 13, lineHeight: 1.35, color: '#1C1C1E', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {message.message}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {errorMessage && <div style={{ color: '#FF3B30', fontSize: 12, marginTop: 10 }}>{errorMessage}</div>}
        </>
      )}
    </section>
  )
}
