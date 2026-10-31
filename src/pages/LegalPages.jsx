import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Landmark, Mail, Shield } from 'lucide-react'

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

function LegalLayout({ title, description, sections = [], summary = [], children, legal = false }) {
  return (
    <div style={{ height: '100%', flex: 1, minHeight: 0, background: COLORS.page, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif", color: COLORS.text, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 680, padding: 'calc(24px + env(safe-area-inset-top, 0px)) 22px calc(40px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
        <Link to="/" style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, background: COLORS.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
          Amiv
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: '20px 0 12px', lineHeight: 1.2 }}>{title}</h1>
        {legal && <><div style={{ color: COLORS.secondary, fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}><div>Date d'effet : 29 octobre 2026</div><div>Dernière mise à jour : 31 octobre 2026</div></div>
        {description && <div style={{ fontSize: 15, lineHeight: 1.65, color: COLORS.body, margin: '0 0 20px' }}>{description}</div>}
        <details style={{ background: COLORS.card, borderRadius: 14, padding: '14px 16px', margin: '0 0 22px', fontSize: 14, lineHeight: 1.55 }}>
          <summary style={{ fontWeight: 800, cursor: 'pointer', color: COLORS.text }}>En bref</summary>
          <ul style={{ margin: '10px 0 0', paddingLeft: 20, color: COLORS.body }}>{summary.map((item, i) => <li key={i} style={{ marginBottom: 5 }}>{item}</li>)}</ul>
        </details>
        {sections.length > 0 && <nav aria-label="Sommaire" style={{ marginBottom: 26, padding: '16px', border: `1px solid ${COLORS.border}`, borderRadius: 14 }}><div style={{ fontWeight: 800, fontSize: 15, marginBottom: 9 }}>Sommaire</div><ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>{sections.map(([id, label]) => <li key={id}><a href={`#${id}`} style={{ color: COLORS.accent, textDecoration: 'none' }}>{label}</a></li>)}</ol></nav>}</>}
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

function Section({ title, children, id }) {
  return (
    <section id={id || title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^[0-9]+[.-]?\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')} style={{ marginBottom: 26, scrollMarginTop: 20 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.3 }}>{title}</h2>
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

export function AboutPage() {
  const links = [
    { to: '/cgu', label: "Conditions d'utilisation", Icon: FileText },
    { to: '/confidentialite', label: 'Politique de confidentialité', Icon: Shield },
    { to: '/mentions-legales', label: 'Mentions légales', Icon: Landmark },
    { to: '/support', label: 'Aide et contact', Icon: Mail },
  ]

  return (
    <LegalLayout title="À propos">
      <div style={{ background: COLORS.card, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
        {links.map(({ to, label, Icon }, index) => (
          <Link key={to} to={to} style={{ minHeight: 56, padding: '10px 14px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, borderBottom: index < links.length - 1 ? `1px solid ${COLORS.border}` : 'none', color: COLORS.text, textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
            <Icon size={19} strokeWidth={1.7} color={COLORS.secondary} />
            <span style={{ flex: 1 }}>{label}</span>
            <ChevronRight size={17} strokeWidth={1.7} color={COLORS.secondary} />
          </Link>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: COLORS.secondary, padding: '18px 0' }}>Amiv · version 1.0.0 (build 1)</div>
    </LegalLayout>
  )
}

export function LegalNoticePage() {
  return (
    <LegalLayout
      title="Mentions légales"
      legal
      description={<><P>Amiv est une application et un site qui t'aident à organiser des anniversaires et des moments entre amis.</P><P>Cette page précise qui édite Amiv, qui l'héberge et comment nous contacter. Elle concerne amiv.app et l'application iOS.</P><P>Pour régler tes notifications et ta confidentialité, ouvre Profil → Notifications ou Profil → Confidentialité. Pour effacer ton compte, choisis Profil → Supprimer mon compte.</P></>}
      summary={['Amiv aide à organiser des événements entre amis.', 'Tu trouveras ici les informations de l’éditeur et des hébergeurs.', 'Pour une question, écris à contact@amiv.app.']}
      sections={[["objet-du-site", "Amiv et son objet"], ["editeur-et-hebergeur", "Éditeur et hébergeur"]]}
    >
      <Section id="objet-du-site" title="1. Amiv et son objet"><P>Amiv est un service qui permet d’organiser des anniversaires et des moments entre amis : invitations, échanges, rappels et souvenirs partagés.</P></Section>
      <Section id="editeur-et-hebergeur" title="2. Éditeur et hébergeur">
        <KeyValueTable rows={[
          ['Éditeur', 'Thomas LEVY, entrepreneur individuel (EI)'], ['SIRET', '851 506 204 00037'], ['Code APE', '8299Z'], ['Adresse', '53 rue du Moulin Vert, 75014 Paris, France'], ['Directeur de la publication', 'Thomas LEVY'], ['Contact', <Contact key="contact" />], ['Hébergement du site', 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis, vercel.com'], ['Hébergement des données', 'Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992, supabase.com. Serveurs situés à Londres (Royaume-Uni).'],
        ]} />
        <P>Pour toute question ou réclamation, écris à <Contact /> ou utilise « Nous contacter » dans l'application.</P>
      </Section>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Conditions générales d'utilisation"
      legal
      description={<><P>Ces conditions expliquent les règles applicables quand tu crées un compte ou utilises Amiv, et les engagements de chacun.</P><P>Elles couvrent les fonctionnalités, ton compte, tes contenus, la modération et les responsabilités liées au service.</P><P>Tu peux gérer Profil → Notifications et Profil → Confidentialité, ou supprimer ton compte depuis Profil → Supprimer mon compte.</P></>}
      summary={['Amiv sert à organiser des anniversaires et des moments entre amis.', 'Le service est réservé aux personnes de 15 ans et plus.', 'Tu gardes la propriété de tes contenus et dois respecter les autres.', 'Tu peux signaler un contenu et supprimer ton compte depuis ton Profil.', 'Le service est soumis au droit français.']}
      sections={[["le-service", "Le service"], ["age-minimum", "Âge minimum"], ["ton-compte", "Ton compte"], ["regles-de-conduite", "Règles de conduite"], ["tes-contenus", "Tes contenus"], ["signalement-et-moderation", "Signalement et modération"], ["disponibilite-et-responsabilite", "Disponibilité et responsabilité"], ["propriete-intellectuelle", "Propriété intellectuelle"], ["modifications", "Modifications"], ["droit-applicable", "Droit applicable"]]}
    >
      <Section title="1. Le service">
        <P>Amiv est une application gratuite pour organiser des anniversaires et des moments entre amis. Elle permet notamment de :</P>
        <List items={[
          'créer des événements et inviter des personnes, avec ou sans compte Amiv ;',
          'suivre les anniversaires de ses amis et recevoir des rappels ;',
          "discuter dans le chat d'un événement ou en messages privés ;",
          'préparer une surprise dans un espace secret, caché à la personne fêtée : idées cadeaux, cagnotte, souvenirs, chat secret ;',
          'partager des souvenirs, révélés à la personne fêtée le jour de son anniversaire ;',
          "partager les photos d'un événement avec ses participants, dans un album.",
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
      legal
      description={<><P>Cette politique décrit les données utilisées par Amiv, les raisons de leur utilisation, les personnes qui peuvent les voir et les durées de conservation.</P><P>Elle s’applique à ton compte comme aux informations de personnes invitées ou répondant à un lien d’anniversaire.</P><P>Dans l’app, gère Profil → Notifications et Profil → Confidentialité. Tu peux effacer ton compte via Profil → Supprimer mon compte.</P></>}
      summary={['Amiv utilise les données nécessaires au fonctionnement du service et ne les vend pas.', 'Ton profil et tes interactions sont visibles selon les fonctionnalités utilisées.', 'Tu peux demander l’accès, la correction ou la suppression de tes données.', 'La suppression du compte efface tes données, avec quelques exceptions expliquées ici.', 'Tu peux contacter Amiv à contact@amiv.app.']}
      sections={[["donnees-collectees-usages-et-durees", "Données collectées, usages et durées"], ["qui-voit-tes-donnees", "Qui voit tes données"], ["suppression-de-ton-compte", "Suppression de ton compte"], ["tes-droits", "Tes droits"], ["mineurs", "Mineurs"], ["securite", "Sécurité"], ["cookies-et-traceurs", "Cookies et traceurs"], ["modifications", "Modifications"], ["qui-est-responsable-de-tes-donnees", "Qui est responsable de tes données ?"]]}
    >
      <Section id="donnees-collectees-usages-et-durees" title="1. Données collectées, usages et durées">
        <CardTable
          columns={['Données', 'Pourquoi', 'Base légale', 'Conservation']}
          rows={[
            ["Compte : email, mot de passe géré par Supabase Auth, dates d'inscription et de connexion", 'Créer et sécuriser ton compte', 'Exécution des CGU', "Jusqu'à la suppression du compte que tu peux demander à tout moment ; aucune suppression automatique pour inactivité n'est actuellement activée"],
            ['Profil : nom, prénom, pseudo, photo, date de naissance, ville (facultative)', 'T\'identifier auprès de tes amis, rappeler ton anniversaire, te suggérer des amis', 'Exécution des CGU', "Jusqu'à la suppression du compte"],
            ['Événements, invitations, réponses, votes de dates, checklist, budget', 'Organiser tes événements', 'Exécution des CGU', "Tant que l'événement existe"],
            ['Messages, souvenirs et leurs photos, idées cadeaux, cagnotte', 'Discuter et préparer les surprises', 'Exécution des CGU', "Tant que l'événement ou la conversation existe"],
            ["Album photo d'un événement : photos (réduites à 1600 pixels de large) et leurs miniatures, prénom de la personne qui les a ajoutées, date d'ajout", "Partager les photos de l'événement avec ses participants", 'Exécution des CGU', "2 mois après la date de l'événement. Environ un mois après l'événement, les participants sont prévenus pour enregistrer les photos qu'ils veulent garder, et la suppression n'a jamais lieu moins de 30 jours après ce message. Une photo est supprimée plus tôt si son auteur ou l'organisateur la supprime, si l'événement est supprimé ou si son auteur supprime son compte."],
            ['Amis, blocages', 'Relier les comptes, te protéger', 'Exécution des CGU', "Jusqu'à la suppression du compte, ou jusqu'à ce que tu débloques la personne"],
            ['Suggestions d\'amis : profils que tu as masqués', 'Ne plus te proposer ces personnes', 'Exécution des CGU', "Jusqu'à la suppression du compte"],
            ['Données de personnes sans compte : nom, email, réponse à une invitation', "Inviter quelqu'un qui n'a pas Amiv", 'Intérêt légitime', "12 mois après la date de l'événement"],
            ['Anniversaires et contacts que tu ajoutes', 'Te rappeler les anniversaires', 'Intérêt légitime', "Jusqu'à leur suppression ou celle de ton compte"],
            ["Date de naissance de tes amis Amiv (jour, mois, et année s'ils l'ont renseignée), ajoutée automatiquement à tes anniversaires quand une demande d'ami est acceptée et mise à jour quand ils la modifient", "Te rappeler l'anniversaire de tes amis", 'Exécution des CGU', "Tant que vous êtes amis. Supprimée quand l'amitié prend fin, quand ton ami efface sa date ou supprime son compte, ou quand tu la supprimes de tes anniversaires (elle n'est alors plus ajoutée)"],
            ["Dates d'anniversaire transmises par lien : prénom, jour et mois de naissance, et année si la personne le souhaite", "Rappeler cet anniversaire à l'utilisateur qui a envoyé le lien", 'Consentement de la personne, qui choisit de répondre', "Dans les rappels de l'utilisateur tant qu'il ne les supprime pas, et au plus tard jusqu'à la suppression de son compte. Le suivi de la demande (prénom, statut, dates d'envoi et de réponse) est supprimé 90 jours après l'envoi du lien. Un lien non utilisé expire au bout de 30 jours."],
            ["Empreinte pseudonymisée de l'adresse IP de la personne qui répond à un lien d'anniversaire, jamais l'adresse elle-même", 'Limiter les abus', 'Intérêt légitime', '24 heures'],
            ['Notifications', "T'informer dans l'application et sur ton iPhone", 'Exécution des CGU', '6 mois'],
            ["Jeton de notification push de ton appareil", "T'envoyer des notifications push sur iPhone", "Consentement, donné quand iOS te demande d'autoriser les notifications", "Supprimé quand tu te déconnectes, quand Apple indique qu'il n'est plus valide, et avec ton compte"],
            ['Signalements : auteur, message, photo ou profil signalé, motif, commentaire, copie du contenu signalé au moment du signalement', 'Modérer les contenus', 'Intérêt légitime', '12 mois après leur traitement, ou après leur création s’ils ne sont pas traités'],
            ['Messages au support, envoyés par le formulaire « Nous contacter » ou par email', 'Répondre et corriger les bugs', 'Intérêt légitime', "2 ans après le dernier échange. Les messages du formulaire ne sont pas enregistrés dans la base d'Amiv : ils arrivent par email dans la boîte du support, comme les emails reçus, et sont supprimés selon la même durée."],
            ["Données techniques : adresse IP, type d'appareil, journaux", 'Sécurité et bon fonctionnement', 'Intérêt légitime', 'Quelques jours, selon les hébergeurs'],
          ]}
        />
        <P><strong>Dates d'anniversaire transmises par lien.</strong> Un utilisateur peut envoyer à un proche un lien personnel pour lui demander sa date d'anniversaire. La personne qui répond, même sans compte Amiv, nous transmet son prénom, son jour et mois de naissance et, si elle le souhaite, son année de naissance. Ces informations ne sont visibles que par l'utilisateur qui a envoyé le lien. Elles servent uniquement à lui rappeler cet anniversaire et ne sont ni publiées ni partagées.</P>
        <P><strong>Suggestions d'amis.</strong> Amiv te propose des personnes que tu connais peut-être, selon, par ordre d'importance : vos amis en commun, les événements auxquels vous participez tous les deux, et les invitations échangées entre vous. Ta ville, si tu l'as renseignée, ne sert qu'en complément : elle ne suffit jamais à elle seule pour proposer quelqu'un et n'est jamais affichée aux autres. Ne sont jamais proposés : les personnes que tu as bloquées ou qui t'ont bloqué, les profils que tu as masqués, et les personnes avec qui une demande d'ami existe déjà. Une suggestion affiche uniquement le nom, le pseudo, la photo et la raison de la suggestion, par exemple le nombre d'amis en commun.</P>
        <P><strong>Album photo d'un événement.</strong> Chaque participant peut ajouter jusqu'à 10 photos par événement. Avant l'envoi, la photo est réduite sur ton appareil et une miniature est créée. Les photos sont stockées dans un espace privé chez Supabase, jamais accessible publiquement : elles ne s'affichent qu'au travers de liens temporaires, valables 10 minutes, créés pour les personnes autorisées. Tu peux supprimer tes photos à tout moment ; l'organisateur et les co-organisateurs peuvent supprimer n'importe quelle photo de leur événement. Les fichiers sont effacés en même temps que la photo. Une photo enregistrée par un participant sur son téléphone reste sous sa responsabilité. Chaque photo peut être signalée.</P>
        <P><strong>Signalement et blocage.</strong> Un signalement est transmis uniquement à l'éditeur, qui est prévenu par email, et la personne signalée ne sait pas qui l'a signalée. Bloquer quelqu'un empêche entre vous les messages privés et les demandes d'ami, ignore ses invitations, masque ses messages dans les chats d'événement et cache vos photos l'un à l'autre dans les albums. La personne bloquée n'en est pas informée.</P>
        <P>Tu ne reçois aucune publicité, et tes données ne servent à aucun profilage. Les emails envoyés par Amiv servent uniquement au fonctionnement du service, par exemple pour la confirmation d'inscription, la réinitialisation du mot de passe, les invitations et les relances.</P>
      </Section>

      <Section id="qui-voit-tes-donnees" title="2. Qui voit tes données">
        <List items={[
          <><strong>Les utilisateurs connectés</strong> voient ton nom, ton prénom, ton pseudo et ta photo.</>,
          <><strong>Tes amis</strong> voient en plus ta date de naissance (jour et mois, et année si tu l'as renseignée) : elle s'ajoute à leurs anniversaires pour qu'ils soient prévenus du tien.</>,
          <><strong>Les participants d'un événement</strong> voient tes réponses et tes messages dans cet événement.</>,
          <><strong>Les photos de l'album d'un événement</strong> sont visibles uniquement par l'organisateur, les co-organisateurs et les participants qui ont accepté l'invitation, y compris la personne fêtée une fois qu'elle a accepté. Les invités en attente, « peut-être » ou qui ont refusé ne voient pas l'album.</>,
          <><strong>La personne fêtée</strong> ne voit jamais l'espace secret. Elle découvre uniquement les souvenirs, le jour de son anniversaire.</>,
          <><strong>Ton email et ta ville</strong> ne sont jamais affichés aux autres utilisateurs.</>,
          <><strong>Une date d'anniversaire transmise par lien</strong> n'est visible que par l'utilisateur qui a envoyé le lien.</>,
          <><strong>Une notification push</strong> (titre et texte, par exemple le début d'un message) passe par Apple pour s'afficher sur ton iPhone.</>,
        ]} />
        <P>Amiv fait appel aux prestataires suivants, qui traitent les données uniquement pour son compte :</P>
        <CardTable
          columns={['Prestataire', 'Rôle', 'Localisation']}
          rows={[
            ['Supabase', 'Base de données, authentification, fichiers, fonctions serveur et tâches planifiées', 'Londres, Royaume-Uni'],
            ['Vercel', 'Hébergement du site', 'États-Unis, avec un réseau de diffusion en Europe'],
            ['Apple (service de notifications push)', "Acheminer les notifications push vers ton iPhone : reçoit le jeton de ton appareil et le contenu de la notification", 'États-Unis'],
            ['Resend', "Envoi des emails : inscription, invitations, relances, formulaire « Nous contacter » et alertes de signalement à l'éditeur", "Serveurs d'envoi en Irlande, société américaine"],
            ['ImprovMX', `Réception des emails envoyés à ${SUPPORT_EMAIL}`, 'États-Unis (société américaine, Dover, Delaware)'],
          ]}
        />
        <P>Le Royaume-Uni bénéficie d'une décision d'adéquation de la Commission européenne. Les transferts vers les États-Unis sont encadrés par les clauses contractuelles types de la Commission européenne ou par le Data Privacy Framework.</P>
      </Section>

      <Section id="suppression-de-ton-compte" title="3. Suppression de ton compte">
        <P>La suppression automatique des comptes inactifs n'est actuellement pas activée. Après 3 ans sans activité, tu reçois un email pour t'en informer. Ton compte n'est pas supprimé pour autant. Tu peux supprimer ton compte à tout moment depuis Profil → Supprimer mon compte.</P>
        <P>La suppression est immédiate : ton profil, tes fichiers et ton compte de connexion sont effacés dès ta demande. Seules les sauvegardes peuvent contenir tes données, 7 jours maximum.</P>
        <P>Sont alors supprimés : ton profil, ta photo, tes amis, tes blocages, les profils que tu as masqués, tes réponses, tes souvenirs, les photos que tu as ajoutées aux albums, tes mots sur les cartes, tes fichiers, tes demandes d'anniversaire, tes signalements et le jeton de notification de tes appareils.</P>
        <P>Les événements que tu organises sont transférés à un co-organisateur s'il y en a un, sinon supprimés, et les invités en sont prévenus. Tes messages dans les chats d'événement et les messages privés restent visibles par les autres participants, mais apparaissent sous « Utilisateur supprimé » : ces échanges appartiennent aussi aux autres. Les signalements faits par d'autres sur tes messages ou ton profil sont supprimés 12 mois après leur traitement, ou 12 mois après leur création s'ils ne sont pas traités.</P>      </Section>

      <Section id="tes-droits" title="4. Tes droits">
        <P>Tu peux à tout moment demander l'accès à tes données, leur rectification, leur suppression, leur portabilité, ou t'opposer à un traitement fondé sur l'intérêt légitime. Tu peux aussi définir des directives sur le sort de tes données après ton décès.</P>
        <P>Écris à <Contact /> depuis l'adresse de ton compte. La réponse arrive sous un mois au plus. Une personne sans compte, invitée par email, ajoutée dans les anniversaires d'un utilisateur ou qui a donné sa date d'anniversaire par lien, peut demander la suppression de ses données de la même manière.</P>
        <P>Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL : cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.</P>
      </Section>

      <Section id="mineurs" title="5. Mineurs">
        <P>Amiv est réservé aux personnes de 15 ans et plus. Si tu apprends qu'un enfant de moins de 15 ans a créé un compte, écris à <Contact /> et le compte sera supprimé.</P>
      </Section>

      <Section id="securite" title="6. Sécurité">
        <P>Les échanges sont chiffrés (HTTPS) et les mots de passe ne sont jamais stockés en clair. L'accès aux données est limité en base : chacun ne voit que ce qui le concerne, et l'espace secret est fermé à la personne fêtée. Les photos sont stockées dans un espace privé et ne s'affichent que par des liens temporaires.</P>
      </Section>

      <Section id="cookies-et-traceurs" title="7. Cookies et traceurs">
        <P>Amiv n'utilise aucun cookie publicitaire ni outil de mesure d'audience. Seule ta session de connexion est enregistrée sur ton appareil, ce qui est indispensable au fonctionnement du service et ne nécessite pas de consentement. Si un outil de mesure d'audience est ajouté, cette politique sera mise à jour et ton accord sera demandé.</P>
      </Section>

      <Section id="modifications" title="8. Modifications">
        <P>Cette politique peut évoluer. En cas de changement important, tu en seras informé dans l'application.</P>
      </Section>
      <Section id="qui-est-responsable-de-tes-donnees" title="9. Qui est responsable de tes données ?">
        <P>Le responsable du traitement est Thomas LEVY, entrepreneur individuel, 53 rue du Moulin Vert, 75014 Paris, France. Pour toute question relative à tes données ou pour exercer tes droits, écris à <Contact />.</P>
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
