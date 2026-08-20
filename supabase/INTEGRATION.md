# Supabase Integration Status

Project: `wolfpack-babminton`
Project ref: `puwkuhqmdzdhxbafttxq`
Region: `ap-northeast-2`

## Live database schema

Public tables:
- clubs
- club_users
- organizer_devices
- members
- sessions
- courts
- session_attendance
- matches
- match_players
- achievement_definitions
- member_achievements

Private tables:
- private.sync_operations

Important rules:
- All exposed public tables have RLS enabled.
- Owner/admin can write club operational data.
- Viewer can only read club data.
- Mutable rows use an integer `version` for future optimistic sync conflict handling.
- One `playing` and one `queued` match maximum per court are enforced by partial unique indexes.
- Member skill levels: BG, BG+, N, N+, S, P, P+.

## Edge Functions

### player-profile
Public read-only endpoint by Member ID.

`POST https://puwkuhqmdzdhxbafttxq.supabase.co/functions/v1/player-profile`

Body:
```json
{"member_code":"BD260012"}
```

Direct execution of the underlying `get_player_profile` RPC is revoked from anon/authenticated. The Edge Function calls it with backend credentials.

### bootstrap-club
JWT-protected endpoint for the first authenticated organizer.

Creates the Club and links the current Auth user as `owner`.

## Offline behavior

Admin operations remain local-first in IndexedDB. Player profiles fetched from Cloud are cached in IndexedDB and can be reopened while offline.

## Still mocked / next implementation

The browser Sync Queue still uses the mock flush implementation. The next server integration is `sync-batch`:
- authenticated organizer only
- idempotent operation IDs
- optimistic concurrency using `base_version`
- conflict responses preserve both local and server state
- dependency ordering for member/session/court/match operations

Do not put secret/service-role keys in browser code.
