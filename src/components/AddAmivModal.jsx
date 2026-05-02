import { useState, useEffect } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SHARE_URL = 'https://amiv.app'

const baseInput = {
  border: '1.5px solid #F2F2F7',
  borderRadius: 12,
  padding: '13px 14px',
  fontSize: 15,
  outline: 'none',
  color: '#1C1C1E',
  background: '#FAFAFA',
  boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  WebkitAppearance: 'none',
}

export default function AddAmivModal({ onClose, onSaved, onToast }) {
  const [visible, setVisible] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [age, setAge] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    if (year.length === 4) {
      const y = parseInt(year, 10)
      const currentYear = new Date().getFullYear()
      if (y >= 1900 && y <= currentYear) {
        setAge(String(currentYear - y))
      } else {
        setAge('')
      }
    } else if (year === '') {
      setAge('')
    }
  }, [year])

  function close() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  async function handleSave(e) {
    e.preventDefault()
    const d = day.trim()
    const m = month.trim()
    if (!firstName.trim() || !d || !m) return

    const dd = d.padStart(2, '0')
    const mm = m.padStart(2, '0')
    const yyyy = year.length === 4 ? year : '2000'
    const birthdate = `${yyyy}-${mm}-${dd}`

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase
        .from('birthdays')
        .insert({ name: firstName.trim(), birthdate, reminder_days: [7], user_id: user.id })
      if (error) {
        console.error('Birthday save failed:', error)
        onToast?.('Erreur lors de la sauvegarde 😕', true)
        setSaving(false)
        return
      }
      onToast?.('Anniversaire ajouté ✓')
      onSaved?.()
      close()
    }
    setSaving(false)
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onToast?.('Lien copié !')
    } catch {
      // clipboard not available
    }
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ url: SHARE_URL, title: 'Amiv' }).catch(() => {})
    }
  }

  return (
    <>
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 301,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E5EA' }} />
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 0', flex: 1 }}>
          <div style={{
            fontSize: 20, fontWeight: 700, color: '#1C1C1E',
            textAlign: 'center', marginBottom: 24,
          }}>
            Ajouter un amiv 🎂
          </div>

          <form onSubmit={handleSave} id="add-amiv-form">
            {/* Prénom */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Prénom de ton amiv"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                autoFocus
                style={{ ...baseInput, width: '100%' }}
              />
            </div>

            {/* Date d'anniversaire */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93', marginBottom: 8, paddingLeft: 2 }}>
                Date d'anniversaire
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="JJ"
                  value={day}
                  onChange={e => setDay(e.target.value)}
                  min="1" max="31"
                  required
                  style={{ ...baseInput, flex: 1, textAlign: 'center', padding: '13px 6px' }}
                />
                <span style={{ color: '#C7C7CC', fontSize: 20, fontWeight: 200, flexShrink: 0 }}>/</span>
                <input
                  type="number"
                  placeholder="MM"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  min="1" max="12"
                  required
                  style={{ ...baseInput, flex: 1, textAlign: 'center', padding: '13px 6px' }}
                />
                <span style={{ color: '#C7C7CC', fontSize: 20, fontWeight: 200, flexShrink: 0 }}>/</span>
                <div style={{ flex: 2, position: 'relative' }}>
                  <input
                    type="number"
                    placeholder="AAAA"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    min="1900"
                    max={new Date().getFullYear()}
                    style={{ ...baseInput, width: '100%', textAlign: 'center', padding: '13px 6px' }}
                  />
                  <span style={{
                    position: 'absolute', top: -18, right: 2,
                    fontSize: 10, fontWeight: 600, color: '#AEAEB2',
                    letterSpacing: '0.04em',
                  }}>
                    optionnel
                  </span>
                </div>
              </div>
            </div>

            {/* Âge */}
            <div style={{ marginBottom: 20 }}>
              <input
                type="number"
                placeholder="Âge (optionnel)"
                value={age}
                onChange={e => setAge(e.target.value)}
                min="0" max="150"
                style={{ ...baseInput, width: '100%' }}
              />
            </div>
          </form>

          {/* Sharing section */}
          <div style={{
            background: '#F2F2F7', borderRadius: 16,
            padding: '14px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8E8E93', marginBottom: 10 }}>
              Inviter un amiv à rejoindre Amiv
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fff', borderRadius: 12, padding: '11px 14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                <span style={{ fontSize: 14, color: '#1C1C1E', fontWeight: 500 }}>amiv.app</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px', display: 'flex', alignItems: 'center' }}
                >
                  <Copy size={16} color={copied ? '#34C759' : '#8E8E93'} strokeWidth={2} />
                </button>
              </div>
              {navigator.share && (
                <button
                  type="button"
                  onClick={handleShare}
                  style={{
                    flexShrink: 0, background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                    border: 'none', cursor: 'pointer', borderRadius: 12,
                    padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 10px rgba(224,85,170,0.28)',
                  }}
                >
                  <Share2 size={15} color="#fff" strokeWidth={2} />
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Partager</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{
          padding: '14px 20px 36px', flexShrink: 0,
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          <button
            type="submit"
            form="add-amiv-form"
            disabled={saving}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
              cursor: saving ? 'default' : 'pointer',
              background: 'linear-gradient(135deg,#e055aa,#f5a623)',
              color: '#fff', fontSize: 16, fontWeight: 700,
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 18px rgba(224,85,170,0.32)',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={close}
            style={{
              width: '100%', padding: '12px 0', marginTop: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8E8E93', fontSize: 15, fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </>
  )
}
