export function getDaysUntilBirthday(dateString) {
  if (dateString == null) return null

  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()

  const birth = new Date(dateString)
  const birthMonth = birth.getUTCMonth()
  const birthDay = birth.getUTCDate()

  let next = new Date(todayYear, birthMonth, birthDay)
  if (
    next.getMonth() < todayMonth ||
    (next.getMonth() === todayMonth && next.getDate() < todayDay)
  ) {
    next = new Date(todayYear + 1, birthMonth, birthDay)
  }

  const todayMidnight = new Date(todayYear, todayMonth, todayDay)
  return Math.round((next - todayMidnight) / 86400000)
}
