import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const MAX_LENGTH = 280
const GRADIENT = 'linear-gradient(135deg, #e055aa, #f5a623)'

function getDisplayName(message, currentUser) {
  const profile = message.profiles ?? {}
  return profile.full_name || profile.name || profile.email || currentUser?.email || 'Invité'
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase()
}

function formatRevealDate(date) {
  if (!date) return 'jour J'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'jour J'
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function relativeDate(value) {
  const then = new Date(value)
  const diffMs = then.getTime() - Date.now()
  const abs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day

  if (abs < minute) return 'à l’instant'
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (abs < month) return rtf.format(Math.round(diffMs / day), 'day')
  return then.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function MessageBubble({ message, currentUser, onDelete, onEdit }) {
  const isMine = message.user_id === currentUser?.id
  const name = getDisplayName(message, currentUser)

  return (
    <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 8 }}>
      {!isMine && (
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: '#FBBF9A',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          flexShrink: 0,
        }}>
          {getInitials(name)}
        </div>
      )}
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
        <div style={{
          background: isMine ? 'rgba(224,85,170,0.08)' : '#fff',
          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          padding: '10px 12px',
          boxShadow: isMine ? 'none' : '0 1px 6px rgba(0,0,0,0.06)',
          border: isMine ? '1px solid rgba(224,85,170,0.14)' : '1px solid rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>
            {isMine ? 'Moi' : name}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.45, color: '#1C1C1E', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.message}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '0 4px' }}>
          <span style={{ fontSize: 11, color: '#8E8E93' }}>{relativeDate(message.created_at)}</span>
          {isMine && (
            <>
              <button
                type="button"
                onClick={() => onEdit(message)}
                aria-label="Modifier mon message"
                title="Modifier"
                style={{ border: 'none', background: 'transparent', color: '#8E8E93', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <Pencil size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                aria-label="Supprimer mon message"
                title="Supprimer"
                style={{ border: 'none', background: 'transparent', color: '#FF3B30', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GroupCard({ eventId, eventDate, isOrganizer }) {
  const [messages, setMessages] = useState([])
  const [myMessage, setMyMessage] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [messageCount, setMessageCount] = useState(0)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const isBeforeEvent = useMemo(() => {
    if (!eventDate) return true
    const eventTime = new Date(eventDate).getTime()
    if (Number.isNaN(eventTime)) return true
    return Date.now() < eventTime
  }, [eventDate])

  const isBlocked = isOrganizer && isBeforeEvent

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setCurrentUser(user ?? null)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!eventId || !currentUser) return
    if (isBlocked) {
      fetchCount()
      return
    }
    fetchMessages()
  }, [eventId, currentUser?.id, isBlocked])

  async function fetchCount() {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase.rpc('get_card_message_count', { p_event_id: eventId })
    if (error) {
      console.error('[GroupCard] count error:', error)
      setErrorMessage('Impossible de charger le nombre de messages.')
    } else {
      setMessageCount(data ?? 0)
    }
    setLoading(false)
  }

  async function fetchMessages() {
    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('group_card_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[GroupCard] messages error:', error)
      setErrorMessage('Impossible de charger la carte collective.')
      setLoading(false)
      return
    }

    const rows = data ?? []
    const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))]
    let profilesById = {}

    if (userIds.length > 0) {
      let profilesRes = await supabase
        .from('profiles')
        .select('id, full_name, name, email')
        .in('id', userIds)

      if (profilesRes.error) {
        profilesRes = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds)
      }

      if (!profilesRes.error) {
        profilesById = Object.fromEntries((profilesRes.data ?? []).map(profile => [profile.id, profile]))
      }
    }

    const enrichedRows = rows.map(row => ({
      ...row,
      profiles: profilesById[row.user_id] ?? null,
    }))

    setMessages(enrichedRows)
    setMessageCount(enrichedRows.length)
    setMyMessage(enrichedRows.find(row => row.user_id === currentUser.id) ?? null)
    setLoading(false)
  }

  async function handleSubmit() {
    const message = inputValue.trim()
    if (!message || !currentUser || submitting) return

    setSubmitting(true)

    if (editingMessageId) {
      const { error: deleteError } = await supabase
        .from('group_card_messages')
        .delete()
        .eq('id', editingMessageId)

      if (deleteError) {
        console.error('[GroupCard] delete before edit error:', deleteError)
        setErrorMessage('Impossible de modifier ce message pour le moment.')
        setSubmitting(false)
        return
      }
    }

    const { error } = await supabase.from('group_card_messages').insert({
      event_id: eventId,
      user_id: currentUser.id,
      message,
    })

    if (!error) {
      setInputValue('')
      setEditingMessageId(null)
      await fetchMessages()
    } else {
      console.error('[GroupCard] insert error:', error)
      setErrorMessage(error.message || 'Impossible d’envoyer ce message.')
    }
    setSubmitting(false)
  }

  async function handleDelete(id) {
    if (!id || submitting) return
    setSubmitting(true)
    const { error } = await supabase
      .from('group_card_messages')
      .delete()
      .eq('id', id)
    if (!error) {
      setInputValue('')
      setEditingMessageId(null)
      await fetchMessages()
    } else {
      console.error('[GroupCard] delete error:', error)
      setErrorMessage('Impossible de supprimer ce message.')
    }
    setSubmitting(false)
  }

  function handleEdit(message) {
    setInputValue(message.message)
    setEditingMessageId(message.id)
  }

  if (isBlocked) {
    const progressWidth = Math.min(100, Math.max(12, messageCount * 12))

    return (
      <div style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 28 }}>
        <div style={{
          width: '100%',
          background: '#fff',
          borderRadius: 24,
          padding: '34px 22px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 46, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 20, lineHeight: 1.25, fontWeight: 800, color: '#1C1C1E', marginBottom: 8 }}>
            La carte sera révélée le {formatRevealDate(eventDate)}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: '#8E8E93', marginBottom: 24 }}>
            Vos invités vous écrivent des messages en secret
          </div>
          <div style={{ height: 8, borderRadius: 999, background: '#F5F5F5', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${loading ? 0 : progressWidth}%`, height: '100%', background: GRADIENT, borderRadius: 999, transition: 'width 0.25s' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#993556' }}>
            {loading ? 'Chargement…' : `${messageCount} message${messageCount > 1 ? 's' : ''} déjà écrit${messageCount > 1 ? 's' : ''}`}
          </div>
          {errorMessage && (
            <div style={{ fontSize: 12, color: '#FF3B30', marginTop: 10, lineHeight: 1.35 }}>
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    )
  }

  const canWrite = !myMessage || editingMessageId
  const isSubmitDisabled = !inputValue.trim() || submitting

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}>
      <div style={{
        background: '#fff',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E', marginBottom: 6 }}>
          Carte collective
        </div>
        <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.35, marginBottom: 12 }}>
          Elle sera révélée le {formatRevealDate(eventDate)}.
        </div>
        <div style={{ height: 6, borderRadius: 999, background: '#F5F5F5', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${Math.min(100, Math.max(10, messageCount * 12))}%`, height: '100%', background: GRADIENT, borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#993556' }}>
          {messageCount} message{messageCount > 1 ? 's' : ''} déjà écrit{messageCount > 1 ? 's' : ''}
        </div>
      </div>

      {errorMessage && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 12, color: '#FF3B30', fontSize: 13, lineHeight: 1.35 }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', fontSize: 14, padding: '36px 0' }}>Chargement…</div>
        ) : messages.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 18, padding: 20, textAlign: 'center', color: '#8E8E93', fontSize: 14, lineHeight: 1.4 }}>
            Aucun message pour l’instant.
          </div>
        ) : (
          messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUser={currentUser}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>

      {canWrite ? (
        <div style={{
          background: '#fff',
          borderRadius: 18,
          padding: 14,
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <textarea
            value={inputValue}
            maxLength={MAX_LENGTH}
            onChange={event => setInputValue(event.target.value)}
            placeholder="Écris un mot pour la carte collective…"
            style={{
              width: '100%',
              minHeight: 104,
              resize: 'vertical',
              border: '1px solid #E5E5EA',
              borderRadius: 14,
              padding: 12,
              outline: 'none',
              fontSize: 15,
              lineHeight: 1.4,
              color: '#1C1C1E',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 12, color: inputValue.length >= MAX_LENGTH ? '#FF3B30' : '#8E8E93' }}>
              {inputValue.length}/{MAX_LENGTH}
            </span>
            <button
              type="button"
              disabled={isSubmitDisabled}
              onClick={handleSubmit}
              style={{
                border: 'none',
                borderRadius: 14,
                padding: '11px 16px',
                background: isSubmitDisabled ? '#D1D1D6' : GRADIENT,
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                cursor: isSubmitDisabled ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {editingMessageId ? 'Enregistrer' : 'Envoyer mon message 💌'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => handleEdit(myMessage)}
            style={{
              border: 'none',
              borderRadius: 14,
              padding: '10px 14px',
              background: 'rgba(224,85,170,0.10)',
              color: '#993556',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Modifier mon message
          </button>
        </div>
      )}
    </div>
  )
}
