
function isUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''));}

function defaultIdFactory(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);
  });
}

export class SyncEngine{
  constructor(storage,{isOnline=()=>globalThis.navigator?.onLine!==false,now=()=>new Date().toISOString(),idFactory=defaultIdFactory,pushBatch=null}={}){
    this.storage=storage;
    this.isOnline=isOnline;
    this.now=now;
    this.idFactory=idFactory;
    this.pushBatch=pushBatch;
  }

  async enqueue(type,payload){
    const e={id:this.idFactory(),type,payload,createdAt:this.now(),status:'pending',attempts:0,syncedAt:null,lastAttemptAt:null,lastError:null,serverRevision:null};
    await this.storage.addSyncEvent(e);
    return e;
  }

  async pendingCount(){
    const events=await this.storage.getSyncEvents();
    return events.filter(e=>['pending','failed','syncing'].includes(e.status)).length;
  }

  async requeueConflicts(){
    const events=await this.storage.getSyncEvents();
    let count=0;
    for(const event of events){
      if(event.status!=='conflict')continue;
      await this.storage.updateSyncEvent(event.id,{status:'pending',lastError:null,serverRevision:null});
      count+=1;
    }
    return count;
  }

  async statusCounts(){
    const events=await this.storage.getSyncEvents();
    const counts={pending:0,failed:0,conflict:0,synced:0};
    for(const e of events){
      if(e.status==='syncing'||e.status==='pending')counts.pending+=1;
      else if(e.status==='failed')counts.failed+=1;
      else if(e.status==='conflict')counts.conflict+=1;
      else if(e.status==='synced')counts.synced+=1;
    }
    return counts;
  }

  async flush({snapshot={},baseRevision=0}={}){
    if(!this.isOnline())return {synced:0,offline:true};
    let allEvents=await this.storage.getSyncEvents();
    let migrated=false;
    allEvents=allEvents.map(event=>{
      if(['pending','failed','syncing','conflict'].includes(event.status)&&!isUuid(event.id)){
        migrated=true;
        return {...event,id:this.idFactory()};
      }
      return event;
    });
    if(migrated&&typeof this.storage.replaceSyncEvents==='function')await this.storage.replaceSyncEvents(allEvents);
    const events=allEvents.filter(e=>['pending','failed','syncing'].includes(e.status));
    if(!events.length)return {synced:0,offline:false,revision:baseRevision};
    if(typeof this.pushBatch!=='function'){
      return {synced:0,failed:events.length,offline:false,error:'sync_transport_unavailable'};
    }

    const attemptAt=this.now();
    for(const event of events){
      await this.storage.updateSyncEvent(event.id,{status:'syncing',attempts:(event.attempts||0)+1,lastAttemptAt:attemptAt,lastError:null});
    }

    let response;
    try{
      response=await this.pushBatch({events,snapshot,baseRevision});
    }catch(error){
      const message=error?.message||String(error);
      for(const event of events)await this.storage.updateSyncEvent(event.id,{status:'failed',lastError:message});
      return {synced:0,failed:events.length,offline:false,error:message};
    }

    if(response?.status==='applied'){
      const syncedAt=this.now();
      for(const event of events){
        await this.storage.updateSyncEvent(event.id,{status:'synced',syncedAt,lastError:null,serverRevision:response.revision??null});
      }
      return {synced:events.length,offline:false,revision:response.revision??baseRevision,replayed:Boolean(response.replayed)};
    }

    if(response?.status==='conflict'){
      for(const event of events){
        await this.storage.updateSyncEvent(event.id,{status:'conflict',lastError:response.reason||'revision_mismatch',serverRevision:response.revision??null});
      }
      return {synced:0,conflict:events.length,offline:false,revision:response.revision??baseRevision,reason:response.reason||'revision_mismatch'};
    }

    const message=response?.reason||response?.error||'sync_rejected';
    if(response?.status==='auth_required'){
      for(const event of events)await this.storage.updateSyncEvent(event.id,{status:'pending',lastError:message});
      return {synced:0,offline:false,authRequired:true,error:message};
    }
    for(const event of events)await this.storage.updateSyncEvent(event.id,{status:'failed',lastError:message});
    return {synced:0,failed:events.length,offline:false,error:message,authRequired:false};
  }
}
