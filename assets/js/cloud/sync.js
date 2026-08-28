import { ensureCloudSession, loadClubMembership, cloudConfig } from './auth.js';

function normalizeEvents(events){
  return events.map(event=>({
    operation_id:event.id,
    event_type:event.type,
    payload:event.payload??{},
    client_created_at:event.createdAt
  }));
}

export function createSyncTransport({
  getSession=ensureCloudSession,
  loadMembership=loadClubMembership,
  fetchImpl=globalThis.fetch?.bind(globalThis),
  config=cloudConfig()
}={}){
  return async function pushBatch({events,snapshot,baseRevision}){
    const session=await getSession();
    if(!session?.access_token)return {status:'auth_required',reason:'organizer_login_required'};
    const membership=await loadMembership(session);
    if(!membership?.club_id)return {status:'auth_required',reason:'club_membership_required'};
    if(typeof fetchImpl!=='function')throw new Error('fetch_unavailable');

    const response=await fetchImpl(`${config.url}/functions/v1/sync-batch`,{
      method:'POST',
      headers:{
        apikey:config.publishableKey,
        Authorization:`Bearer ${session.access_token}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        club_id:membership.club_id,
        base_revision:Number(baseRevision)||0,
        events:normalizeEvents(events),
        snapshot
      })
    });
    const data=await response.json().catch(()=>({}));
    if(response.status===409||data?.status==='conflict'){
      return {status:'conflict',revision:Number(data.revision)||0,reason:data.reason||'revision_mismatch'};
    }
    if(response.status===401||response.status===403){
      return {status:'auth_required',reason:data.error||data.reason||'cloud_authorization_required'};
    }
    if(!response.ok)throw new Error(data.error||data.message||`HTTP ${response.status}`);
    return {status:data.status||'applied',revision:Number(data.revision)||0,...(data.replayed?{replayed:true}:{})};
  };
}

export const pushSyncBatch=createSyncTransport();
