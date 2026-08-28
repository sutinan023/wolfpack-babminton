import { cloudConfig } from './auth.js';

const BACKUP_ENDPOINT='https://puwkuhqmdzdhxbafttxq.supabase.co/functions/v1/club-backups';

async function backupRequest({session,membership,action,payload={},fetchImpl=globalThis.fetch}){
  if(!session?.access_token)throw new Error('organizer_login_required');
  if(!membership?.club_id)throw new Error('club_membership_required');
  const config=cloudConfig();
  const response=await fetchImpl(BACKUP_ENDPOINT,{
    method:'POST',
    headers:{
      apikey:config.publishableKey,
      Authorization:`Bearer ${session.access_token}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({action,club_id:membership.club_id,...payload})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'cloud_backup_failed');
  return data;
}

export async function createCloudBackup({session,membership,snapshot,label='',fetchImpl}){
  const data=await backupRequest({session,membership,action:'create',payload:{label,snapshot},fetchImpl});
  return data.backup;
}

export async function listCloudBackups({session,membership,fetchImpl}){
  const data=await backupRequest({session,membership,action:'list',fetchImpl});
  return Array.isArray(data.backups)?data.backups:[];
}

export async function getCloudBackup({session,membership,id,fetchImpl}){
  const data=await backupRequest({session,membership,action:'get',payload:{backup_id:id},fetchImpl});
  return data.backup;
}

export function prepareCloudRestore(snapshot,{deviceId,syncRevision=0}){
  if(!snapshot||!Array.isArray(snapshot.members)||!Array.isArray(snapshot.sessions))throw new Error('invalid_cloud_backup');
  const restored=structuredClone(snapshot);
  restored.deviceId=deviceId;
  restored.sessions.forEach(session=>{session.primaryDeviceId=deviceId;});
  const revision=Number(syncRevision)||0;
  restored.cloudSync={enabled:false,revision,serverRevision:revision,lastConflictAt:null};
  return restored;
}
