import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/20260827_delete_empty_session.sql',import.meta.url),'utf8');

assert.match(migration,/event_type'\s*<>\s*'DELETE_SESSION'/);
assert.match(migration,/from public\.matches/i);
assert.match(migration,/status\s*<>\s*'absent'/i);

const attendanceDelete=migration.search(/delete from public\.session_attendance/i);
const courtsDelete=migration.search(/delete from public\.courts/i);
const sessionDelete=migration.search(/delete from public\.sessions/i);
assert.ok(attendanceDelete>=0&&courtsDelete>attendanceDelete&&sessionDelete>courtsDelete,'child rows must be deleted before the session');

console.log('PASS cloud deletion is event-scoped and preserves non-empty session history');
