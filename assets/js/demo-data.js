import { createSession } from './core/session.js';
const base=(sessions,matches,wins,draws,losses,uniquePartners,uniqueOpponents,winStreak,top4Count,championCount,maxSessionMatches)=>({sessions,matches,wins,draws,losses,uniquePartners,uniqueOpponents,winStreak,top4Count,championCount,maxSessionMatches});
export function demoState(deviceId){
  const members=[
    {id:'m1',memberCode:'BD260009',nickname:'Joy',gender:'หญิง',level:'P+',rating:8,joinedDate:'2025-12-20',isActive:true,careerBase:base(23,89,54,16,19,18,31,4,7,3,9)},
    {id:'m2',memberCode:'BD260010',nickname:'Phuwin',gender:'ชาย',level:'P',rating:7,joinedDate:'2026-01-12',isActive:true,careerBase:base(19,75,39,15,21,14,26,3,5,1,8)},
    {id:'m3',memberCode:'BD260011',nickname:'Joong',gender:'ชาย',level:'S',rating:6,joinedDate:'2026-02-03',isActive:true,careerBase:base(16,64,29,17,18,11,21,2,3,0,7)},
    {id:'m4',memberCode:'BD260012',nickname:'Pond',gender:'ชาย',level:'P',rating:7,joinedDate:'2026-01-12',isActive:true,careerBase:base(17,68,35,13,20,9,18,2,2,0,7)},
    {id:'m5',memberCode:'BD260013',nickname:'Dunk',gender:'ชาย',level:'N+',rating:5,joinedDate:'2026-02-03',isActive:true,careerBase:base(15,59,25,16,18,8,16,2,2,0,6)},
    {id:'m6',memberCode:'BD260014',nickname:'Earth',gender:'ชาย',level:'P',rating:7,joinedDate:'2026-03-10',isActive:true,careerBase:base(14,56,30,10,16,12,23,3,3,1,7)},
    {id:'m7',memberCode:'BD260015',nickname:'Mix',gender:'ชาย',level:'S',rating:6,joinedDate:'2026-03-10',isActive:true,careerBase:base(14,54,26,13,15,11,20,2,2,0,7)},
    {id:'m8',memberCode:'BD260016',nickname:'Gemini',gender:'ชาย',level:'N',rating:4,joinedDate:'2026-05-18',isActive:true,careerBase:base(9,31,11,10,10,6,13,1,0,0,5)},
    {id:'m9',memberCode:'BD260017',nickname:'Fourth',gender:'ชาย',level:'N',rating:4,joinedDate:'2026-05-18',isActive:true,careerBase:base(9,30,12,8,10,7,12,1,1,0,5)},
    {id:'m10',memberCode:'BD260018',nickname:'Namtan',gender:'หญิง',level:'S',rating:6,joinedDate:'2026-06-02',isActive:true,careerBase:base(7,25,12,7,6,5,10,2,1,0,5)},
    {id:'m11',memberCode:'BD260019',nickname:'Jimmy',gender:'ชาย',level:'S',rating:6,joinedDate:'2026-06-20',isActive:true,careerBase:base(5,18,8,5,5,4,8,1,0,0,4)},
    {id:'m12',memberCode:'BD260020',nickname:'Sea',gender:'ชาย',level:'N+',rating:5,joinedDate:'2026-06-20',isActive:true,careerBase:base(5,17,7,5,5,4,8,1,0,0,4)}
  ];
  const s1=createSession({id:'session_1',name:'รอบเย็น',date:'2026-08-20',startTime:'19:00',endTime:'',courtCount:4,primaryDeviceId:deviceId,memberIds:members.map(m=>m.id)});
  ['m1','m2','m3','m4','m5','m6','m7','m8'].forEach((id,i)=>{const a=s1.attendance.find(a=>a.memberId===id);a.status='waiting';a.waitMinutes=18-i*2;});
  const s2=createSession({id:'session_2',name:'รอบดึก',date:'2026-08-20',startTime:'',endTime:'',courtCount:2,primaryDeviceId:deviceId,memberIds:members.map(m=>m.id)});
  return {schemaVersion:1,members,sessions:[s1,s2],activeSessionId:s1.id,memberSequence:21,deviceId,lastSyncAt:null,createdAt:new Date().toISOString()};
}
