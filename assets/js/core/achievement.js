import { topFour } from './ranking.js';
const defs=[
  ['first','First Match','เล่น Match แรกกับก๊วน',1,'matches'],
  ['regular','Regular Player','มาเล่นครบ 5 Session',5,'sessions'],
  ['iron','Iron Legs','เล่นครบ 8 Match ใน Session เดียว',8,'maxSessionMatches'],
  ['streak','Win Streak x3','ชนะติดต่อกัน 3 Match',3,'winStreak'],
  ['social','Social Player','เล่นคู่กับ Partner ไม่ซ้ำครบ 10 คน',10,'uniquePartners'],
  ['explorer','Explorer','เจอ Opponent ไม่ซ้ำครบ 20 คน',20,'uniqueOpponents'],
  ['top4','Top 4 Debut','ติด Top 4 ครั้งแรก',1,'top4Count'],
  ['champion','Session Champion','ได้อันดับ 1 ของ Session',1,'championCount']
];
export function achievementProgress(state,memberId){
  const m=state.members.find(x=>x.id===memberId);if(!m)return [];
  const base={sessions:0,matches:0,wins:0,draws:0,losses:0,uniquePartners:0,uniqueOpponents:0,winStreak:0,top4Count:0,championCount:0,maxSessionMatches:0,...m.careerBase};
  const sessions=state.sessions||[];let attended=0,matches=0,maxSession=0,top4Count=0,championCount=0;const partners=new Set(),opponents=new Set();let streak=base.winStreak,currentStreak=0;
  sessions.forEach(s=>{const a=s.attendance.find(a=>a.memberId===memberId);if(a&&['waiting','playing','queued','left'].includes(a.status)||a?.matches>0)attended+=1;if(a){matches+=a.matches;maxSession=Math.max(maxSession,a.matches);}const rank=topFour(s).find(r=>r.memberId===memberId);if(rank){top4Count+=1;if(rank.rank===1)championCount+=1;}[...s.matches].filter(x=>x.status==='finished'&&(x.teamA.includes(memberId)||x.teamB.includes(memberId))).reverse().forEach(mt=>{const own=mt.teamA.includes(memberId)?'A':'B';const win=mt.result===own;if(win){currentStreak+=1;streak=Math.max(streak,currentStreak)}else currentStreak=0;const ownTeam=own==='A'?mt.teamA:mt.teamB,other=own==='A'?mt.teamB:mt.teamA;ownTeam.filter(id=>id!==memberId).forEach(id=>partners.add(id));other.forEach(id=>opponents.add(id));});});
  const totals={sessions:base.sessions+attended,matches:base.matches+matches,maxSessionMatches:Math.max(base.maxSessionMatches,maxSession),winStreak:Math.max(base.winStreak,streak),uniquePartners:base.uniquePartners+partners.size,uniqueOpponents:base.uniqueOpponents+opponents.size,top4Count:base.top4Count+top4Count,championCount:base.championCount+championCount};
  return defs.map(([id,title,description,target,key])=>{const value=totals[key]||0;return {id,title,description,target,value,progress:Math.min(100,Math.round(value/target*100)),unlocked:value>=target};});
}
