import { useState } from 'react'
import { ChevronLeft, Clapperboard, Coffee, Footprints, Gamepad2, Plus, Utensils, Wine } from 'lucide-react'
import DispoCalendar from '../components/home/DispoCalendar'
import { useDispoCalendar } from '../hooks/useDispoCalendar'

const moods = [
  { key: 'cafe', label: 'Café', Icon: Coffee },
  { key: 'jeux', label: 'Jeux', Icon: Gamepad2 },
  { key: 'diner', label: 'Dîner', Icon: Utensils },
  { key: 'cine', label: 'Ciné', Icon: Clapperboard },
  { key: 'apero', label: 'Apéro', Icon: Wine },
  { key: 'balade', label: 'Balade', Icon: Footprints },
]

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthDays(currentMonth) {
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const cells = Array.from({ length: mondayOffset }, () => null)

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
  }

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function DispoCalendarPage({ userId, onBack }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const { posts, myPosts, loading, createDispo, creating, deleteDispo, updateDispo } = useDispoCalendar(userId)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedDates, setSelectedDates] = useState([])
  const [selectedMoods, setSelectedMoods] = useState([])
  const [editingPost, setEditingPost] = useState(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = toDateKey(today)
  const days = getMonthDays(currentMonth)
  const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  function resetSheet() {
    setSheetOpen(false)
    setStep(1)
    setSelectedDates([])
    setSelectedMoods([])
    setEditingPost(null)
  }

  function openCreateSheet(dateKey) {
    setEditingPost(null)
    setSelectedDates(dateKey ? [dateKey] : [])
    setSelectedMoods([])
    setStep(1)
    setSheetOpen(true)
  }

  function openEditSheet(post) {
    setEditingPost(post)
    setSelectedDates([...(post.available_dates ?? [])].sort())
    setSelectedMoods([...(post.moods ?? [])])
    setStep(1)
    setSheetOpen(true)
  }

  function toggleDate(dateKey) {
    setSelectedDates(prev => (
      prev.includes(dateKey)
        ? prev.filter(value => value !== dateKey)
        : [...prev, dateKey].sort()
    ))
  }

  function toggleMood(moodKey) {
    setSelectedMoods(prev => (
      prev.includes(moodKey)
        ? prev.filter(value => value !== moodKey)
        : [...prev, moodKey]
    ))
  }

  async function handlePublish() {
    if (creating) return
    try {
      if (editingPost) {
        await updateDispo(editingPost.id, selectedDates, selectedMoods)
      } else {
        await createDispo(userId, selectedDates, selectedMoods)
      }
      resetSheet()
    } catch (error) {
      console.error('[DispoCalendarPage] saveDispo error:', error)
    }
  }

  async function handleDelete(postId) {
    try {
      await deleteDispo(postId)
    } catch (error) {
      console.error('[DispoCalendarPage] deleteDispo error:', error)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: '#faf9fb',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        color: '#1C1C1E',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px 10px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: 'none',
              background: '#F2F2F7',
              color: '#1C1C1E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Retour"
          >
            <ChevronLeft size={21} strokeWidth={2.4} />
          </button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: 0 }}>
            Dispos de mes amis
          </h1>
        </div>
        <button
          type="button"
          aria-label="Ajouter une dispo"
          onClick={() => openCreateSheet()}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e055aa, #f5a623)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Plus size={17} strokeWidth={2.5} color="white" />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 100px' }}>
        {loading ? (
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '0.5px solid rgba(0,0,0,0.07)',
              padding: 18,
              color: '#8E8E93',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Chargement...
          </div>
        ) : (
          <>
            <DispoCalendar
              userId={userId}
              posts={posts}
              myPosts={myPosts}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              onDayClick={openCreateSheet}
              onEditPost={openEditSheet}
              onDeletePost={handleDelete}
            />
          </>
        )}
      </div>

      {sheetOpen && (
        <>
          <div
            onClick={resetSheet}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              zIndex: 499,
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 0,
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 430,
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
              zIndex: 500,
            }}
          >
          {step === 1 ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                Quand es-tu dispo ?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 7, marginBottom: 16 }}>
                {weekdays.map((weekday, index) => (
                  <div
                    key={`${weekday}-${index}`}
                    style={{
                      height: 24,
                      color: '#8E8E93',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {weekday}
                  </div>
                ))}
                {days.map((day, index) => {
                  if (!day) return <div key={`empty-${index}`} />
                  const dateKey = toDateKey(day)
                  const isPast = dateKey < todayKey
                  const selected = selectedDates.includes(dateKey)

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      disabled={isPast}
                      onClick={() => toggleDate(dateKey)}
                      style={{
                        height: 40,
                        borderRadius: 12,
                        border: 'none',
                        background: selected ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                        color: selected ? '#fff' : '#1C1C1E',
                        fontSize: 13,
                        fontWeight: 800,
                        opacity: isPast ? 0.3 : 1,
                        cursor: isPast ? 'default' : 'pointer',
                      }}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                disabled={selectedDates.length === 0}
                onClick={() => setStep(2)}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  opacity: selectedDates.length === 0 ? 0.35 : 1,
                  cursor: selectedDates.length === 0 ? 'default' : 'pointer',
                }}
              >
                Suivant →
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                Quoi de prévu ?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
                {moods.map(({ key, label, Icon }) => {
                  const selected = selectedMoods.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleMood(key)}
                      style={{
                        height: 44,
                        borderRadius: 14,
                        border: 'none',
                        background: selected ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F2F2F7',
                        color: selected ? '#fff' : '#3A3A3C',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon size={16} strokeWidth={2.3} />
                      {label}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={handlePublish}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginBottom: 12,
                }}
              >
                Publier
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: '#8E8E93',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: 8,
                }}
              >
                ← Retour
              </button>
            </>
          )}
          </div>
        </>
      )}
    </div>
  )
}
