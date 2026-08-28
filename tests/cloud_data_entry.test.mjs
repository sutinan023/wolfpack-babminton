import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const admin=readFileSync(new URL('../assets/js/ui/admin.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(index,/id="network-button"[^>]+data-action="open-offline"/);
assert.match(app,/a==='open-offline'\|\|a==='settings'/);
assert.doesNotMatch(admin,/data-action="settings"/);
assert.doesNotMatch(admin,/class="page-title"/);

console.log('PASS Cloud Conflict and Offline/Data use one network-status entry');
