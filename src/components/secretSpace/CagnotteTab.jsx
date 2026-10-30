import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Check, Copy, ExternalLink, Pencil, Sparkles, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { captureSupabaseError } from '../../lib/monitoring'
import { fetchCagnotteSummary, formatEuros } from '../../lib/secretSpace'
import {
  cleanPaymentMethod,
  CONTRIBUTION_METHOD_LABELS,
  CONTRIBUTION_METHODS,
  copyText,
  formatDeadline,
  PAYMENT_METHOD_META,
  PAYMENT_METHOD_TYPES,
  paymentAction,
  suggestedAmount,
} from '../../lib/cagnottePayment'
import { COLORS, EmptyCard, Input, PrimaryButton, Sheet } from './ui'

const CARD = { background: COLORS.card, borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }
const SECTION_LABEL = { fontSize: 11, fontWeight: 700, color: COLORS.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }
const NO_PAYMENT_DISCLAIMER = 'Amiv ne gère aucun paiement. Les échanges d’argent se font directement entre vous.'

function money(value) {
  if (value === null || value === undefined || value === '') return null
  return formatEuros(value)
}

function firstWord(name, fallback) {
  return String(name || '').trim().replace(/^@/, '').split(/\s+/)[0] || fallback
}

function emptySetupForm(info) {
  const byType = Object.fromEntries((info?.methods ?? []).map(method => [method.type, method]))
  return {
    enabled: Object.fromEntries(PAYMENT_METHOD_TYPES.map(type => [type, !!byType[type]])),
    values: Object.fromEntries(PAYMENT_METHOD_TYPES.map(type => [type, byType[type]?.value ?? ''])),
    holder: byType.virement?.holder ?? '',
    amountMode: info?.split_goal ? 'split' : info?.suggested_amount ? 'fixed' : 'none',
    amount: info?.suggested_amount ? String(Number(info.suggested_amount)) : '',
    deadline: info?.deadline ?? '',
    message: info?.message ?? '',
  }
}

// Onglet Cagnotte de l'espace secret. Coordinateur = organisateur,
// co-organisateur ou coordinateur approuvé (can_manage_cagnotte côté serveur).
export default function CagnotteTab({ eventId, currentUserId, canManage, isOrganizer, roleLoading, members, collectiveGifts, onToast }) {
  const [loaded, setLoaded] = useState(false)
  const [cagnotte, setCagnotte] = useState(null)
  const [info, setInfo] = useState(null)
  const [contributions, setContributions] = useState([])
  const [summary, setSummary] = useState({ participants: 0, total: 0 })
  const [error, setError] = useState('')

  const [cagnotteForm, setCagnotteForm] = useState(null)
  const [setupForm, setSetupForm] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [declareForm, setDeclareForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copiedType, setCopiedType] = useState(null)

  const memberById = useMemo(() => new Map(members.map(member => [member.user_id, member])), [members])
  const participantCount = useMemo(() => members.filter(member => member.status === 'confirmed').length, [members])
  const myContribution = contributions.find(contribution => contribution.user_id === currentUserId) ?? null
  const isRecipient = !!info && info.recipient_id === currentUserId
  const recipientName = info ? firstWord(memberById.get(info.recipient_id)?.name, 'le coordinateur') : null
  const suggestion = suggestedAmount(info, cagnotte?.goal, participantCount)
  const receivedTotal = contributions.filter(contribution => contribution.received).reduce((sum, contribution) => sum + (Number(contribution.amount) || 0), 0)

  const load = useCallback(async () => {
    const [cagnotteRes, infoRes, contributionsRes] = await Promise.all([
      supabase.from('event_cagnottes').select('url, goal, gift_id').eq('event_id', eventId).maybeSingle(),
      supabase.from('event_cagnotte_payment_info').select('recipient_id, methods, suggested_amount, split_goal, deadline, message').eq('event_id', eventId).maybeSingle(),
      // Les siennes, ou toutes pour un coordinateur (RLS)
      supabase.from('cagnotte_contributions').select('id, user_id, amount, method, received, created_at').eq('event_id', eventId).order('created_at', { ascending: true }),
    ])
    const loadError = cagnotteRes.error || infoRes.error || contributionsRes.error
    if (loadError) throw loadError
    setCagnotte(cagnotteRes.data ?? null)
    setInfo(infoRes.data ?? null)
    setContributions(contributionsRes.data ?? [])
    setSummary(await fetchCagnotteSummary(eventId))
  }, [eventId])

  const refresh = useCallback(() => load().catch(loadError => {
    captureSupabaseError(loadError, { operation: 'load_cagnotte_tab' })
    setError('Impossible de charger la cagnotte.')
  }).finally(() => setLoaded(true)), [load])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refresh])

  async function ensureCagnotte() {
    if (cagnotte) return true
    const { error: insertError } = await supabase.from('event_cagnottes').insert({ event_id: eventId })
    if (insertError) {
      captureSupabaseError(insertError, { operation: 'create_cagnotte' })
      return false
    }
    return true
  }

  // ── Cagnotte (objectif, lien, cadeau) ────────────────────────────────────
  function openCagnotteForm() {
    setCagnotteForm({ url: cagnotte?.url ?? '', goal: cagnotte?.goal ?? '', giftId: cagnotte?.gift_id ?? '' })
  }

  async function handleCagnotteSubmit(submitEvent) {
    submitEvent.preventDefault()
    if (saving) return
    const rawUrl = cagnotteForm.url.trim()
    const next = {
      url: rawUrl ? (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`) : null,
      goal: cagnotteForm.goal === '' ? null : Number(cagnotteForm.goal),
      gift_id: cagnotteForm.giftId || null,
    }
    setSaving(true)
    const { error: saveError } = cagnotte
      ? await supabase.from('event_cagnottes').update(next).eq('event_id', eventId)
      : await supabase.from('event_cagnottes').insert({ event_id: eventId, ...next })
    setSaving(false)
    if (saveError) {
      captureSupabaseError(saveError, { operation: 'save_cagnotte' })
      onToast('Impossible d’enregistrer la cagnotte.', true)
      return
    }
    setCagnotteForm(null)
    await refresh()
  }

  // ── « Comment me payer » ─────────────────────────────────────────────────
  function openSetup() {
    setSetupForm(emptySetupForm(isRecipient ? info : null))
    setSetupError('')
    setConfirmRemove(false)
  }

  async function handleSetupSubmit(submitEvent) {
    submitEvent.preventDefault()
    if (saving) return
    const methods = []
    for (const type of PAYMENT_METHOD_TYPES) {
      if (!setupForm.enabled[type]) continue
      const { method, error: methodError } = cleanPaymentMethod(type, setupForm.values[type], setupForm.holder)
      if (methodError) { setSetupError(methodError); return }
      methods.push(method)
    }
    if (methods.length === 0) { setSetupError('Choisis au moins un moyen de paiement.'); return }
    const amount = setupForm.amountMode === 'fixed' ? Number(setupForm.amount) : null
    if (setupForm.amountMode === 'fixed' && !(amount > 0)) { setSetupError('Indique un montant suggéré, ou choisis une autre option.'); return }
    const payload = {
      methods,
      suggested_amount: amount,
      split_goal: setupForm.amountMode === 'split',
      deadline: setupForm.deadline || null,
      message: setupForm.message.trim() || null,
    }
    setSaving(true)
    if (!(await ensureCagnotte())) {
      setSaving(false)
      setSetupError('Impossible de préparer la cagnotte.')
      return
    }
    const { error: saveError } = info
      ? await supabase.from('event_cagnotte_payment_info').update(payload).eq('event_id', eventId)
      : await supabase.from('event_cagnotte_payment_info').insert({ event_id: eventId, ...payload })
    setSaving(false)
    if (saveError) {
      captureSupabaseError(saveError, { operation: 'save_cagnotte_payment_info' })
      setSetupError('Impossible d’enregistrer ces infos. Vérifie les coordonnées.')
      return
    }
    setSetupForm(null)
    onToast(info ? 'Infos de paiement mises à jour' : 'Infos ajoutées · annoncé dans la discussion secrète')
    await refresh()
  }

  async function handleSetupRemove() {
    if (saving) return
    setSaving(true)
    const { error: removeError } = await supabase.from('event_cagnotte_payment_info').delete().eq('event_id', eventId)
    setSaving(false)
    if (removeError) {
      captureSupabaseError(removeError, { operation: 'delete_cagnotte_payment_info' })
      onToast('Impossible de retirer ces infos.', true)
      return
    }
    setSetupForm(null)
    onToast('Infos de paiement retirées')
    await refresh()
  }

  // ── « J'ai participé » ───────────────────────────────────────────────────
  function openDeclare() {
    const offered = info?.methods?.map(method => method.type) ?? []
    setDeclareForm({
      amount: myContribution?.amount != null ? String(myContribution.amount) : suggestion ? String(Math.round(suggestion.amount)) : '',
      method: myContribution?.method ?? (offered.length === 1 ? offered[0] : ''),
    })
  }

  async function handleDeclareSubmit(submitEvent) {
    submitEvent.preventDefault()
    if (saving || !currentUserId) return
    const amount = Math.round(Number(declareForm.amount))
    if (!(amount > 0) || !declareForm.method) return
    setSaving(true)
    const { error: saveError } = myContribution
      ? await supabase.from('cagnotte_contributions').update({ amount, method: declareForm.method }).eq('id', myContribution.id)
      : await supabase.from('cagnotte_contributions').insert({ event_id: eventId, user_id: currentUserId, amount, method: declareForm.method })
    setSaving(false)
    if (saveError) {
      captureSupabaseError(saveError, { operation: 'save_cagnotte_contribution' })
      onToast('Impossible d’enregistrer ta participation.', true)
      return
    }
    setDeclareForm(null)
    onToast(myContribution ? 'Participation modifiée' : 'Participation notée ✓')
    await refresh()
  }

  async function handleDeclareRemove() {
    if (!myContribution || saving) return
    setSaving(true)
    const { error: removeError } = await supabase.from('cagnotte_contributions').delete().eq('id', myContribution.id)
    setSaving(false)
    if (removeError) {
      captureSupabaseError(removeError, { operation: 'delete_cagnotte_contribution' })
      onToast('Impossible de retirer ta participation.', true)
      return
    }
    setDeclareForm(null)
    await refresh()
  }

  async function toggleReceived(contribution) {
    const received = !contribution.received
    setContributions(prev => prev.map(row => (row.id === contribution.id ? { ...row, received } : row)))
    const { error: updateError } = await supabase.from('cagnotte_contributions').update({ received }).eq('id', contribution.id)
    if (updateError) {
      captureSupabaseError(updateError, { operation: 'toggle_cagnotte_received' })
      onToast('Impossible de mettre à jour.', true)
      await refresh()
    }
  }

  async function handleCopy(method) {
    const action = paymentAction(method)
    if (action.kind !== 'copy') return
    const ok = await copyText(action.text)
    if (!ok) { onToast('Copie impossible : sélectionne le texte à la main.', true); return }
    setCopiedType(method.type)
    window.setTimeout(() => setCopiedType(current => (current === method.type ? null : current)), 1800)
  }

  if (!loaded || roleLoading) return <EmptyCard>Chargement...</EmptyCard>
  if (error && !cagnotte && !info) return <EmptyCard>{error}</EmptyCard>

  // ── Pas encore de cagnotte ───────────────────────────────────────────────
  if (!cagnotte) {
    if (!canManage) return <EmptyCard>La cagnotte n'a pas encore été créée.</EmptyCard>
    return (
      <>
        <div style={CARD}>
          <h2 style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>Préparer la cagnotte</h2>
          <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.4, marginBottom: 14 }}>
            Indique comment t’envoyer l’argent, ou ajoute le lien d’une cagnotte en ligne.
          </p>
          <PrimaryButton onClick={openSetup}><Wallet size={17} /> Comment me payer</PrimaryButton>
          <button type="button" onClick={openCagnotteForm} style={{ width: '100%', minHeight: 44, marginTop: 10, borderRadius: 14, border: `1.5px solid ${COLORS.line}`, background: COLORS.card, color: COLORS.text, fontSize: 14, fontWeight: 800 }}>
            Objectif et lien de cagnotte
          </button>
        </div>
        <Disclaimer />
        {renderSheets()}
      </>
    )
  }

  return (
    <>
      {info ? renderParticipateCard() : canManage ? (
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>Comment t’envoyer l’argent ?</div>
          <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.4 }}>Ajoute tes moyens de paiement : les participants verront une carte « Participer ».</div>
          <PrimaryButton onClick={openSetup}><Wallet size={17} /> Comment me payer</PrimaryButton>
        </div>
      ) : null}

      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 15, background: 'rgba(245,166,35,0.15)', color: COLORS.orange, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 900 }}>Cagnotte</h2>
            {cagnotte.goal && <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700, marginTop: 2 }}>Objectif : {money(cagnotte.goal)}</div>}
          </div>
          {canManage && (
            <button type="button" aria-label="Modifier la cagnotte" onClick={openCagnotteForm} style={{ width: 34, height: 34, borderRadius: 17, background: COLORS.bg, color: COLORS.muted, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Pencil size={15} />
            </button>
          )}
        </div>
        <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 800, marginTop: 14 }}>
          {summary.participants > 0
            ? <>{summary.participants} participant{summary.participants > 1 ? 's' : ''}{summary.total > 0 && <> · {money(summary.total)} collectés</>}</>
            : 'Aucune participation pour le moment'}
        </div>
        {cagnotte.goal > 0 && summary.total > 0 && (
          <div style={{ height: 6, borderRadius: 3, background: COLORS.bg, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.round((summary.total / cagnotte.goal) * 100))}%`, height: '100%', background: COLORS.gradient }} />
          </div>
        )}
        {cagnotte.url && (
          <a href={cagnotte.url} target="_blank" rel="noreferrer" style={{ minHeight: 46, marginTop: 14, borderRadius: 14, background: COLORS.gradient, color: '#fff', fontSize: 14, fontWeight: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
            Accéder à la cagnotte en ligne <ExternalLink size={17} />
          </a>
        )}
        {!info && renderMyDeclaration()}
        {canManage && info && !isRecipient && (
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 12, lineHeight: 1.4 }}>
            {recipientName} reçoit l’argent : seul·e {recipientName} peut modifier ses infos de paiement.
            {isOrganizer && <> <button type="button" onClick={openSetup} style={{ color: COLORS.pink, fontWeight: 800, fontSize: 12 }}>Gérer</button></>}
          </div>
        )}
        {isRecipient && (
          <button type="button" onClick={openSetup} style={{ width: '100%', minHeight: 42, marginTop: 12, borderRadius: 14, border: `1.5px solid ${COLORS.line}`, background: COLORS.card, color: COLORS.text, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Wallet size={15} /> Comment me payer
          </button>
        )}
      </div>

      {canManage && contributions.length > 0 && (
        <div>
          <div style={{ ...SECTION_LABEL, marginBottom: 10, padding: '0 2px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Participations déclarées</span>
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>{money(receivedTotal) ?? '0 €'} reçus</span>
          </div>
          <div style={{ background: COLORS.card, borderRadius: 16, overflow: 'hidden' }}>
            {contributions.map((contribution, index) => {
              const name = contribution.user_id === currentUserId ? 'Toi' : firstWord(memberById.get(contribution.user_id)?.name, 'Invité')
              return (
                <div key={contribution.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px' }}>
                  {index > 0 && <div style={{ position: 'absolute', top: 0, left: 12, right: 0, height: 0.5, background: COLORS.line }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                      {[money(contribution.amount), CONTRIBUTION_METHOD_LABELS[contribution.method]].filter(Boolean).join(' · ') || 'Montant non indiqué'}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={contribution.received}
                    onClick={() => toggleReceived(contribution)}
                    style={{ minHeight: 32, borderRadius: 999, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, background: contribution.received ? 'rgba(52,199,89,0.14)' : COLORS.bg, color: contribution.received ? '#1e7a35' : COLORS.muted, border: contribution.received ? '1px solid rgba(52,199,89,0.35)' : `1px solid ${COLORS.line}`, flexShrink: 0 }}
                  >
                    {contribution.received && <Check size={13} strokeWidth={2.8} />}
                    Reçu
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!info && <Disclaimer />}
      {renderSheets()}
    </>
  )

  function renderParticipateCard() {
    const deadline = formatDeadline(info.deadline)
    return (
      <div>
        <div style={{ ...CARD, border: '1.5px solid rgba(224,85,170,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900 }}>Participer</h2>
            {deadline && <span style={{ fontSize: 12, fontWeight: 800, color: '#A76500', background: '#FFF3E0', borderRadius: 999, padding: '4px 9px', flexShrink: 0 }}>Avant le {deadline}</span>}
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
            {isRecipient ? 'Les participants t’envoient l’argent directement.' : `Envoie ta participation à ${recipientName}.`}
          </div>

          {suggestion && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: COLORS.text }}>{money(suggestion.amount)}</span>
              <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>
                par personne{suggestion.split ? ` (${money(suggestion.goal)} ÷ ${suggestion.count})` : ' suggérés'}
              </span>
            </div>
          )}

          {info.message && (
            <div style={{ marginTop: 12, background: COLORS.bg, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, color: COLORS.text }}>
              <span style={{ fontWeight: 800 }}>{recipientName} : </span>{info.message}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {info.methods.map(method => renderMethod(method))}
          </div>

          {renderMyDeclaration()}
        </div>
        <Disclaimer />
      </div>
    )
  }

  function renderMethod(method) {
    const meta = PAYMENT_METHOD_META[method.type]
    const action = paymentAction(method)
    const label = (
      <span style={{ width: 64, flexShrink: 0, fontSize: 12, fontWeight: 900, color: meta.color, background: meta.bg, borderRadius: 8, padding: '5px 0', textAlign: 'center' }}>{meta.label}</span>
    )
    if (action.kind === 'cash') {
      return (
        <div key={method.type} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 10px', borderRadius: 12, border: `1px solid ${COLORS.line}` }}>
          {label}
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Banknote size={15} color={COLORS.muted} /> À remettre à {isRecipient ? 'toi' : recipientName}
          </span>
        </div>
      )
    }
    const detail = method.type === 'virement'
      ? <><span style={{ display: 'block', fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>{method.holder}</span><span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>{method.value}</span></>
      : <span style={{ fontSize: 13 }}>{method.value.replace(/^https:\/\/(www\.)?/, '')}</span>
    return (
      <div key={method.type} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 6px 6px 10px', borderRadius: 12, border: `1px solid ${COLORS.line}` }}>
        {label}
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: COLORS.text, overflowWrap: 'anywhere', userSelect: 'text', WebkitUserSelect: 'text' }}>{detail}</span>
        {action.kind === 'link' ? (
          <a href={action.href} target="_blank" rel="noreferrer" style={{ minHeight: 34, borderRadius: 10, padding: '0 11px', background: COLORS.gradient, color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none', flexShrink: 0 }}>
            Ouvrir <ExternalLink size={13} />
          </a>
        ) : (
          <button type="button" onClick={() => handleCopy(method)} style={{ minHeight: 34, minWidth: 82, borderRadius: 10, padding: '0 11px', background: copiedType === method.type ? 'rgba(52,199,89,0.14)' : COLORS.bg, color: copiedType === method.type ? '#1e7a35' : COLORS.text, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0 }}>
            {copiedType === method.type ? <><Check size={13} strokeWidth={2.8} /> Copié</> : <><Copy size={13} /> Copier</>}
          </button>
        )}
      </div>
    )
  }

  function renderMyDeclaration() {
    if (myContribution) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(52,199,89,0.08)' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#1e7a35', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Check size={16} strokeWidth={2.6} style={{ flexShrink: 0 }} />
            <span>
              Tu as participé{myContribution.amount ? ` · ${money(myContribution.amount)}` : ''}{myContribution.method ? ` · ${CONTRIBUTION_METHOD_LABELS[myContribution.method]}` : ''}
              {myContribution.received && <span style={{ display: 'block', fontWeight: 600, fontSize: 12 }}>Reçu par {isRecipient ? 'toi' : recipientName ?? 'le coordinateur'}</span>}
            </span>
          </span>
          <button type="button" onClick={openDeclare} style={{ color: COLORS.muted, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>Modifier</button>
        </div>
      )
    }
    if (isRecipient) return null
    return (
      <PrimaryButton onClick={openDeclare} style={{ marginTop: 14 }}>J’ai participé</PrimaryButton>
    )
  }

  function renderSheets() {
    return (
      <>
        {cagnotteForm && (
          <Sheet title="Cagnotte" onClose={() => { if (!saving) setCagnotteForm(null) }}>
            <form onSubmit={handleCagnotteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <Input label="Objectif (facultatif)" type="number" inputMode="decimal" min="0" step="1" value={cagnotteForm.goal} onChange={changeEvent => setCagnotteForm(form => ({ ...form, goal: changeEvent.target.value }))} placeholder="150 €" />
              <Input label="Lien d’une cagnotte en ligne (facultatif)" type="text" value={cagnotteForm.url} onChange={changeEvent => setCagnotteForm(form => ({ ...form, url: changeEvent.target.value }))} placeholder="https://..." />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>Cadeau associé</span>
                <select value={cagnotteForm.giftId} onChange={changeEvent => setCagnotteForm(form => ({ ...form, giftId: changeEvent.target.value }))} style={{ width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '12px 13px', fontSize: 14, color: COLORS.text, background: COLORS.card, outline: 'none' }}>
                  <option value="">Aucun cadeau</option>
                  {collectiveGifts.map(gift => <option key={gift.id} value={gift.id}>{gift.name}</option>)}
                </select>
              </label>
              <PrimaryButton disabled={saving} type="submit">{saving ? 'Enregistrement...' : cagnotte ? 'Enregistrer' : 'Créer la cagnotte'}</PrimaryButton>
            </form>
          </Sheet>
        )}

        {setupForm && (
          <Sheet title="Comment me payer" onClose={() => { if (!saving) setSetupForm(null) }}>
            {info && !isRecipient ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, lineHeight: 1.45, color: COLORS.text }}>
                  {recipientName} a déjà indiqué comment lui envoyer l’argent. Tu peux retirer ses infos pour mettre les tiennes.
                </div>
                {confirmRemove ? (
                  <PrimaryButton disabled={saving} onClick={handleSetupRemove} style={{ background: COLORS.red }}>Confirmer le retrait</PrimaryButton>
                ) : (
                  <button type="button" onClick={() => setConfirmRemove(true)} style={{ minHeight: 44, borderRadius: 14, background: 'rgba(255,59,48,0.08)', color: COLORS.red, fontSize: 14, fontWeight: 800 }}>Retirer les infos de {recipientName}</button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSetupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '72dvh', overflowY: 'auto', paddingBottom: 2 }}>
                <div style={SECTION_LABEL}>Moyens de paiement</div>
                {PAYMENT_METHOD_TYPES.map(type => {
                  const meta = PAYMENT_METHOD_META[type]
                  const enabled = setupForm.enabled[type]
                  return (
                    <div key={type} style={{ borderRadius: 12, border: `1px solid ${enabled ? 'rgba(224,85,170,0.35)' : COLORS.line}`, padding: '9px 10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={enabled} onChange={() => setSetupForm(form => ({ ...form, enabled: { ...form.enabled, [type]: !form.enabled[type] } }))} style={{ width: 18, height: 18, accentColor: COLORS.pink }} />
                        <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{meta.label}</span>
                      </label>
                      {enabled && type !== 'especes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
                          {type === 'virement' && (
                            <input value={setupForm.holder} onChange={changeEvent => setSetupForm(form => ({ ...form, holder: changeEvent.target.value }))} placeholder="Nom du titulaire" autoComplete="name" style={setupInputStyle} />
                          )}
                          <input
                            value={setupForm.values[type]}
                            onChange={changeEvent => setSetupForm(form => ({ ...form, values: { ...form.values, [type]: changeEvent.target.value } }))}
                            placeholder={meta.placeholder}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            style={setupInputStyle}
                          />
                          {(type === 'wero' || (type === 'lydia' && !/^https?:|lydia/i.test(setupForm.values[type]))) && (
                            <span style={{ fontSize: 11, color: COLORS.muted }}>Les participants pourront le copier.</span>
                          )}
                        </div>
                      )}
                      {enabled && type === 'especes' && (
                        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>« À te remettre en main propre »</div>
                      )}
                    </div>
                  )
                })}

                <div style={{ ...SECTION_LABEL, marginTop: 4 }}>Montant suggéré par personne</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { id: 'none', label: 'Aucun' },
                    { id: 'fixed', label: 'Montant fixe' },
                    { id: 'split', label: 'Objectif ÷ invités', disabled: !(Number(cagnotte?.goal) > 0) },
                  ].map(option => (
                    <button key={option.id} type="button" disabled={option.disabled} onClick={() => setSetupForm(form => ({ ...form, amountMode: option.id }))} style={{ minHeight: 40, borderRadius: 10, fontSize: 12, fontWeight: 800, padding: '0 4px', background: setupForm.amountMode === option.id ? COLORS.text : COLORS.bg, color: setupForm.amountMode === option.id ? '#fff' : option.disabled ? '#C7C7CC' : COLORS.text }}>
                      {option.label}
                    </button>
                  ))}
                </div>
                {setupForm.amountMode === 'fixed' && (
                  <Input label="Montant (€)" type="number" inputMode="decimal" min="1" step="1" value={setupForm.amount} onChange={changeEvent => setSetupForm(form => ({ ...form, amount: changeEvent.target.value }))} placeholder="25" />
                )}
                {setupForm.amountMode === 'split' && (
                  <div style={{ fontSize: 12, color: COLORS.muted }}>
                    {participantCount > 0 ? `Soit ${money(Math.ceil(Number(cagnotte.goal) / participantCount))} (${money(cagnotte.goal)} ÷ ${participantCount} invités confirmés), recalculé automatiquement.` : 'Calculé dès qu’un invité aura confirmé.'}
                  </div>
                )}
                {!(Number(cagnotte?.goal) > 0) && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: -4 }}>Ajoute un objectif à la cagnotte pour le calcul automatique.</div>}

                <Input label="Date limite (facultative)" type="date" value={setupForm.deadline} min={new Date().toISOString().slice(0, 10)} onChange={changeEvent => setSetupForm(form => ({ ...form, deadline: changeEvent.target.value }))} />

                <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>Petit message (facultatif)</span>
                  <textarea value={setupForm.message} maxLength={280} rows={2} onChange={changeEvent => setSetupForm(form => ({ ...form, message: changeEvent.target.value }))} placeholder="Pour le cadeau commun, merci avant le 15 !" style={{ ...setupInputStyle, resize: 'none' }} />
                </label>

                <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
                  Visible uniquement par les invités de l’espace secret, jamais par la personne fêtée. Supprimé automatiquement 30 jours après l’anniversaire.
                </div>
                {setupError && <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 700 }}>{setupError}</div>}
                <PrimaryButton disabled={saving} type="submit">{saving ? 'Enregistrement...' : 'Enregistrer'}</PrimaryButton>
                {isRecipient && (confirmRemove ? (
                  <PrimaryButton disabled={saving} onClick={handleSetupRemove} style={{ background: COLORS.red }}>Confirmer le retrait</PrimaryButton>
                ) : (
                  <button type="button" onClick={() => setConfirmRemove(true)} style={{ minHeight: 42, borderRadius: 14, color: COLORS.red, fontSize: 13, fontWeight: 800 }}>Retirer ces infos</button>
                ))}
              </form>
            )}
          </Sheet>
        )}

        {declareForm && (
          <Sheet title="J’ai participé" onClose={() => { if (!saving) setDeclareForm(null) }}>
            <form onSubmit={handleDeclareSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input autoFocus label="Montant envoyé (€)" type="number" inputMode="numeric" min="1" step="1" value={declareForm.amount} onChange={changeEvent => setDeclareForm(form => ({ ...form, amount: changeEvent.target.value }))} placeholder="€" />
              <div>
                <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, marginBottom: 6 }}>Moyen utilisé</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(info ? [...info.methods.map(method => method.type), 'autre'] : CONTRIBUTION_METHODS).map(type => (
                    <button key={type} type="button" onClick={() => setDeclareForm(form => ({ ...form, method: type }))} style={{ minHeight: 36, borderRadius: 999, padding: '0 13px', fontSize: 13, fontWeight: 800, background: declareForm.method === type ? COLORS.text : COLORS.bg, color: declareForm.method === type ? '#fff' : COLORS.text }}>
                      {CONTRIBUTION_METHOD_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.4 }}>
                C’est déclaratif : Amiv ne vérifie aucun paiement. Seuls toi et les coordinateurs voient ton montant ; les autres voient le total.
              </div>
              <PrimaryButton disabled={saving || !(Number(declareForm.amount) > 0) || !declareForm.method} type="submit">
                {saving ? 'Enregistrement...' : myContribution ? 'Enregistrer' : 'Valider'}
              </PrimaryButton>
              {myContribution && (
                <button type="button" disabled={saving} onClick={handleDeclareRemove} style={{ minHeight: 40, color: COLORS.red, fontSize: 13, fontWeight: 800 }}>Retirer ma participation</button>
              )}
            </form>
          </Sheet>
        )}
      </>
    )
  }
}

const setupInputStyle = { width: '100%', border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 16, color: COLORS.text, background: COLORS.card, outline: 'none' }

function Disclaimer() {
  return (
    <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.4, textAlign: 'center', padding: '10px 8px 0' }}>
      {NO_PAYMENT_DISCLAIMER}
    </div>
  )
}
