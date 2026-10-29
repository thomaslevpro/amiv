import { GUEST_STATUS_META } from '../../lib/eventGuests'

export default function GuestStatusPill({ status }) {
  const meta = GUEST_STATUS_META[status] ?? GUEST_STATUS_META.pending
  return (
    <span style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 999, background: meta.bg, color: meta.text, fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  )
}
