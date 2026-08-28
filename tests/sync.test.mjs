import assert from 'node:assert/strict';
import { MemoryStorage } from '../assets/js/storage/memory.js';
import { SyncEngine } from '../assets/js/sync/sync.js';

function test(name, fn){return Promise.resolve().then(fn).then(()=>console.log(`PASS ${name}`)).catch(e=>{console.error(`FAIL ${name}`);throw e})}

const UUID='11111111-1111-4111-8111-111111111111';

await test('enqueue creates a UUID-backed pending sync event', async()=>{
  const storage=new MemoryStorage();
  const sync=new SyncEngine(storage,{isOnline:()=>false,idFactory:()=>UUID,now:()=> '2026-08-20T05:00:00.000Z'});
  const event=await sync.enqueue('CHECK_IN',{memberId:'m1'});
  assert.equal(event.id,UUID);
  assert.equal(event.status,'pending');
  assert.equal(event.attempts,0);
  assert.equal(await sync.pendingCount(),1);
});

await test('offline flush leaves queue untouched and never calls transport', async()=>{
  const storage=new MemoryStorage();
  let calls=0;
  const sync=new SyncEngine(storage,{isOnline:()=>false,idFactory:()=>UUID,pushBatch:async()=>{calls+=1;}});
  await sync.enqueue('CREATE_MATCH',{matchId:'m1'});
  const result=await sync.flush({snapshot:{},baseRevision:0});
  assert.deepEqual(result,{synced:0,offline:true});
  assert.equal(calls,0);
  assert.equal((await storage.getSyncEvents())[0].status,'pending');
});

await test('applied batch marks retryable events synced and returns server revision', async()=>{
  const storage=new MemoryStorage();
  const ids=[UUID,'22222222-2222-4222-8222-222222222222'];
  const sync=new SyncEngine(storage,{
    isOnline:()=>true,
    idFactory:()=>ids.shift(),
    now:()=> '2026-08-20T05:01:00.000Z',
    pushBatch:async request=>{
      assert.equal(request.events.length,2);
      assert.equal(request.baseRevision,4);
      assert.equal(request.snapshot.members.length,0);
      return {status:'applied',revision:5};
    }
  });
  await sync.enqueue('CHECK_IN',{memberId:'m1'});
  await sync.enqueue('CREATE_MATCH',{matchId:'m1'});
  const result=await sync.flush({snapshot:{members:[]},baseRevision:4});
  assert.equal(result.synced,2);
  assert.equal(result.revision,5);
  const events=await storage.getSyncEvents();
  assert.ok(events.every(e=>e.status==='synced'));
  assert.ok(events.every(e=>e.attempts===1));
});

await test('transport failure marks events failed and keeps them retryable', async()=>{
  const storage=new MemoryStorage();
  const sync=new SyncEngine(storage,{
    isOnline:()=>true,
    idFactory:()=>UUID,
    pushBatch:async()=>{throw new Error('network down')}
  });
  await sync.enqueue('UPDATE_MEMBER',{memberId:'m1'});
  const result=await sync.flush({snapshot:{},baseRevision:0});
  assert.equal(result.failed,1);
  const [event]=await storage.getSyncEvents();
  assert.equal(event.status,'failed');
  assert.equal(event.attempts,1);
  assert.match(event.lastError,/network down/);
  assert.equal(await sync.pendingCount(),1);
});

await test('revision conflict marks events conflict and never reports them synced', async()=>{
  const storage=new MemoryStorage();
  const sync=new SyncEngine(storage,{
    isOnline:()=>true,
    idFactory:()=>UUID,
    pushBatch:async()=>({status:'conflict',revision:8,reason:'revision_mismatch'})
  });
  await sync.enqueue('EDIT_RESULT',{matchId:'m1'});
  const result=await sync.flush({snapshot:{},baseRevision:7});
  assert.equal(result.conflict,1);
  assert.equal(result.revision,8);
  const [event]=await storage.getSyncEvents();
  assert.equal(event.status,'conflict');
  assert.equal(await sync.pendingCount(),0);
});

await test('statusCounts reports queue states separately', async()=>{
  const storage=new MemoryStorage();
  storage.events=[
    {id:'1',status:'pending'},
    {id:'2',status:'failed'},
    {id:'3',status:'conflict'},
    {id:'4',status:'synced'},
    {id:'5',status:'syncing'}
  ];
  const sync=new SyncEngine(storage,{isOnline:()=>true});
  assert.deepEqual(await sync.statusCounts(),{pending:2,failed:1,conflict:1,synced:1});
});

await test('auth-required response leaves events pending instead of failed', async()=>{
  const storage=new MemoryStorage();
  const sync=new SyncEngine(storage,{
    isOnline:()=>true,
    idFactory:()=> '33333333-3333-4333-8333-333333333333',
    pushBatch:async()=>({status:'auth_required',reason:'organizer_login_required'})
  });
  await sync.enqueue('CHECK_IN',{memberId:'m1'});
  const result=await sync.flush({snapshot:{},baseRevision:0});
  assert.equal(result.authRequired,true);
  const [event]=await storage.getSyncEvents();
  assert.equal(event.status,'pending');
  assert.equal(event.lastError,'organizer_login_required');
});

await test('legacy non-UUID queue ids are migrated before cloud transport', async()=>{
  const storage=new MemoryStorage();
  storage.events=[{id:'sync_old_1',type:'CHECK_IN',payload:{},createdAt:'2026-08-20T01:00:00.000Z',status:'pending',attempts:0}];
  const replacement='44444444-4444-4444-8444-444444444444';
  let sentId=null;
  const sync=new SyncEngine(storage,{
    isOnline:()=>true,
    idFactory:()=>replacement,
    pushBatch:async ({events})=>{sentId=events[0].id;return {status:'applied',revision:1};}
  });
  await sync.flush({snapshot:{},baseRevision:0});
  assert.equal(sentId,replacement);
  const [event]=await storage.getSyncEvents();
  assert.equal(event.id,replacement);
  assert.equal(event.status,'synced');
});

await test('requeueConflicts moves only conflict events back to pending', async()=>{
  const storage=new MemoryStorage();
  storage.events=[
    {id:'a',status:'conflict',lastError:'revision_mismatch'},
    {id:'b',status:'synced'},
    {id:'c',status:'failed'}
  ];
  const sync=new SyncEngine(storage,{isOnline:()=>true});
  const count=await sync.requeueConflicts();
  assert.equal(count,1);
  const events=await storage.getSyncEvents();
  assert.equal(events.find(e=>e.id==='a').status,'pending');
  assert.equal(events.find(e=>e.id==='a').lastError,null);
  assert.equal(events.find(e=>e.id==='b').status,'synced');
  assert.equal(events.find(e=>e.id==='c').status,'failed');
});
