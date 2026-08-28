import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  adminEntryMode,
  canShowOrganizerControls,
  configureAdminPin,
  getAdminPinStatus,
  isAdminPinConfigured,
  verifyAdminPin
} from '../assets/js/security/admin-pin.js';

class MemoryKeyValueStorage {
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
}

async function test(name,fn){
  try{await fn();console.log(`PASS ${name}`);}
  catch(error){console.error(`FAIL ${name}`);throw error;}
}

await test('configured PIN is hashed and the correct PIN unlocks',async()=>{
  const storage=new MemoryKeyValueStorage();
  await configureAdminPin('246810',{storage,cryptoImpl:webcrypto});
  assert.equal(isAdminPinConfigured(storage),true);
  assert.equal([...storage.values.values()].some(value=>value.includes('246810')),false,'plaintext PIN must never be stored');
  assert.deepEqual(await verifyAdminPin('246810',{storage,cryptoImpl:webcrypto,now:()=>1_000}),{ok:true,locked:false,retryAfterMs:0});
});

await test('PIN must contain exactly six digits',async()=>{
  const storage=new MemoryKeyValueStorage();
  await assert.rejects(()=>configureAdminPin('1234',{storage,cryptoImpl:webcrypto}),/pin_format_invalid/);
  await assert.rejects(()=>configureAdminPin('abcdef',{storage,cryptoImpl:webcrypto}),/pin_format_invalid/);
  assert.equal(isAdminPinConfigured(storage),false);
});

await test('admin entry allows local PIN setup without cloud auth',async()=>{
  assert.equal(adminEntryMode({pinConfigured:false,cloudConnected:false}),'setup_pin');
  assert.equal(adminEntryMode({pinConfigured:false,cloudConnected:true}),'setup_pin');
  assert.equal(adminEntryMode({pinConfigured:true,cloudConnected:true}),'unlock_pin');
  assert.equal(adminEntryMode({pinConfigured:true,cloudConnected:false}),'unlock_pin');
});

await test('organizer controls are visible only in an unlocked admin view',async()=>{
  assert.equal(canShowOrganizerControls({view:'player',adminUnlocked:false}),false);
  assert.equal(canShowOrganizerControls({view:'player',adminUnlocked:true}),false);
  assert.equal(canShowOrganizerControls({view:'admin',adminUnlocked:false}),false);
  assert.equal(canShowOrganizerControls({view:'admin',adminUnlocked:true}),true);
});

await test('five wrong attempts lock PIN verification for five minutes',async()=>{
  const storage=new MemoryKeyValueStorage();
  let now=10_000;
  await configureAdminPin('246810',{storage,cryptoImpl:webcrypto});
  for(let attempt=1;attempt<=4;attempt+=1){
    const result=await verifyAdminPin('000000',{storage,cryptoImpl:webcrypto,now:()=>now});
    assert.equal(result.ok,false);
    assert.equal(result.locked,false);
    assert.equal(result.attemptsRemaining,5-attempt);
  }
  const fifth=await verifyAdminPin('000000',{storage,cryptoImpl:webcrypto,now:()=>now});
  assert.equal(fifth.ok,false);
  assert.equal(fifth.locked,true);
  assert.equal(fifth.retryAfterMs,300_000);
  assert.equal((await verifyAdminPin('246810',{storage,cryptoImpl:webcrypto,now:()=>now+299_999})).locked,true);
  now+=300_000;
  assert.deepEqual(await verifyAdminPin('246810',{storage,cryptoImpl:webcrypto,now:()=>now}),{ok:true,locked:false,retryAfterMs:0});
  assert.deepEqual(getAdminPinStatus(storage,{now:()=>now}),{configured:true,locked:false,retryAfterMs:0,attemptsRemaining:5});
});
