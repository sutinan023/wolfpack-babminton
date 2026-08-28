const GENDER_MAP={
  'ชาย':'male',male:'male',
  'หญิง':'female',female:'female',
  'ไม่ระบุ':'unspecified',unspecified:'unspecified'
};
const RESULT_MAP={A:'team_a',B:'team_b',draw:'draw',team_a:'team_a',team_b:'team_b'};

function nullable(value){return value===undefined||value===null||value===''?null:value;}

export function toCloudSnapshot(state){
  return {
    device:{
      localId:String(state.deviceId||''),
      label:'Primary organizer device',
      platform:globalThis.navigator?.userAgent||null
    },
    members:(state.members||[]).map(member=>({
      localId:String(member.id),
      memberCode:String(member.memberCode),
      nickname:String(member.nickname),
      gender:GENDER_MAP[member.gender]||'unspecified',
      skillLevel:String(member.level),
      rating:Number(member.rating),
      joinedDate:member.joinedDate,
      isActive:member.isActive!==false
    })),
    sessions:(state.sessions||[]).map(session=>({
      localId:String(session.id),
      name:String(session.name||'Session'),
      sessionDate:session.date,
      startTime:nullable(session.startTime),
      endTime:nullable(session.endTime),
      status:session.status==='closed'?'closed':'open',
      closedAt:nullable(session.closedAt),
      primaryDeviceLocalId:nullable(session.primaryDeviceId),
      courts:(session.courts||[]).map(court=>({
        courtNo:Number(court.id),
        status:court.status==='closed'?'closed':'available'
      })),
      attendance:(session.attendance||[]).map(attendance=>({
        memberLocalId:String(attendance.memberId),
        status:String(attendance.status||'absent')
      })),
      matches:[...(session.matches||[])].sort((a,b)=>{const rank={finished:0,playing:1,queued:2};return (rank[a.status]??9)-(rank[b.status]??9);}).map(match=>({
        localId:String(match.id),
        matchCode:String(match.code),
        mode:match.mode==='singles'?'singles':'doubles',
        courtNo:Number(match.courtId),
        status:String(match.status),
        result:match.result==null?null:(RESULT_MAP[match.result]||null),
        teamA:[...(match.teamA||[])].map(String),
        teamB:[...(match.teamB||[])].map(String),
        createdAt:nullable(match.createdAt),
        startedAt:match.status==='queued'?null:nullable(match.startedAt||match.createdAt),
        finishedAt:nullable(match.finishedAt),
        resultEditedAt:nullable(match.resultEditedAt)
      }))
    }))
  };
}
