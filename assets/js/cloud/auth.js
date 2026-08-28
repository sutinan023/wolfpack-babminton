const SUPABASE_URL='https://puwkuhqmdzdhxbafttxq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_6sCSs2KSDxiPvPBNttvS7A_2y60aVWe';
const SESSION_KEY='badminton_cloud_auth_session';
const AUTH_MODE_KEY='badminton_cloud_auth_mode';
export const AUTH_MODES={MAGIC_LINK:'magic_link',EMAIL_OTP:'email_otp'};
const DEFAULT_AUTH_MODE=AUTH_MODES.MAGIC_LINK;
const DEFAULT_MAGIC_LINK_REDIRECT='http://localhost:8080';
const authStateListeners=new Set();

async function api(path,{method='GET',body,accessToken}={}){
  const headers={apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'};
  if(accessToken)headers.Authorization=`Bearer ${accessToken}`;
  const response=await fetch(`${SUPABASE_URL}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  let data=null;try{data=await response.json();}catch{}
  if(!response.ok){const e=new Error(data?.msg||data?.message||data?.error_description||data?.error||`HTTP ${response.status}`);e.status=response.status;e.data=data;throw e;}
  return data;
}

function getBrowserLocation(){
  if(typeof location==='undefined') return null;
  return {origin:location.origin,pathname:location.pathname||'/',search:location.search||'',href:location.href||''};
}

export function getAuthMode(){
  try{const saved=localStorage.getItem(AUTH_MODE_KEY); if(saved===AUTH_MODES.EMAIL_OTP||saved===AUTH_MODES.MAGIC_LINK)return saved;}catch{}
  return DEFAULT_AUTH_MODE;
}

export function setAuthMode(mode){
  const next=(mode===AUTH_MODES.EMAIL_OTP||mode===AUTH_MODES.MAGIC_LINK)?mode:DEFAULT_AUTH_MODE;
  localStorage.setItem(AUTH_MODE_KEY,next);
  return next;
}

function emitAuthState(event,session){
  for(const listener of authStateListeners){
    try{listener(event,session);}catch{}
  }
}

export function getSession(){return {data:{session:getStoredCloudSession()},error:null};}

export function onAuthStateChange(callback){
  if(typeof callback==='function')authStateListeners.add(callback);
  return {data:{subscription:{unsubscribe(){if(typeof callback==='function')authStateListeners.delete(callback);}}}};
}

export function sessionModeLabel(mode){return mode===AUTH_MODES.EMAIL_OTP?'Email OTP':'Magic Link';}

function magicLinkRedirectUrl(){
  const loc=getBrowserLocation();
  if(!loc?.origin) return DEFAULT_MAGIC_LINK_REDIRECT;
  return `${loc.origin}${loc.pathname || '/'}`;
}

function normalizeEmail(email){
  const value=String(email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(value))throw new Error('อีเมลไม่ถูกต้อง');
  return value;
}

function parseAuthRedirectParams(rawUrl){
  const safeUrl=String(rawUrl||'');
  const fallback=DEFAULT_MAGIC_LINK_REDIRECT;
  const target=new URL(safeUrl||fallback,fallback);
  const params=new URLSearchParams(target.search);
  if(target.hash){
    const hashPart=target.hash.startsWith('#')?target.hash.slice(1):target.hash;
    for(const [k,v] of new URLSearchParams(hashPart).entries())params.set(k,v);
  }
  return params;
}

export function extractMagicLinkSession(rawUrl){
  const params=parseAuthRedirectParams(rawUrl);
  const accessToken=params.get('access_token');
  const refreshToken=params.get('refresh_token');
  if(!accessToken||!refreshToken)return null;
  const numericExpiresIn=Number(params.get('expires_in')||params.get('expiresIn')||3600);
  const numericExpiresAt=Number(params.get('expires_at')||'0');
  const expires_at=Number.isFinite(numericExpiresAt)&&numericExpiresAt>0
    ?Math.floor(numericExpiresAt/1000)
    :Math.floor(Date.now()/1000)+((Number.isFinite(numericExpiresIn)&&numericExpiresIn>0)?numericExpiresIn:3600);
  return {
    access_token:accessToken,
    refresh_token:refreshToken,
    expires_at,
    user:{email:params.get('email')||null}
  };
}

export async function restoreSessionFromAuthUrl(rawUrl=getBrowserLocation()?.href,clear=true){
  const session=extractMagicLinkSession(rawUrl);
  if(!session)return null;
  setAuthMode(AUTH_MODES.MAGIC_LINK);
  storeCloudSession(session);
  if(clear&&typeof history!=='undefined'&&typeof history.replaceState==='function'&&typeof location!=='undefined'){
    const cleanUrl=`${location.origin}${location.pathname}${location.search}`;
    history.replaceState({},document.title||'',cleanUrl);
  }
  return session;
}

export function getStoredCloudSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}}
export function storeCloudSession(session){
  const value=session?{...session}:null;
  if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value));else localStorage.removeItem(SESSION_KEY);
  emitAuthState(value?'SIGNED_IN':'SIGNED_OUT',value);
  return value;
}
export function clearCloudSession(){
  localStorage.removeItem(SESSION_KEY);
  emitAuthState('SIGNED_OUT',null);
}
export function sessionIsUsable(session,marginSeconds=60){if(!session?.access_token)return false;const exp=session.expires_at||0;return exp*1000>Date.now()+marginSeconds*1000;}

export function sessionFromTokens(payload={}){const expIn=Number(payload.expires_in||payload.expiresIn||3600);return {access_token:payload.access_token,refresh_token:payload.refresh_token,expires_at:payload.expires_in?Math.floor(Date.now()/1000)+Number(payload.expires_in):Math.floor(Date.now()/1000)+(Number.isFinite(expIn)&&expIn>0?expIn:3600),user:payload.user};}

export async function sendEmailOtp(email){
  const normalized=normalizeEmail(email);
  await api('/auth/v1/otp',{method:'POST',body:{email:normalized,create_user:true,type:'email'}});
  return normalized;
}

export async function sendEmailMagicLink(email){
  const normalized=normalizeEmail(email);
  const redirectTo=magicLinkRedirectUrl();
  await api('/auth/v1/otp',{
    method:'POST',
    body:{
      email:normalized,
      create_user:true,
      type:'magiclink',
      options:{
        emailRedirectTo:redirectTo,
        shouldCreateUser:true,
        email_redirect_to:redirectTo,
        should_create_user:true
      }
    }
  });
  return normalized;
}

export async function verifyEmailOtp(email,token){
  const data=await api('/auth/v1/verify',{method:'POST',body:{email:normalizeEmail(email),token:String(token).trim(),type:'email'}});
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
