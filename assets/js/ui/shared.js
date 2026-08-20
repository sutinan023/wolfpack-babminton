export const esc=(s='')=>String(s).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
export function memberName(state,id){return state.members.find(m=>m.id===id)?.nickname||'?';}
export function memberByCode(state,code){const q=String(code||'').trim().toUpperCase();return state.members.find(m=>m.memberCode.toUpperCase()===q);}
export function teamNames(state,ids){return ids.map(id=>esc(memberName(state,id))).join(' + ');}
export function initials(name){return esc(String(name||'?').trim().slice(0,2).toUpperCase());}
export function dateLabel(date){if(!date)return '—';return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});}
export function sessionTimeLabel(s){const d=dateLabel(s.date);if(!s.startTime&&!s.endTime)return `${d} · ไม่กำหนดเวลา`;if(s.startTime&&s.endTime)return `${d} · ${s.startTime}–${s.endTime}`;if(s.startTime)return `${d} · เริ่ม ${s.startTime}`;return `${d} · ถึง ${s.endTime}`;}
export function resultText(r){return r==='A'?'Team A ชนะ':r==='B'?'Team B ชนะ':'เสมอ';}
export function downloadText(filename,text,type='application/json'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
