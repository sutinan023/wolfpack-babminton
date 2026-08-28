import assert from 'node:assert/strict';
import { createCloudBackup, listCloudBackups, prepareCloudRestore } from '../assets/js/cloud/backup.js';

const session={access_token:'organizer-token'};
const membership={club_id:'club-1'};

{
  let request=null;
  const result=await createCloudBackup({
    session,
    membership,
    snapshot:{members:[{id:'m1'}],sessions:[{id:'s1'}]},
    label:'ก่อนเริ่มรอบเย็น',
    fetchImpl:async(url,options)=>{
      request={url,options};
      return {ok:true,json:async()=>({backup:{id:'backup-1'}})};
    }
  });
  assert.equal(result.id,'backup-1');
  assert.equal(request.options.headers.Authorization,'Bearer organizer-token');
  assert.deepEqual(JSON.parse(request.options.body),{
    action:'create',
    club_id:'club-1',
    label:'ก่อนเริ่มรอบเย็น',
    snapshot:{members:[{id:'m1'}],sessions:[{id:'s1'}]}
  });
  console.log('PASS Cloud Backup sends an authenticated complete local snapshot');
}

{
  const backups=await listCloudBackups({
    session,
    membership,
    fetchImpl:async()=>({ok:true,json:async()=>({backups:[{id:'b2'},{id:'b1'}]})})
  });
  assert.deepEqual(backups,[{id:'b2'},{id:'b1'}]);
  console.log('PASS Cloud Backup lists organizer backups');
}

{
  const original={
    deviceId:'old-device',
    members:[{id:'m1'}],
    sessions:[
      {id:'s1',primaryDeviceId:'old-device'},
      {id:'s2',primaryDeviceId:'another-device'}
    ],
    cloudSync:{enabled:true,revision:2,serverRevision:3,lastConflictAt:'2026-08-27T00:00:00.000Z'}
  };
  const restored=prepareCloudRestore(original,{deviceId:'current-device',syncRevision:9});
  assert.equal(restored.deviceId,'current-device');
  assert.ok(restored.sessions.every(item=>item.primaryDeviceId==='current-device'));
  assert.deepEqual(restored.cloudSync,{enabled:false,revision:9,serverRevision:9,lastConflictAt:null});
  assert.equal(original.deviceId,'old-device','backup payload must not be mutated');
  console.log('PASS Cloud Restore is local-safe, disables Sync and claims the current device');
}

{
  await assert.rejects(
    ()=>listCloudBackups({
      session,
      membership,
      fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:'club_write_forbidden'})})
    }),
    /club_write_forbidden/
  );
  console.log('PASS Cloud Backup rejects unauthorized access');
}
