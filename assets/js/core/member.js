import { LEVELS, levelToRating } from './constants.js';

export function nextMemberCode(sequence, year=new Date().getFullYear()){
  const yy=String(year).slice(-2);
  return `BD${yy}${String(sequence).padStart(4,'0')}`;
}

export function createMember({sequence,year,nickname,gender='ไม่ระบุ',level='BG',joinedDate=new Date().toISOString().slice(0,10)}){
  const name=String(nickname||'').trim();
  if(!name) throw new Error('Nickname required');
  if(!LEVELS.includes(level)) throw new Error('Invalid level');
  const memberCode=nextMemberCode(sequence,year);
  return {
    id:`member_${memberCode}`,
    memberCode,
    nickname:name,
    gender,
    level,
    rating:levelToRating(level),
    joinedDate,
    isActive:true,
    careerBase:{sessions:0,matches:0,wins:0,draws:0,losses:0,uniquePartners:0,uniqueOpponents:0,winStreak:0,top4Count:0,championCount:0,maxSessionMatches:0}
  };
}

export function updateMember(member, patch){
  if(patch.nickname!==undefined){
    const name=String(patch.nickname).trim(); if(!name) throw new Error('Nickname required'); member.nickname=name;
  }
  if(patch.gender!==undefined) member.gender=patch.gender;
  if(patch.level!==undefined){ if(!LEVELS.includes(patch.level)) throw new Error('Invalid level'); member.level=patch.level; member.rating=levelToRating(patch.level); }
  if(patch.joinedDate!==undefined) member.joinedDate=patch.joinedDate;
  if(patch.isActive!==undefined) member.isActive=Boolean(patch.isActive);
  return member;
}
