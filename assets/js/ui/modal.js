export function showModal({title,subtitle='',body='',wide=false,actions=''}){
  const root=document.getElementById('modal-root');
  root.innerHTML=`<div class="modal-backdrop" data-action="close-modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="close-btn" data-action="close-modal" aria-label="ปิด">×</button></div>${body}${actions?`<div class="mt-4 flex gap-2">${actions}</div>`:''}</section></div>`;
}
export function closeModal(){document.getElementById('modal-root').innerHTML='';}
export function confirmModal({title,subtitle='',message,confirmText='ยืนยัน',danger=false,action,payload=''}){
  showModal({title,subtitle,body:`<div class="notice">${message}</div>`,actions:`<button class="btn btn-secondary" data-action="close-modal">ยกเลิก</button><button class="btn ${danger?'btn-danger':'btn-primary'} ml-auto" data-action="${action}" ${payload?`data-payload='${payload}'`:''}>${confirmText}</button>`});
}
