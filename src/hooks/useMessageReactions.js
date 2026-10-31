import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const REACTION_COLUMNS = 'id, message_id, user_id, emoji, created_at'

export function sameReaction(a, b) {
  return a.message_id === b.message_id && a.user_id === b.user_id && a.emoji === b.emoji
}

// { [messageId]: { [emoji]: { emoji, count, reactedByMe } } }, dans l'ordre d'arrivée
function aggregateReactions(reactions, currentUserId) {
  return reactions.reduce((acc, reaction) => {
    if (!acc[reaction.message_id]) acc[reaction.message_id] = {}
    if (!acc[reaction.message_id][reaction.emoji]) {
      acc[reaction.message_id][reaction.emoji] = { emoji: reaction.emoji, count: 0, reactedByMe: false }
    }
    acc[reaction.message_id][reaction.emoji].count += 1
    if (reaction.user_id === currentUserId) acc[reaction.message_id][reaction.emoji].reactedByMe = true
    return acc
  }, {})
}

// Réactions emoji des messages affichés : chargement, temps réel, ajout /
// retrait de ma réaction (optimiste). table = message_reactions (messages
// privés) ou event_message_reactions (chat d'événement).
export function useMessageReactions({ table, messages, currentUserId, channelKey }) {
  const [reactions, setReactions] = useState([])
  const messageIdsRef = useRef(new Set())
  const messageIds = useMemo(
    () => messages.filter(msg => !msg.isOptimistic && !msg.system_type).map(msg => msg.id),
    [messages]
  )
  const messageIdsKey = messageIds.join(',')

  useEffect(() => {
    messageIdsRef.current = new Set(messageIds)
    if (!messageIds.length) {
      setReactions([])
      return undefined
    }
    let cancelled = false
    supabase
      .from(table)
      .select(REACTION_COLUMNS)
      .in('message_id', messageIds)
      .then(({ data }) => {
        if (cancelled) return
        setReactions(prev => [
          ...(data ?? []),
          // Réactions envoyées pendant le chargement
          ...prev.filter(r => r.isOptimistic && !(data ?? []).some(d => sameReaction(d, r))),
        ])
      })
    return () => { cancelled = true }
  }, [table, messageIdsKey])

  useEffect(() => {
    if (!channelKey) return undefined
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`${table}:${channelKey}:${suffix}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, ({ new: added }) => {
        if (!added?.message_id || !messageIdsRef.current.has(added.message_id)) return
        setReactions(prev => {
          if (prev.some(r => r.id === added.id)) return prev
          // Ma réaction encore en cours d'envoi : remplacée sur place
          if (prev.some(r => sameReaction(r, added))) return prev.map(r => (sameReaction(r, added) ? added : r))
          return [...prev, added]
        })
      })
      // Sur un DELETE, seul l'id de la réaction arrive
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, ({ old: removed }) => {
        if (removed?.id) setReactions(prev => prev.filter(r => r.id !== removed.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [table, channelKey])

  const reactionsByMessage = useMemo(
    () => aggregateReactions(reactions, currentUserId),
    [reactions, currentUserId]
  )

  function myEmojis(messageId) {
    return new Set(reactions.filter(r => r.message_id === messageId && r.user_id === currentUserId).map(r => r.emoji))
  }

  async function toggleReaction(messageId, emoji) {
    if (!messageId || !currentUserId) return
    const mine = { message_id: messageId, user_id: currentUserId, emoji }
    const existing = reactions.find(reaction => sameReaction(reaction, mine))

    if (existing) {
      setReactions(prev => prev.filter(reaction => !sameReaction(reaction, mine)))
      // Par (message, moi, emoji) : marche aussi si la réaction est encore en cours d'envoi
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji)
      if (error) setReactions(prev => [...prev.filter(reaction => !sameReaction(reaction, mine)), existing])
      return
    }

    const optimistic = { ...mine, id: `optimistic-${crypto.randomUUID()}`, created_at: new Date().toISOString(), isOptimistic: true }
    setReactions(prev => [...prev, optimistic])
    const { data, error } = await supabase
      .from(table)
      .insert(mine)
      .select(REACTION_COLUMNS)
      .single()

    if (error && error.code !== '23505') {
      setReactions(prev => prev.filter(reaction => reaction.id !== optimistic.id))
    } else if (data) {
      setReactions(prev => prev.filter(reaction => reaction.id !== data.id).map(reaction => (reaction.id === optimistic.id ? data : reaction)))
    }
  }

  // Message supprimé : ses réactions partent avec (cascade en base)
  function forgetMessage(messageId) {
    setReactions(prev => prev.filter(r => r.message_id !== messageId))
  }

  function restore(rows) {
    setReactions(prev => [...prev, ...rows.filter(row => !prev.some(r => r.id === row.id))])
  }

  return { reactions, reactionsByMessage, myEmojis, toggleReaction, forgetMessage, restore }
}
