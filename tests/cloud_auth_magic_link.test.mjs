import assert from 'node:assert/strict';

async function run(name,fn){
  try{
    await fn();
    console.log(`PASS ${name}`);
  }catch(err){
    console.error(`FAIL ${name}`);
    throw err;
  }
}

function setupBrowserWindowMock({href='http://localhost:8080/',search='',pathname='/',clearHash=true}={}){
  const store=new Map();
  globalThis.localStorage={
    getItem:key=>store.has(key)?store.get(key):null,
    setItem:(k,v)=>store.set(k,`${v}`),
    removeItem:key=>store.delete(key)
  };
  globalThis.location={href,search,pathname,origin:'http://localhost:8080',hash:search?'':(clearHash?'': '')};
  globalThis.history={replaceState:()=>{}};
  globalThis.document={title:'Badminton Club'};
}

function mockJsonResponse(payload){
  return {ok:true,status:200,json:async()=>payload,headers:{}};
}

await (async()=>{
  setupBrowserWindowMock();
  const auth=await import('../assets/js/cloud/auth.js');
  const {
    sendEmailMagicLink,
    sendEmailOtp,
    extractMagicLinkSession,
    restoreSessionFromAuthUrl,
    getStoredCloudSession,
    clearCloudSession,
    getAuthMode,
    setAuthMode
  }=auth;

  await run('default auth mode is magic link',async()=>{
    assert.equal(getAuthMode(),'magic_link');
  });

  await run('magic link request sends /auth/v1/otp with magiclink payload',async()=>{
    let calledUrl=null;
    let body=null;
    globalThis.fetch=async(url,{method,body:raw})=>{
      calledUrl=url;
      body=JSON.parse(raw);
      assert.equal(method,'POST');
      return mockJsonResponse({});
    };
    const email=await sendEmailMagicLink('Owner@Example.com');
    assert.equal(email,'owner@example.com');
    assert.equal(calledUrl,'https://puwkuhqmdzdhxbafttxq.supabase.co/auth/v1/otp');
    assert.equal(body.email,'owner@example.com');
    assert.equal(body.type,'magiclink');
    assert.equal(body.options.email_redirect_to,'http://localhost:8080/');
  });

  await run('otp request remains supported',async()=>{
    let body=null;
    globalThis.fetch=async(_, {method,body:raw})=>{
      assert.equal(method,'POST');
      body=JSON.parse(raw);
      return mockJsonResponse({});
    };
    const email=await sendEmailOtp('Otp@Example.com');
    assert.equal(email,'otp@example.com');
    assert.equal(body.type,'email');
  });

  await run('extractMagicLinkSession reads token from callback URL',()=>{
    const parsed=extractMagicLinkSession('http://localhost:8080/#access_token=abc123&refresh_token=refresh123&expires_in=3600&email=owner%40badminton.test&type=magiclink');
    assert.equal(parsed?.access_token,'abc123');
    assert.equal(parsed?.refresh_token,'refresh123');
    assert.equal(parsed?.user.email,'owner@badminton.test');
    assert.equal(typeof parsed.expires_at,'number');
  });

  await run('restoreSessionFromAuthUrl stores callback session for boot restore',async()=>{
    const session=await restoreSessionFromAuthUrl('http://localhost:8080/#access_token=abc123&refresh_token=refresh123&expires_in=3600&email=owner%40badminton.test&type=magiclink',false);
    assert.equal(session?.access_token,'abc123');
    const stored=getStoredCloudSession();
    assert.equal(stored?.refresh_token,'refresh123');
  });

  clearCloudSession();
  setAuthMode('magic_link');
})();  
