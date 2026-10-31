// Nom affiché d'un utilisateur : « Prénom Nom ». Même règle que la fonction SQL
// public.profile_full_name. Selon l'époque du compte, name contient le nom de
// famille, le prénom (onboarding actuel) ou le nom complet : on évite donc
// « Thomas Thomas » et « Thomas Thomas Levy ». Une lettre seule (« L ») ne
// compte pas comme un nom : on renvoie '' et l'appelant passe au @pseudo.
export function fullName(firstName, lastName) {
  const name = joinNames(firstName?.trim() || '', lastName?.trim() || '')
  return name.length > 1 ? name : ''
}

function joinNames(first, last) {
  if (!first) return last
  if (!last || last.toLowerCase() === first.toLowerCase()) return first
  if (last.toLowerCase().startsWith(`${first.toLowerCase()} `)) return last
  return `${first} ${last}`
}

// Profil (first_name, name, username)
export function profileFullName(profile, fallback = 'Ami') {
  return fullName(profile?.first_name, profile?.name)
    || (profile?.username ? `@${profile.username}` : '')
    || fallback
}

// Ami renvoyé par get_friends (friend_first_name, friend_name, friend_username)
export function friendFullName(friend, fallback = 'Ami') {
  return fullName(friend?.friend_first_name, friend?.friend_name)
    || (friend?.friend_username ? `@${friend.friend_username}` : '')
    || fallback
}
