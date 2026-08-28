# Badminton Club — Full Option Offline-first PWA + Supabase

ระบบ Prototype/Reference implementation สำหรับจัดก๊วนแบดบน iPad โดยรวม **Admin Court Manager + Member ID + Player Profile + Achievement + Offline-first PWA + Supabase Sync** ไว้ในโปรเจกต์เดียว

## Architecture

```text
iPad / PWA
  ↓
IndexedDB  ← ทำงานหลักตอนอยู่สนาม
  ↓
Sync Queue
  ↓ เมื่อ Online + Login + เปิด Cloud Sync
Supabase Edge Function: sync-batch
  ↓
PostgreSQL transaction + sync_revision
```

หลักสำคัญ: **Court operation ไม่รอ network** ทุก action บันทึก Local ก่อนเสมอ

## เปิดใช้งาน Local

Windows: ดับเบิลคลิก `start-local.bat`

หรือ:

```bash
python -m http.server 8080
```

แล้วเปิด `http://localhost:8080`

> Service Worker/PWA ต้องใช้ `localhost` หรือ HTTPS

## Admin

- Member master + Member ID `BD26xxxx`
- Level: `BG / BG+ / N / N+ / S / P / P+`
- Rating auto: `2 / 3 / 4 / 5 / 6 / 7 / 8`
- Multi-session ต่อวัน / เวลา optional
- Check-in / Waiting Queue
- Court 1–20 / iPad landscape responsive
- Singles / Doubles
- Auto Match / alternate pairing / Manual Match
- Result: Team A / Draw / Team B
- Next Queue ต่อ Court
- Cancel current/queued match โดยไม่เก็บ history
- Edit result ย้อนหลัง
- Top 4 ต่อ Session
- Primary organizer device
- IndexedDB + Backup JSON

## Cloud Sync

Sync Queue ใช้งานจริงแล้ว ไม่ใช่ Mock Sync

Queue state:

```text
pending → syncing → synced
                  ↘ failed
                  ↘ conflict
```

คุณสมบัติ:

- UUID operation ID สำหรับ idempotency
- legacy queue ID รุ่นเก่าถูก migrate เป็น UUID ก่อนส่ง
- ส่งเป็น authenticated batch ผ่าน `sync-batch`
- snapshot ถูก apply ใน PostgreSQL transaction เดียว
- Club-level optimistic concurrency ด้วย `sync_revision`
- ถ้า revision ไม่ตรง ระบบหยุดและ mark `conflict`
- Conflict ไม่ overwrite Cloud อัตโนมัติ
- มี explicit action **ใช้ข้อมูลใน iPad นี้แทน Cloud** พร้อม confirmation
- Match sync เรียง `finished → playing → queued` เพื่อไม่ชน unique court-state constraints

### Safety gate

หลัง Login/สร้าง Club แล้ว Cloud Sync **ยังไม่เปิดทันที**

Admin ต้องไป `ตั้งค่า / Offline & Data` แล้วกด **เปิด Cloud Sync** ก่อน เพราะ snapshot Local ทั้งชุดจะถูกถือเป็น authoritative state ตอน Sync ครั้งแรก วิธีนี้ช่วยป้องกัน Demo/ข้อมูลทดลองถูกส่งขึ้น Cloud โดยไม่ตั้งใจ

## Organizer Auth

Admin ใช้ Email OTP:

```text
Email → OTP → Supabase Auth → Club membership
```

ครั้งแรกสามารถสร้าง Club ผ่าน JWT-protected `bootstrap-club` และกลายเป็น `owner`

Browser ใช้เฉพาะ **publishable key** ไม่มี secret/service-role key ใน frontend

## Player Profile

- เปิดด้วย Member ID
- Read-only
- Online: `player-profile` Edge Function
- Offline: ใช้ profile ล่าสุดจาก IndexedDB cache

## Supabase

Project ref ปัจจุบัน: `puwkuhqmdzdhxbafttxq`

Edge Functions ใน repo:

```text
supabase/functions/player-profile/
supabase/functions/bootstrap-club/
supabase/functions/sync-batch/
```

Migration ของ Sync รอบนี้:

```text
supabase/migrations/20260820_cloud_snapshot_sync.sql
```

## Tests

```bash
npm test
npm run check:js
```

## Tailwind

UI เป็น utility-first/Tailwind-ready และมี offline stylesheet อยู่ที่:

```text
dist/tailwind.offline.css
```

ถ้าต้องการ rebuild Tailwind:

```bash
npm install
npm run build:css
```

## หมายเหตุ Production

- ระบบยังใช้ Primary Organizer Device เป็น conflict-avoidance หลัก
- ยังไม่มี automatic merge ระหว่าง 2 เครื่องที่แก้ข้อมูล Offline พร้อมกัน
- Remote Achievement awarding ยังควรทำเป็น phase แยก (ปัจจุบันฐาน achievement definitions พร้อมแล้ว)
- ก่อนใช้งานจริงควรตั้ง Custom SMTP สำหรับ Auth และทดสอบสนามจริงด้วย iPad หลายรอบ
