const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  let body: {
    invitee_email: string
    invitee_name: string
    sender_name: string
    event_title: string
    event_date: string
    event_id: string
  }

  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { invitee_email, invitee_name, sender_name, event_title, event_date, event_id } = body

  if (!invitee_email || !sender_name || !event_title || !event_id) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const displayName = invitee_name || invitee_email.split('@')[0]
  const eventUrl = `https://amiv.app/events/${event_id}`
  const unsubscribeUrl = `mailto:unsubscribe@amiv.app?subject=unsubscribe&body=${encodeURIComponent(invitee_email)}`

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0D0D1A;margin:0;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#1A1A2E;border-radius:20px;overflow:hidden;box-shadow:0 2px 32px rgba(0,0,0,0.4)">
    <div style="background:linear-gradient(135deg,#e055aa,#f5a623);padding:36px 24px;text-align:center">
      <div style="font-size:52px">🎉</div>
      <h1 style="color:#fff;margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.3px">Tu es invité(e) !</h1>
      <p style="color:rgba(255,255,255,0.88);margin:0;font-size:15px;font-weight:500">${sender_name} t'invite à un événement</p>
    </div>
    <div style="padding:28px 24px">
      <p style="color:#E5E5EA;font-size:16px;margin:0 0 24px;line-height:1.5">
        Salut ${displayName} 👋<br><br>
        <strong style="color:#fff">${sender_name}</strong> t'a envoyé une invitation pour rejoindre :
      </p>
      <div style="background:#252540;border-radius:14px;padding:18px 20px;margin-bottom:28px;border:1px solid rgba(224,85,170,0.2)">
        <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:8px">${event_title}</div>
        ${event_date ? `<div style="font-size:14px;color:#A9A9BC;display:flex;align-items:center;gap:6px">📅&nbsp;${event_date}</div>` : ''}
      </div>
      <a
        href="${eventUrl}"
        style="display:block;text-align:center;background:linear-gradient(135deg,#e055aa,#f5a623);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:12px;letter-spacing:0.2px"
      >
        Voir l'invitation →
      </a>
      <p style="color:#636380;font-size:12px;margin:24px 0 0;text-align:center;line-height:1.6">
        Tu reçois cet email car tu as été invité(e) via AMIV.<br>
        Si tu ne connais pas cet événement, tu peux ignorer ce message.<br><br>
        <a href="${unsubscribeUrl}" style="color:#4A4A6A;font-size:11px;text-decoration:underline">Se désabonner</a>
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
      to: [invitee_email],
      subject: `🎉 ${sender_name} t'invite à "${event_title}"`,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Resend error:', errText)
    return new Response(JSON.stringify({ error: errText }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
