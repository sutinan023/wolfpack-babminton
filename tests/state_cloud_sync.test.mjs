import assert from 'node:assert/strict';
import { MemoryStorage } from '../assets/js/storage/memory.js';
import { SyncEngine } from '../assets/js/sync/sync.js';
import { AppState } from '../assets/js/state.js';

const saved={
  schemaVersion:1,
  deviceId:'device_1',
  members:[],
  sessions:[],
  activeSessionId:null,
  memberSequence:1,
  lastSyncAt:null,
  createdAt:'2026-08-20T00:00:00.000Z'
};

{
  const storage=new MemoryStorage();
  await storage.saveState({...saved,cloudSync:{enabled:true,revision:0,serverRevision:0,lastConflictAt:null}});
  await storage.addSyncEvent({id:'11111111-1111-4111-8111-111111111111',type:'CHECK_IN',payload:{},createdAt:'2026-08-20T01:00:00.000Z',status:'pending',attempts:0});
  const sync=new SyncEngine(storage,{isOnline:()=>true,pushBatch:async ({baseRevision,snapshot})=>{
    assert.equal(baseRevision,0);
    assert.equal(snapshot.device.localId,'device_1');
    return {status:'applied',revision:1};
  }});
  const app=new AppState({storage,sync,isOnline:()=>true});
  await app.init();
  assert.equal(app.state.cloudSync.revision,0);
  const result=await app.syncNow();
  assert.equal(result.revision,1);
  assert.equal(app.state.cloudSync.revision,1);
  assert.equal(app.state.cloudSync.serverRevision,1);
  assert.ok(app.state.lastSyncAt);
  console.log('PASS AppState stores applied cloud revision');
}

{
  const storage=new MemoryStorage();
  await storage.saveState({...saved,cloudSync:{enabled:true,revision:4,serverRevision:4,lastConflictAt:null}});
  await storage.addSyncEvent({id:'22222222-2222-4222-8222-222222222222',type:'EDIT_RESULT',payload:{},createdAt:'2026-08-20T01:00:00.000Z',status:'pending',attempts:0});
  const sync=new SyncEngine(storage,{isOnline:()=>true,pushBatch:async()=>({status:'conflict',revision:7,reason:'revision_mismatch'})});
  const app=new AppState({storage,sync,isOnline:()=>true});
  await app.init();
  const result=await app.syncNow();
  assert.equal(result.conflict,1);
  assert.equal(app.state.cloudSync.revision,4,'base revision must stay unchanged until conflict is resolved');
  assert.equal(app.state.cloudSync.serverRevision,7);
  assert.ok(app.state.cloudSync.lastConflictAt);
  console.log('PASS AppState preserves base revision on conflict');
}


{
  const storage=new MemoryStorage();
  await storage.saveState(saved);
  await storage.addSyncEvent({id:'55555555-5555-4555-8555-555555555555',type:'CHECK_IN',payload:{},createdAt:'2026-08-20T01:00:00.000Z',status:'pending',attempts:0});
  let calls=0;
  const sync=new SyncEngine(storage,{isOnline:()=>true,pushBatch:async()=>{calls+=1;return {status:'applied',revision:1};}});
  const app=new AppState({storage,sync,isOnline:()=>true});
  await app.init();
  assert.equal(app.state.cloudSync.enabled,false);
  const result=await app.syncNow();
  assert.equal(result.disabled,true);
  assert.equal(calls,0);
  console.log('PASS AppState requires explicit Cloud Sync enablement');
}

{
  const storage=new MemoryStorage();
  await storage.saveState({...saved,cloudSync:{enabled:true,revision:3,serverRevision:5,lastConflictAt:'2026-08-20T02:00:00.000Z'}});
  await storage.addSyncEvent({id:'66666666-6666-4666-8666-666666666666',type:'UPDATE_MEMBER',payload:{},createdAt:'2026-08-20T01:00:00.000Z',status:'conflict',attempts:1});
  let seenBase=null;
  const sync=new SyncEngine(storage,{isOnline:()=>true,pushBatch:async ({baseRevision})=>{seenBase=baseRevision;return {status:'applied',revision:6};}});
  const app=new AppState({storage,sync,isOnline:()=>true});
  await app.init();
  const result=await app.forceLocalAfterConflict();
  assert.equal(seenBase,5);
  assert.equal(result.revision,6);
  assert.equal(app.state.cloudSync.revision,6);
  assert.equal(app.state.cloudSync.lastConflictAt,null);
  console.log('PASS AppState can explicitly force local snapshot after conflict');
}
