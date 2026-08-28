import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { member_code?: unknown }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const memberCode = typeof body.member_code === 'string' ? body.member_code.trim().toUpperCase() : ''
  if (!/^[A-Z0-9][A-Z0-9+\-]{3,19}$/.test(memberCode)) return json({ error: 'invalid_member_code' }, 400)

  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
  const legacyServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const secretKey = secretKeysRaw ? JSON.parse(secretKeysRaw).default : legacyServiceKey
  if (!secretKey) return json({ error: 'server_configuration_error' }, 500)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    secretKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await supabaseAdmin.rpc('get_player_profile', { member_code_input: memberCode })
  if (error) return json({ error: 'profile_lookup_failed' }, 500)
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return json({ error: 'member_not_found' }, 404)
  return json(data)
})
