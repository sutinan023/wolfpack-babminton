export class SyncEngine{
  constructor(storage,{isOnline=()=>navigator.onLine,now=()=>new Date().toISOString()}={}){this.storage=storage;this.isOnline=isOnline;this.now=now;}
  async enqueue(type,payload){const e={id:`sync_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,type,payload,createdAt:this.now(),status:'pending',syncedAt:null};await this.storage.addSyncEvent(e);return e;}
  async pendingCount(){return (await this.storage.getSyncEvents()).filter(e=>e.status==='pending'||e.status==='failed').length;}
  async flush(){if(!this.isOnline())return {synced:0,offline:true};const events=await this.storage.getSyncEvents();let synced=0;for(const e of events){if(!['pending','failed'].includes(e.status))continue;await this.storage.updateSyncEvent(e.id,{status:'synced',syncedAt:this.now()});synced+=1;}return {synced,offline:false};}
}
