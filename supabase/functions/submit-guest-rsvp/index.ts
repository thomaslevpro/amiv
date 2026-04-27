import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  let body: {
    action: string
    token?: string
    invite_token?: string
    guest_name?: string
    guest_email?: string
    response?: string
  }

  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── GET EVENT DETAILS ────────────────────────────────────────────────────────
  if (body.action === 'get_event') {
    const { token } = body
    if (!token) return json({ error: 'Token manquant' }, 400)

    const { data: event } = await supabase
      .from('events')
      .select('id, name, date, location, description, type, user_id')
      .eq('invite_token', token)
      .maybeSingle()

    if (!event) return json({ error: 'Événement introuvable' }, 404)

    const [{ data: profile }, { count: rsvpCount }, { count: guestCount }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', event.user_id).maybeSingle(),
      supabase.from('rsvps').select('id', { count: 'exact', head: true }).eq('event_id', event.id).eq('status', 'going'),
      supabase.from('guest_rsvps').select('id', { count: 'exact', head: true }).eq('event_id', event.id).eq('response', 'yes'),
    ])

    return json({
      event: {
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        description: event.description,
        type: event.type,
      },
      organizer_name: profile?.name ?? null,
      confirmed_count: (rsvpCount ?? 0) + (guestCount ?? 0),
    })
  }

  // ── SUBMIT GUEST RSVP ────────────────────────────────────────────────────────
  if (body.action === 'submit') {
    const { invite_token, guest_name, guest_email, response } = body

    if (!invite_token || !guest_name || !guest_email || !response) {
      return json({ error: 'Champs manquants' }, 400)
    }
    if (!['yes', 'no', 'maybe'].includes(response)) {
      return json({ error: 'Réponse invalide' }, 400)
    }

    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('invite_token', invite_token)
      .maybeSingle()

    if (!event) return json({ error: 'Événement introuvable' }, 404)

    const { error: insertErr } = await supabase
      .from('guest_rsvps')
      .insert({ event_id: event.id, guest_name, guest_email, response })

    if (insertErr) return json({ error: insertErr.message }, 500)

    return json({ success: true })
  }

  return json({ error: 'Action inconnue' }, 400)
})
