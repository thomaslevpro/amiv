export default function MonthTimeline({ birthdays, events, today }) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDate = today.getDate()

  // Parse YYYY-MM-DD safely without timezone shift
  const bdayDays = new Set(
    birthdays.map(b => parseInt(b.birthdate.split('-')[2], 10))
  )

  const eventsThisMonth = events.filter(e => {
    if (!e.date) return false
    const d = new Date(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
  const eventDays = new Set(eventsThisMonth.map(e => new Date(e.date).getDate()))

  const monthLabel = today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  const bdayCount = birthdays.length
  const eventCount = eventsThisMonth.length
  const subtitle = [
    bdayCount > 0 && `${bdayCount} anniversaire${bdayCount !== 1 ? 's' : ''}`,
    eventCount > 0 && `${eventCount} événement${eventCount !== 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      padding: '12px 14px 10px', marginBottom: 16,
      boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>{monthLabelCapitalized}</span>
        {subtitle ? (
          <span style={{ fontSize: 12, color: '#8E8E93' }}>{subtitle}</span>
        ) : null}
      </div>
      <div style={{
        overflowX: 'auto', display: 'flex', gap: 4,
        padding: '2px 0 4px', WebkitOverflowScrolling: 'touch',
      }}>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const isToday = day === todayDate
        const hasBday = bdayDays.has(day)
        const hasEvent = eventDays.has(day)
        const isPast = day < todayDate

        let barColor = '#E5E5EA'
        if (isToday) barColor = '#007AFF'
        else if (hasBday) barColor = '#e055aa'
        else if (hasEvent) barColor = 'rgba(0,122,255,0.5)'

        return (
          <div key={day} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            flexShrink: 0, width: 20,
            opacity: isPast && !isToday ? 0.4 : 1,
          }}>
            <div style={{
              fontSize: 9,
              color: isToday ? '#007AFF' : '#AEAEB2',
              fontWeight: isToday ? 700 : 400,
              marginBottom: 3,
            }}>
              {day}
            </div>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: barColor }} />
            {(hasBday || hasEvent) && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%', marginTop: 2,
                background: hasBday ? '#e055aa' : '#007AFF',
              }} />
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
