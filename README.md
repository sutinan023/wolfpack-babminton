# Badminton Club Prototype V6.2

Prototype สำหรับผู้จัดก๊วนแบดบน iPad แนวนอน โดยแยกไฟล์ HTML / CSS / JavaScript ให้ดูแลง่าย และลด visual noise แบบ dashboard template

## เปิดใช้งาน
เปิด `index.html` ใน browser ได้โดยตรง ข้อมูล Demo เก็บใน `localStorage`

## โครงสร้าง
- `index.html` — shell และ modal markup
- `assets/css/base.css` — tokens / typography / buttons / form primitives
- `assets/css/layout.css` — app shell, Court Board และ responsive layout
- `assets/css/components.css` — Court, Team, Queue, Member, Modal, History, Top 4
- `assets/js/data.js` — demo/master data
- `assets/js/session.js` — session, attendance, court lifecycle
- `assets/js/member.js` — เพิ่ม/แก้ไข/เปิด-ปิดใช้งานสมาชิก
- `assets/js/match.js` — auto/manual matching, cancel, result, edit result, Top 4
- `assets/js/state.js` — localStorage + backward-compatible normalization
- `assets/js/ui.js` — rendering only
- `assets/js/app.js` — event wiring / interaction

## Member vs Check-in
- **สมาชิก** = Master Data ของก๊วน: ชื่อเล่น เพศ ระดับมือ Rating วันที่เข้าก๊วน Active/Inactive
- **เช็กอิน** = Attendance ของ Session ปัจจุบัน
- สมาชิกใหม่จะถูกเพิ่มเข้า Attendance ของทุก Session เป็นสถานะ `ยังไม่มา`
- ปิดใช้งานสมาชิกไม่ได้ถ้าสมาชิกกำลังเล่นหรือรอ Court

## Tests
```bash
node tests/logic.test.js
node tests/member.test.js
python tests/structure.test.py
```


## V6.2 fix
- แก้ Modal ซ้อนกันตอน History > แก้ผลย้อนหลัง
- เปิด Edit Result จะปิด History ก่อน
- บันทึกหรือปิด Edit Result จะกลับไปหน้า History
# wolfpack-babminton
