export function topFour(session){
  return session.attendance
    .filter(a=>a.matches>=2)
    .map(a=>({memberId:a.memberId,points:a.wins*3+a.draws,matches:a.matches,wins:a.wins,draws:a.draws,losses:a.losses,winRate:a.matches?a.wins/a.matches:0}))
    .sort((a,b)=>b.points-a.points||b.wins-a.wins||b.winRate-a.winRate||a.losses-b.losses||a.memberId.localeCompare(b.memberId))
    .slice(0,4)
    .map((r,i)=>({...r,rank:i+1}));
}
