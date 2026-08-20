import { IndexedDBStorage } from './storage/indexeddb.js';
import { SyncEngine } from './sync/sync.js';
import { demoState } from './demo-data.js';

function stableDeviceId(){let id=localStorage.getItem('badminton_device_id');if(!id){id=`device_${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;localStorage.setItem('badminton_device_id',id);}return id;}
export class AppState{
  constructor(){this.storage=new IndexedDBStorage();this.listeners=new Set();this.state=null;this.sync=new SyncEngine(this.storage,{isOnline:()=>navigator.onLine});}
  async init(){const saved=await this.storage.getState();this.state=saved||demoState(stableDeviceId());if(!saved)await this.storage.saveState(this.state);return this.state;}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){this.listeners.forEach(fn=>fn(this.state));}
  activeSession(){return this.state.sessions.find(s=>s.id===this.state.activeSessionId);}
  isPrimary(){const s=this.activeSession();return !s.primaryDeviceId||s.primaryDeviceId===this.state.deviceId;}
  async commit(type,payload,mutator,{sync=true}={}){mutator(this.state);await this.storage.saveState(this.state);if(sync)await this.sync.enqueue(type,payload);this.notify();if(navigator.onLine)this.sync.flush().then(async()=>{this.state.lastSyncAt=new Date().toISOString();await this.storage.saveState(this.state);this.notify();});}
  async pendingCount(){return this.sync.pendingCount();}
  async getCachedPlayerProfile(memberCode){return this.storage.getPlayerProfile(String(memberCode||'').trim().toUpperCase());}
  async cachePlayerProfile(memberCode,profile){return this.storage.savePlayerProfile(String(memberCode||'').trim().toUpperCase(),profile);}
  async syncNow(){const result=await this.sync.flush();if(!result.offline){this.state.lastSyncAt=new Date().toISOString();await this.storage.saveState(this.state);this.notify();}return result;}
  exportBackup(){return JSON.stringify({exportedAt:new Date().toISOString(),state:this.state},null,2);}
  async importBackup(json){const parsed=typeof json==='string'?JSON.parse(json):json;if(!parsed?.state?.members||!parsed?.state?.sessions)throw new Error('Invalid backup');parsed.state.deviceId=this.state.deviceId;this.state=parsed.state;await this.storage.saveState(this.state);await this.sync.enqueue('IMPORT_BACKUP',{exportedAt:parsed.exportedAt||null});this.notify();}
  async resetDemo(){this.state=demoState(this.state?.deviceId||stableDeviceId());await this.storage.replaceSyncEvents([]);await this.storage.saveState(this.state);this.notify();}
}
