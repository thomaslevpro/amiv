const icons = {
  home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H15v-5h-6v5H4a1 1 0 0 1-1-1V9.5z"/>
    </svg>
  ),
  calendar: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  messages: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  profile: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
}

const tabs = [
  { key: 'home', icon: 'home' },
  { key: 'calendar', icon: 'calendar' },
  { key: 'messages', icon: 'messages' },
  { key: 'profile', icon: 'profile' },
]

export default function BottomNav({ current, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '10px 16px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        background: '#fff', borderRadius: 40,
        boxShadow: '0 -2px 20px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.10)',
        padding: '10px 20px', width: '100%', height: 62,
      }}>
        {tabs.map(tab => {
          const active = current === tab.key
          return (
            <div key={tab.key} onClick={() => onChange(tab.key)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 22,
                background: active ? '#F2F2F7' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.18s ease',
              }}>
                <div style={{ stroke: active ? '#1C1C1E' : '#AEAEB2' }}>
                  {icons[tab.icon]}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
