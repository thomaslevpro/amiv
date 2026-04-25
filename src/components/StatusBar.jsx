export default function StatusBar({ light = false }) {
  const color = light ? 'white' : '#1C1C1E'
  const opacity = light ? 0.6 : 0.35

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 28px 0', fontSize: 12, fontWeight: 700, color,
      flexShrink: 0,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="17" height="12" viewBox="0 0 17 12" fill={color}>
          <rect x="0" y="4" width="3" height="8" rx="0.6"/>
          <rect x="4.5" y="2.5" width="3" height="9.5" rx="0.6"/>
          <rect x="9" y="0.5" width="3" height="11.5" rx="0.6"/>
          <rect x="13.5" y="0" width="3" height="12" rx="0.6" opacity="0.5"/>
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke={color} strokeOpacity={opacity}/>
          <rect x="1.5" y="1.5" width="18" height="9" rx="2.2" fill={color}/>
        </svg>
      </div>
    </div>
  )
}
