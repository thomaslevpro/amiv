import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'
import { supabase } from '../../lib/supabase'
import { isNative } from '../../lib/native'
import { track } from '../../lib/analytics'
import { captureSupabaseError } from '../../lib/monitoring'

const CONFIRM_WORD = 'SUPPRIMER'

const DELETED_ITEMS = [
  'Ton profil, ta photo, tes amis et tes demandes d’amis',
  'Tes réponses aux invitations, tes dispos et les anniversaires que tu as enregistrés',
  'Tes souvenirs, tes photos et tes mots sur les cartes d’anniversaire',
  'Tes événements : transférés à ton co-organisateur s’il y en a un, sinon supprimés (les invités des événements à venir sont prévenus)',
]

const inputStyle = {
  width: '100%',
  padding: '14px 15px',
  borderRadius: 14,
  border: '1px solid #E5E5EA',
  background: '#fff',
  color: '#1C1C1E',
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: '0.06em',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function deletionErrorMessage(error) {
  if (error instanceof FunctionsFetchError) return 'Pas de connexion. Vérifie ton réseau et réessaie.'
  if (error instanceof FunctionsHttpError && error.context?.status === 401) return 'Ta session a expiré. Déconnecte-toi, reconnecte-toi, puis réessaie.'
  return 'La suppression n’a pas pu aboutir. Ton compte est toujours actif, réessaie dans un instant.'
}

export default function DeleteAccountModal({ isOpen, onClose }) {
  const [step, setStep] = useState('explain')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setStep('explain')
    setConfirmText('')
    setError(null)
  }, [isOpen])

  if (!isOpen) return null

  const canDelete = confirmText.trim() === CONFIRM_WORD && !deleting

  function close() {
    if (deleting) return
    onClose?.()
  }

  async function handleDelete() {
    if (!canDelete) return
    setDeleting(true)
    setError(null)

    const { error: invokeError } = await supabase.functions.invoke('delete-account', { method: 'POST' })

    if (invokeError) {
      captureSupabaseError(invokeError, { operation: 'delete_account' })
      setError(deletionErrorMessage(invokeError))
      setDeleting(false)
      return
    }

    track('account_deleted')
    // Le compte n'existe plus côté serveur : déconnexion locale uniquement.
    await supabase.auth.signOut({ scope: 'local' })
    if (isNative) {
      try {
        await Preferences.clear()
      } catch {
        // la session est déjà retirée par signOut
      }
    }
    // App.jsx reçoit SIGNED_OUT et affiche l'écran de connexion
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 700,
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 430,
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 24px)',
          overflowY: 'auto',
          background: '#F5F5F5',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px max(28px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.18)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E' }}>Supprimer mon compte</div>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            disabled={deleting}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: '#E5E5EA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: deleting ? 'default' : 'pointer',
              color: '#1C1C1E',
              opacity: deleting ? 0.65 : 1,
            }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {step === 'explain' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginBottom: 10 }}>Ce qui sera supprimé définitivement :</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DELETED_ITEMS.map(item => (
                  <li key={item} style={{ fontSize: 13, color: '#3A3A3C', lineHeight: 1.4 }}>{item}</li>
                ))}
              </ul>
              <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.4, marginTop: 12 }}>
                Tes messages restent visibles dans les conversations, signés « Utilisateur supprimé ».
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#FF3B30', fontWeight: 600, padding: '0 2px', lineHeight: 1.35 }}>
              Cette action est irréversible.
            </div>

            <button
              type="button"
              onClick={() => setStep('confirm')}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: 16,
                border: 'none',
                background: '#FF3B30',
                color: '#fff',
                fontSize: 17,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Continuer
            </button>
            <button
              type="button"
              onClick={close}
              style={{ width: '100%', padding: 12, border: 'none', background: 'transparent', color: '#8E8E93', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Annuler
            </button>
          </div>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); handleDelete() }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
              <label style={{ display: 'block', fontSize: 13, color: '#8E8E93', fontWeight: 600, marginBottom: 7, lineHeight: 1.35 }}>
                Pour confirmer, écris <strong style={{ color: '#1C1C1E' }}>{CONFIRM_WORD}</strong>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                disabled={deleting}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(255,59,48,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FF3B30', lineHeight: 1.35 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canDelete}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: 16,
                border: 'none',
                background: canDelete ? '#FF3B30' : '#C7C7CC',
                color: '#fff',
                fontSize: 17,
                fontWeight: 800,
                cursor: canDelete ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('explain'); setError(null) }}
              disabled={deleting}
              style={{ width: '100%', padding: 12, border: 'none', background: 'transparent', color: '#8E8E93', fontSize: 15, fontWeight: 600, cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.5 : 1 }}
            >
              Retour
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
