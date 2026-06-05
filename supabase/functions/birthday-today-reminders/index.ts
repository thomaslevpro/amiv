import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type BirthdayTodayReminderResult = {
  inserted_count: number
  skipped_count: number
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

  const requestId = crypto.randomUUID()
  console.log('[birthday-today-reminders] start', {
    requestId,
    method: req.method,
    url: req.url,
  })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabase.rpc('create_birthday_today_notifications')

  if (error) {
    console.error('[birthday-today-reminders] rpc_error', {
      requestId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return json({ error: error.message }, 500)
  }

  const result = (data?.[0] ?? { inserted_count: 0, skipped_count: 0 }) as BirthdayTodayReminderResult

  console.log('[birthday-today-reminders] success', {
    requestId,
    inserted: result.inserted_count,
    skipped: result.skipped_count,
  })

  return json({
    success: true,
    inserted: result.inserted_count,
    skipped: result.skipped_count,
  })
})
