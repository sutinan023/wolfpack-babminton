# Supabase Integration

Project: `wolfpack-babminton`
Project ref: `puwkuhqmdzdhxbafttxq`
Region: `ap-northeast-2`

## Live components

### Database

Core tables:

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
- private.sync_operations

Sync-specific additions:

- `clubs.sync_revision`
- `organizer_devices.local_id`
- `members.local_id`
- `sessions.local_id`
- `matches.local_id`
- unique `(club_id, local_id)` indexes
- `public.apply_club_snapshot(...)` — EXECUTE restricted to service role only

## Edge Functions

### `player-profile`

Public read-only player lookup by Member ID. Direct privileged DB RPC is not available to browser roles.

### `bootstrap-club`

JWT required. Creates a Club for the first organizer and grants role `owner`.

### `sync-batch`

JWT required.

Flow:

1. Validate organizer JWT.
2. Verify owner/admin membership for requested Club.
3. Call service-only `apply_club_snapshot` RPC.
4. Return `applied` or HTTP 409 `conflict`.

## Sync contract

Client sends:

```json
{
  "club_id": "uuid",
  "base_revision": 4,
  "events": [
    {
      "operation_id": "uuid",
      "event_type": "UPDATE_RESULT",
      "payload": {},
      "client_created_at": "2026-08-20T12:00:00Z"
    }
  ],
  "snapshot": {
    "device": {},
    "members": [],
    "sessions": []
  }
}
```

Success:

```json
{"status":"applied","revision":5,"replayed":false}
```

Conflict:

```json
{"status":"conflict","revision":6,"reason":"revision_mismatch"}
```

Operation UUIDs are recorded in `private.sync_operations`; a retry of a fully applied batch is acknowledged as replayed without incrementing revision again.

## Security

- Public schema tables use RLS.
- Browser contains publishable key only.
- `apply_club_snapshot` is a SECURITY DEFINER RPC but anon/authenticated/PUBLIC have no EXECUTE grant.
- `sync-batch` is the only browser-facing write path for batch snapshot sync.
- Do not put Supabase secret/service-role keys in frontend files.

## Current conflict model

Club-level optimistic concurrency is intentionally used instead of per-row merge for this phase because court state, attendance, and match transitions must remain consistent as one logical snapshot.

Primary Organizer Device remains the operational authority at the court.
