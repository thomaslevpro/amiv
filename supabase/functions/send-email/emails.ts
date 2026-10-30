import { escapeHtml, type EmailContent } from '../_shared/email.ts'

// Contenu des emails d'auth envoyés par le hook « Send Email ». Inscription,
// mot de passe oublié, changement d'email et réauthentification : code à
// saisir dans l'app (aucun lien). Lien de connexion : lien de vérification.

export type AuthEmailPayload = {
  user?: {
    email?: string
    new_email?: string
  }
  email_data?: {
    email_action_type?: string
    token?: string
    token_hash?: string
    token_new?: string
    token_hash_new?: string
  }
}

export type AuthEmail = { to: string; content: EmailContent }

const AUTH_CALLBACK_URL = 'https://amiv.app/auth/callback'
const AUTH_RESET_URL = 'https://amiv.app/auth/reset'

const SIGNUP_TYPES = ['signup', 'signupconfirmation', 'confirmation', 'confirm']
const RECOVERY_TYPES = ['recovery', 'passwordreset', 'resetpassword', 'passwordrecovery']
const MAGIC_LINK_TYPES = ['magiclink', 'magiclinklogin', 'login']

export function normalizeEventType(payload: AuthEmailPayload) {
  return payload.email_data?.email_action_type?.toLowerCase().replace(/[\s_-]+/g, '')
}

function verifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo = AUTH_CALLBACK_URL) {
  const url = new URL(`${supabaseUrl}/auth/v1/verify`)
  url.searchParams.set('type', type)
  url.searchParams.set('token', tokenHash)
  url.searchParams.set('redirect_to', redirectTo)
  return url.toString()
}

// « Amiv » en rose uni : Gmail ignore background-clip:text, un dégradé
// en texte transparent y serait invisible.
function layout(inner: string) {
  return `
    <div style="margin:0;padding:32px 16px;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
      <div style="max-width:480px;margin:0 auto;padding:40px 32px;background:#ffffff;border-radius:20px;text-align:center;">
        <div style="font-size:32px;font-weight:800;line-height:1;color:#e055aa;margin-bottom:28px;">Amiv</div>
        ${inner}
      </div>
    </div>
  `
}

// fallbackUrl : lien de secours pour les versions de l'app qui n'ont pas
// encore l'écran du code (transition, voir AUTH_EMAIL_FALLBACK_LINK).
function codeEmail({ subject, title, intro, code, footer, fallbackUrl }: { subject: string; title: string; intro: string; code: string; footer: string; fallbackUrl?: string }): EmailContent {
  const safeCode = escapeHtml(code)
  const fallback = fallbackUrl
    ? `<p style="margin:0 0 16px;color:#AEAEB2;font-size:12px;line-height:1.5;">Ton app ne te demande pas de code ? Mets-la à jour, ou <a href="${escapeHtml(fallbackUrl)}" style="color:#e055aa;">utilise ce lien</a>.</p>`
    : ''
  return {
    subject,
    html: layout(`
        <h1 style="margin:0 0 14px;color:#1C1C1E;font-size:22px;font-weight:700;line-height:1.25;">${title}</h1>
        <p style="margin:0;color:#8E8E93;font-size:15px;line-height:1.6;">${intro}</p>
        <div style="margin:28px 0;padding:20px 12px;background:#FFF0F7;border-radius:16px;">
          <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:#1C1C1E;font-family:'SF Mono',Menlo,Consolas,monospace;">${safeCode}</div>
        </div>
        <p style="margin:0 0 8px;color:#8E8E93;font-size:13px;line-height:1.5;">Ce code est valable 1 heure.</p>
        ${fallback}
        <p style="margin:0;color:#AEAEB2;font-size:12px;line-height:1.5;">${footer}</p>
    `),
    text: `${title}\n\n${intro}\n\nTon code : ${code}\n\nCe code est valable 1 heure.${fallbackUrl ? `\n\nTon app ne te demande pas de code ? Utilise ce lien : ${fallbackUrl}` : ''}\n\n${footer}`,
  }
}

function linkEmail({ subject, title, intro, button, url, footer }: { subject: string; title: string; intro: string; button: string; url: string; footer: string }): EmailContent {
  const safeUrl = escapeHtml(url)
  return {
    subject,
    html: layout(`
        <h1 style="margin:0 0 14px;color:#1C1C1E;font-size:22px;font-weight:700;line-height:1.25;">${title}</h1>
        <p style="margin:0;color:#8E8E93;font-size:15px;line-height:1.6;">${intro}</p>
        <a href="${safeUrl}" style="display:inline-block;margin:24px 0;padding:14px 32px;border-radius:12px;background:#e055aa;background-image:linear-gradient(135deg,#e055aa,#f5a623);color:#fff;font-size:15px;font-weight:700;text-decoration:none;">${button}</a>
        <p style="margin:0 0 8px;color:#8E8E93;font-size:12px;line-height:1.5;">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :</p>
        <p style="margin:0 0 16px;color:#8E8E93;font-size:12px;line-height:1.5;word-break:break-all;">${safeUrl}</p>
        <p style="margin:0;color:#AEAEB2;font-size:12px;line-height:1.5;">${footer}</p>
    `),
    text: `${title}\n\n${intro}\n\n${url}\n\n${footer}`,
  }
}

export function signupEmail(code: string, fallbackUrl?: string) {
  return codeEmail({
    fallbackUrl,
    subject: `Ton code Amiv : ${code}`,
    title: 'Bienvenue sur Amiv !',
    intro: "Voici ton code pour confirmer ton adresse email. Saisis-le dans l'app pour finir ton inscription.",
    code,
    footer: "Tu n'as pas créé de compte Amiv ? Ignore simplement cet email.",
  })
}

export function recoveryEmail(code: string, fallbackUrl?: string) {
  return codeEmail({
    fallbackUrl,
    subject: `Ton code pour changer de mot de passe : ${code}`,
    title: 'Mot de passe oublié ?',
    intro: "Pas de souci. Saisis ce code dans l'app pour choisir un nouveau mot de passe.",
    code,
    footer: "Tu n'as rien demandé ? Ignore cet email, ton mot de passe ne change pas.",
  })
}

function reauthenticationEmail(code: string) {
  return codeEmail({
    subject: `Ton code de vérification Amiv : ${code}`,
    title: "Confirme que c'est bien toi",
    intro: "Saisis ce code dans l'app pour valider ta demande.",
    code,
    footer: "Tu n'as rien demandé ? Ignore cet email et pense à changer ton mot de passe.",
  })
}

// Changement d'adresse : un code par adresse. L'objet et le libellé disent
// clairement à quelle adresse appartient le code (l'app demande les deux).
export function emailChangeEmail({ code, newEmail, toNewAddress, fallbackUrl }: { code: string; newEmail: string; toNewAddress: boolean; fallbackUrl?: string }) {
  return codeEmail({
    subject: toNewAddress
      ? `Code de ta nouvelle adresse : ${code}`
      : `Code de ton adresse actuelle : ${code}`,
    title: toNewAddress ? 'Confirme ta nouvelle adresse' : "Confirme ton changement d'adresse",
    intro: toNewAddress
      ? "Saisis ce code dans l'app, dans le champ « nouvelle adresse », pour utiliser cette adresse avec ton compte Amiv."
      : `Tu as demandé à remplacer ton adresse par <strong style="color:#1C1C1E;">${escapeHtml(newEmail)}</strong>. Saisis ce code dans l'app, dans le champ « adresse actuelle », pour confirmer.`,
    code,
    footer: "Tu n'as rien demandé ? Ignore cet email, ton adresse ne change pas.",
    fallbackUrl,
  })
}

function magicLinkEmail(url: string) {
  return linkEmail({
    subject: 'Ton lien de connexion Amiv',
    title: 'Connexion à Amiv',
    intro: 'Clique sur le bouton ci-dessous pour te connecter.',
    button: 'Me connecter',
    url,
    footer: "Tu n'as rien demandé ? Ignore simplement cet email.",
  })
}

// Emails à envoyer pour un appel du hook (deux pour un changement d'email
// sécurisé : ancienne et nouvelle adresse), ou une erreur.
export function buildAuthEmails(payload: AuthEmailPayload, supabaseUrl: string | undefined, { fallbackLinks = false } = {}): AuthEmail[] | { error: string } {
  const eventType = normalizeEventType(payload)
  const data = payload.email_data
  const email = payload.user?.email
  if (!eventType) return { error: 'Missing event type' }
  if (!email) return { error: 'Missing email' }

  if (SIGNUP_TYPES.includes(eventType) || RECOVERY_TYPES.includes(eventType) || eventType === 'reauthentication') {
    if (!data?.token) return { error: 'Missing token' }
    const fallback = (type: string, redirectTo?: string) =>
      fallbackLinks && supabaseUrl && data.token_hash ? verifyUrl(supabaseUrl, data.token_hash, type, redirectTo) : undefined
    const content = SIGNUP_TYPES.includes(eventType) ? signupEmail(data.token, fallback('email'))
      : RECOVERY_TYPES.includes(eventType) ? recoveryEmail(data.token, fallback('recovery', AUTH_RESET_URL))
      : reauthenticationEmail(data.token)
    return [{ to: email, content }]
  }

  if (eventType === 'emailchange') {
    // Noms inversés côté Supabase (compatibilité). Changement sécurisé (deux
    // codes) : token + token_hash_new pour l'adresse actuelle, token_new +
    // token_hash pour la nouvelle. Sinon un seul code, à la nouvelle adresse.
    const newEmail = payload.user?.new_email
    if (!newEmail) return { error: 'Missing new email' }
    const link = (tokenHash?: string) =>
      fallbackLinks && supabaseUrl && tokenHash ? verifyUrl(supabaseUrl, tokenHash, 'email_change') : undefined
    if (data?.token && data?.token_new) {
      return [
        { to: email, content: emailChangeEmail({ code: data.token, newEmail, toNewAddress: false, fallbackUrl: link(data.token_hash_new) }) },
        { to: newEmail, content: emailChangeEmail({ code: data.token_new, newEmail, toNewAddress: true, fallbackUrl: link(data.token_hash) }) },
      ]
    }
    const code = data?.token_new || data?.token
    if (!code) return { error: 'Missing token' }
    return [{ to: newEmail, content: emailChangeEmail({ code, newEmail, toNewAddress: true, fallbackUrl: link(data?.token_hash || data?.token_hash_new) }) }]
  }

  if (!supabaseUrl) return { error: 'SUPABASE_URL is not configured' }

  if (MAGIC_LINK_TYPES.includes(eventType)) {
    if (!data?.token_hash) return { error: 'Missing token' }
    return [{ to: email, content: magicLinkEmail(verifyUrl(supabaseUrl, data.token_hash, 'magiclink')) }]
  }

  // Notifications de sécurité (mot de passe modifié…) : pas de modèle, on
  // n'envoie rien plutôt que de faire échouer l'action de l'utilisateur.
  if (eventType.endsWith('notification')) return []

  return { error: `Unsupported email type: ${eventType}` }
}
