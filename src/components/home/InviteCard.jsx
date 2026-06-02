async function handleShare(onToast) {
  const shareData = {
    title: 'Amiv',
    text: 'Rejoins-moi sur Amiv pour ne plus jamais rater un anniversaire 🎂',
    url: 'https://amiv.app',
  }
  if (navigator.share) {
    navigator.share(shareData).catch(() => {})
  } else {
    try { await navigator.clipboard.writeText('https://amiv.app') } catch { /* ignore */ }
    onToast?.('Lien copié !', false, 2000)
  }
}

export default function InviteCard({ onToast }) {
  const onShare = () => handleShare(onToast)

  return (
    <div
      onClick={onShare}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        marginBottom: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {['#e055aa', '#f5a623', '#4D96FF', '#6BCB77'].map(color => (
            <span key={color} style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
          ))}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginBottom: 3 }}>
          Offrez Amiv à vos proches
        </div>
        <div style={{ fontSize: 12, color: '#6B6B6D', lineHeight: 1.4 }}>
          Parce que les bons moments méritent d'être partagés
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onShare() }}
        style={{
          flexShrink: 0,
          padding: '10px 14px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #e055aa, #f5a623)',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
          whiteSpace: 'normal',
          width: 80,
          border: 'none',
          cursor: 'pointer',
          lineHeight: 1.15,
        }}
      >
        Envoyer<br />le lien
      </button>
    </div>
  )
}
