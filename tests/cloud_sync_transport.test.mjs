import assert from 'node:assert/strict';
import { createSyncTransport } from '../assets/js/cloud/sync.js';

const event={id:'11111111-1111-4111-8111-111111111111',type:'CHECK_IN',payload:{memberId:'m1'},createdAt:'2026-08-20T05:00:00.000Z'};

{
  const transport=createSyncTransport({
    getSession:async()=>null,
    loadMembership:async()=>{throw new Error('must not load')},
    fetchImpl:async()=>{throw new Error('must not fetch')},
    config:{url:'https://example.supabase.co',publishableKey:'pk'}
  });
  assert.deepEqual(await transport({events:[event],snapshot:{},baseRevision:0}),{status:'auth_required',reason:'organizer_login_required'});
  console.log('PASS sync transport blocks cloud write without organizer auth');
}

{
  let request;
  const transport=createSyncTransport({
    getSession:async()=>({access_token:'jwt'}),
    loadMembership:async()=>({club_id:'club-1',role:'owner'}),
    fetchImpl:async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({status:'applied',revision:3})};},
    config:{url:'https://example.supabase.co',publishableKey:'pk'}
  });
  const result=await transport({events:[event],snapshot:{members:[]},baseRevision:2});
  assert.deepEqual(result,{status:'applied',revision:3});
  assert.equal(request.url,'https://example.supabase.co/functions/v1/sync-batch');
  assert.equal(request.options.headers.Authorization,'Bearer jwt');
  assert.equal(request.options.headers.apikey,'pk');
  const body=JSON.parse(request.options.body);
  assert.equal(body.club_id,'club-1');
  assert.equal(body.base_revision,2);
  assert.equal(body.events[0].operation_id,event.id);
  assert.equal(body.events[0].event_type,'CHECK_IN');
  console.log('PASS sync transport sends authenticated batch contract');
}

{
  const transport=createSyncTransport({
    getSession:async()=>({access_token:'jwt'}),
    loadMembership:async()=>({club_id:'club-1',role:'admin'}),
    fetchImpl:async()=>({ok:false,status:409,json:async()=>({status:'conflict',revision:9,reason:'revision_mismatch'})}),
    config:{url:'https://example.supabase.co',publishableKey:'pk'}
  });
  const result=await transport({events:[event],snapshot:{},baseRevision:8});
  assert.deepEqual(result,{status:'conflict',revision:9,reason:'revision_mismatch'});
  console.log('PASS sync transport preserves revision conflict response');
}
