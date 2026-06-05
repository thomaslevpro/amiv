import { MapPin } from 'lucide-react'

export default function EventInfoCard({ displayLocation, organizers, userId, eventId, onAddCoOrg }) {
  void eventId
  const sortedOrganizers = [...organizers].sort((a, b) => (a.role === 'owner' ? -1 : 1))
  const isOwner = organizers.eventOwnerId === userId

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 150px', minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={17} strokeWidth={1.8} color="#8E8E93" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>Lieu</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLocation || 'Lieu non précisé'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flex: '0 1 auto', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            {sortedOrganizers.map(({ role, profile }) => {
              const name = profile?.first_name || profile?.name || 'Organisateur'
              const displayName = profile?.id === userId ? 'Moi' : name
              const owner = role === 'owner'
              return (
                <div key={profile?.id} title={owner ? 'Organisateur' : 'Co-organisateur'} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: 14, background: owner ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#FBBF9A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1C1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 86 }}>{displayName}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: owner ? '#e055aa' : '#8E8E93', marginTop: 1, whiteSpace: 'nowrap' }}>
                      {owner ? 'Organisateur' : 'Co-org'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {isOwner && organizers.length < 4 && (
            <button type="button" onClick={onAddCoOrg} style={{ width: 28, height: 28, borderRadius: 14, background: 'linear-gradient(135deg,#e055aa,#f5a623)', border: 'none', color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }} aria-label="Ajouter un co-organisateur">
              +
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
