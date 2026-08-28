# Cloud Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype mock sync with an authenticated, idempotent, offline-first sync path from IndexedDB to Supabase, including optimistic conflict detection and retry-safe queue states.

**Architecture:** Court operations continue to commit locally first. Each local mutation adds an immutable queue event. When online and authenticated, the client sends all retryable events plus the current authoritative club snapshot to a Supabase Edge Function. Supabase applies the snapshot transactionally only when the client's `base_revision` matches the club's current `sync_revision`, records operation IDs for idempotency, increments the revision, and returns either `applied` or `conflict`.

**Tech Stack:** Browser ES modules, IndexedDB, Supabase Auth, Edge Functions, PostgreSQL, RLS.

**Spec:** `docs/superpowers/specs/2026-08-20-badminton-club-full-option-design.md`

## Global Constraints

- Local court operation must never wait for network I/O.
- Browser code may contain only the Supabase publishable key; never a secret/service-role key.
- One primary organizer device remains the authority for active court operations.
- Sync must be idempotent by operation UUID.
- Conflict must not overwrite cloud state automatically.
- Failed/conflicted queue items must remain inspectable and retryable.

---

### Task 1: Queue model and transport contract

**Files:**
- Modify: `assets/js/sync/sync.js`
- Modify: `assets/js/storage/memory.js`
- Modify: `assets/js/storage/indexeddb.js`
- Test: `tests/sync.test.mjs`

**Interfaces:**
- `SyncEngine.enqueue(type, payload)` creates a UUID-backed `pending` event.
- `SyncEngine.flush({snapshot, baseRevision})` calls a provided `pushBatch` transport and returns applied/conflict/auth/offline outcomes.
- `SyncEngine.statusCounts()` returns pending/failed/conflict/synced counts.

### Task 2: Cloud snapshot serialization

**Files:**
- Create: `assets/js/cloud/snapshot.js`
- Test: `tests/cloud_sync_snapshot.test.mjs`

**Interfaces:**
- `toCloudSnapshot(state)` returns normalized members/sessions/courts/attendance/matches data suitable for PostgreSQL enums and columns.

### Task 3: Authenticated batch transport

**Files:**
- Create: `assets/js/cloud/sync.js`
- Modify: `assets/js/cloud/auth.js`
- Test: `tests/cloud_sync_transport.test.mjs`

**Interfaces:**
- `pushSyncBatch({events,snapshot,baseRevision})` loads/refreshes the organizer session and club membership, invokes `/functions/v1/sync-batch`, and returns normalized sync outcome.

### Task 4: AppState cloud revision integration

**Files:**
- Modify: `assets/js/state.js`
- Modify: `assets/js/app.js`
- Modify: `assets/js/ui/admin.js`
- Test: `tests/cloud_integration.test.mjs`

**Interfaces:**
- `state.cloudSync.revision` stores the last applied server revision.
- `AppState.syncNow()` sends the current snapshot, updates revision on success, and preserves conflict state.

### Task 5: Supabase transactional apply path

**Files:**
- Create: `supabase/migrations/20260820_cloud_snapshot_sync.sql`
- Create: `supabase/functions/sync-batch/index.ts`

**Interfaces:**
- `public.apply_club_snapshot(...)` service-role-only RPC applies a snapshot in one database transaction.
- `sync-batch` requires a valid organizer JWT, verifies club membership, then calls the service-only RPC.

### Task 6: Verification

Run all Node tests, Python structure tests, JS syntax checks, Supabase security/performance advisors, and verify no browser source contains secret/service-role keys.
