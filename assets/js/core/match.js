function attendee(session,id){const a=session.attendance.find(a=>a.memberId===id);if(!a)throw new Error(`Attendance missing: ${id}`);return a;}
function currentCourt(session,id){const c=session.courts.find(c=>c.id===Number(id));if(!c)throw new Error('Court not found');return c;}
function setPlayers(session,ids,status){ids.forEach(id=>{const a=attendee(session,id);a.status=status;a.waitMinutes=0;});}
function allPlayers(m){return [...m.teamA,...m.teamB];}

export function createMatch(session,{courtId,mode='doubles',teamA,teamB,source='auto'}){
  if(session.status==='closed') throw new Error('Session closed');
  const c=currentCourt(session,courtId);
  if(c.currentMatchId&&c.nextMatchId) throw new Error('Court queue full');
  const id=`${session.id}_match_${session.seq}`;
  const m={id,code:`M${String(session.seq).padStart(3,'0')}`,mode,source,courtId:Number(courtId),teamA:[...teamA],teamB:[...teamB],status:c.currentMatchId?'queued':'playing',result:null,createdAt:new Date().toISOString(),finishedAt:null,resultEditedAt:null};
  session.seq+=1;session.matches.unshift(m);setPlayers(session,allPlayers(m),m.status==='queued'?'queued':'playing');
  if(c.currentMatchId)c.nextMatchId=m.id;else c.currentMatchId=m.id;
  return m;
}
function deleteMatch(session,id){session.matches=session.matches.filter(m=>m.id!==id);}
export function cancelQueuedMatch(session,courtId){
  const c=currentCourt(session,courtId);if(!c.nextMatchId)return false;const m=session.matches.find(m=>m.id===c.nextMatchId);if(!m)return false;
  setPlayers(session,allPlayers(m),'waiting');deleteMatch(session,m.id);c.nextMatchId=null;return true;
}
export function cancelCurrentMatch(session,courtId){
  const c=currentCourt(session,courtId);if(!c.currentMatchId)return false;const m=session.matches.find(m=>m.id===c.currentMatchId);if(!m)return false;
  setPlayers(session,allPlayers(m),'waiting');deleteMatch(session,m.id);const nextId=c.nextMatchId;c.currentMatchId=null;c.nextMatchId=null;
  if(nextId){const next=session.matches.find(m=>m.id===nextId);if(next){next.status='playing';c.currentMatchId=next.id;setPlayers(session,allPlayers(next),'playing');}}
  return true;
}
function adjustResult(session,m,result,delta){
  allPlayers(m).forEach(id=>{const a=attendee(session,id);if(result==='draw')a.draws=Math.max(0,a.draws+delta);else if((result==='A'&&m.teamA.includes(id))||(result==='B'&&m.teamB.includes(id)))a.wins=Math.max(0,a.wins+delta);else a.losses=Math.max(0,a.losses+delta);});
}
export function applyResult(session,matchId,result){
  const m=session.matches.find(m=>m.id===matchId);if(!m||m.status!=='playing')throw new Error('Match not playing');
  const c=currentCourt(session,m.courtId);m.result=result;m.status='finished';m.finishedAt=new Date().toISOString();
  allPlayers(m).forEach(id=>{const a=attendee(session,id);a.matches+=1;a.status='waiting';a.waitMinutes=0;});adjustResult(session,m,result,1);
  c.currentMatchId=null;if(c.nextMatchId){const n=session.matches.find(x=>x.id===c.nextMatchId);c.currentMatchId=c.nextMatchId;c.nextMatchId=null;if(n){n.status='playing';setPlayers(session,allPlayers(n),'playing');}}
  return m;
}
export function editFinishedResult(session,matchId,newResult){
  const m=session.matches.find(m=>m.id===matchId);if(!m||m.status!=='finished')throw new Error('Match not finished');if(m.result===newResult)return m;adjustResult(session,m,m.result,-1);adjustResult(session,m,newResult,1);m.result=newResult;m.resultEditedAt=new Date().toISOString();return m;
}
function teamSum(team,memberMap){return team.reduce((s,id)=>s+(memberMap.get(id)?.rating||0),0);}
function pairings(ids){return [[[ids[0],ids[1]],[ids[2],ids[3]]],[[ids[0],ids[2]],[ids[1],ids[3]]],[[ids[0],ids[3]],[ids[1],ids[2]]]];}
function repeatCounts(session,teamA,teamB){
  let partner=0,opp=0;const finished=session.matches.filter(m=>m.status==='finished');
  const pairKey=(a,b)=>[a,b].sort().join('|');
  const partnerPairs=[...teamA.flatMap((a,i)=>teamA.slice(i+1).map(b=>pairKey(a,b))),...teamB.flatMap((a,i)=>teamB.slice(i+1).map(b=>pairKey(a,b)))];
  const oppPairs=teamA.flatMap(a=>teamB.map(b=>pairKey(a,b)));
  finished.forEach(m=>{const oldPartners=[...m.teamA.flatMap((a,i)=>m.teamA.slice(i+1).map(b=>pairKey(a,b))),...m.teamB.flatMap((a,i)=>m.teamB.slice(i+1).map(b=>pairKey(a,b)))];const oldOpp=m.teamA.flatMap(a=>m.teamB.map(b=>pairKey(a,b)));partner+=partnerPairs.filter(k=>oldPartners.includes(k)).length;opp+=oppPairs.filter(k=>oldOpp.includes(k)).length;});
  return {partner,opp};
}
export function autoMatchCandidates(session,members,mode='doubles'){
  const memberMap=new Map(members.map(m=>[m.id,m]));const waiting=session.attendance.filter(a=>a.status==='waiting'&&memberMap.has(a.memberId)).sort((a,b)=>(b.waitMinutes-a.waitMinutes)||(a.matches-b.matches));
  if(mode==='singles'){
    const pool=waiting.slice(0,6);const out=[];for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){const a=pool[i],b=pool[j];const rating=Math.abs((memberMap.get(a.memberId)?.rating||0)-(memberMap.get(b.memberId)?.rating||0));const fairness=Math.abs(a.matches-b.matches)*.2;const waitBonus=(a.waitMinutes+b.waitMinutes)*.03;const repeats=repeatCounts(session,[a.memberId],[b.memberId]);const score=rating*.4+fairness*.2+repeats.opp*.05-waitBonus*.25;out.push({teamA:[a.memberId],teamB:[b.memberId],score,ratingDiff:rating});}return out.sort((x,y)=>x.score-y.score);
  }
  if(waiting.length<4)return [];
  const ids=waiting.slice(0,4).map(a=>a.memberId);return pairings(ids).map(([teamA,teamB])=>{const rating=Math.abs(teamSum(teamA,memberMap)-teamSum(teamB,memberMap));const selected=ids.map(id=>attendee(session,id));const matchesSpread=Math.max(...selected.map(a=>a.matches))-Math.min(...selected.map(a=>a.matches));const avgWait=selected.reduce((s,a)=>s+a.waitMinutes,0)/4;const repeats=repeatCounts(session,teamA,teamB);const score=rating*.4+matchesSpread*.2+repeats.partner*.1+repeats.opp*.05-avgWait*.025;return {teamA,teamB,score,ratingDiff:rating,repeatPartners:repeats.partner,repeatOpponents:repeats.opp};}).sort((a,b)=>a.score-b.score);
}
