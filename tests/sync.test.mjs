import assert from 'node:assert/strict';
import { MemoryStorage } from '../assets/js/storage/memory.js';
import { SyncEngine } from '../assets/js/sync/sync.js';

function test(name, fn){return Promise.resolve().then(fn).then(()=>console.log(`PASS ${name}`)).catch(e=>{console.error(`FAIL ${name}`);throw e})}

await test('enqueue creates pending sync event', async()=>{
  const storage=new MemoryStorage();
  const sync=new SyncEngine(storage,{isOnline:()=>false});
  await sync.enqueue('CHECK_IN',{memberId:'m1'});
  assert.equal(await sync.pendingCount(),1);
  const items=await storage.getSyncEvents();
  assert.equal(items[0].status,'pending');
});

await test('mock sync marks pending events synced when online', async()=>{
  const storage=new MemoryStorage();
  const sync=new SyncEngine(storage,{isOnline:()=>true});
  await sync.enqueue('CREATE_MATCH',{matchId:'m1'});
  const result=await sync.flush();
  assert.equal(result.synced,1);
  assert.equal(await sync.pendingCount(),0);
});
