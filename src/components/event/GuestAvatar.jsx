const PASTELS = [
  { bg: '#FCE4F1', text: '#B4387F' },
  { bg: '#FFEBD6', text: '#B25E09' },
  { bg: '#DFF5E6', text: '#1F7A41' },
  { bg: '#DDEBFF', text: '#2759B5' },
  { bg: '#ECE3FF', text: '#6941C6' },
  { bg: '#D9F2F5', text: '#16707E' },
]

function pastelFor(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return PASTELS[Math.abs(hash) % PASTELS.length]
}

// Photo ronde, ou initiale sur fond pastel.
export default function GuestAvatar({ name, avatarUrl, seed, size = 40 }) {
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0 }
  if (avatarUrl) return <img src={avatarUrl} alt="" style={{ ...style, objectFit: 'cover', display: 'block' }} />
  const initial = (name || '?').replace(/^@/, '').trim().charAt(0).toUpperCase() || '?'
  const pastel = pastelFor(seed || name || '?')
  return (
    <div aria-hidden="true" style={{ ...style, background: pastel.bg, color: pastel.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.4), fontWeight: 700 }}>
      {initial}
    </div>
  )
}
