import { ChevronLeft, ChevronRight } from 'lucide-react'
import StatusBar from '../components/StatusBar'
import { events } from '../data/mockData'

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const EVENT_DAYS = [10, 18, 24]
const TODAY = 10

function buildGrid() {
  const grid = []
  for (let i = 0; i < 3; i++) grid.push(null)
  for (let i = 1; i <= 31; i++) grid.push(i)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

export default function Calendar({ onEventClick }) {
  const grid = buildGrid()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <StatusBar />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, padding: '6px 2px 0' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E' }}>Calendrier</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>Mai 2025</div>
          </div>
        </div>

        {/* Calendar widget */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 14, marginBottom: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={14} strokeWidth={1.5} color="#8E8E93" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>Mai 2025</div>
            <div style={{ width: 28, height: 28, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={14} strokeWidth={1.5} color="#8E8E93" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DAYS.map((d, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 600, color: '#AEAEB2', textAlign: 'center', padding: '4px 0' }}>{d}</div>
            ))}
            {grid.map((d, i) => {
              if (!d) return <div key={i}/>
              const isToday = d === TODAY
              const hasEvent = EVENT_DAYS.includes(d) && !isToday
              return (
                <div key={i} onClick={() => d && onEventClick(events[0])} style={{
                  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: isToday ? 700 : 400, borderRadius: '50%',
                  color: isToday ? '#fff' : '#1C1C1E',
                  background: isToday ? 'linear-gradient(135deg,#e055aa,#f5a623)' : 'transparent',
                  margin: 'auto', cursor: d ? 'pointer' : 'default', position: 'relative',
                }}>
                  {d}
                  {hasEvent && (
                    <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: '#e055aa' }}/>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Events list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93' }}>À venir</div>
        </div>

        {events.map(ev => (
          <div key={ev.id} onClick={() => onEventClick(ev)} style={{
            background: '#fff', borderRadius: 16, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 10, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', cursor: 'pointer',
          }}>
            <div style={{ width: 42, height: 42, background: '#FBBF9A', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {ev.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E' }}>{ev.eventName} — {ev.name}</div>
              <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{ev.date}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>J-{ev.daysLeft}</div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#007AFF' }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
