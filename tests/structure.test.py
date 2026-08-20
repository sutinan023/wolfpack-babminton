from pathlib import Path
import re, sys
root=Path(__file__).resolve().parents[1]
required=[
'index.html','manifest.webmanifest','sw.js','dist/tailwind.offline.css','src/input.css','tailwind.config.cjs','package.json',
'assets/js/app.js','assets/js/state.js','assets/js/core/member.js','assets/js/core/session.js','assets/js/core/match.js','assets/js/core/achievement.js',
'assets/js/storage/indexeddb.js','assets/js/sync/sync.js','assets/js/ui/admin.js','assets/js/ui/player.js','README.md'
]
missing=[p for p in required if not (root/p).exists()]
assert not missing, f'Missing: {missing}'
html=(root/'index.html').read_text('utf-8')
assert 'http://' not in html and 'https://' not in html, 'Runtime external URL found in index.html'
assert 'dist/tailwind.offline.css' in html
assert 'manifest.webmanifest' in html
assert 'assets/js/app.js' in html
sw=(root/'sw.js').read_text('utf-8')
for p in ['index.html','dist/tailwind.offline.css','assets/js/app.js','assets/js/core/match.js']:
    assert p in sw, f'{p} missing from service worker shell'
app=(root/'assets/js/app.js').read_text('utf-8')
for action in ['cancel-current','cancel-next','save-edit-result','member-form','player-login-form','export-backup','claim-primary']:
    assert action in app, f'Action missing: {action}'
print('PASS structure')

# Every local path listed in APP_SHELL must exist.
import ast
sw_text=(root/'sw.js').read_text('utf-8')
m=re.search(r'const APP_SHELL=\[(.*?)\];',sw_text,re.S)
assert m, 'APP_SHELL not found'
paths=re.findall(r"['\"](\./[^'\"]+)['\"]",m.group(1))
for rel in paths:
    rel=rel[2:]
    if rel in ('','/'):
        continue
    assert (root/rel).exists(), f'Service worker cache path missing: {rel}'
print('PASS service worker shell')
