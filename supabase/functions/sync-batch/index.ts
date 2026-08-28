const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function envKey(name: string, legacy: string) {
  const raw = Deno.env.get(name);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return parsed.default as string;
    } catch {
      // fall through to legacy value
    }
  }
  return Deno.env.get(legacy) ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !publishableKey || !secretKey || !authorization.startsWith('Bearer ')) {
    return json({ error: 'cloud_configuration_or_auth_missing' }, 401);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: authorization },
  });
  if (!userResponse.ok) return json({ error: 'invalid_session' }, 401);
  const user = await userResponse.json();

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const clubId = String(body?.club_id ?? '');
  const baseRevision = Number(body?.base_revision ?? 0);
  const events = Array.isArray(body?.events) ? body.events : [];
  const snapshot = body?.snapshot;
  const deviceLocalId = String(snapshot?.device?.localId ?? '');
  if (!clubId || !deviceLocalId || !snapshot || !Array.isArray(snapshot?.members) || !Array.isArray(snapshot?.sessions)) {
    return json({ error: 'invalid_sync_payload' }, 400);
  }

  const membershipUrl = new URL(`${supabaseUrl}/rest/v1/club_users`);
  membershipUrl.searchParams.set('select', 'role');
  membershipUrl.searchParams.set('club_id', `eq.${clubId}`);
  membershipUrl.searchParams.set('user_id', `eq.${user.id}`);
  membershipUrl.searchParams.set('limit', '1');
  const membershipResponse = await fetch(membershipUrl, { headers: { apikey: secretKey } });
  if (!membershipResponse.ok) return json({ error: 'membership_lookup_failed' }, 500);
  const memberships = await membershipResponse.json();
  if (!Array.isArray(memberships) || !memberships.length || !['owner','admin'].includes(memberships[0].role)) {
    return json({ error: 'club_write_forbidden' }, 403);
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_club_snapshot`, {
    method: 'POST',
    headers: { apikey: secretKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_club_id: clubId,
      p_user_id: user.id,
      p_device_local_id: deviceLocalId,
      p_base_revision: baseRevision,
      p_events: events,
      p_snapshot: snapshot,
    }),
  });
  const result = await rpcResponse.json().catch(() => ({}));
  if (!rpcResponse.ok) return json({ error: result?.message ?? result?.error ?? 'sync_apply_failed' }, rpcResponse.status >= 400 && rpcResponse.status < 600 ? rpcResponse.status : 500);
  if (result?.status === 'conflict') return json(result, 409);
  return json(result, 200);
});
