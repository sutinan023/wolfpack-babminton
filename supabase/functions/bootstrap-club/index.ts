import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function secretKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (raw) return JSON.parse(raw).default
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return json({ error: 'unauthorized' }, 401)

  const key = secretKey()
  if (!key) return json({ error: 'server_configuration_error' }, 500)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) return json({ error: 'unauthorized' }, 401)

  let body: { name?: unknown; code?: unknown; member_prefix?: unknown }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const memberPrefix = typeof body.member_prefix === 'string' ? body.member_prefix.trim().toUpperCase() : 'BD'

  if (name.length < 2 || name.length > 80) return json({ error: 'invalid_club_name' }, 400)
  if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) return json({ error: 'invalid_club_code' }, 400)
  if (!/^[A-Z0-9]{1,6}$/.test(memberPrefix)) return json({ error: 'invalid_member_prefix' }, 400)

  const { data: existingMembership, error: membershipError } = await admin
    .from('club_users')
    .select('club_id, role, clubs(id,name,code,member_prefix,timezone)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membershipError) return json({ error: 'membership_lookup_failed' }, 500)
  if (existingMembership) return json({ club: existingMembership.clubs, role: existingMembership.role, existing: true })

  const { data: club, error: clubError } = await admin
    .from('clubs')
    .insert({ name, code, member_prefix: memberPrefix, timezone: 'Asia/Bangkok' })
    .select('id,name,code,member_prefix,timezone')
    .single()

  if (clubError) {
    if (clubError.code === '23505') return json({ error: 'club_code_exists' }, 409)
    return json({ error: 'club_create_failed' }, 500)
  }

  const { error: ownerError } = await admin.from('club_users').insert({ club_id: club.id, user_id: user.id, role: 'owner' })
  if (ownerError) {
    await admin.from('clubs').delete().eq('id', club.id)
    return json({ error: 'club_owner_create_failed' }, 500)
  }

  return json({ club, role: 'owner', existing: false }, 201)
})
