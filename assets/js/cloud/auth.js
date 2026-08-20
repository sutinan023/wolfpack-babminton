const SUPABASE_URL='https://puwkuhqmdzdhxbafttxq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_6sCSs2KSDxiPvPBNttvS7A_2y60aVWe';
const SESSION_KEY='badminton_cloud_auth_session';

async function api(path,{method='GET',body,accessToken}={}){
  const headers={apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'};
  if(accessToken)headers.Authorization=`Bearer ${accessToken}`;
  const response=await fetch(`${SUPABASE_URL}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await response.json();}catch{}
  if(!response.ok){const e=new Error(data?.msg||data?.message||data?.error_description||data?.error||`HTTP ${response.status}`);e.status=response.status;e.data=data;throw e;}
  return data;
}

export function getStoredCloudSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}
export function storeCloudSession(session){if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY);return session;}
export function clearCloudSession(){localStorage.removeItem(SESSION_KEY);}
export function sessionIsUsable(session,marginSeconds=60){if(!session?.access_token)return false;const exp=session.expires_at||0;return exp*1000>Date.now()+marginSeconds*1000;}

export async function sendEmailOtp(email){
  const normalized=String(email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(normalized))throw new Error('อีเมลไม่ถูกต้อง');
  await api('/auth/v1/otp',{method:'POST',body:{email:normalized,create_user:true}});
  return normalized;
}

export async function verifyEmailOtp(email,token){
  const data=await api('/auth/v1/verify',{method:'POST',body:{email:String(email).trim().toLowerCase(),token:String(token).trim(),type:'email'}});
  const session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600),user:data.user};
  return storeCloudSession(session);
}

export async function refreshCloudSession(session=getStoredCloudSession()){
  if(!session?.refresh_token)throw new Error('ไม่มี refresh token');
  const data=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});
  const next={access_token:data.access_token,refresh_token:data.refresh_token||session.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600),user:data.user||session.user};
  return storeCloudSession(next);
}

export async function ensureCloudSession(){
  const session=getStoredCloudSession();
  if(!session)return null;
  if(sessionIsUsable(session))return session;
  if(!navigator.onLine)return session;
  try{return await refreshCloudSession(session);}catch{clearCloudSession();return null;}
}

export async function loadClubMembership(session){
  if(!session?.access_token)return null;
  const rows=await api('/rest/v1/club_users?select=club_id,role,clubs(id,name,code,member_prefix,timezone)&limit=1',{accessToken:session.access_token});
  return Array.isArray(rows)&&rows.length?rows[0]:null;
}

export async function bootstrapClub(session,{name,code,memberPrefix='BD'}){
  const response=await fetch(`${SUPABASE_URL}/functions/v1/bootstrap-club`,{
    method:'POST',
    headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
    body:JSON.stringify({name,code,member_prefix:memberPrefix})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(data.error||`HTTP ${response.status}`);e.status=response.status;throw e;}
  return data;
}

export function cloudConfig(){return {url:SUPABASE_URL,publishableKey:PUBLISHABLE_KEY};}
