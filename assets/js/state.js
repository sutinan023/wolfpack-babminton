import { IndexedDBStorage } from './storage/indexeddb.js';
import { SyncEngine } from './sync/sync.js';
import { demoState } from './demo-data.js';
import { toCloudSnapshot } from './cloud/snapshot.js';
import { pushSyncBatch } from './cloud/sync.js';

function stableDeviceId(){
  let id=localStorage.getItem('badminton_device_id');
  if(!id){id=`device_${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;localStorage.setItem('badminton_device_id',id);}
  return id;
}

export class AppState{
  constructor({storage=null,sync=null,isOnline=()=>globalThis.navigator?.onLine!==false}={}){
    this.storage=storage||new IndexedDBStorage();
    this.listeners=new Set();
    this.state=null;
    this.isOnline=isOnline;
    this.sync=sync||new SyncEngine(this.storage,{isOnline,pushBatch:pushSyncBatch});
  }

  async init(){
    const saved=await this.storage.getState();
    this.state=saved||demoState(stableDeviceId());
    this.state.cloudSync={enabled:false,revision:0,serverRevision:0,lastConflictAt:null,...(this.state.cloudSync||{})};
    if(!saved)await this.storage.saveState(this.state);else await this.storage.saveState(this.state);
    return this.state;
  }

  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){this.listeners.forEach(fn=>fn(this.state));}
  activeSession(){return this.state.sessions.find(s=>s.id===this.state.activeSessionId);}
  isPrimary(){const s=this.activeSession();return !s?.primaryDeviceId||s.primaryDeviceId===this.state.deviceId;}

  async commit(type,payload,mutator,{sync=true}={}){
    mutator(this.state);
    await this.storage.saveState(this.state);
    if(sync)await this.sync.enqueue(type,payload);
    this.notify();
    if(sync&&this.isOnline()&&this.state.cloudSync?.enabled)this.syncNow().catch(()=>{});
  }

  async pendingCount(){return this.sync.pendingCount();}
  async syncStatusCounts(){return this.sync.statusCounts();}
  async getCachedPlayerProfile(memberCode){return this.storage.getPlayerProfile(String(memberCode||'').trim().toUpperCase());}
  async cachePlayerProfile(memberCode,profile){return this.storage.savePlayerProfile(String(memberCode||'').trim().toUpperCase(),profile);}

  async syncNow(){
    if(!this.state.cloudSync?.enabled)return {synced:0,offline:false,disabled:true};
    const baseRevision=Number(this.state.cloudSync?.revision)||0;
    const result=await this.sync.flush({snapshot:toCloudSnapshot(this.state),baseRevision});
    if(result?.revision!==undefined&&result?.conflict){
      this.state.cloudSync.serverRevision=Number(result.revision)||baseRevision;
      this.state.cloudSync.lastConflictAt=new Date().toISOString();
    }else if(!result.offline&&!result.failed&&!result.authRequired&&result?.revision!==undefined){
      this.state.cloudSync.revision=Number(result.revision)||0;
      this.state.cloudSync.serverRevision=this.state.cloudSync.revision;
      this.state.cloudSync.lastConflictAt=null;
      if(result.synced>0||result.replayed)this.state.lastSyncAt=new Date().toISOString();
    }
    await this.storage.saveState(this.state);
    this.notify();
    return result;
  }

  async forceLocalAfterConflict(){
    const serverRevision=Number(this.state.cloudSync?.serverRevision);
    if(!Number.isFinite(serverRevision))throw new Error('server_revision_missing');
    await this.sync.requeueConflicts();
    this.state.cloudSync.revision=serverRevision;
    await this.storage.saveState(this.state);
    return this.syncNow();
  }

  async enableCloudSync(){
    if(this.state.cloudSync?.enabled)return this.syncNow();
    this.state.cloudSync={enabled:true,revision:Number(this.state.cloudSync?.revision)||0,serverRevision:Number(this.state.cloudSync?.serverRevision)||0,lastConflictAt:this.state.cloudSync?.lastConflictAt||null};
    await this.storage.saveState(this.state);
    await this.sync.enqueue('ENABLE_CLOUD_SYNC',{deviceId:this.state.deviceId});
    this.notify();
    return this.syncNow();
  }

  async disableCloudSync(){
    this.state.cloudSync.enabled=false;
    await this.storage.saveState(this.state);
    this.notify();
  }

  exportBackup(){return JSON.stringify({exportedAt:new Date().toISOString(),state:this.state},null,2);}
  async importBackup(json){const parsed=typeof json==='string'?JSON.parse(json):json;if(!parsed?.state?.members||!parsed?.state?.sessions)throw new Error('Invalid backup');parsed.state.deviceId=this.state.deviceId;this.state=parsed.state;this.state.cloudSync={enabled:false,revision:0,serverRevision:0,lastConflictAt:null,...(this.state.cloudSync||{})};await this.storage.saveState(this.state);await this.sync.enqueue('IMPORT_BACKUP',{exportedAt:parsed.exportedAt||null});this.notify();}
  async resetDemo(){this.state=demoState(this.state?.deviceId||stableDeviceId());this.state.cloudSync={enabled:false,revision:0,serverRevision:0,lastConflictAt:null};await this.storage.replaceSyncEvents([]);await this.storage.saveState(this.state);this.notify();}
}
