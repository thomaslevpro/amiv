import { useState } from 'react'
import { Link } from 'react-router-dom'

// Pages publiques /cgu, /confidentialite, /mentions-legales et /support,
// ouvertes depuis le Profil et l'écran d'inscription (navigateur intégré sur natif).

const COLORS = {
  text: '#1C1C1E',
  body: '#3A3A3C',
  secondary: '#8E8E93',
  page: '#FFFFFF',
  card: '#F7F6F9',
  border: '#ECEAF0',
  accent: '#e055aa',
  gradient: 'linear-gradient(135deg,#e055aa,#f5a623)',
}

export const SUPPORT_EMAIL = 'contact@amiv.app'

const LEGAL_LINKS = [
  { to: '/cgu', label: "Conditions d'utilisation" },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/support', label: 'Support' },
]

function LegalLayout({ title, intro, children }) {
  return (
    <div style={{ height: '100%', flex: 1, minHeight: 0, background: COLORS.page, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", color: COLORS.text, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 680, padding: 'calc(28px + env(safe-area-inset-top, 0px)) 20px calc(40px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
        <a href="/" style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, background: COLORS.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
          Amiv
        </a>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: '18px 0 10px', lineHeight: 1.2 }}>{title}</h1>
        {intro && <p style={{ fontSize: 15, lineHeight: 1.6, color: COLORS.body, margin: '0 0 22px' }}>{intro}</p>}
        {children}
        <LegalFooter />
      </div>
    </div>
  )
}

function LegalFooter() {
  return (
    <footer style={{ marginTop: 32, paddingTop: 18, borderTop: `1px solid ${COLORS.border}`, display: 'flex', flexWrap: 'wrap', gap: '10px 18px', fontSize: 13 }}>
      {LEGAL_LINKS.map(link => (
        <Link key={link.to} to={link.to} style={{ color: COLORS.secondary, fontWeight: 600, textDecoration: 'none' }}>
          {link.label}
        </Link>
      ))}
    </footer>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: COLORS.body }}>{children}</div>
    </section>
  )
}

function P({ children }) {
  return <p style={{ margin: '0 0 10px' }}>{children}</p>
}

function List({ items }) {
  return (
    <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>
      {items.map((item, index) => <li key={index} style={{ marginBottom: 4 }}>{item}</li>)}
    </ul>
  )
}

// Tableau clé / valeur : libellé au-dessus de la valeur, lisible sur mobile
function KeyValueTable({ rows }) {
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
      {rows.map(([label, value], index) => (
        <div key={label} style={{ padding: '10px 14px', borderTop: index ? `1px solid ${COLORS.border}` : 'none' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
          <div style={{ fontSize: 15, lineHeight: 1.5, color: COLORS.text }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// Tableau à plusieurs colonnes : une carte par ligne, la première colonne en titre
function CardTable({ columns, rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
      {rows.map(([title, ...cells]) => (
        <div key={title} style={{ background: COLORS.card, borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 6, lineHeight: 1.4 }}>{title}</div>
          {cells.map((cell, index) => (
            <div key={columns[index + 1]} style={{ fontSize: 14, lineHeight: 1.5, marginTop: index ? 4 : 0 }}>
              <span style={{ color: COLORS.secondary, fontWeight: 700 }}>{columns[index + 1]} : </span>
              <span style={{ color: COLORS.body }}>{cell}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Contact() {
  return <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: COLORS.accent, fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
}

export function LegalNoticePage() {
  return (
    <LegalLayout
      title="Mentions légales"
      intro="Amiv est édité par un entrepreneur individuel, Thomas LEVY. Ces mentions s'appliquent au site amiv.app et à l'application Amiv sur iOS."
    >
      <KeyValueTable rows={[
        ['Éditeur', 'Thomas LEVY, entrepreneur individuel (EI)'],
        ['Adresse', '53 rue du Moulin Vert, 75014 Paris, France'],
        ['SIRET', '851 506 204 00037'],
        ['Code APE', '8299Z'],
        ['Directeur de la publication', 'Thomas LEVY'],
        ['Contact', <Contact key="contact" />],
        ['Hébergement du site', 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis, vercel.com'],
        ['Hébergement des données', 'Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992, supabase.com. Serveurs situés à Londres (Royaume-Uni).'],
      ]} />
      <P>
        Pour toute question ou réclamation, écris à <Contact /> ou utilise le formulaire « Nous contacter » de l'application.
      </P>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Conditions générales d'utilisation"
      intro="En créant un compte ou en utilisant Amiv, tu acceptes ces conditions. Elles sont en vigueur depuis le 30 octobre 2026."
    >
      <Section title="1. Le service">
        <P>Amiv est une application gratuite pour organiser des anniversaires et des moments entre amis. Elle permet notamment de :</P>
        <List items={[
          'créer des événements et inviter des personnes, avec ou sans compte Amiv ;',
          'suivre les anniversaires de ses amis et recevoir des rappels ;',
          "discuter dans le chat d'un événement ou en messages privés ;",
          'préparer une surprise dans un espace secret, caché à la personne fêtée : idées cadeaux, cagnotte, souvenirs, chat secret ;',
          'partager des souvenirs, révélés à la personne fêtée le jour de son anniversaire.',
        ]} />
        <P>Amiv ne gère aucun paiement. Une cagnotte est un lien vers un service externe, choisi par l'organisateur, qui applique ses propres conditions.</P>
      </Section>

      <Section title="2. Âge minimum">
        <P>Amiv est réservé aux personnes de 15 ans et plus. En créant un compte, tu confirmes avoir au moins 15 ans.</P>
      </Section>

      <Section title="3. Ton compte">
        <P>Tu crées ton compte avec une adresse email valide et un mot de passe. Tu es responsable de la confidentialité de ton mot de passe et de ce qui est fait depuis ton compte. Les informations de ton profil doivent être exactes : tu ne peux pas te faire passer pour quelqu'un d'autre.</P>
        <P>Tu peux supprimer ton compte à tout moment depuis Profil → Supprimer mon compte. Ce qui est supprimé ou conservé est détaillé dans la <Link to="/confidentialite" style={{ color: COLORS.accent, fontWeight: 700 }}>politique de confidentialité</Link>.</P>
      </Section>

      <Section title="4. Règles de conduite">
        <P>Sur Amiv, tu t'engages à ne pas :</P>
        <List items={[
          "harceler, menacer, insulter ou discriminer qui que ce soit ;",
          'publier des contenus illégaux, violents, pornographiques ou haineux ;',
          "publier des informations ou des photos de quelqu'un sans son accord ;",
          'envoyer du spam ou des messages commerciaux non sollicités ;',
          "ajouter des personnes ou leurs coordonnées sans qu'elles le souhaitent ;",
          "utiliser l'espace secret pour autre chose que préparer une surprise bienveillante ;",
          "tenter d'accéder aux données d'autres utilisateurs ou de perturber le service.",
        ]} />
      </Section>

      <Section title="5. Tes contenus">
        <P>Tu restes propriétaire de ce que tu publies : messages, photos, souvenirs, événements. Tu autorises Amiv à les stocker et à les afficher aux personnes concernées, uniquement pour faire fonctionner le service. Cette autorisation prend fin quand tu supprimes le contenu ou ton compte, sous réserve de ce qui est prévu pour les messages dans la politique de confidentialité.</P>
        <P>Tu garantis avoir le droit de publier ce que tu partages, en particulier les photos où apparaissent d'autres personnes.</P>
      </Section>

      <Section title="6. Signalement et modération">
        <P>Tu peux signaler un message ou un profil par un appui long ou le menu « … », et bloquer un utilisateur depuis son profil ou une conversation. Chaque signalement est examiné par l'éditeur.</P>
        <P>En cas de non-respect de ces conditions, Amiv peut retirer un contenu, suspendre ou supprimer un compte, sans préavis si la situation le justifie. Les contenus manifestement illicites peuvent être signalés aux autorités.</P>
      </Section>

      <Section title="7. Disponibilité et responsabilité">
        <P>Amiv est fourni gratuitement, en l'état. L'éditeur fait de son mieux pour que le service fonctionne correctement, mais ne garantit pas qu'il soit disponible en permanence ni exempt d'erreurs. Une notification ou un rappel peut, par exemple, arriver en retard.</P>
        <P>Chaque utilisateur est responsable des contenus qu'il publie et des événements qu'il organise. L'éditeur n'est pas responsable des échanges entre utilisateurs, ni des services externes accessibles par un lien (cagnotte, agenda, partage).</P>
      </Section>

      <Section title="8. Propriété intellectuelle">
        <P>Le nom Amiv, son logo, son design et son code appartiennent à l'éditeur. Ils ne peuvent pas être copiés ou réutilisés sans autorisation.</P>
      </Section>

      <Section title="9. Modifications">
        <P>Ces conditions peuvent évoluer. En cas de changement important, tu en seras informé dans l'application avant son entrée en vigueur. Continuer à utiliser Amiv vaut acceptation de la nouvelle version.</P>
      </Section>

      <Section title="10. Droit applicable">
        <P>Ces conditions sont soumises au droit français. En cas de litige, écris d'abord à <Contact /> pour trouver une solution amiable. À défaut d'accord, les tribunaux français sont compétents.</P>
      </Section>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      intro="Amiv collecte uniquement les données nécessaires pour organiser tes événements, ne les vend jamais et n'affiche aucune publicité. Cette politique est en vigueur depuis le 30 octobre 2026."
    >
      <Section title="1. Responsable du traitement">
        <P>Thomas LEVY, entrepreneur individuel, 53 rue du Moulin Vert, 75014 Paris. Contact : <Contact />.</P>
      </Section>

      <Section title="2. Données collectées, usages et durées">
        <CardTable
          columns={['Données', 'Pourquoi', 'Base légale', 'Conservation']}
          rows={[
            ["Compte : email, mot de passe chiffré, dates d'inscription et de connexion", 'Créer et sécuriser ton compte', 'Exécution des CGU', "Jusqu'à la suppression du compte, ou 3 ans sans connexion (après un email d'avertissement)"],
            ['Profil : nom, prénom, pseudo, photo, date de naissance', 'T\'identifier auprès de tes amis, rappeler ton anniversaire', 'Exécution des CGU', "Jusqu'à la suppression du compte"],
            ['Événements, invitations, réponses, votes de dates, checklist, budget', 'Organiser tes événements', 'Exécution des CGU', "Tant que l'événement existe"],
            ['Messages, souvenirs, photos, idées cadeaux, cagnotte', 'Discuter et préparer les surprises', 'Exécution des CGU', "Tant que l'événement ou la conversation existe"],
            ['Amis, blocages', 'Relier les comptes, te protéger', 'Exécution des CGU', "Jusqu'à la suppression du compte"],
            ['Données de personnes sans compte : nom, email, réponse à une invitation', "Inviter quelqu'un qui n'a pas Amiv", 'Intérêt légitime', "12 mois après la date de l'événement"],
            ['Anniversaires et contacts que tu ajoutes', 'Te rappeler les anniversaires', 'Intérêt légitime', "Jusqu'à leur suppression ou celle de ton compte"],
            ['Notifications', "T'informer dans l'application", 'Exécution des CGU', '6 mois'],
            ['Signalements et messages au support', 'Modérer, répondre, corriger les bugs', 'Intérêt légitime', '12 mois après leur traitement'],
            ["Données techniques : adresse IP, type d'appareil, journaux", 'Sécurité et bon fonctionnement', 'Intérêt légitime', 'Quelques jours, selon les hébergeurs'],
          ]}
        />
        <P>Tu ne reçois aucune publicité, et tes données ne servent à aucun profilage. Les emails envoyés par Amiv servent uniquement au service : confirmation d'inscription, réinitialisation du mot de passe, invitations et relances.</P>
      </Section>

      <Section title="3. Qui voit tes données">
        <List items={[
          <><strong>Les utilisateurs connectés</strong> voient ton nom, ton prénom, ton pseudo et ta photo.</>,
          <><strong>Tes amis</strong> voient en plus ta date de naissance.</>,
          <><strong>Les participants d'un événement</strong> voient tes réponses et tes messages dans cet événement.</>,
          <><strong>La personne fêtée</strong> ne voit jamais l'espace secret. Elle découvre uniquement les souvenirs, le jour de son anniversaire.</>,
          <><strong>Ton email</strong> n'est jamais affiché aux autres utilisateurs.</>,
        ]} />
        <P>Amiv fait appel aux prestataires suivants, qui traitent les données uniquement pour son compte :</P>
        <CardTable
          columns={['Prestataire', 'Rôle', 'Localisation']}
          rows={[
            ['Supabase', 'Base de données, authentification, fichiers', 'Londres, Royaume-Uni'],
            ['Vercel', 'Hébergement du site', 'États-Unis, avec un réseau de diffusion en Europe'],
            ['Resend', 'Envoi des emails', "Serveurs d'envoi en Irlande, société américaine"],
            ['ImprovMX', `Réception des emails envoyés à ${SUPPORT_EMAIL}`, 'États-Unis (société américaine, Dover, Delaware)'],
          ]}
        />
        <P>Le Royaume-Uni bénéficie d'une décision d'adéquation de la Commission européenne. Les transferts vers les États-Unis sont encadrés par les clauses contractuelles types de la Commission européenne ou par le Data Privacy Framework.</P>
      </Section>

      <Section title="4. Suppression de ton compte">
        <P>Tu peux supprimer ton compte à tout moment depuis Profil → Supprimer mon compte. Sont alors supprimés : ton profil, ta photo, tes amis, tes réponses, tes souvenirs, tes mots sur les cartes et tes fichiers.</P>
        <P>Les événements que tu organises sont transférés à un co-organisateur s'il y en a un, sinon supprimés, et les invités en sont prévenus. Tes messages dans les chats d'événement et les messages privés restent visibles par les autres participants, mais apparaissent sous « Utilisateur supprimé » : ces échanges appartiennent aussi aux autres.</P>
        <P>Les sauvegardes de la base sont conservées au maximum 3 mois.</P>
      </Section>

      <Section title="5. Tes droits">
        <P>Tu peux à tout moment demander l'accès à tes données, leur rectification, leur suppression, leur portabilité, ou t'opposer à un traitement fondé sur l'intérêt légitime. Tu peux aussi définir des directives sur le sort de tes données après ton décès.</P>
        <P>Écris à <Contact /> depuis l'adresse de ton compte. La réponse arrive sous un mois au plus. Une personne sans compte, invitée par email ou ajoutée dans les anniversaires d'un utilisateur, peut demander la suppression de ses données de la même manière.</P>
        <P>Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL : cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.</P>
      </Section>

      <Section title="6. Mineurs">
        <P>Amiv est réservé aux personnes de 15 ans et plus. Si tu apprends qu'un enfant de moins de 15 ans a créé un compte, écris à <Contact /> et le compte sera supprimé.</P>
      </Section>

      <Section title="7. Sécurité">
        <P>Les échanges sont chiffrés (HTTPS) et les mots de passe ne sont jamais stockés en clair. L'accès aux données est limité en base : chacun ne voit que ce qui le concerne, et l'espace secret est fermé à la personne fêtée.</P>
      </Section>

      <Section title="8. Cookies et traceurs">
        <P>Amiv n'utilise aucun cookie publicitaire ni outil de mesure d'audience. Seule ta session de connexion est enregistrée sur ton appareil, ce qui est indispensable au fonctionnement du service et ne nécessite pas de consentement. Si un outil de mesure d'audience est ajouté, cette politique sera mise à jour et ton accord sera demandé.</P>
      </Section>

      <Section title="9. Modifications">
        <P>Cette politique peut évoluer. En cas de changement important, tu en seras informé dans l'application.</P>
      </Section>
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
        <span style={{ color: COLORS.accent, fontWeight: 700, userSelect: 'all' }}>{SUPPORT_EMAIL}</span>.
        <button type="button" onClick={copySupportEmail} style={{ display: 'block', marginTop: 12, border: 0, borderRadius: 10, padding: '10px 14px', background: COLORS.gradient, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {copied ? 'Adresse copiée' : "Copier l'adresse"}
        </button>
      </Section>
    </LegalLayout>
  )
}
