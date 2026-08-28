function attendanceFor(memberId){return {memberId,status:'absent',waitMinutes:0,matches:0,wins:0,draws:0,losses:0};}
function court(id){return {id,status:'available',currentMatchId:null,nextMatchId:null};}

export function createSession({id,name,date,startTime='',endTime='',courtCount=4,primaryDeviceId='',memberIds=[]}){
  const n=Math.max(1,Math.min(20,Number(courtCount)||1));
  return {id,name:name||'Session',date,startTime,endTime,status:'open',closedAt:null,primaryDeviceId,courts:Array.from({length:n},(_,i)=>court(i+1)),attendance:memberIds.map(attendanceFor),matches:[],seq:1};
}
export function setCourtCount(session,count){
  const n=Math.max(1,Math.min(20,Number(count)||1));
  if(n<session.courts.length){
    const blocked=session.courts.filter(c=>c.id>n&&(c.currentMatchId||c.nextMatchId));
    if(blocked.length) throw new Error(`Court in use: ${blocked.map(c=>c.id).join(',')}`);
    session.courts=session.courts.filter(c=>c.id<=n);
  }else{
    for(let i=session.courts.length+1;i<=n;i++) session.courts.push(court(i));
  }
  return session;
}
export function closeSession(session,at=new Date().toISOString()){
  if(session.courts.some(c=>c.currentMatchId||c.nextMatchId)) throw new Error('Active court work exists');
  session.status='closed'; session.closedAt=at; return session;
}
export function reopenSession(session){session.status='open';session.closedAt=null;return session;}
export function sessionDeleteBlockReason(state,sessionId){
  const session=state.sessions.find(s=>s.id===sessionId);
  if(!session)return 'not_found';
  if(state.sessions.length<=1)return 'last_session';
  if((session.matches||[]).length)return 'has_matches';
  if((session.attendance||[]).some(a=>(a.status||'absent')!=='absent'))return 'has_checkin';
  return null;
}
export function deleteSession(state,sessionId){
  const reason=sessionDeleteBlockReason(state,sessionId);
  if(reason==='not_found')throw new Error('Session not found');
  if(reason==='last_session')throw new Error('Cannot delete last session');
  if(reason==='has_matches')throw new Error('Session has match history');
  if(reason==='has_checkin')throw new Error('Session has check-in');
  state.sessions=state.sessions.filter(s=>s.id!==sessionId);
  if(state.activeSessionId===sessionId)state.activeSessionId=state.sessions[state.sessions.length-1].id;
  return state;
}
export function ensureAttendance(session,memberId){if(!session.attendance.some(a=>a.memberId===memberId))session.attendance.push(attendanceFor(memberId));}
export function checkIn(session,memberId){const a=session.attendance.find(a=>a.memberId===memberId);if(!a)throw new Error('Attendance missing');a.status='waiting';a.waitMinutes=0;return a;}
export function markLeft(session,memberId){const a=session.attendance.find(a=>a.memberId===memberId);if(!a)throw new Error('Attendance missing');if(['playing','queued'].includes(a.status))throw new Error('Member has active match');a.status='left';a.waitMinutes=0;return a;}
