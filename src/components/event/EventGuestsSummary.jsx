import { ChevronRight, X } from 'lucide-react'
import { countsFromGuests } from '../../lib/eventGuests'
import EventGuestsSection from './EventGuestsSection'
import GuestAvatar from './GuestAvatar'

const MAX_AVATARS = 3

function plural(count, singular, pluralForm) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

export function guestsSummaryLine(counts) {
  return [
    counts.confirmed > 0 && plural(counts.confirmed, 'confirmé', 'confirmés'),
    counts.pending > 0 && `${counts.pending} en attente`,
  ].filter(Boolean).join(' · ')
}

// Ligne résumée des invités ; un appui ouvre la liste complète (barre,
// compteurs, filtres, relance, +1) dans une feuille.
export default function EventGuestsSummary({ open, onOpen, onClose, sectionProps }) {
  const { guests, loading } = sectionProps
  const counts = countsFromGuests(guests)
  const shown = guests.slice(0, MAX_AVATARS)
  const extra = counts.total - shown.length
  const subtitle = loading && counts.total === 0 ? 'Chargement…' : guestsSummaryLine(counts) || 'Personne pour l’instant'

  return (
    <>
      <button type="button" onClick={onOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
        {shown.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {shown.map((guest, index) => (
              <span key={guest.guest_key} style={{ marginLeft: index ? -10 : 0, borderRadius: '50%', border: '2px solid #fff', display: 'flex' }}>
                <GuestAvatar name={guest.display_name} avatarUrl={guest.avatar_url} seed={guest.guest_key} size={36} />
              </span>
            ))}
            {extra > 0 && (
              <span style={{ marginLeft: -10, minWidth: 40, height: 40, padding: '0 6px', boxSizing: 'border-box', borderRadius: 20, border: '2px solid #fff', background: '#F2F2F7', color: '#6B6B72', fontSize: 13, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                +{extra}
              </span>
            )}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E' }}>{plural(counts.total, 'invité', 'invités')}</div>
          <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
        </div>
        <ChevronRight size={20} strokeWidth={2} color="#C7C7CC" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div role="dialog" aria-label="Invités" onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 430, maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: '24px 24px 0 0', padding: '10px 16px max(24px, env(safe-area-inset-bottom))', boxSizing: 'border-box', boxShadow: '0 -8px 36px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 32, marginBottom: 6 }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: '#D1D1D6' }} />
              <button type="button" onClick={onClose} aria-label="Fermer" style={{ position: 'absolute', right: 0, top: 0, width: 32, height: 32, borderRadius: 16, border: 'none', background: '#F2F2F7', color: '#8E8E93', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>
            <EventGuestsSection {...sectionProps} />
          </div>
        </div>
      )}
    </>
  )
}
