import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isOrganizer } from '../lib/organizers'
import CoOrganizers from '../components/CoOrganizers'
import InviteFriendsSheet from '../components/InviteFriendsSheet'

const GRAD = 'linear-gradient(135deg, #e055aa, #f5a623)'
const PENDING_STATUSES = ['pending', 'invited']
const WAITING_STATUSES = ['pending', 'invited', 'reminded']
const AVATAR_COLORS = ['#FBBF9A', '#B5CAF0', '#C5E8C5', '#F9DDB3', '#E2C9F0', '#F0C5C5']

const TASK_CATEGORIES = [
  { key: 'food', label: 'Nourriture', emoji: '🍕' },
  { key: 'decoration', label: 'Décoration', emoji: '🎈' },
  { key: 'logistics', label: 'Logistique', emoji: '🚗' },
  { key: 'other', label: 'Autre', emoji: '✨' },
]

const EXPENSE_CATEGORIES = [
  { key: 'food', label: 'Nourriture', emoji: '🍕' },
  { key: 'decoration', label: 'Décoration', emoji: '🎈' },
  { key: 'drinks', label: 'Boissons', emoji: '🥂' },
  { key: 'venue', label: 'Lieu', emoji: '📍' },
  { key: 'other', label: 'Autre', emoji: '✨' },
]

const SUGGESTIONS = {
  birthday: [
    { label: 'Réserver le lieu', category: 'logistics' },
    { label: 'Commander le gâteau', category: 'food' },
    { label: 'Créer les invitations', category: 'logistics' },
    { label: 'Prévoir la playlist', category: 'other' },
    { label: 'Acheter les décorations', category: 'decoration' },
  ],
}

const sheetInput = {
  width: '100%',
  background: '#F2F2F7',
  borderRadius: 12,
  padding: '13px 14px',
  fontSize: 14,
  color: '#1C1C1E',
  border: 'none',
}

function parseAmount(value) {
  const amount = Number.parseFloat(String(value || '').replace(',', '.'))
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

function formatMoney(value, withDecimals = false) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: withDecimals ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(Number(value || 0))
}

function eventDateParts(value) {
  if (!value) return { date: '', time: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: '', time: '' }
  return {
    date: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function shortDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function daysUntil(value) {
  if (!value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date - today) / 86400000)
}

function daysAgo(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - date) / 86400000))
}

function relativeSince(value, fallback = 'Invité récemment') {
  const days = daysAgo(value)
  if (days === null) return fallback
  if (days === 0) return fallback
  if (days === 1) return 'Invité hier'
  return `Invité il y a ${days} jours`
}

function profileName(profile, email = '') {
  const full = [profile?.first_name, profile?.name].filter(Boolean).join(' ').trim()
  return full || profile?.name || email?.split('@')[0] || 'Invité'
}

function firstName(profile, email = '') {
  return profile?.first_name || profile?.name?.split(' ')?.[0] || email?.split('@')[0] || 'Ami'
}

function initialFor(profile, email = '') {
  return firstName(profile, email).trim().charAt(0).toUpperCase() || 'A'
}

function hashColor(value = '') {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash + value.charCodeAt(i) * (i + 1)) % 997
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function taskCategory(key) {
  return TASK_CATEGORIES.find(category => category.key === key) || TASK_CATEGORIES[3]
}

function expenseCategory(key) {
  return EXPENSE_CATEGORIES.find(category => category.key === key) || EXPENSE_CATEGORIES[4]
}

function groupByCategory(rows, categories, field) {
  return categories
    .map(category => ({
      ...category,
      rows: rows.filter(row => (row.category || 'other') === category.key),
      subtotal: rows
        .filter(row => (row.category || 'other') === category.key)
        .reduce((sum, row) => sum + Number(row[field] || 0), 0),
    }))
    .filter(group => group.rows.length > 0)
}

function invitationStatus(invitation) {
  if (invitation.status === 'accepted') return { label: '✓ Oui', color: '#34C759' }
  if (invitation.status === 'declined') return { label: '✕ Non', color: '#FF3B30' }
  if (invitation.status === 'reminded') return { label: '↩ Relancé', color: '#FF9500' }
  return { label: '— En attente', color: '#AEAEB2' }
}

function statusChip(item) {
  if (item.done) return { label: 'Fait', cls: 'chip-green' }
  const days = daysUntil(item.due_date)
  if (days !== null && days < 0) return { label: 'Urgent', cls: 'chip-orange' }
  if (days !== null && days < 7) return { label: `J-${days}`, cls: 'chip-pink' }
  return { label: 'À faire', cls: 'chip-gray' }
}

function Avatar({ profile, email, size = 38, fontSize = 14, salmon = false }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="org-avatar-img" style={{ width: size, height: size }} />
  }
  const display = profileName(profile, email)
  return (
    <span
      className="org-avatar-fallback"
      style={{
        width: size,
        height: size,
        background: salmon ? '#FBBF9A' : hashColor(display || email),
        fontSize,
      }}
    >
      {initialFor(profile, email)}
    </span>
  )
}

function Toast({ toast }) {
  if (!toast?.message) return null
  return <div className={`org-toast ${toast.type === 'error' ? 'error' : ''}`}>{toast.message}</div>
}

function Skeleton() {
  return (
    <div className="organizer-page">
      <div className="organizer-shell">
        <div className="org-skeleton-head">
          <span className="org-skeleton circle" />
          <span className="org-skeleton line strong" />
        </div>
        <span className="org-skeleton hero" />
        <div className="org-skeleton-tabs">
          <span className="org-skeleton pill" />
          <span className="org-skeleton pill" />
          <span className="org-skeleton pill" />
        </div>
        {[0, 1, 2].map(item => <span key={item} className="org-skeleton row" />)}
      </div>
    </div>
  )
}

function Sheet({ children, onClose }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  function close() {
    setShown(false)
    setTimeout(onClose, 280)
  }

  return (
    <div className={`org-backdrop ${shown ? 'shown' : ''}`} onClick={close}>
      <div className={`org-sheet ${shown ? 'shown' : ''}`} onClick={event => event.stopPropagation()}>
        <div className="org-handle" />
        {children(close)}
      </div>
    </div>
  )
}

function AddTaskSheet({ guests, onClose, onSave }) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('other')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(close) {
    if (!label.trim() || saving) return
    setSaving(true)
    const ok = await onSave({
      label: label.trim(),
      category,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
    })
    setSaving(false)
    if (ok) close()
  }

  return (
    <Sheet onClose={onClose}>
      {close => (
        <>
          <div className="org-sheet-title-row">
            <h2>Ajouter une tâche</h2>
            <button type="button" aria-label="Fermer" onClick={close}><X size={17} /></button>
          </div>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)} placeholder="Nom de la tâche" style={sheetInput} />
          <CategoryGrid categories={TASK_CATEGORIES} selected={category} onSelect={setCategory} />
          <label className="org-field-label">Assigner à</label>
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={sheetInput}>
            <option value="">Personne</option>
            {guests.map(guest => <option key={guest.id} value={guest.id}>{profileName(guest)}</option>)}
          </select>
          <label className="org-field-label">Date limite</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={sheetInput} />
          <button type="button" className="org-primary-sheet-btn" disabled={!label.trim() || saving} onClick={() => submit(close)}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </>
      )}
    </Sheet>
  )
}

function AddExpenseSheet({ onClose, onSave }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [saving, setSaving] = useState(false)
  const canSave = label.trim() && parseAmount(amount) > 0

  async function submit(close) {
    if (!canSave || saving) return
    setSaving(true)
    const ok = await onSave({ label: label.trim(), amount: parseAmount(amount), category })
    setSaving(false)
    if (ok) close()
  }

  return (
    <Sheet onClose={onClose}>
      {close => (
        <>
          <div className="org-sheet-title-row">
            <h2>Ajouter une dépense</h2>
            <button type="button" aria-label="Fermer" onClick={close}><X size={17} /></button>
          </div>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)} placeholder="Nom de la dépense" style={sheetInput} />
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Montant" type="number" min="0" step="0.01" inputMode="decimal" style={sheetInput} />
          <CategoryGrid categories={EXPENSE_CATEGORIES} selected={category} onSelect={setCategory} />
          <button type="button" className="org-primary-sheet-btn" disabled={!canSave || saving} onClick={() => submit(close)}>
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </>
      )}
    </Sheet>
  )
}

function CategoryGrid({ categories, selected, onSelect }) {
  return (
    <div className="org-category-grid">
      {categories.map(category => (
        <button
          key={category.key}
          type="button"
          className={selected === category.key ? 'selected' : ''}
          onClick={() => onSelect(category.key)}
        >
          <span>{category.emoji}</span>
          <small>{category.label}</small>
        </button>
      ))}
    </div>
  )
}

function ReminderSheet({ event, invitations, onClose, onSend }) {
  const [selected, setSelected] = useState(() => new Set(invitations.map(invitation => invitation.id)))
  const [message, setMessage] = useState(() => {
    const date = eventDateParts(event?.date).date || 'bientôt'
    return `Salut ! Tu n'as pas encore répondu à l'invitation pour ${event?.name || "l'événement"} le ${date}. On compte sur toi ! 🎉`
  })
  const [sending, setSending] = useState(false)

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(close) {
    if (!selected.size || !message.trim() || sending) return
    setSending(true)
    const ok = await onSend(invitations.filter(invitation => selected.has(invitation.id)), message.trim())
    setSending(false)
    if (ok) close()
  }

  return (
    <Sheet onClose={onClose}>
      {close => (
        <>
          <h2 className="org-reminder-title">Relancer les invités</h2>
          <p className="org-reminder-subtitle">{invitations.length} invités sans réponse</p>
          <div className="org-reminder-list">
            {invitations.map(invitation => {
              const checked = selected.has(invitation.id)
              return (
                <button key={invitation.id} type="button" onClick={() => toggle(invitation.id)} className="org-reminder-row">
                  <Avatar profile={invitation.profile} email={invitation.invited_email} size={34} fontSize={13} />
                  <span>
                    <strong>{profileName(invitation.profile, invitation.invited_email)}</strong>
                    <small>{invitation.invited_email || invitation.profile?.email || 'Email non renseigné'}</small>
                  </span>
                  <i className={checked ? 'checked' : ''}>{checked ? '✓' : ''}</i>
                </button>
              )
            })}
          </div>
          <div className="org-sheet-separator" />
          <label className="org-field-label">Message de relance</label>
          <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} style={{ ...sheetInput, resize: 'none', lineHeight: 1.35 }} />
          <button type="button" className="org-primary-sheet-btn" disabled={!selected.size || !message.trim() || sending} onClick={() => submit(close)}>
            {sending ? 'Envoi...' : `Envoyer la relance (${selected.size} personnes)`}
          </button>
        </>
      )}
    </Sheet>
  )
}

function ChecklistItem({ item, index, onToggle, onDelete }) {
  const [offset, setOffset] = useState(0)
  const start = useRef(null)
  const chip = statusChip(item)

  function pointerDown(event) {
    start.current = { x: event.clientX, offset }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function pointerMove(event) {
    if (!start.current) return
    const dx = event.clientX - start.current.x
    setOffset(Math.min(0, Math.max(-44, start.current.offset + dx)))
  }

  function pointerUp() {
    setOffset(current => (current < -22 ? -44 : 0))
    start.current = null
  }

  return (
    <div className="org-task-swipe" style={{ animationDelay: `${index * 40}ms` }}>
      <button type="button" className="org-delete-reveal" onClick={() => onDelete(item)}>Supprimer</button>
      <div
        className="org-task-card fade-up"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <button type="button" className={`org-check ${item.done ? 'done' : ''}`} onClick={() => onToggle(item)}>
          {item.done ? '✓' : ''}
        </button>
        <button type="button" className="org-task-main" onClick={() => onToggle(item)}>
          <span className={item.done ? 'done' : ''}>{item.label}</span>
        </button>
        <div className="org-task-side">
          <em className={`org-chip ${chip.cls}`}>{chip.label}</em>
          {item.assignee && <Avatar profile={item.assignee} size={20} fontSize={9} salmon />}
          {item.due_date && <small>{shortDate(item.due_date)}</small>}
        </div>
      </div>
    </div>
  )
}

export default function OrganizerSpacePage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('checklist')
  const [event, setEvent] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [items, setItems] = useState([])
  const [expenses, setExpenses] = useState([])
  const [invitations, setInvitations] = useState([])
  const [acceptedGuests, setAcceptedGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTaskSheet, setShowTaskSheet] = useState(false)
  const [showExpenseSheet, setShowExpenseSheet] = useState(false)
  const [showReminderSheet, setShowReminderSheet] = useState(false)
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [toast, setToast] = useState(null)

  const loadOrganizerData = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      navigate('/')
      return
    }
    setCurrentUserId(user.id)

    const eventQuery = supabase
      .from('events')
      .select('id, name, emoji, user_id, date, location, type, budget_total')
      .eq('id', eventId)
      .maybeSingle()
    const itemsQuery = supabase
      .from('checklist_items')
      .select('id, event_id, label, done, position, assigned_to, due_date, category, created_by')
      .eq('event_id', eventId)
      .order('position', { ascending: true })
    const expensesQuery = supabase
      .from('event_expenses')
      .select('id, event_id, label, amount, category, created_by, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    const invitationsQuery = supabase
      .from('invitations')
      .select('id, event_id, invited_email, invited_user_id, status, invited_by, created_at, updated_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    const [eventRes, itemsRes, expensesRes, invitationsRes, userCanManage] = await Promise.all([
      eventQuery,
      itemsQuery,
      expensesQuery,
      invitationsQuery,
      isOrganizer(eventId),
    ])
    if (eventRes.error || !eventRes.data || !userCanManage) {
      navigate('/')
      return
    }
    setIsOwner(eventRes.data.user_id === user.id)

    const inviteRows = invitationsRes.data || []
    const taskRows = itemsRes.data || []
    const profileIds = [
      ...taskRows.map(item => item.assigned_to),
      ...inviteRows.map(invitation => invitation.invited_user_id),
    ].filter(Boolean)
    const emails = inviteRows.map(invitation => invitation.invited_email).filter(Boolean)
    const [profilesByIdRes, profilesByEmailRes] = await Promise.all([
      profileIds.length ? supabase.from('profiles').select('id, first_name, name, email, avatar_url').in('id', [...new Set(profileIds)]) : Promise.resolve({ data: [] }),
      emails.length ? supabase.from('profiles').select('id, first_name, name, email, avatar_url').in('email', [...new Set(emails)]) : Promise.resolve({ data: [] }),
    ])

    const profiles = [...(profilesByIdRes.data || []), ...(profilesByEmailRes.data || [])]
    const byId = Object.fromEntries(profiles.map(profile => [profile.id, profile]))
    const byEmail = Object.fromEntries(profiles.filter(profile => profile.email).map(profile => [profile.email, profile]))

    setEvent({ ...eventRes.data, budget_total: Number(eventRes.data.budget_total || 0) })
    setBudgetDraft(eventRes.data.budget_total ? String(eventRes.data.budget_total) : '')
    setItems(taskRows.map(item => ({
      ...item,
      category: item.category || 'other',
      assignee: byId[item.assigned_to] || null,
    })))
    setExpenses((expensesRes.data || []).map(expense => ({ ...expense, category: expense.category || 'other' })))
    setInvitations(inviteRows.map(invitation => ({
      ...invitation,
      profile: byId[invitation.invited_user_id] || byEmail[invitation.invited_email] || null,
    })))
    setAcceptedGuests(inviteRows
      .filter(invitation => invitation.status === 'accepted')
      .map(invitation => byId[invitation.invited_user_id] || byEmail[invitation.invited_email])
      .filter(Boolean))
    setLoading(false)
  }, [eventId, navigate])

  useEffect(() => {
    loadOrganizerData()
  }, [loadOrganizerData])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3000)
  }

  const doneCount = items.filter(item => item.done).length
  const totalCount = items.length
  const checklistProgress = totalCount ? (doneCount / totalCount) * 100 : 0
  const dateParts = eventDateParts(event?.date)
  const heroMeta = [dateParts.date, dateParts.time, event?.location].filter(Boolean).join(' · ')
  const groupedTasks = useMemo(() => groupByCategory(items, TASK_CATEGORIES), [items])
  const suggestions = SUGGESTIONS[event?.type] || SUGGESTIONS.birthday
  const budgetTotal = Number(event?.budget_total || 0)
  const spentTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const remainingBudget = budgetTotal - spentTotal
  const budgetProgress = budgetTotal > 0 ? Math.min(100, (spentTotal / budgetTotal) * 100) : 0
  const budgetFill = budgetProgress >= 80 ? '#FF3B30' : budgetProgress >= 50 ? '#FF9500' : '#34C759'
  const groupedExpenses = useMemo(() => groupByCategory(expenses, EXPENSE_CATEGORIES, 'amount'), [expenses])
  const confirmed = invitations.filter(invitation => invitation.status === 'accepted')
  const waiting = invitations.filter(invitation => WAITING_STATUSES.includes(invitation.status))
  const declined = invitations.filter(invitation => invitation.status === 'declined')
  const pendingForReminder = invitations.filter(invitation => PENDING_STATUSES.includes(invitation.status))
  const lastReminder = invitations.filter(invitation => invitation.status === 'reminded' && invitation.updated_at).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
  const oldestPending = pendingForReminder.slice().sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0]
  const reminderDays = daysAgo(lastReminder?.updated_at || oldestPending?.created_at)

  async function toggleItem(item) {
    const nextDone = !item.done
    setItems(prev => prev.map(row => row.id === item.id ? { ...row, done: nextDone } : row))
    const { error } = await supabase.from('checklist_items').update({ done: nextDone }).eq('id', item.id)
    if (error) {
      setItems(prev => prev.map(row => row.id === item.id ? { ...row, done: item.done } : row))
      showToast('Erreur réseau, tâche restaurée', 'error')
    }
  }

  async function addTask(payload) {
    const maxPosition = items.reduce((max, item) => Math.max(max, Number(item.position || 0)), -1)
    const optimistic = {
      id: `local-${Date.now()}`,
      event_id: eventId,
      done: false,
      position: maxPosition + 1,
      created_by: currentUserId,
      assignee: acceptedGuests.find(guest => guest.id === payload.assigned_to) || null,
      ...payload,
    }
    setItems(prev => [...prev, optimistic])
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ ...payload, event_id: eventId, done: false, position: maxPosition + 1, created_by: currentUserId })
      .select('id, event_id, label, done, position, assigned_to, due_date, category, created_by')
      .maybeSingle()
    if (error) {
      setItems(prev => prev.filter(item => item.id !== optimistic.id))
      showToast("Impossible d'ajouter la tâche", 'error')
      return false
    }
    setItems(prev => prev.map(item => item.id === optimistic.id ? { ...data, assignee: optimistic.assignee } : item))
    return true
  }

  async function addSuggestions() {
    const rows = suggestions.map((suggestion, position) => ({
      event_id: eventId,
      label: suggestion.label,
      category: suggestion.category,
      position,
      done: false,
      created_by: currentUserId,
    }))
    const { data, error } = await supabase.from('checklist_items').insert(rows).select('id, event_id, label, done, position, assigned_to, due_date, category, created_by')
    if (error) {
      showToast("Impossible d'ajouter les suggestions", 'error')
      return
    }
    setItems((data || []).map(item => ({ ...item, assignee: null })))
  }

  async function deleteTask(item) {
    if (!window.confirm('Supprimer cette tâche ?')) return
    setItems(prev => prev.filter(row => row.id !== item.id))
    const { error } = await supabase.from('checklist_items').delete().eq('id', item.id)
    if (error) {
      setItems(prev => [...prev, item].sort((a, b) => Number(a.position || 0) - Number(b.position || 0)))
      showToast('Erreur réseau, tâche restaurée', 'error')
    }
  }

  async function saveBudget() {
    const previous = budgetTotal
    const next = parseAmount(budgetDraft)
    setEditingBudget(false)
    setEvent(prev => ({ ...prev, budget_total: next }))
    const { error } = await supabase.from('events').update({ budget_total: next }).eq('id', eventId)
    if (error) {
      setEvent(prev => ({ ...prev, budget_total: previous }))
      setBudgetDraft(previous ? String(previous) : '')
      showToast('Budget non sauvegardé', 'error')
    }
  }

  async function addExpense(payload) {
    const optimistic = { id: `local-${Date.now()}`, event_id: eventId, created_by: currentUserId, created_at: new Date().toISOString(), ...payload }
    setExpenses(prev => [...prev, optimistic])
    const { data, error } = await supabase
      .from('event_expenses')
      .insert({ ...payload, event_id: eventId, created_by: currentUserId })
      .select('id, event_id, label, amount, category, created_by, created_at')
      .maybeSingle()
    if (error) {
      setExpenses(prev => prev.filter(expense => expense.id !== optimistic.id))
      showToast("Impossible d'ajouter la dépense", 'error')
      return false
    }
    setExpenses(prev => prev.map(expense => expense.id === optimistic.id ? data : expense))
    return true
  }

  async function deleteExpense(expense) {
    if (!window.confirm('Supprimer cette dépense ?')) return
    setExpenses(prev => prev.filter(row => row.id !== expense.id))
    const { error } = await supabase.from('event_expenses').delete().eq('id', expense.id)
    if (error) {
      setExpenses(prev => [...prev, expense].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)))
      showToast('Erreur réseau, dépense restaurée', 'error')
    }
  }

  async function sendReminder(selectedInvitations, message) {
    const ids = selectedInvitations.map(invitation => invitation.id)
    const recipients = selectedInvitations
      .map(invitation => ({
        invitation_id: invitation.id,
        email: invitation.invited_email || invitation.profile?.email,
        first_name: firstName(invitation.profile, invitation.invited_email),
      }))
      .filter(recipient => recipient.email)

    const { error } = await supabase.functions.invoke('send-reminder', {
      body: { event_id: eventId, invitation_ids: ids, message, event: { id: eventId, name: event.name, date: event.date }, recipients },
    })
    if (error) {
      showToast('Relance non envoyée', 'error')
      return false
    }
    const now = new Date().toISOString()
    const { error: updateError } = await supabase.from('invitations').update({ status: 'reminded', updated_at: now }).in('id', ids)
    if (updateError) {
      showToast('Relance envoyée, statut non mis à jour', 'error')
      return false
    }
    setInvitations(prev => prev.map(invitation => ids.includes(invitation.id) ? { ...invitation, status: 'reminded', updated_at: now } : invitation))
    showToast(`Relance envoyée à ${ids.length} personnes ✓`)
    return true
  }

  if (loading || !event) return <Skeleton />

  return (
    <div className="organizer-page">
      <style>{styles}</style>
      <div className="organizer-shell">
        <header className="org-header">
          <button type="button" aria-label="Retour" onClick={() => navigate(-1)}><ChevronLeft size={22} /></button>
          <h1>{event.name}</h1>
        </header>

        <section className="org-hero fade-up">
          <div className="org-hero-emoji">{event.emoji || '🎉'}</div>
          <h2>{event.name}</h2>
          <p>{heroMeta || 'Date et lieu à préciser'}</p>
          <div className="org-hero-progress">
            <div><span>Checklist</span><strong>{doneCount} / {totalCount} tâches</strong></div>
            <i><b style={{ width: `${checklistProgress}%` }} /></i>
          </div>
        </section>

        <nav className="org-tabs" aria-label="Espace organisateur">
          {[
            ['checklist', 'Checklist'],
            ['budget', 'Budget'],
            ['guests', 'Invités'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </nav>

        {activeTab === 'checklist' && (
          <main className="org-panel">
            {items.length === 0 ? (
              <section className="org-empty fade-up">
                <h2>Suggestions</h2>
                {suggestions.map(suggestion => {
                  const category = taskCategory(suggestion.category)
                  return <p key={suggestion.label}><span>{category.emoji}</span>{suggestion.label}</p>
                })}
                <button type="button" onClick={addSuggestions}>Utiliser ces suggestions</button>
              </section>
            ) : groupedTasks.map((group, groupIndex) => (
              <section key={group.key} className="org-group">
                <h2 style={{ marginTop: groupIndex === 0 ? 4 : 18 }}>{group.emoji} {group.label}</h2>
                {group.rows.map((item, index) => (
                  <ChecklistItem key={item.id} item={item} index={index} onToggle={toggleItem} onDelete={deleteTask} />
                ))}
              </section>
            ))}
            <button type="button" className="org-dashed-btn" onClick={() => setShowTaskSheet(true)}><Plus size={15} /> Ajouter une tâche</button>
          </main>
        )}

        {activeTab === 'budget' && (
          <main className="org-panel">
            {budgetTotal === 0 && (
              <section className="org-budget-set fade-up">
                <h2>Définir mon budget</h2>
                <div>
                  <input type="number" min="0" inputMode="decimal" value={budgetDraft} onChange={e => setBudgetDraft(e.target.value)} placeholder="300" />
                  <button type="button" onClick={saveBudget}>Valider</button>
                </div>
              </section>
            )}

              <section className="org-budget-hero fade-up">
                <span>Budget restant</span>
              <div className={`org-budget-amount ${remainingBudget < 0 ? 'negative' : ''}`}>{formatMoney(remainingBudget)} <small>€</small></div>
              <p>
                <em>Dépensé : {formatMoney(spentTotal)} €</em>
                {editingBudget ? (
                  <input
                    autoFocus
                    value={budgetDraft}
                    onChange={e => setBudgetDraft(e.target.value)}
                    onBlur={saveBudget}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveBudget()
                      if (e.key === 'Escape') setEditingBudget(false)
                    }}
                    type="number"
                    min="0"
                    inputMode="decimal"
                  />
                ) : (
                  <button type="button" onClick={() => setEditingBudget(true)}>Budget : {formatMoney(budgetTotal)} €</button>
                )}
              </p>
              <i><b style={{ width: `${budgetProgress}%`, background: budgetFill }} /></i>
            </section>

            {groupedExpenses.map(group => (
              <section key={group.key} className="org-expense-group">
                <h2><span>{group.emoji} {group.label}</span><strong>{formatMoney(group.subtotal)} €</strong></h2>
                {group.rows.map(expense => {
                  const category = expenseCategory(expense.category)
                  return (
                    <div key={expense.id} className="org-expense-row fade-up">
                      <span>{category.emoji}</span>
                      <strong>{expense.label}</strong>
                      <em>{formatMoney(expense.amount, true)} €</em>
                      <button type="button" aria-label={`Supprimer ${expense.label}`} onClick={() => deleteExpense(expense)}>×</button>
                    </div>
                  )
                })}
              </section>
            ))}

            <div className="org-total-row fade-up"><span>Total dépensé</span><strong>{formatMoney(spentTotal)} € / {formatMoney(budgetTotal)} €</strong></div>
            <button type="button" className="org-dashed-btn" onClick={() => setShowExpenseSheet(true)}><Plus size={15} /> Ajouter une dépense</button>
          </main>
        )}

        {activeTab === 'guests' && (
          <main className="org-panel">
            <CoOrganizers eventId={eventId} isOwner={isOwner} />
            {pendingForReminder.length > 0 && (
              <section className="org-alert fade-up">
                <span>⏰</span>
                <div>
                  <strong>{pendingForReminder.length} invités sans réponse</strong>
                  <small>{lastReminder ? `Dernière relance il y a ${reminderDays || 0} jours` : `Dernière relance il y a ${reminderDays || 0} jours`}</small>
                </div>
                <button type="button" onClick={() => setShowReminderSheet(true)}>Relancer</button>
              </section>
            )}
            <GuestGroup title={`✅ Confirmés (${confirmed.length})`} rows={confirmed} />
            <GuestGroup title={`⏳ En attente (${waiting.length})`} rows={waiting} />
            <GuestGroup title={`✕ Déclinés (${declined.length})`} rows={declined} />
            <button type="button" className="org-invite-btn" onClick={() => setShowInviteSheet(true)}><Plus size={15} /> Inviter des amis</button>
          </main>
        )}
      </div>

      {showTaskSheet && <AddTaskSheet guests={acceptedGuests} onClose={() => setShowTaskSheet(false)} onSave={addTask} />}
      {showExpenseSheet && <AddExpenseSheet onClose={() => setShowExpenseSheet(false)} onSave={addExpense} />}
      {showReminderSheet && <ReminderSheet event={event} invitations={pendingForReminder} onClose={() => setShowReminderSheet(false)} onSend={sendReminder} />}
      {showInviteSheet && (
        <InviteFriendsSheet
          eventId={eventId}
          onClose={() => setShowInviteSheet(false)}
          onInvited={count => {
            showToast(`${count} invitation${count > 1 ? 's' : ''} envoyée${count > 1 ? 's' : ''} ✓`)
            loadOrganizerData()
          }}
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}

function GuestGroup({ title, rows }) {
  return (
    <section className="org-guest-group">
      <h2>{title}</h2>
      {rows.map(invitation => {
        const status = invitationStatus(invitation)
        const email = invitation.invited_email || invitation.profile?.email
        return (
          <div key={invitation.id} className="org-guest-row fade-up">
            <Avatar profile={invitation.profile} email={email} />
            <div>
              <strong>{profileName(invitation.profile, email)}</strong>
              <small>{email || (invitation.status === 'reminded' ? 'Relancé hier' : relativeSince(invitation.created_at))}</small>
            </div>
            <em style={{ color: status.color }}>{status.label}</em>
          </div>
        )
      })}
    </section>
  )
}

const styles = `
.organizer-page {
  --bg: #F2F2F7;
  --white: #FFFFFF;
  --black: #1C1C1E;
  --blue: #007AFF;
  --green: #34C759;
  --red: #FF3B30;
  --orange: #FF9500;
  --gray1: #8E8E93;
  --gray2: #AEAEB2;
  --gray3: #F2F2F7;
  --salmon: #FBBF9A;
  --grad: linear-gradient(135deg, #e055aa, #f5a623);
  --r-card: 20px;
  --r-inner: 14px;
  --r-pill: 20px;
  --r-btn: 12px;
  --shadow-card: 0 2px 16px rgba(0,0,0,0.08);
  --shadow-sm: 0 1px 8px rgba(0,0,0,0.07);
  min-height: 100dvh;
  background: var(--bg);
  color: var(--black);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  overflow-y: auto;
}
.organizer-shell { max-width: 560px; margin: 0 auto; padding: 14px 16px 34px; }
.org-header { display: grid; grid-template-columns: 32px minmax(0, 1fr) 32px; align-items: center; gap: 10px; margin-bottom: 14px; }
.org-header button { width: 32px; height: 32px; border-radius: 50%; background: var(--white); box-shadow: var(--shadow-sm); color: var(--black); display: flex; align-items: center; justify-content: center; }
.org-header h1 { font-size: 18px; font-weight: 700; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.org-hero { position: relative; overflow: hidden; background: radial-gradient(circle at 18% 8%, rgba(251,191,154,0.48), transparent 34%), radial-gradient(circle at 88% 18%, rgba(255,245,224,0.95), transparent 38%), var(--white); border-radius: var(--r-card); box-shadow: var(--shadow-card); padding: 17px 16px 15px; text-align: center; margin-bottom: 14px; }
.org-hero-emoji { font-size: 40px; line-height: 1; margin-bottom: 8px; }
.org-hero h2 { font-size: 19px; font-weight: 800; margin: 0 0 4px; }
.org-hero p { font-size: 12px; color: var(--gray1); margin: 0 0 14px; }
.org-hero-progress div { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px; font-weight: 700; color: var(--gray1); }
.org-hero-progress i, .org-budget-hero i { display: block; height: 7px; border-radius: 10px; background: #EBEBF0; overflow: hidden; }
.org-hero-progress b, .org-budget-hero b { display: block; height: 100%; border-radius: 10px; background: var(--grad); transition: width 0.4s ease; }
.org-tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 16px; }
.org-tabs button { flex: 0 0 auto; background: var(--white); color: var(--gray1); box-shadow: var(--shadow-sm); border-radius: var(--r-pill); padding: 8px 16px; font-size: 13px; font-weight: 500; }
.org-tabs button.active { background: var(--grad); color: var(--white); font-weight: 600; }
.org-panel { display: grid; gap: 8px; }
.org-group h2, .org-guest-group h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gray1); margin: 4px 0 10px; }
.org-task-swipe { position: relative; overflow: hidden; border-radius: var(--r-inner); margin-bottom: 8px; }
.org-delete-reveal { position: absolute; top: 0; right: 0; bottom: 0; width: 44px; background: var(--red); color: white; font-size: 10px; font-weight: 700; writing-mode: vertical-rl; transform: rotate(180deg); }
.org-task-card { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; background: var(--white); border-radius: var(--r-inner); padding: 11px 12px; box-shadow: var(--shadow-sm); transition: transform 0.18s ease; touch-action: pan-y; }
.org-check { width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%; border: 2px solid #D1D1D6; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 700; }
.org-check.done { border: none; background: var(--grad); animation: org-scale 0.15s ease; }
.org-task-main { flex: 1; min-width: 0; text-align: left; font-size: 14px; font-weight: 500; color: var(--black); }
.org-task-main span { overflow-wrap: anywhere; }
.org-task-main .done { color: var(--gray2); text-decoration: line-through; }
.org-task-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.org-task-side small { font-size: 10px; color: var(--gray2); }
.org-chip { padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; white-space: nowrap; font-style: normal; }
.chip-green { background: rgba(52,199,89,0.10); color: #34C759; }
.chip-pink { background: rgba(224,85,170,0.10); color: #e055aa; }
.chip-orange { background: rgba(255,149,0,0.12); color: #FF9500; }
.chip-gray { background: #F2F2F7; color: #6B6B6B; }
.org-dashed-btn { background: var(--white); border: 1.5px dashed var(--gray2); border-radius: var(--r-inner); padding: 11px; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--gray1); font-size: 12px; font-weight: 500; margin-top: 4px; }
.org-empty, .org-budget-set { background: var(--white); border-radius: var(--r-card); box-shadow: var(--shadow-card); padding: 16px; }
.org-empty h2, .org-budget-set h2 { font-size: 16px; font-weight: 800; margin-bottom: 10px; }
.org-empty p { display: flex; gap: 8px; align-items: center; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
.org-empty button, .org-budget-set button { width: 100%; margin-top: 8px; background: var(--grad); color: white; border-radius: var(--r-btn); padding: 13px; font-size: 13px; font-weight: 700; }
.org-budget-set div { display: grid; grid-template-columns: 1fr 104px; gap: 8px; }
.org-budget-set input { background: var(--gray3); border-radius: var(--r-btn); padding: 13px; font-size: 14px; }
.org-budget-hero { background: var(--white); border-radius: var(--r-card); box-shadow: var(--shadow-card); padding: 18px 16px 14px; margin-bottom: 6px; }
.org-budget-hero > span { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--gray1); margin-bottom: 4px; }
.org-budget-amount { font-size: 36px; font-weight: 800; letter-spacing: -1px; color: var(--black); line-height: 1; margin-bottom: 10px; }
.org-budget-amount.negative { color: var(--red); }
.org-budget-hero small { font-size: 18px; font-weight: 700; color: var(--gray1); }
.org-budget-hero input { width: 126px; background: var(--gray3); border-radius: var(--r-btn); padding: 6px 8px; font-size: 12px; font-weight: 700; text-align: right; color: var(--black); }
.org-budget-hero p { display: flex; justify-content: space-between; margin: 0 0 6px; }
.org-budget-hero em, .org-budget-hero p button { font-size: 12px; color: var(--gray1); font-style: normal; }
.org-budget-hero i { height: 8px; }
.org-expense-group { margin-bottom: 4px; }
.org-expense-group h2 { display: flex; justify-content: space-between; padding: 0 4px; margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--gray2); }
.org-expense-row { display: flex; align-items: center; gap: 10px; background: var(--white); border-radius: 12px; padding: 10px 12px; box-shadow: var(--shadow-sm); margin-bottom: 6px; }
.org-expense-row > span { width: 28px; text-align: center; font-size: 18px; }
.org-expense-row strong { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.org-expense-row em { font-size: 14px; font-weight: 700; font-style: normal; }
.org-expense-row button { width: 20px; height: 20px; border-radius: 50%; background: var(--gray3); color: var(--gray1); flex-shrink: 0; font-size: 17px; line-height: 18px; }
.org-total-row { display: flex; justify-content: space-between; align-items: center; background: var(--white); border-radius: 12px; padding: 12px 14px; box-shadow: var(--shadow-sm); margin: 4px 0; }
.org-total-row span { font-size: 13px; font-weight: 600; color: var(--gray1); }
.org-total-row strong { font-size: 16px; font-weight: 800; color: var(--black); }
.org-alert { display: flex; align-items: center; gap: 10px; background: rgba(255,149,0,0.10); border-radius: var(--r-inner); padding: 12px 14px; margin-bottom: 6px; }
.org-alert > span { font-size: 20px; flex-shrink: 0; }
.org-alert div { flex: 1; min-width: 0; }
.org-alert strong { display: block; font-size: 13px; font-weight: 700; color: #B36500; }
.org-alert small { font-size: 11px; color: var(--orange); }
.org-alert button { background: var(--orange); color: white; padding: 6px 12px; border-radius: 10px; font-size: 11px; font-weight: 700; }
.org-guest-row { display: flex; align-items: center; gap: 10px; background: var(--white); border-radius: var(--r-inner); padding: 11px 12px; box-shadow: var(--shadow-sm); margin-bottom: 8px; }
.org-guest-row div { flex: 1; min-width: 0; }
.org-guest-row strong { display: block; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.org-guest-row small { display: block; font-size: 11px; color: var(--gray1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.org-guest-row em { font-size: 11px; font-weight: 600; font-style: normal; white-space: nowrap; }
.org-invite-btn { width: 100%; background: var(--grad); color: white; border-radius: var(--r-btn); padding: 13px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; }
.org-avatar-img, .org-avatar-fallback { border-radius: 50%; flex-shrink: 0; object-fit: cover; }
.org-avatar-fallback { display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 700; }
.org-backdrop { position: fixed; inset: 0; z-index: 800; background: rgba(0,0,0,0); display: flex; flex-direction: column; justify-content: flex-end; transition: background 0.28s ease; }
.org-backdrop.shown { background: rgba(0,0,0,0.4); }
.org-sheet { background: white; border-radius: 20px 20px 0 0; padding: 10px 16px 40px; transform: translateY(100%); transition: transform 0.28s ease-out; max-height: 88dvh; overflow-y: auto; display: grid; gap: 12px; }
.org-sheet.shown { transform: translateY(0); }
.org-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--gray2); justify-self: center; margin-bottom: 8px; }
.org-sheet-title-row { display: flex; align-items: center; justify-content: space-between; }
.org-sheet-title-row h2, .org-reminder-title { font-size: 17px; font-weight: 700; color: var(--black); margin: 0; }
.org-sheet-title-row button { width: 30px; height: 30px; border-radius: 50%; background: var(--gray3); display: flex; align-items: center; justify-content: center; color: var(--gray1); }
.org-category-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.org-category-grid button { background: white; border-radius: 12px; padding: 12px; text-align: center; box-shadow: var(--shadow-sm); }
.org-category-grid button.selected { box-shadow: 0 0 0 2px #007AFF inset; }
.org-category-grid span { display: block; font-size: 20px; margin-bottom: 4px; }
.org-category-grid small { font-size: 11px; font-weight: 500; color: var(--gray1); }
.org-field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--gray1); margin-top: 2px; }
.org-primary-sheet-btn { background: var(--grad); color: white; border-radius: var(--r-btn); padding: 14px; font-size: 14px; font-weight: 700; margin-top: 4px; }
.org-primary-sheet-btn:disabled { background: var(--gray3); color: var(--gray1); }
.org-reminder-subtitle { font-size: 13px; color: var(--gray1); margin: -8px 0 4px; }
.org-reminder-list { display: grid; gap: 0; border-radius: var(--r-inner); overflow: hidden; }
.org-reminder-row { display: flex; align-items: center; gap: 10px; background: white; padding: 10px 0; text-align: left; }
.org-reminder-row span:nth-child(2) { flex: 1; min-width: 0; }
.org-reminder-row strong, .org-reminder-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.org-reminder-row strong { font-size: 13px; font-weight: 600; }
.org-reminder-row small { font-size: 11px; color: var(--gray1); }
.org-reminder-row i { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #D1D1D6; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 11px; font-weight: 700; color: white; }
.org-reminder-row i.checked { border: none; background: var(--grad); }
.org-sheet-separator { height: 0.5px; background: var(--gray3); margin-bottom: 2px; }
.org-toast { position: fixed; left: 50%; bottom: 26px; z-index: 950; transform: translateX(-50%); background: var(--black); color: white; border-radius: var(--r-btn); padding: 12px 16px; font-size: 13px; font-weight: 700; animation: org-toast 0.22s ease-out; box-shadow: 0 8px 24px rgba(0,0,0,0.2); white-space: nowrap; }
.org-toast.error { background: var(--red); }
.fade-up { opacity: 0; transform: translateY(10px); animation: org-fade-up 0.3s ease forwards; }
.org-skeleton-head { display: flex; align-items: center; gap: 12px; margin: 8px 0 16px; }
.org-skeleton { display: block; background: linear-gradient(90deg,#E5E5EA,#F7F7FA,#E5E5EA); background-size: 200% 100%; animation: org-pulse 1.2s ease infinite; }
.org-skeleton.circle { width: 32px; height: 32px; border-radius: 50%; }
.org-skeleton.line { height: 18px; border-radius: 8px; width: 170px; }
.org-skeleton.hero { height: 170px; border-radius: 20px; margin-bottom: 14px; }
.org-skeleton-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.org-skeleton.pill { width: 96px; height: 32px; border-radius: 20px; }
.org-skeleton.row { height: 54px; border-radius: 14px; margin-bottom: 8px; }
@keyframes org-fade-up { to { opacity: 1; transform: translateY(0); } }
@keyframes org-scale { from { transform: scale(0.85); } to { transform: scale(1); } }
@keyframes org-toast { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes org-pulse { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`
