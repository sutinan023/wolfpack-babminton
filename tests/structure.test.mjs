import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const required=[
  'index.html','manifest.webmanifest','sw.js','dist/tailwind.offline.css','src/input.css','tailwind.config.cjs','package.json',
  'assets/js/app.js','assets/js/state.js','assets/js/core/member.js','assets/js/core/session.js','assets/js/core/match.js','assets/js/core/achievement.js',
  'assets/js/storage/indexeddb.js','assets/js/sync/sync.js','assets/js/ui/admin.js','assets/js/ui/player.js','README.md'
];
const missing=required.filter(path=>!existsSync(resolve(root,path)));
assert.deepEqual(missing,[],`Missing: ${missing.join(', ')}`);

const html=readFileSync(resolve(root,'index.html'),'utf8');
assert.ok(!html.includes('http://')&&!html.includes('https://'),'Runtime external URL found in index.html');
for(const path of ['dist/tailwind.offline.css','manifest.webmanifest','assets/js/app.js']){
  assert.ok(html.includes(path),`${path} missing from index.html`);
}

const sw=readFileSync(resolve(root,'sw.js'),'utf8');
for(const path of ['index.html','dist/tailwind.offline.css','assets/js/app.js','assets/js/core/match.js']){
  assert.ok(sw.includes(path),`${path} missing from service worker shell`);
}

const app=readFileSync(resolve(root,'assets/js/app.js'),'utf8');
for(const action of ['cancel-current','cancel-next','save-edit-result','member-form','player-login-form','export-backup','claim-primary']){
  assert.ok(app.includes(action),`Action missing: ${action}`);
}
console.log('PASS structure');

const shellMatch=sw.match(/const APP_SHELL=\[(.*?)\];/s);
assert.ok(shellMatch,'APP_SHELL not found');
const paths=[...shellMatch[1].matchAll(/['"](\.\/[^'"]+)['"]/g)].map(match=>match[1]);
for(const localPath of paths){
  const relativePath=localPath.slice(2).split(/[?#]/,1)[0];
  if(!relativePath)continue;
  assert.ok(existsSync(resolve(root,relativePath)),`Service worker cache path missing: ${relativePath}`);
}
console.log('PASS service worker shell');
