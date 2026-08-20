import fs from 'node:fs';
const app=fs.readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const auth=fs.readFileSync(new URL('../assets/js/cloud/auth.js',import.meta.url),'utf8');
const player=fs.readFileSync(new URL('../assets/js/ui/player.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function ok(v,msg){if(!v)throw new Error(msg);console.log('PASS',msg)}
ok(app.includes('player-profile'),'player profile endpoint wired');
ok(auth.includes('/auth/v1/otp')&&auth.includes('/auth/v1/verify'),'email OTP auth wired');
ok(auth.includes('bootstrap-club'),'club bootstrap wired');
ok(player.includes('renderRemotePlayer'),'remote player renderer exists');
ok(sw.includes('./assets/js/cloud/auth.js'),'cloud auth module cached by service worker');
ok(!auth.includes('sb_secret_')&&!auth.includes('SUPABASE_SERVICE_ROLE_KEY'),'browser auth has no secret key');
