import { useEffect, useState } from 'react'
import { Cake, Link2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const REMINDER_OPTIONS = [1, 3, 7, 14, 30]
const CONFETTI = [
  { left: '8%', w: 6, h: 6, r: 2, color: 'rgba(255,255,255,0.9)', dur: '2.1s', delay: '0s' },
  { left: '18%', w: 8, h: 3, r: 1, color: 'rgba(255,220,180,0.9)', dur: '2.6s', delay: '0.4s' },
  { left: '27%', w: 4, h: 8, r: 1, color: 'rgba(255,180,230,0.85)', dur: '1.9s', delay: '1.1s' },
  { left: '36%', w: 5, h: 5, r: 3, color: 'rgba(255,255,255,0.6)', dur: '3.0s', delay: '0.7s' },
  { left: '45%', w: 7, h: 3, r: 1, color: 'rgba(255,255,255,0.9)', dur: '2.3s', delay: '1.8s' },
  { left: '53%', w: 6, h: 6, r: 1, color: 'rgba(255,220,180,0.9)', dur: '2.8s', delay: '0.2s' },
  { left: '62%', w: 4, h: 9, r: 1, color: 'rgba(255,180,230,0.85)', dur: '2.0s', delay: '1.4s' },
  { left: '70%', w: 8, h: 4, r: 1, color: 'rgba(255,255,255,0.7)', dur: '3.1s', delay: '0.9s' },
  { left: '78%', w: 5, h: 5, r: 50, color: 'rgba(255,255,255,0.8)', dur: '2.4s', delay: '2.2s' },
  { left: '85%', w: 6, h: 3, r: 1, color: 'rgba(255,220,180,0.9)', dur: '1.8s', delay: '0.5s' },
  { left: '13%', w: 5, h: 8, r: 1, color: 'rgba(255,255,255,0.55)', dur: '2.7s', delay: '2.5s' },
  { left: '40%', w: 7, h: 7, r: 2, color: 'rgba(255,180,230,0.7)', dur: '3.2s', delay: '1.6s' },
  { left: '58%', w: 4, h: 4, r: 50, color: 'rgba(255,255,255,0.9)', dur: '2.2s', delay: '2.8s' },
  { left: '90%', w: 6, h: 9, r: 1, color: 'rgba(255,220,180,0.85)', dur: '2.5s', delay: '0.3s' },
]

function normalizeReminderDays(value) {
  if (Array.isArray(value)) return value.map(Number).filter(day => REMINDER_OPTIONS.includes(day))
  if (value != null) {
    const day = Number(value)
    return REMINDER_OPTIONS.includes(day) ? [day] : [7]
  }
  return [7]
}

function getLinkedProfile(birthday) {
  return birthday?.linked_profile ?? birthday?.profiles ?? null
}

function getBirthdayName(birthday) {
  const linkedProfile = getLinkedProfile(birthday)
  if (birthday?.linked_profile_id && linkedProfile) {
    return linkedProfile.first_name || linkedProfile.name || birthday.name || 'Amiv'
  }
  return birthday?.name || 'Amiv'
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function ReminderSheet({ birthday, onClose, onSaved, onToast }) {
  const [enabled, setEnabled] = useState(birthday.reminder_enabled ?? true)
  const [days, setDays] = useState(normalizeReminderDays(birthday.reminder_days))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEnabled(birthday.reminder_enabled ?? true)
    setDays(normalizeReminderDays(birthday.reminder_days))
  }, [birthday])

  function toggleDay(day) {
    setDays(current =>
      current.includes(day)
        ? current.filter(item => item !== day)
        : [...current, day].sort((a, b) => a - b)
    )
  }

  async function handleSave() {
    if (!birthday?.id) return
    setSaving(true)
    const payload = {
      reminder_enabled: enabled,
      reminder_days: days,
    }
    const { data, error } = await supabase
      .from('birthdays')
      .update(payload)
      .eq('id', birthday.id)
      .select('id, reminder_enabled, reminder_days')
      .maybeSingle()

    setSaving(false)
    if (error) {
      console.error('Erreur sauvegarde rappel anniversaire :', error)
      onToast?.('Erreur lors de la sauvegarde du rappel', true)
      return
    }

    onSaved?.(data ?? { id: birthday.id, ...payload })
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.28)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '82vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: '24px 24px 0 0',
          padding: '10px 16px 28px',
          boxShadow: '0 -12px 36px rgba(18,31,46,0.18)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        }}
      >
        <div style={{ width: 42, height: 5, borderRadius: 99, background: '#D9D9DE', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E' }}>Gérer le rappel</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 3 }}>{birthday.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              border: 'none',
              background: '#fff',
              color: '#8E8E93',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 5px rgba(0,0,0,0.08)',
            }}
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🎂</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>Rappel le jour J</div>
            <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Envoyé automatiquement à 8h</div>
          </div>
          <span style={{
            background: 'rgba(245,166,35,0.12)',
            color: '#f5a623',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            padding: '4px 10px',
            flexShrink: 0,
          }}>
            Actif
          </span>
        </div>

        <div style={{
          marginTop: 10,
          background: '#fff',
          borderRadius: 16,
          padding: '14px 16px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#8E8E93',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            Jours de rappel
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {REMINDER_OPTIONS.map(day => {
              const active = days.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 16px',
                    borderRadius: 20,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    background: active ? 'linear-gradient(90deg, #e055aa, #f5a623)' : '#F5F5F5',
                    color: active ? '#fff' : '#8E8E93',
                  }}
                >
                  J-{day}
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            marginTop: 14,
            border: 'none',
            borderRadius: 16,
            background: 'linear-gradient(135deg,#e055aa,#f5a623)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            padding: '14px 18px',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

export default function HeroBirthdayCard({ birthday, onReminderSaved, onToast }) {
  const [showReminderSheet, setShowReminderSheet] = useState(false)

  if (!birthday) {
    return (
      <div style={{
        background: '#fff', borderRadius: 20, padding: '28px 20px',
        textAlign: 'center', marginBottom: 16,
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      }}>
        <div style={{ marginBottom: 8 }}><Cake size={20} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#8E8E93' }}>
          Aucun anniversaire ce mois-ci
        </div>
      </div>
    )
  }

  const { birthdate, days } = birthday
  const linkedProfile = getLinkedProfile(birthday)
  const isLinked = Boolean(birthday.linked_profile_id)
  const displayName = getBirthdayName(birthday)
  const birthdayDate = new Date(birthdate)
  const age = new Date().getFullYear() - birthdayDate.getFullYear()
  const birthdayLabel = birthdayDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const birthdayDay = birthdayDate.getDate()
  const birthdayMonth = birthdayDate.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase().replace('.', '')
  const isToday = days === 0
  const eyebrow = isToday ? "ANNIVERSAIRE AUJOURD'HUI" : 'PROCHAIN ANNIVERSAIRE'
  const subtitle = isToday
    ? 'Souhaite-lui un joyeux anniversaire 🎂'
    : birthdayLabel
  const ageLabel = `${age} ans`

  return (
    <>
      <style>{`
        @keyframes amivBorderRotate {
          0%   { background-position: 0% 50% }
          50%  { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        @keyframes amivConfettiFall {
          0%   { transform: translateY(-8px) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.85; }
          85%  { opacity: 0.6; }
          100% { transform: translateY(110px) rotate(340deg); opacity: 0; }
        }
      `}</style>
      <div style={{
        padding: '2.5px',
        borderRadius: 22,
        background: 'linear-gradient(135deg, #e055aa, #f5a623, #ff9a3c, #e055aa)',
        backgroundSize: '300% 300%',
        animation: 'amivBorderRotate 2.8s ease infinite',
        marginBottom: 16,
      }}>
        <div
          onClick={() => setShowReminderSheet(true)}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'radial-gradient(circle at 86% 12%, rgba(255, 201, 112, 0.62) 0%, rgba(255, 160, 64, 0.26) 28%, rgba(255, 160, 64, 0) 48%), linear-gradient(135deg, #f06292 0%, #ff8a50 60%, #ffa040 100%)',
            borderRadius: 19,
            padding: '20px 18px',
            boxShadow: '0 4px 24px rgba(224,85,170,0.28)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {CONFETTI.map((c, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: '-8px',
              left: c.left,
              width: c.w,
              height: c.h,
              borderRadius: c.r,
              background: c.color,
              pointerEvents: 'none',
              animationName: 'amivConfettiFall',
              animationDuration: c.dur,
              animationDelay: c.delay,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in',
              opacity: 0,
            }} />
          ))}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Cake size={20} strokeWidth={1.5} /> {eyebrow}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isLinked && (
                  <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 800,
                      boxShadow: '0 2px 8px rgba(18,31,46,0.14)',
                    }}>
                      {linkedProfile?.avatar_url ? (
                        <img src={linkedProfile.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        getInitials(displayName)
                      )}
                    </div>
                    <div
                      aria-label="Profil lié"
                      title="Profil lié"
                      style={{
                        position: 'absolute',
                        right: -1,
                        bottom: -1,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg,#e055aa,#f5a623)',
                        border: '1.5px solid #fff',
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: '0 1px 4px rgba(18,31,46,0.18)',
                      }}
                    >
                      <Link2 size={8.5} color="#fff" strokeWidth={2.4} />
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{displayName}</div>
              </div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 5 }}>
                {subtitle}
                <br />
                {ageLabel}
              </div>
            </div>

            <div style={{
              width: 82.5,
              height: 82.5,
              borderRadius: 16,
              background: '#fff',
              boxShadow: '0 4px 14px rgba(18,31,46,0.14)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: '#f5a623' }}>{birthdayDay}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8E8E93', marginTop: 5 }}>
                {birthdayMonth}
              </span>
            </div>
          </div>

          {showReminderSheet && (
            <ReminderSheet
              birthday={birthday}
              onClose={() => setShowReminderSheet(false)}
              onSaved={onReminderSaved}
              onToast={onToast}
            />
          )}
        </div>
      </div>
    </>
  )
}
