import { MapPin } from 'lucide-react'

export default function EventInfoCard({ displayLocation, organizers, userId, eventId, onAddCoOrg }) {
  void eventId
  const sortedOrganizers = [...organizers].sort((a, b) => (a.role === 'owner' ? -1 : 1))
  const isOwner = organizers.eventOwnerId === userId

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MapPin size={17} strokeWidth={1.8} color="#8E8E93" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>Lieu</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1C1E', marginTop: 1 }}>{displayLocation || 'Lieu non précisé'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingTop: 10 }}>
        {sortedOrganizers.map(({ role, profile }) => {
          const name = profile?.first_name || profile?.name || 'Organisateur'
          const displayName = profile?.id === userId ? 'Moi' : name
          const owner = role === 'owner'
          return (
            <div key={profile?.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} style={{ width: 26, height: 26, borderRadius: 13, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 26, height: 26, borderRadius: 13, background: '#FBBF9A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{displayName}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: owner ? '#fff' : '#8E8E93', background: owner ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#F5F5F5', padding: '1px 7px', borderRadius: 20, display: 'inline-block', marginTop: 2 }}>
                  {owner ? 'Organisateur' : 'Co-organisateur'}
                </div>
              </div>
            </div>
          )
        })}
        {isOwner && organizers.length < 4 && (
          <button type="button" onClick={onAddCoOrg} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20, background: 'linear-gradient(135deg,#e055aa,#f5a623)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            + Ajouter
          </button>
        )}
      </div>
    </div>
  )
}
