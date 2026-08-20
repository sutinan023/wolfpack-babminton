# Badminton Club Full Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build an offline-first badminton club prototype combining organizer court operations, member management, player profiles, achievements, and local sync behavior.

**Architecture:** Use a static SPA with pure domain modules, IndexedDB persistence, a sync queue adapter, and a service worker. UI uses standard Tailwind utility class names and ships with a local offline CSS build/fallback so the prototype has no runtime CDN dependency.

**Tech Stack:** HTML5, JavaScript ES modules, IndexedDB, Service Worker/PWA, Tailwind-compatible utility classes, Node.js tests, Python structural tests.

**Spec:** `docs/superpowers/specs/2026-08-20-badminton-club-full-option-design.md`

## Global Constraints
- Admin court operation must remain usable offline after the app shell has been loaded once through localhost/HTTPS.
- Member levels are exactly `BG`, `BG+`, `N`, `N+`, `S`, `P`, `P+`.
- Default ratings are exactly `2, 3, 4, 5, 6, 7, 8` respectively.
- A match result stores only Team A win, Draw, or Team B win; no point scores.
- One session may have 1–20 courts and one day may have multiple sessions.
- Cancelled active/queued matches are deleted and do not appear in history.
- Player profile is read-only and must not expose private contact data.
- No runtime CDN dependencies.

---

### Task 1: Domain model and tests
**Files:** Create `assets/js/core/constants.js`, `member.js`, `session.js`, `match.js`, `ranking.js`, `achievement.js`; test `tests/core.test.mjs`.

- [x] Write failing tests for level/rating mapping, member code generation, match cancellation, result editing, Top 4, and auto-match alternatives.
- [x] Run `node tests/core.test.mjs` and verify expected module-not-found failures.
- [x] Implement pure domain functions.
- [x] Run `node tests/core.test.mjs` and verify PASS.

### Task 2: Offline storage and sync queue
**Files:** Create `assets/js/storage/indexeddb.js`, `assets/js/storage/memory.js`, `assets/js/sync/sync.js`; test `tests/sync.test.mjs`.

- [x] Write failing tests for queue append, mock online sync, and pending-count behavior using memory storage.
- [x] Run `node tests/sync.test.mjs` and verify FAIL.
- [x] Implement storage interface and sync queue.
- [x] Run `node tests/sync.test.mjs` and verify PASS.

### Task 3: State controller
**Files:** Create `assets/js/state.js`, `assets/js/demo-data.js`.

- [x] Implement state bootstrap, commit, IndexedDB save, sync event creation, active-session selection, backup export/import helpers.
- [x] Verify state module imports successfully with `node --check` and static tests.

### Task 4: Tailwind-style offline UI shell
**Files:** Create `index.html`, `dist/tailwind.offline.css`, `src/input.css`, `tailwind.config.js`, `package.json`.

- [x] Build Admin/Player shell with standard Tailwind utility class names.
- [x] Implement court-first iPad layout and responsive 1/2/3/4 court arrangements.
- [x] Ensure all controls have explicit labels and 44px+ touch targets.

### Task 5: Admin interaction
**Files:** Create `assets/js/ui/admin.js`, `assets/js/ui/modal.js`, `assets/js/app.js`.

- [x] Wire member CRUD, Member ID, check-in, session creation/switching/editing, court count/status, auto/manual match, result entry, result edit, cancel current/queued match, close/reopen session, Top 4.
- [x] Persist every mutation locally before any mock sync attempt.

### Task 6: Player profile and achievements
**Files:** Create `assets/js/ui/player.js`.

- [x] Add Member ID lookup, profile summary, matches, achievements, and offline cached read behavior.
- [x] Add admin shortcut from member management to player profile.

### Task 7: PWA and offline controls
**Files:** Create `sw.js`, `manifest.webmanifest`, `icons/app-icon.svg`, `assets/js/ui/network.js`, `start-local.bat`, `start-local.sh`.

- [x] Cache app shell in service worker.
- [x] Show Online / Offline / pending sync state.
- [x] Add manual mock sync, backup export/import, primary organizer device status.

### Task 8: Verification and documentation
**Files:** Create `README.md`, `tests/structure.test.py`.

- [x] Verify no external runtime CDN links.
- [x] Verify required files and key UI hooks exist.
- [x] Run `node tests/core.test.mjs`.
- [x] Run `node tests/sync.test.mjs`.
- [x] Run `python tests/structure.test.py`.
- [x] Run `node --check` over every JavaScript file.
- [x] Zip the complete project.
