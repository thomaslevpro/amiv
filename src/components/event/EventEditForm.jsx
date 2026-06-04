import { supabase } from '../../lib/supabase'
import { birthdayFriendInitial, birthdayFriendName } from './eventUtils'

export default function EventEditForm({
  event,
  editForm,
  setEditForm,
  friends,
  birthdayPersonId,
  onToggleBirthdayPerson,
  coverPreview,
  setCoverFile,
  setCoverPreview,
  saving,
  onSubmit,
  onCancel,
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8E8E93', marginBottom: 12 }}>
        Modifier l'événement
      </div>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Titre</div>
          <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 6 }}>
            Personne fêtée <span style={{ color: '#AEAEB2' }}>(optionnel)</span>
          </div>
          {friends.length === 0 ? (
            <div style={{ fontSize: 13, color: '#8E8E93' }}>Ajoute des amis pour les sélectionner ici</div>
          ) : (
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 2px' }}>
              {friends.map(friend => {
                const selected = birthdayPersonId === friend.id
                const name = birthdayFriendName(friend)
                return (
                  <div key={friend.id} onClick={() => onToggleBirthdayPerson(friend.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0, width: 58 }}>
                    <div style={{ position: 'relative' }}>
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: selected ? '0 0 0 2px #e055aa' : 'none' }} />
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FBBF9A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, boxShadow: selected ? '0 0 0 2px #e055aa' : 'none' }}>
                          {birthdayFriendInitial(friend)}
                        </div>
                      )}
                      {selected && (
                        <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                          ✓
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#1C1C1E', maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Date</div>
          <input type="datetime-local" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Lieu</div>
          <input type="text" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Description</div>
          <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', color: '#1C1C1E', resize: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginBottom: 8 }}>Photo de couverture</div>
          {(coverPreview || event.cover_image) && (
            <img src={coverPreview || supabase.storage.from('event-covers').getPublicUrl(event.cover_image).data.publicUrl} alt="cover preview" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
          )}
          <label style={{ display: 'block', width: '100%', padding: '11px', borderRadius: 10, background: '#F5F5F5', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#1C1C1E', cursor: 'pointer', boxSizing: 'border-box' }}>
            {coverPreview ? '🖼 Changer la photo' : event.cover_image ? '🖼 Remplacer la photo' : '📷 Ajouter une photo'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                setCoverFile(file)
                setCoverPreview(URL.createObjectURL(file))
              }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#F5F5F5', color: '#8E8E93', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Annuler
          </button>
          <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#e055aa,#f5a623)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}
