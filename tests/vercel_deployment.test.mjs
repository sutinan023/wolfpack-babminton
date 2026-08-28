import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const ignore=readFileSync(new URL('../.vercelignore',import.meta.url),'utf8').split(/\r?\n/).filter(Boolean);

const serviceWorkerRule=config.headers.find(rule=>rule.source==='/sw.js');
assert.ok(serviceWorkerRule,'Service Worker must have an explicit Vercel header rule');
assert.ok(serviceWorkerRule.headers.some(header=>header.key==='Cache-Control'&&/no-cache|no-store|max-age=0/.test(header.value)));
assert.ok(serviceWorkerRule.headers.some(header=>header.key==='Service-Worker-Allowed'&&header.value==='/'));

for(const privatePath of ['tests','supabase','node_modules','.git']){
  assert.ok(ignore.includes(privatePath),`${privatePath} must not be uploaded to Vercel`);
}
for(const publicPath of ['assets','dist','index.html','sw.js','manifest.webmanifest']){
  assert.ok(!ignore.includes(publicPath),`${publicPath} must remain deployable`);
}

console.log('PASS Vercel deployment keeps PWA assets public and development files private');
