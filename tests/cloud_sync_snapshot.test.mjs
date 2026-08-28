import assert from 'node:assert/strict';
import { toCloudSnapshot } from '../assets/js/cloud/snapshot.js';

const state={
  deviceId:'device_ipad_1',
  members:[
    {id:'m1',memberCode:'BD260001',nickname:'Joy',gender:'หญิง',level:'P+',rating:8,joinedDate:'2026-08-01',isActive:true,careerBase:{matches:99}},
    {id:'m2',memberCode:'BD260002',nickname:'Pond',gender:'ชาย',level:'P',rating:7,joinedDate:'2026-08-02',isActive:false,careerBase:{matches:88}}
  ],
  sessions:[{
    id:'session_1',name:'รอบเย็น',date:'2026-08-20',startTime:'19:00',endTime:'',status:'open',closedAt:null,primaryDeviceId:'device_ipad_1',
    courts:[{id:1,status:'available',currentMatchId:'match_1',nextMatchId:null}],
    attendance:[
      {memberId:'m1',status:'playing',waitMinutes:0,matches:1,wins:1,draws:0,losses:0},
      {memberId:'m2',status:'waiting',waitMinutes:12,matches:0,wins:0,draws:0,losses:0}
    ],
    matches:[{
      id:'match_1',code:'M001',mode:'doubles',source:'auto',courtId:1,teamA:['m1'],teamB:['m2'],status:'finished',result:'A',createdAt:'2026-08-20T12:00:00.000Z',finishedAt:'2026-08-20T12:10:00.000Z',resultEditedAt:null
    }]
  }]
};

const snapshot=toCloudSnapshot(state);
assert.equal(snapshot.device.localId,'device_ipad_1');
assert.equal(snapshot.members[0].gender,'female');
assert.equal(snapshot.members[1].gender,'male');
assert.equal(snapshot.members[0].skillLevel,'P+');
assert.equal(snapshot.members[1].isActive,false);
assert.equal('careerBase' in snapshot.members[0],false);
assert.equal(snapshot.sessions[0].sessionDate,'2026-08-20');
assert.equal(snapshot.sessions[0].startTime,'19:00');
assert.equal(snapshot.sessions[0].endTime,null);
assert.equal(snapshot.sessions[0].courts[0].courtNo,1);
assert.equal(snapshot.sessions[0].attendance[0].memberLocalId,'m1');
assert.equal(snapshot.sessions[0].matches[0].result,'team_a');
assert.deepEqual(snapshot.sessions[0].matches[0].teamA,['m1']);
assert.deepEqual(snapshot.sessions[0].matches[0].teamB,['m2']);
console.log('PASS cloud snapshot normalizes local state for Supabase');

{
  const ordered=toCloudSnapshot({
    deviceId:'d',members:[],sessions:[{id:'s',name:'S',date:'2026-08-20',status:'open',courts:[],attendance:[],matches:[
      {id:'queued',code:'M003',mode:'doubles',courtId:1,status:'queued',result:null,teamA:[],teamB:[]},
      {id:'playing',code:'M002',mode:'doubles',courtId:1,status:'playing',result:null,teamA:[],teamB:[]},
      {id:'finished',code:'M001',mode:'doubles',courtId:1,status:'finished',result:'A',teamA:[],teamB:[]}
    ]}]
  });
  assert.deepEqual(ordered.sessions[0].matches.map(m=>m.status),['finished','playing','queued']);
  console.log('PASS cloud snapshot orders match transitions safely');
}
