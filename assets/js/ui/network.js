export async function renderNetwork(appState){
  const counts=await appState.syncStatusCounts();
  const online=navigator.onLine;
  const dot=document.getElementById('network-dot'),label=document.getElementById('network-label');
  dot.className=`network-dot ${online?'online':'offline'}`;
  if(counts.conflict){label.textContent=`Cloud Conflict ${counts.conflict}`;return;}
  if(online&&counts.failed){label.textContent=`Online · Sync Failed ${counts.failed}`;return;}
  if(online&&counts.pending){label.textContent=`Online · รอ Sync ${counts.pending}`;return;}
  if(!online){label.textContent=`Offline · รอ Sync ${counts.pending+counts.failed}`;return;}
  label.textContent='Online';
}
