const CACHE='badminton-full-option-v3';
const APP_SHELL=[
  './','./index.html','./manifest.webmanifest','./dist/tailwind.offline.css','./icons/app-icon.svg',
  './assets/js/app.js','./assets/js/state.js','./assets/js/demo-data.js','./assets/js/cloud/auth.js',
  './assets/js/core/constants.js','./assets/js/core/member.js','./assets/js/core/session.js','./assets/js/core/match.js','./assets/js/core/ranking.js','./assets/js/core/achievement.js',
  './assets/js/storage/indexeddb.js','./assets/js/storage/memory.js','./assets/js/sync/sync.js',
  './assets/js/ui/admin.js','./assets/js/ui/player.js','./assets/js/ui/modal.js','./assets/js/ui/network.js','./assets/js/ui/shared.js'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok&&new URL(event.request.url).origin===self.location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):cached)));
});
