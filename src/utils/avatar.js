// Initiale d'avatar : toujours celle du vrai prénom, jamais celle d'un
// libellé d'affichage comme « Moi ».
export function avatarInitial(profile, fallback = '?') {
  const source = profile?.first_name || profile?.name || profile?.username || profile?.full_name || fallback
  return String(source).trim().charAt(0).toUpperCase() || fallback
}
