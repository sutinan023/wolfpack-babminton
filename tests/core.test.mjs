import assert from 'node:assert/strict';
import { LEVEL_RATING, levelToRating } from '../assets/js/core/constants.js';
import { createMember, nextMemberCode } from '../assets/js/core/member.js';
import { createSession, setCourtCount, closeSession, reopenSession, deleteSession } from '../assets/js/core/session.js';
import { createMatch, cancelCurrentMatch, cancelQueuedMatch, applyResult, editFinishedResult, autoMatchCandidates } from '../assets/js/core/match.js';
import { topFour } from '../assets/js/core/ranking.js';
import { achievementProgress } from '../assets/js/core/achievement.js';

function test(name, fn){
  try { fn(); console.log(`PASS ${name}`); }
  catch (err){ console.error(`FAIL ${name}`); throw err; }
}

test('level mapping is exact', () => {
  assert.deepEqual(LEVEL_RATING, {BG:2,'BG+':3,N:4,'N+':5,S:6,P:7,'P+':8});
  assert.equal(levelToRating('P+'), 8);
});

test('member code and new member use level rating', () => {
  assert.equal(nextMemberCode(13, 2026), 'BD260013');
  const m = createMember({sequence:13, year:2026, nickname:'Pond', gender:'ชาย', level:'N+', joinedDate:'2026-08-20'});
  assert.equal(m.memberCode, 'BD260013');
  assert.equal(m.rating, 5);
  assert.equal(m.isActive, true);
});

test('session supports optional time and resizing courts', () => {
  const s = createSession({id:'s1', name:'รอบเย็น', date:'2026-08-20', courtCount:2, primaryDeviceId:'dev1', memberIds:['m1','m2']});
  assert.equal(s.startTime, '');
  assert.equal(s.endTime, '');
  setCourtCount(s, 4);
  assert.equal(s.courts.length, 4);
  closeSession(s);
  assert.equal(s.status, 'closed');
  reopenSession(s);
  assert.equal(s.status, 'open');
});

test('deleting an empty session switches active session to latest remaining', () => {
  const state={
    sessions:[
      createSession({id:'s1',name:'รอบเช้า',date:'2026-08-20',courtCount:1,memberIds:[]}),
      createSession({id:'s2',name:'รอบเย็น',date:'2026-08-20',courtCount:1,memberIds:[]}),
      createSession({id:'s3',name:'รอบดึก',date:'2026-08-20',courtCount:1,memberIds:[]})
    ],
    activeSessionId:'s2'
  };
  deleteSession(state,'s2');
  assert.deepEqual(state.sessions.map(s=>s.id),['s1','s3']);
  assert.equal(state.activeSessionId,'s3');
});

test('deleting the last session is blocked', () => {
  const state={sessions:[createSession({id:'s1',name:'รอบเดียว',date:'2026-08-20',courtCount:1,memberIds:[]})],activeSessionId:'s1'};
  assert.throws(()=>deleteSession(state,'s1'),/last session/i);
});

test('deleting a session with check-in is blocked', () => {
  const s1=createSession({id:'s1',name:'รอบเช้า',date:'2026-08-20',courtCount:1,memberIds:['m1']});
  s1.attendance[0].status='waiting';
  const state={sessions:[s1,createSession({id:'s2',name:'รอบเย็น',date:'2026-08-20',courtCount:1,memberIds:[]})],activeSessionId:'s1'};
  assert.throws(()=>deleteSession(state,'s1'),/check-in/i);
});

test('deleting a session with match history is blocked', () => {
  const s1=createSession({id:'s1',name:'รอบเช้า',date:'2026-08-20',courtCount:1,memberIds:[]});
  s1.matches.push({id:'match_1'});
  const state={sessions:[s1,createSession({id:'s2',name:'รอบเย็น',date:'2026-08-20',courtCount:1,memberIds:[]})],activeSessionId:'s1'};
  assert.throws(()=>deleteSession(state,'s1'),/match/i);
});

test('cancel current match deletes it and promotes queued match', () => {
  const s = createSession({id:'s1', name:'x', date:'2026-08-20', courtCount:1, primaryDeviceId:'d', memberIds:['a','b','c','d','e','f','g','h']});
  s.attendance.forEach(a=>a.status='waiting');
  const m1 = createMatch(s,{courtId:1,mode:'doubles',teamA:['a','b'],teamB:['c','d'],source:'manual'});
  const m2 = createMatch(s,{courtId:1,mode:'doubles',teamA:['e','f'],teamB:['g','h'],source:'manual'});
  assert.equal(s.courts[0].nextMatchId,m2.id);
  cancelCurrentMatch(s,1);
  assert.equal(s.matches.some(m=>m.id===m1.id),false);
  assert.equal(s.courts[0].currentMatchId,m2.id);
  assert.equal(s.matches.find(m=>m.id===m2.id).status,'playing');
});

test('cancel queued match deletes without history', () => {
  const s = createSession({id:'s1', name:'x', date:'2026-08-20', courtCount:1, primaryDeviceId:'d', memberIds:['a','b','c','d','e','f','g','h']});
  s.attendance.forEach(a=>a.status='waiting');
  createMatch(s,{courtId:1,mode:'doubles',teamA:['a','b'],teamB:['c','d'],source:'manual'});
  const m2 = createMatch(s,{courtId:1,mode:'doubles',teamA:['e','f'],teamB:['g','h'],source:'manual'});
  cancelQueuedMatch(s,1);
  assert.equal(s.matches.some(m=>m.id===m2.id),false);
  assert.equal(s.courts[0].nextMatchId,null);
});

test('editing finished result reverses old WDL without changing match count', () => {
  const s = createSession({id:'s1', name:'x', date:'2026-08-20', courtCount:1, primaryDeviceId:'d', memberIds:['a','b','c','d']});
  s.attendance.forEach(a=>a.status='waiting');
  const m = createMatch(s,{courtId:1,mode:'doubles',teamA:['a','b'],teamB:['c','d'],source:'manual'});
  applyResult(s,m.id,'A');
  const before = s.attendance.find(a=>a.memberId==='a');
  assert.equal(before.matches,1); assert.equal(before.wins,1);
  editFinishedResult(s,m.id,'draw');
  const after = s.attendance.find(a=>a.memberId==='a');
  assert.equal(after.matches,1); assert.equal(after.wins,0); assert.equal(after.draws,1);
});

test('top four uses 3/1/0 and minimum two matches', () => {
  const s = createSession({id:'s1', name:'x', date:'2026-08-20', courtCount:1, primaryDeviceId:'d', memberIds:['a','b','c','d','e']});
  Object.assign(s.attendance[0],{matches:3,wins:2,draws:1,losses:0});
  Object.assign(s.attendance[1],{matches:2,wins:2,draws:0,losses:0});
  Object.assign(s.attendance[2],{matches:4,wins:1,draws:2,losses:1});
  Object.assign(s.attendance[3],{matches:2,wins:1,draws:0,losses:1});
  Object.assign(s.attendance[4],{matches:1,wins:1,draws:0,losses:0});
  const ranks = topFour(s);
  assert.equal(ranks.length,4);
  assert.equal(ranks[0].memberId,'a');
  assert.equal(ranks[0].points,7);
  assert.equal(ranks.some(r=>r.memberId==='e'),false);
});

test('auto doubles returns alternate pairings and scores repeat history', () => {
  const members = [
    {id:'a',rating:8},{id:'b',rating:7},{id:'c',rating:5},{id:'d',rating:4}
  ];
  const s = createSession({id:'s1',name:'x',date:'2026-08-20',courtCount:1,primaryDeviceId:'d',memberIds:members.map(m=>m.id)});
  s.attendance.forEach((a,i)=>Object.assign(a,{status:'waiting',waitMinutes:20-i,matches:i%2}));
  const candidates = autoMatchCandidates(s,members,'doubles');
  assert.equal(candidates.length,3);
  assert.notDeepEqual(candidates[0].teamA,candidates[1].teamA);
  assert.ok(candidates[0].score <= candidates[1].score);
});

test('auto match ignores waiting attendance missing from active member list', () => {
  const members=[{id:'a',rating:8},{id:'b',rating:7},{id:'c',rating:5},{id:'d',rating:4}];
  const s=createSession({id:'s1',name:'x',date:'2026-08-20',courtCount:1,primaryDeviceId:'d',memberIds:['a','b','c','d','inactive']});
  s.attendance.forEach(a=>Object.assign(a,{status:'waiting',waitMinutes:a.memberId==='inactive'?99:20,matches:0}));
  const candidates=autoMatchCandidates(s,members,'doubles');
  assert.ok(candidates.length>0);
  assert.equal(candidates.some(c=>[...c.teamA,...c.teamB].includes('inactive')),false);
});

test('achievement progress returns eight definitions', () => {
  const member={id:'a',careerBase:{sessions:5,matches:10,wins:5,draws:2,losses:3,uniquePartners:10,uniqueOpponents:20,winStreak:3,top4Count:1,championCount:1,maxSessionMatches:8}};
  const state={members:[member],sessions:[]};
  const data=achievementProgress(state,'a');
  assert.equal(data.length,8);
  assert.ok(data.every(a=>a.unlocked));
});
