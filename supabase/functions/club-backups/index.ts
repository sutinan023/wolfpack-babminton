const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
}

function envKey(name:string,legacy:string){
  const raw=Deno.env.get(name);
  if(raw){
    try{const parsed=JSON.parse(raw);if(parsed?.default)return parsed.default as string;}catch{}
  }
  return Deno.env.get(legacy)??'';
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);

  const supabaseUrl=Deno.env.get('SUPABASE_URL')??'';
  const publishableKey=envKey('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
  const secretKey=envKey('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
  const authorization=req.headers.get('Authorization')??'';
  if(!supabaseUrl||!publishableKey||!secretKey||!authorization.startsWith('Bearer ')){
    return json({error:'cloud_configuration_or_auth_missing'},401);
  }

  const userResponse=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:publishableKey,Authorization:authorization}});
  if(!userResponse.ok)return json({error:'invalid_session'},401);
  const user=await userResponse.json();

  let body:any;
  try{body=await req.json();}catch{return json({error:'invalid_json'},400);}
  const action=String(body?.action??'');
  const clubId=String(body?.club_id??'');
  if(!clubId||!['create','list','get'].includes(action))return json({error:'invalid_backup_request'},400);

  const serviceHeaders={apikey:secretKey,Authorization:`Bearer ${secretKey}`};
  const membershipUrl=new URL(`${supabaseUrl}/rest/v1/club_users`);
  membershipUrl.searchParams.set('select','role');
  membershipUrl.searchParams.set('club_id',`eq.${clubId}`);
  membershipUrl.searchParams.set('user_id',`eq.${user.id}`);
  membershipUrl.searchParams.set('limit','1');
  const membershipResponse=await fetch(membershipUrl,{headers:serviceHeaders});
  const memberships=await membershipResponse.json().catch(()=>[]);
  if(!membershipResponse.ok)return json({error:'membership_lookup_failed'},500);
  if(!memberships.length||!['owner','admin'].includes(memberships[0].role))return json({error:'club_write_forbidden'},403);

  if(action==='list'){
    const url=new URL(`${supabaseUrl}/rest/v1/club_backups`);
    url.searchParams.set('select','id,label,member_count,session_count,sync_revision,created_at');
    url.searchParams.set('club_id',`eq.${clubId}`);
    url.searchParams.set('order','created_at.desc');
    url.searchParams.set('limit','20');
    const response=await fetch(url,{headers:serviceHeaders});
    const backups=await response.json().catch(()=>[]);
    return response.ok?json({backups}):json({error:'backup_list_failed'},500);
  }

  if(action==='get'){
    const backupId=String(body?.backup_id??'');
    if(!backupId)return json({error:'backup_id_required'},400);
    const url=new URL(`${supabaseUrl}/rest/v1/club_backups`);
    url.searchParams.set('select','id,label,snapshot,member_count,session_count,sync_revision,created_at');
    url.searchParams.set('club_id',`eq.${clubId}`);
    url.searchParams.set('id',`eq.${backupId}`);
    url.searchParams.set('limit','1');
    const response=await fetch(url,{headers:serviceHeaders});
    const rows=await response.json().catch(()=>[]);
    if(!response.ok)return json({error:'backup_load_failed'},500);
    if(!rows.length)return json({error:'backup_not_found'},404);
    return json({backup:rows[0]});
  }

  const snapshot=body?.snapshot;
  if(!snapshot||!Array.isArray(snapshot.members)||!Array.isArray(snapshot.sessions))return json({error:'invalid_backup_snapshot'},400);
  if(new TextEncoder().encode(JSON.stringify(snapshot)).length>5_000_000)return json({error:'backup_too_large'},413);
  const insertResponse=await fetch(`${supabaseUrl}/rest/v1/club_backups`,{
    method:'POST',
    headers:{...serviceHeaders,'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify({
      club_id:clubId,
      created_by:user.id,
      label:String(body?.label??'').slice(0,100),
      snapshot,
      member_count:snapshot.members.length,
      session_count:snapshot.sessions.length,
      sync_revision:Number(snapshot?.cloudSync?.revision)||0
    })
  });
  const rows=await insertResponse.json().catch(()=>[]);
  if(!insertResponse.ok)return json({error:rows?.message??'backup_create_failed'},500);
  return json({backup:rows[0]},201);
});
