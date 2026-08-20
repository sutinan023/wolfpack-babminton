# Badminton Club — Full Option Offline-first Prototype

Prototype รวม **Admin Court Manager + Member ID + Player Profile + Achievement + Offline-first PWA** ไว้ในระบบเดียว

## เปิดใช้งาน

### วิธีแนะนำ (PWA / Offline ใช้งานได้)
Windows: ดับเบิลคลิก `start-local.bat`

หรือรัน:

```bash
python -m http.server 8080
```

แล้วเปิด `http://localhost:8080`

> Service Worker และ PWA ทำงานบน `localhost` หรือ HTTPS เท่านั้น หากเปิด `index.html` แบบ `file://` หน้าจอจะเปิดได้ แต่ Offline cache/PWA จะไม่ทำงานเต็มรูปแบบ

## Demo Player
Member ID: `BD260012`

## ฟีเจอร์ Admin
- Member master + Member ID `BD26xxxx`
- Level: BG / BG+ / N / N+ / S / P / P+
- Rating auto: 2 / 3 / 4 / 5 / 6 / 7 / 8
- Multi-session ต่อวัน, เวลา optional
- Check-in / Waiting Queue
- Court 1–20 และ responsive สำหรับ iPad แนวนอน
- Singles / Doubles
- Auto Match + alternate pairing + Manual Match
- 1 Match = 2 เกม; บันทึกเฉพาะ Team A ชนะ / เสมอ / Team B ชนะ
- Next Queue ต่อ Court
- ยกเลิก Match ที่กำลังเล่นหรือคิวถัดไปโดยไม่เก็บประวัติ
- แก้ผลย้อนหลังพร้อมย้อน W/D/L เดิม
- Top 4: ชนะ 3 / เสมอ 1 / แพ้ 0, ขั้นต่ำ 2 Match
- ปิด/เปิด Session
- Primary organizer device
- IndexedDB local state
- Pending Sync Queue + Mock Sync
- Export / Import Backup JSON

## Player
- เข้า Profile ด้วย Member ID
- Read-only
- Career summary + W/D/L
- Match history
- Achievement 8 แบบ
- Top 4 history จาก Session ที่มีข้อมูล

## Offline-first
ทุก action ฝั่ง Admin จะบันทึก **IndexedDB ก่อน** แล้วเพิ่ม event เข้า Sync Queue ภายหลัง จึงไม่ต้องรอ network ตอนจัดก๊วน

Sync ใน Prototype เป็น **Mock Sync**: เมื่อ Online จะเปลี่ยน event จาก pending → synced เพื่อสาธิต UX เท่านั้น ยังไม่ได้ส่ง API จริง

## Tailwind
Markup ใช้แนวทาง utility-first และชื่อ class แบบ Tailwind โดยมีไฟล์ offline fallback `dist/tailwind.offline.css` แพ็กมาให้เพื่อไม่พึ่ง CDN ในสนาม

ไฟล์ Tailwind source/build config พร้อมอยู่แล้ว:
- `src/input.css`
- `tailwind.config.cjs`
- `package.json`

ถ้าต้องการ build ด้วย Tailwind official CLI:

```bash
npm install
npm run build:css
```

จากนั้นเปลี่ยน `<link>` ใน `index.html` จาก `dist/tailwind.offline.css` เป็น `dist/app.tailwind.css`

## โครงสร้าง

```text
assets/js/core/      pure business logic
assets/js/storage/   IndexedDB / memory adapters
assets/js/sync/      sync queue
assets/js/ui/        Admin / Player / Modal / Network UI
assets/js/state.js   local-first application state
dist/                offline CSS
sw.js                service worker
manifest.webmanifest PWA manifest
tests/               logic / sync / structure tests
```


## Supabase integration (live project)

- Project: `wolfpack-babminton`
- Project ref: `puwkuhqmdzdhxbafttxq`
- Player profile endpoint: `POST /functions/v1/player-profile`
- Player profile lookup is public read-only by Member ID through the Edge Function. Direct database RPC access is restricted to backend/service role.
- Player profiles loaded online are cached in IndexedDB and can be reopened offline.
- Admin sync remains local-first; the next integration step is Supabase Auth + club bootstrap + real sync batch processing.

Security: never put Supabase secret/service-role keys in browser code.


### Organizer cloud onboarding

The Admin header now has a **Cloud** button:
1. Enter organizer email.
2. Verify email OTP.
3. First organizer creates a Club and becomes `owner` through the JWT-protected `bootstrap-club` Edge Function.
4. Local court operation remains usable while signed out/offline; cloud synchronization can resume later.

Only the Supabase **publishable key** is shipped to browser code. No secret/service-role key is included.
