const STORAGE_KEY='badminton_admin_pin_v1';
const MAX_ATTEMPTS=5;
const LOCK_MS=5*60*1000;

function resolveStorage(storage){
  const value=storage||globalThis.localStorage;
  if(!value)throw new Error('pin_storage_unavailable');
  return value;
}

function readRecord(storage){
  try{
    const value=JSON.parse(resolveStorage(storage).getItem(STORAGE_KEY)||'null');
    return value?.salt&&value?.hash?value:null;
  }catch{return null;}
}

function saveRecord(storage,record){resolveStorage(storage).setItem(STORAGE_KEY,JSON.stringify(record));}
function bytesToHex(bytes){return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
function sameHash(left,right){if(left.length!==right.length)return false;let diff=0;for(let i=0;i<left.length;i+=1)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0;}

async function pinHash(pin,salt,cryptoImpl){
  const cryptoValue=cryptoImpl||globalThis.crypto;
  if(!cryptoValue?.subtle)throw new Error('pin_crypto_unavailable');
  const digest=await cryptoValue.subtle.digest('SHA-256',new TextEncoder().encode(`${salt}:${pin}`));
  return bytesToHex(new Uint8Array(digest));
}

export function isAdminPinConfigured(storage){return Boolean(readRecord(storage));}

export function adminEntryMode({pinConfigured}){
  return pinConfigured?'unlock_pin':'setup_pin';
}

export function canShowOrganizerControls({view,adminUnlocked}){
  return view==='admin'&&adminUnlocked===true;
}

export function getAdminPinStatus(storage,{now=Date.now}={}){
  const record=readRecord(storage);
  if(!record)return {configured:false,locked:false,retryAfterMs:0,attemptsRemaining:MAX_ATTEMPTS};
  const retryAfterMs=Math.max(0,Number(record.lockedUntil||0)-Number(now()));
  return {configured:true,locked:retryAfterMs>0,retryAfterMs,attemptsRemaining:retryAfterMs>0?0:Math.max(0,MAX_ATTEMPTS-Number(record.failedAttempts||0))};
}

export async function configureAdminPin(pin,{storage,cryptoImpl}={}){
  if(!/^\d{6}$/.test(String(pin||'')))throw new Error('pin_format_invalid');
  const cryptoValue=cryptoImpl||globalThis.crypto;
  if(!cryptoValue?.getRandomValues)throw new Error('pin_crypto_unavailable');
  const salt=bytesToHex(cryptoValue.getRandomValues(new Uint8Array(16)));
  const hash=await pinHash(pin,salt,cryptoValue);
  saveRecord(storage,{salt,hash,failedAttempts:0,lockedUntil:0});
}

export async function verifyAdminPin(pin,{storage,cryptoImpl,now=Date.now}={}){
  const record=readRecord(storage);
  if(!record)return {ok:false,locked:false,retryAfterMs:0,error:'pin_not_configured'};
  const timestamp=Number(now());
  const retryAfterMs=Math.max(0,Number(record.lockedUntil||0)-timestamp);
  if(retryAfterMs>0)return {ok:false,locked:true,retryAfterMs};
  if(record.lockedUntil){record.lockedUntil=0;record.failedAttempts=0;}
  const validFormat=/^\d{6}$/.test(String(pin||''));
  const hash=validFormat?await pinHash(pin,record.salt,cryptoImpl):'';
  if(validFormat&&sameHash(hash,record.hash)){
    saveRecord(storage,{...record,failedAttempts:0,lockedUntil:0});
    return {ok:true,locked:false,retryAfterMs:0};
  }
  const failedAttempts=Number(record.failedAttempts||0)+1;
  if(failedAttempts>=MAX_ATTEMPTS){
    saveRecord(storage,{...record,failedAttempts:0,lockedUntil:timestamp+LOCK_MS});
    return {ok:false,locked:true,retryAfterMs:LOCK_MS};
  }
  saveRecord(storage,{...record,failedAttempts,lockedUntil:0});
  return {ok:false,locked:false,retryAfterMs:0,attemptsRemaining:MAX_ATTEMPTS-failedAttempts};
}
