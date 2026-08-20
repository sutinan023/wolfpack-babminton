export async function renderNetwork(appState){
  const pending=await appState.pendingCount();
  const online=navigator.onLine;
  const dot=document.getElementById('network-dot'),label=document.getElementById('network-label');
  dot.className=`network-dot ${online?'online':'offline'}`;
  label.textContent=online?(pending?`Online · รอ Sync ${pending}`:'Online'):`Offline · ${pending} pending`;
}
