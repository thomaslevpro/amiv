import { useState } from 'react'

// Pages publiques /cgu, /confidentialite et /support, ouvertes depuis le
// Profil et l'écran d'inscription (navigateur intégré sur natif).
// Contenu provisoire : le texte définitif reste à rédiger.

const COLORS = {
  text: '#1C1C1E',
  secondary: '#8E8E93',
  page: '#FFFFFF',
  gradient: 'linear-gradient(135deg,#e055aa,#f5a623)',
}

export const SUPPORT_EMAIL = 'contact@amiv.app'

function LegalLayout({ title, children }) {
  return (
    <div style={{ height: '100%', flex: 1, minHeight: 0, background: COLORS.page, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", color: COLORS.text, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 680, padding: 'calc(28px + env(safe-area-inset-top, 0px)) 20px calc(40px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
        <a href="/" style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, background: COLORS.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
          Amiv
        </a>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '18px 0 14px', lineHeight: 1.2 }}>{title}</h1>
        {children}
      </div>
    </div>
  )
}

function DraftNotice() {
  return (
    <div style={{ background: '#FFF4E5', color: '#A05A00', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 700, marginBottom: 22 }}>
      À compléter : contenu provisoire, la version définitive sera publiée prochainement.
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: '#3A3A3C' }}>{children}</div>
    </section>
  )
}

function Contact() {
  return <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#e055aa', fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
}

export function TermsPage() {
  return (
    <LegalLayout title="Conditions d'utilisation">
      <DraftNotice />
      <Section title="Objet">À compléter.</Section>
      <Section title="Compte utilisateur">À compléter.</Section>
      <Section title="Contenus publiés par les utilisateurs">
        À compléter. Les contenus abusifs peuvent être signalés depuis l'app (appui long sur un message, menu d'un profil) et les utilisateurs peuvent être bloqués.
      </Section>
      <Section title="Suppression du compte">À compléter. Le compte peut être supprimé à tout moment depuis Profil → Supprimer mon compte.</Section>
      <Section title="Contact">Pour toute question : <Contact />.</Section>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <DraftNotice />
      <Section title="Données collectées">À compléter.</Section>
      <Section title="Utilisation des données">À compléter.</Section>
      <Section title="Partage et sous-traitants">À compléter.</Section>
      <Section title="Durée de conservation et suppression">À compléter.</Section>
      <Section title="Tes droits">À compléter. Pour exercer tes droits, écris à <Contact />.</Section>
    </LegalLayout>
  )
}

export function SupportPage() {
  const [copied, setCopied] = useState(false)

  async function copySupportEmail() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL)
      } else {
        const input = document.createElement('textarea')
        input.value = SUPPORT_EMAIL
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        const copiedToClipboard = document.execCommand('copy')
        input.remove()
        if (!copiedToClipboard) throw new Error('copy failed')
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <LegalLayout title="Support">
      <Section title="Nous contacter">
        Une question, un bug ou un contenu à signaler ? Écris-nous à{' '}
        <span style={{ color: '#e055aa', fontWeight: 700, userSelect: 'all' }}>{SUPPORT_EMAIL}</span>.
        <button type="button" onClick={copySupportEmail} style={{ display: 'block', marginTop: 12, border: 0, borderRadius: 10, padding: '10px 14px', background: COLORS.gradient, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {copied ? 'Adresse copiée' : "Copier l'adresse"}
        </button>
      </Section>
    </LegalLayout>
  )
}
