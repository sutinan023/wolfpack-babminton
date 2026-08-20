# Badminton Club Full Option Offline-First Design

## Goal
Build a single prototype that combines the existing organizer workflow and the new player profile flow, remains usable on an iPad when the court internet connection is unstable, and is structured so it can later be connected to a real backend.

## Product surfaces

### Organizer/Admin
- Member master data with Member ID `BD26xxxx`.
- Levels: `BG`, `BG+`, `N`, `N+`, `S`, `P`, `P+`.
- Default rating mapping: 2, 3, 4, 5, 6, 7, 8.
- Multi-session per day; date and start/end time are optional except date.
- Check-in attendance per session.
- Waiting queue.
- 1–20 courts with responsive court board optimized for iPad landscape.
- Singles and doubles.
- Auto and manual match creation.
- One match represents two games; result is only Team A win / Draw / Team B win.
- Next-match queue per court.
- Cancel active or queued match without history.
- Edit a finished result retrospectively and recalculate W/D/L and ranking.
- Close/reopen a session safely.
- Top 4 per session with 3/1/0 points and two-match minimum.
- Network/sync status, local backup export/import, primary organizer device status.

### Player
- Read-only access by Member ID for the prototype.
- Profile, level, member-since date, career/session summary.
- Match history.
- Achievement progress.
- Top 4 history when available.
- Offline-readable after the player profile has been loaded on the device.

## Offline architecture
- Admin actions never wait for a network request.
- IndexedDB is the source of truth on the device.
- Each mutation also appends a sync event with `pending` status.
- A mock sync adapter marks events synced when online; the interface is designed to be replaced by a real API later.
- Service worker caches the full local app shell.
- Service worker/PWA requires `localhost` or HTTPS; direct `file://` can still render but does not activate the service worker.
- One primary organizer device per session is the write authority in the prototype. Other devices can be treated as view-only when imported state indicates another primary device.
- Export/import JSON backup is available from Data & Offline settings.

## Data model
- `members[]`: id, memberCode, nickname, gender, level, rating, joinedDate, isActive, careerBase.
- `sessions[]`: id, name, date, startTime, endTime, status, primaryDeviceId, courts, attendance, matches, seq, closedAt.
- `attendance[]`: memberId, status, waitMinutes, matches, wins, draws, losses.
- `courts[]`: id, status, currentMatchId, nextMatchId.
- `matches[]`: id, code, mode, source, courtId, teamA, teamB, status, result, timestamps, resultEditedAt.
- `syncQueue[]`: id, type, payload, createdAt, status, syncedAt.
- `settings`: activeSessionId, memberSequence, deviceId, lastSyncAt.

## Auto-match scoring
Auto matching favors fair matches and fair participation rather than pure rating only.
- Rating balance: 40%.
- Waiting time: 25%.
- Number of matches this session: 20%.
- Repeat-partner avoidance: 10%.
- Repeat-opponent avoidance: 5%.
Manual override always remains available.

## Achievement set
- First Match.
- Regular Player.
- Iron Legs.
- Win Streak x3.
- Social Player.
- Explorer.
- Top 4 Debut.
- Session Champion.
Achievements are derived from stored data plus optional seeded career baseline for demo members.

## Visual direction
- Utility-first Tailwind class structure.
- Local/offline stylesheet is packaged with the prototype; no CDN is required at court.
- Warm neutral background, badminton green as the action color, blue only for Team B/status distinction.
- No decorative gradients, glass cards, excessive pills, or nested dashboard cards.
- Large type and 44–52px minimum touch targets for organizers aged 40+.
- Court board is the dominant admin surface.
- 1 court: one wide card; 2 courts: two full-height columns; 3 courts: two plus a full-width third; 4 courts: 2×2.

## Security boundary
Member ID identifies the profile but is not authentication. Prototype player access is read-only and must not expose phone, LINE, email, or other private contact data. A later write-capable player portal should add PIN/OTP.
