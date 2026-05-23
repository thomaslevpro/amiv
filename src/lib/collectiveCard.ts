import { supabase } from './supabase'

export type CollectiveCard = {
  id: string
  event_id: string
  revealed: boolean
  revealed_at: string | null
  created_at: string
}

export type Reaction = {
  emoji: string
  count: number
  userReacted: boolean
}

export type Memory = {
  id: string
  card_id: string
  event_id: string
  contributor_id: string
  emoji: string | null
  text: string | null
  image_url: string | null
  bg_color: string
  created_at: string
  reactions: Reaction[]
}

export type Profile = {
  id: string
  first_name: string | null
  avatar_url: string | null
}

export type Progress = {
  contributed: number
  total: number
  contributors: Profile[]
}

type MemoryRow = Omit<Memory, 'reactions'>

function groupReactions(
  rows: Array<{ emoji: string | null; user_id: string | null }> = [],
  userId: string
): Reaction[] {
  const grouped = new Map<string, Reaction>()

  rows.forEach(row => {
    if (!row.emoji) return
    const reaction = grouped.get(row.emoji) || {
      emoji: row.emoji,
      count: 0,
      userReacted: false,
    }
    reaction.count += 1
    reaction.userReacted = reaction.userReacted || row.user_id === userId
    grouped.set(row.emoji, reaction)
  })

  return Array.from(grouped.values())
}

export async function getOrCreateCard(eventId: string): Promise<CollectiveCard> {
  const existing = await supabase
    .from('collective_cards')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data) return existing.data

  const created = await supabase
    .from('collective_cards')
    .insert({ event_id: eventId })
    .select('*')
    .single()

  if (created.error) throw created.error
  return created.data
}

export async function getMyMemories(eventId: string, userId: string): Promise<Memory[]> {
  const memoriesRes = await supabase
    .from('collective_memories')
    .select('*')
    .eq('event_id', eventId)
    .eq('contributor_id', userId)
    .order('created_at', { ascending: false })

  if (memoriesRes.error) throw memoriesRes.error

  const memories = (memoriesRes.data || []) as MemoryRow[]
  if (memories.length === 0) return []

  const enriched = await Promise.all(
    memories.map(async memory => {
      const reactionsRes = await supabase
        .from('memory_reactions')
        .select('emoji, user_id')
        .eq('memory_id', memory.id)

      if (reactionsRes.error) throw reactionsRes.error

      return {
        ...memory,
        reactions: groupReactions(reactionsRes.data || [], userId),
      }
    })
  )

  return enriched
}

export async function getProgress(eventId: string): Promise<Progress> {
  const [memoriesRes, rsvpsRes] = await Promise.all([
    supabase
      .from('collective_memories')
      .select('contributor_id')
      .eq('event_id', eventId),
    supabase
      .from('rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId),
  ])

  if (memoriesRes.error) throw memoriesRes.error
  if (rsvpsRes.error) throw rsvpsRes.error

  const contributorIds = [
    ...new Set((memoriesRes.data || []).map(row => row.contributor_id).filter(Boolean)),
  ]

  let contributors: Profile[] = []
  if (contributorIds.length > 0) {
    const profilesRes = await supabase
      .from('profiles')
      .select('id, first_name, avatar_url')
      .in('id', contributorIds.slice(0, 5))

    if (profilesRes.error) throw profilesRes.error
    contributors = (profilesRes.data || []) as Profile[]
  }

  return {
    contributed: contributorIds.length,
    total: rsvpsRes.count || 0,
    contributors,
  }
}

export async function addMemory(params: {
  cardId: string
  eventId: string
  contributorId: string
  text?: string
  imageUrl?: string
  bgColor: string
}): Promise<Memory> {
  const { cardId, eventId, contributorId, text, imageUrl, bgColor } = params
  const result = await supabase
    .from('collective_memories')
    .insert({
      card_id: cardId,
      event_id: eventId,
      contributor_id: contributorId,
      text: text?.trim() || null,
      image_url: imageUrl || null,
      bg_color: bgColor,
    })
    .select('*')
    .single()

  if (result.error) throw result.error
  return { ...(result.data as MemoryRow), reactions: [] }
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const result = await supabase
    .from('collective_memories')
    .delete()
    .eq('id', memoryId)

  if (result.error) throw result.error
}

export async function toggleReaction(memoryId: string, userId: string, emoji: string): Promise<void> {
  const existing = await supabase
    .from('memory_reactions')
    .select('id')
    .eq('memory_id', memoryId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing.error) throw existing.error

  if (existing.data) {
    const deleted = await supabase
      .from('memory_reactions')
      .delete()
      .eq('id', existing.data.id)

    if (deleted.error) throw deleted.error
    return
  }

  const inserted = await supabase
    .from('memory_reactions')
    .insert({ memory_id: memoryId, user_id: userId, emoji })

  if (inserted.error) throw inserted.error
}
