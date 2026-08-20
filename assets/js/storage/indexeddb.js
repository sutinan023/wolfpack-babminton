const DB_NAME='badmintonClubFullOption';
const DB_VERSION=2;
function requestToPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export class IndexedDBStorage{
  constructor(){this.dbPromise=this.open();}
  open(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('state'))db.createObjectStore('state');if(!db.objectStoreNames.contains('syncQueue'))db.createObjectStore('syncQueue',{keyPath:'id'});if(!db.objectStoreNames.contains('playerProfiles'))db.createObjectStore('playerProfiles',{keyPath:'memberCode'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async getState(){const db=await this.dbPromise;const tx=db.transaction('state','readonly');return (await requestToPromise(tx.objectStore('state').get('app')))||null;}
  async saveState(state){const db=await this.dbPromise;const tx=db.transaction('state','readwrite');tx.objectStore('state').put(structuredClone(state),'app');return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async addSyncEvent(event){const db=await this.dbPromise;const tx=db.transaction('syncQueue','readwrite');tx.objectStore('syncQueue').put(structuredClone(event));return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async getSyncEvents(){const db=await this.dbPromise;const tx=db.transaction('syncQueue','readonly');return requestToPromise(tx.objectStore('syncQueue').getAll());}
  async updateSyncEvent(id,patch){const db=await this.dbPromise;const tx=db.transaction('syncQueue','readwrite');const store=tx.objectStore('syncQueue');const current=await requestToPromise(store.get(id));if(current)store.put({...current,...patch});return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async getPlayerProfile(memberCode){const db=await this.dbPromise;const tx=db.transaction('playerProfiles','readonly');return (await requestToPromise(tx.objectStore('playerProfiles').get(memberCode)))||null;}
  async savePlayerProfile(memberCode,profile){const db=await this.dbPromise;const tx=db.transaction('playerProfiles','readwrite');tx.objectStore('playerProfiles').put({memberCode,profile:structuredClone(profile),cachedAt:new Date().toISOString()});return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async replaceSyncEvents(events){const db=await this.dbPromise;const tx=db.transaction('syncQueue','readwrite');const store=tx.objectStore('syncQueue');store.clear();events.forEach(e=>store.put(structuredClone(e)));return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async clearAll(){const db=await this.dbPromise;const tx=db.transaction(['state','syncQueue','playerProfiles'],'readwrite');tx.objectStore('state').clear();tx.objectStore('syncQueue').clear();tx.objectStore('playerProfiles').clear();return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
}
