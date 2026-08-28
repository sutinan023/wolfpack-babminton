import assert from 'node:assert/strict';
import { AppState } from '../assets/js/state.js';
import { MemoryStorage } from '../assets/js/storage/memory.js';
import { SyncEngine } from '../assets/js/sync/sync.js';
import { createSession, checkIn, closeSession } from '../assets/js/core/session.js';
import { createMatch, applyResult } from '../assets/js/core/match.js';

const members=[
  {id:'m1',memberCode:'BD260001',nickname:'Joy',gender:'หญิง',level:'N',rating:4,joinedDate:'2026-08-20',isActive:true},
  {id:'m2',memberCode:'BD260002',nickname:'Phuwin',gender:'ชาย',level:'N+',rating:5,joinedDate:'2026-08-20',isActive:true},
  {id:'m3',memberCode:'BD260003',nickname:'Joong',gender:'ชาย',level:'N',rating:4,joinedDate:'2026-08-20',isActive:true},
  {id:'m4',memberCode:'BD260004',nickname:'Pond',gender:'ชาย',level:'N+',rating:5,joinedDate:'2026-08-20',isActive:true}
];

function baseState(overrides={}){
  return {
    schemaVersion:1,
    deviceId:'device_v31',
    members:structuredClone(members),
    sessions:[],
    activeSessionId:null,
    memberSequence:5,
    lastSyncAt:null,
    createdAt:'2026-08-27T00:00:00.000Z',
    cloudSync:{enabled:true,revision:0,serverRevision:0,lastConflictAt:null},
    ...overrides
  };
}

let uuidSequence=1;
function nextUuid(){
  return `00000000-0000-4000-8000-${String(uuidSequence++).padStart(12,'0')}`;
}

async function test(name,fn){
  try{await fn();console.log(`PASS ${name}`);}
  catch(error){console.error(`FAIL ${name}`);throw error;}
}

await test('V3.1 lifecycle keeps eight offline actions and syncs one closed finished-match snapshot',async()=>{
  let online=false;
  let cloudRequest=null;
  const storage=new MemoryStorage();
  await storage.saveState(baseState());
  const sync=new SyncEngine(storage,{
    isOnline:()=>online,
    idFactory:nextUuid,
    pushBatch:async request=>{cloudRequest=request;return {status:'applied',revision:1};}
  });
  const app=new AppState({storage,sync,isOnline:()=>online});
  await app.init();

  await app.commit('CREATE_SESSION',{sessionId:'session_v31'},state=>{
    const session=createSession({
      id:'session_v31',
      name:'รอบทดสอบ V3.1',
      date:'2026-08-27',
      startTime:'19:00',
      endTime:'21:00',
      courtCount:1,
      primaryDeviceId:state.deviceId,
      memberIds:state.members.map(member=>member.id)
    });
    state.sessions.push(session);
    state.activeSessionId=session.id;
  });

  for(const member of members){
    await app.commit('CHECK_IN',{memberId:member.id},state=>checkIn(state.sessions[0],member.id));
  }
  await app.commit('CREATE_MATCH',{courtId:1},state=>{
    createMatch(state.sessions[0],{courtId:1,mode:'doubles',teamA:['m1','m2'],teamB:['m3','m4'],source:'manual'});
  });
  await app.commit('UPDATE_RESULT',{result:'A'},state=>{
    const session=state.sessions[0];
    applyResult(session,session.matches[0].id,'A');
  });
  await app.commit('CLOSE_SESSION',{sessionId:'session_v31'},state=>closeSession(state.sessions[0],'2026-08-27T14:00:00.000Z'));

  assert.equal((await storage.getSyncEvents()).length,8);
  assert.equal(cloudRequest,null,'offline actions must not call Cloud transport');

  online=true;
  const result=await app.syncNow();
  assert.equal(result.synced,8);
  assert.equal(result.revision,1);
  assert.deepEqual(cloudRequest.events.map(event=>event.type),[
    'CREATE_SESSION','CHECK_IN','CHECK_IN','CHECK_IN','CHECK_IN','CREATE_MATCH','UPDATE_RESULT','CLOSE_SESSION'
  ]);
  assert.equal(cloudRequest.snapshot.sessions.length,1);
  assert.equal(cloudRequest.snapshot.sessions[0].status,'closed');
  assert.equal(cloudRequest.snapshot.sessions[0].matches[0].status,'finished');
  assert.equal(cloudRequest.snapshot.sessions[0].matches[0].result,'team_a');
  assert.equal(app.state.cloudSync.revision,1);
  assert.deepEqual(await sync.statusCounts(),{pending:0,failed:0,conflict:0,synced:8});
});

await test('V3.1 conflict keeps the local edit and does not advance the accepted Cloud revision',async()=>{
  let online=false;
  const session=createSession({
    id:'session_conflict',
    name:'ชื่อเดิม',
    date:'2026-08-27',
    courtCount:1,
    primaryDeviceId:'device_v31',
    memberIds:members.map(member=>member.id)
  });
  const storage=new MemoryStorage();
  await storage.saveState(baseState({
    sessions:[session],
    activeSessionId:session.id,
    cloudSync:{enabled:true,revision:4,serverRevision:4,lastConflictAt:null}
  }));
  const sync=new SyncEngine(storage,{
    isOnline:()=>online,
    idFactory:nextUuid,
    pushBatch:async()=>({status:'conflict',revision:5,reason:'revision_mismatch'})
  });
  const app=new AppState({storage,sync,isOnline:()=>online});
  await app.init();

  await app.commit('UPDATE_SESSION',{sessionId:session.id},state=>{state.sessions[0].name='ชื่อแก้ในเครื่อง';});
  online=true;
  const result=await app.syncNow();

  assert.equal(result.conflict,1);
  assert.equal(app.state.sessions[0].name,'ชื่อแก้ในเครื่อง');
  assert.equal(app.state.cloudSync.revision,4);
  assert.equal(app.state.cloudSync.serverRevision,5);
  assert.ok(app.state.cloudSync.lastConflictAt);
  assert.deepEqual(await sync.statusCounts(),{pending:0,failed:0,conflict:1,synced:0});
});
