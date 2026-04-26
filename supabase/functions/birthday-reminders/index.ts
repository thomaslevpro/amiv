import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // Allow manual trigger via POST, and scheduled invocation
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Target date: 7 days from now (month-day match, ignoring year)
  const target = new Date()
  target.setDate(target.getDate() + 7)
  const targetMonth = target.getMonth() + 1 // 1-12
  const targetDay = target.getDate()

  // Fetch birthdays whose month/day matches target date
  // We use EXTRACT on the date column to match regardless of year
  const { data: birthdays, error: bdError } = await supabase
    .from('birthdays')
    .select('id, user_id, name, date')
    .filter('date', 'not.is', null)

  if (bdError) {
    console.error('Error fetching birthdays:', bdError)
    return new Response(JSON.stringify({ error: bdError.message }), { status: 500 })
  }

  // Filter client-side to match month and day
  const upcoming = (birthdays ?? []).filter((b) => {
    const d = new Date(b.date)
    return d.getMonth() + 1 === targetMonth && d.getDate() === targetDay
  })

  if (upcoming.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No birthdays in 7 days' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get emails for all concerned user_ids
  const userIds = [...new Set(upcoming.map((b) => b.user_id))]
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError) {
    console.error('Error fetching users:', usersError)
    return new Response(JSON.stringify({ error: usersError.message }), { status: 500 })
  }

  const emailById = new Map(
    (users?.users ?? [])
      .filter((u) => userIds.includes(u.id) && u.email)
      .map((u) => [u.id, u.email!])
  )

  // Fetch display names from profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds)

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name ?? null]))

  // Send one email per user listing their upcoming birthdays
  const grouped = new Map<string, typeof upcoming>()
  for (const b of upcoming) {
    const list = grouped.get(b.user_id) ?? []
    list.push(b)
    grouped.set(b.user_id, list)
  }

  let sent = 0
  const errors: string[] = []

  for (const [userId, bdList] of grouped) {
    const email = emailById.get(userId)
    if (!email) continue

    const userName = nameById.get(userId) ?? 'toi'
    const birthdayLines = bdList
      .map((b) => {
        const d = new Date(b.date)
        const age = target.getFullYear() - d.getFullYear()
        return `<li><strong>${b.name}</strong> fête ses ${age} ans dans 7 jours 🎂</li>`
      })
      .join('')

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F2F2F7;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#e055aa,#f5a623);padding:32px 24px;text-align:center">
      <div style="font-size:48px">🎂</div>
      <h1 style="color:#fff;margin:12px 0 4px;font-size:22px;font-weight:700">Rappel d'anniversaire</h1>
      <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px">Dans 7 jours</p>
    </div>
    <div style="padding:24px">
      <p style="color:#1C1C1E;font-size:16px;margin:0 0 16px">Salut ${userName} 👋</p>
      <p style="color:#3C3C43;font-size:15px;margin:0 0 16px">
        N'oublie pas ces anniversaires qui arrivent dans <strong>7 jours</strong> :
      </p>
      <ul style="color:#1C1C1E;font-size:15px;line-height:1.8;padding-left:20px;margin:0 0 24px">
        ${birthdayLines}
      </ul>
      <p style="color:#8E8E93;font-size:13px;margin:0">
        Tu reçois cet email car tu as activé les rappels d'anniversaire dans AMIV.
      </p>
    </div>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AMIV <no-reply@amiv.app>',
        to: [email],
        subject: `🎂 Rappel : ${bdList.map((b) => b.name).join(', ')} fête${bdList.length > 1 ? 'nt' : ''} son anniversaire dans 7 jours`,
        html,
      }),
    })

    if (res.ok) {
      sent++
    } else {
      const body = await res.text()
      errors.push(`${email}: ${body}`)
      console.error(`Resend error for ${email}:`, body)
    }
  }

  return new Response(
    JSON.stringify({ sent, errors: errors.length ? errors : undefined }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
