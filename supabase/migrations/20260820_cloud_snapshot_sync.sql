-- Offline-first club snapshot sync.
-- Browser writes remain local-first; this RPC is callable only by service_role/secret-key backend code.

alter table public.clubs
  add column if not exists sync_revision bigint not null default 0;

alter table public.organizer_devices add column if not exists local_id text;
alter table public.members add column if not exists local_id text;
alter table public.sessions add column if not exists local_id text;
alter table public.matches add column if not exists local_id text;

update public.organizer_devices set local_id = id::text where local_id is null;
update public.members set local_id = id::text where local_id is null;
update public.sessions set local_id = id::text where local_id is null;
update public.matches set local_id = id::text where local_id is null;

alter table public.organizer_devices alter column local_id set not null;
alter table public.members alter column local_id set not null;
alter table public.sessions alter column local_id set not null;
alter table public.matches alter column local_id set not null;

create unique index if not exists organizer_devices_club_local_id_uidx on public.organizer_devices(club_id, local_id);
create unique index if not exists members_club_local_id_uidx on public.members(club_id, local_id);
create unique index if not exists sessions_club_local_id_uidx on public.sessions(club_id, local_id);
create unique index if not exists matches_club_local_id_uidx on public.matches(club_id, local_id);

create or replace function public.apply_club_snapshot(
  p_club_id uuid,
  p_user_id uuid,
  p_device_local_id text,
  p_base_revision bigint,
  p_events jsonb,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_revision bigint;
  v_device_id uuid;
  v_session_id uuid;
  v_court_id uuid;
  v_match_id uuid;
  v_member_id uuid;
  v_event jsonb;
  v_member jsonb;
  v_session jsonb;
  v_court jsonb;
  v_attendance jsonb;
  v_match jsonb;
  v_all_replayed boolean := false;
begin
  if not exists (
    select 1
    from public.club_users cu
    where cu.club_id = p_club_id
      and cu.user_id = p_user_id
      and cu.role in ('owner','admin')
  ) then
    raise exception 'club_write_forbidden' using errcode = '42501';
  end if;

  select c.sync_revision
    into v_revision
  from public.clubs c
  where c.id = p_club_id
  for update;

  if v_revision is null then
    raise exception 'club_not_found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_sync_payload' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 0 then
    select not exists (
      select 1
      from jsonb_array_elements(p_events) e
      where not exists (
        select 1
        from private.sync_operations so
        where so.operation_id = (e->>'operation_id')::uuid
          and so.status = 'applied'
      )
    ) into v_all_replayed;
  end if;

  -- A response may have been lost after a successful transaction. If every
  -- operation UUID is already applied, acknowledge the retry without bumping revision.
  if v_all_replayed then
    return jsonb_build_object('status','applied','revision',v_revision,'replayed',true);
  end if;

  if v_revision <> coalesce(p_base_revision, 0) then
    for v_event in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
    loop
      insert into private.sync_operations(
        operation_id, club_id, device_id, entity_type, entity_id, action,
        base_version, payload, client_created_at, status, error_message
      ) values (
        (v_event->>'operation_id')::uuid, p_club_id, null, 'club_snapshot', p_club_id, 'update',
        p_base_revision, v_event,
        coalesce((v_event->>'client_created_at')::timestamptz, now()),
        'conflict', 'revision_mismatch'
      )
      on conflict (operation_id) do update
        set status='conflict', error_message='revision_mismatch', received_at=now();
    end loop;
    return jsonb_build_object('status','conflict','revision',v_revision,'reason','revision_mismatch');
  end if;

  -- Organizer device must exist before sessions can point at it.
  insert into public.organizer_devices(club_id, user_id, label, platform, local_id, is_active, last_seen_at)
  values (
    p_club_id,
    p_user_id,
    coalesce(p_snapshot->'device'->>'label','Primary organizer device'),
    p_snapshot->'device'->>'platform',
    p_device_local_id,
    true,
    now()
  )
  on conflict (club_id, local_id) do update
    set user_id=excluded.user_id,
        label=excluded.label,
        platform=excluded.platform,
        is_active=true,
        last_seen_at=now()
  returning id into v_device_id;

  -- Member master data. Missing members are retained for history; deactivation is explicit.
  for v_member in select value from jsonb_array_elements(coalesce(p_snapshot->'members','[]'::jsonb))
  loop
    insert into public.members(
      club_id, local_id, member_code, nickname, gender, skill_level, rating, joined_date, is_active
    ) values (
      p_club_id,
      v_member->>'localId',
      v_member->>'memberCode',
      v_member->>'nickname',
      coalesce(v_member->>'gender','unspecified'),
      v_member->>'skillLevel',
      (v_member->>'rating')::numeric,
      (v_member->>'joinedDate')::date,
      coalesce((v_member->>'isActive')::boolean,true)
    )
    on conflict (club_id, local_id) do update
      set member_code=excluded.member_code,
          nickname=excluded.nickname,
          gender=excluded.gender,
          skill_level=excluded.skill_level,
          rating=excluded.rating,
          joined_date=excluded.joined_date,
          is_active=excluded.is_active;
  end loop;

  for v_session in select value from jsonb_array_elements(coalesce(p_snapshot->'sessions','[]'::jsonb))
  loop
    insert into public.sessions(
      club_id, local_id, name, session_date, start_time, end_time, status,
      primary_device_id, closed_at
    ) values (
      p_club_id,
      v_session->>'localId',
      v_session->>'name',
      (v_session->>'sessionDate')::date,
      nullif(v_session->>'startTime','')::time,
      nullif(v_session->>'endTime','')::time,
      coalesce(v_session->>'status','open'),
      case when nullif(v_session->>'primaryDeviceLocalId','') is null then null else v_device_id end,
      nullif(v_session->>'closedAt','')::timestamptz
    )
    on conflict (club_id, local_id) do update
      set name=excluded.name,
          session_date=excluded.session_date,
          start_time=excluded.start_time,
          end_time=excluded.end_time,
          status=excluded.status,
          primary_device_id=excluded.primary_device_id,
          closed_at=excluded.closed_at
    returning id into v_session_id;

    -- Courts removed from the active layout remain as closed rows so finished
    -- match history can keep its foreign key intact.
    update public.courts
      set status='closed'
    where club_id=p_club_id and session_id=v_session_id;

    for v_court in select value from jsonb_array_elements(coalesce(v_session->'courts','[]'::jsonb))
    loop
      insert into public.courts(club_id, session_id, court_no, status)
      values (
        p_club_id,
        v_session_id,
        (v_court->>'courtNo')::integer,
        coalesce(v_court->>'status','available')
      )
      on conflict (session_id, court_no) do update
        set status=excluded.status;
    end loop;

    for v_attendance in select value from jsonb_array_elements(coalesce(v_session->'attendance','[]'::jsonb))
    loop
      select m.id into v_member_id
      from public.members m
      where m.club_id=p_club_id and m.local_id=v_attendance->>'memberLocalId';

      if v_member_id is null then
        raise exception 'attendance_member_not_found:%', v_attendance->>'memberLocalId' using errcode='23503';
      end if;

      insert into public.session_attendance(club_id, session_id, member_id, status)
      values (p_club_id, v_session_id, v_member_id, coalesce(v_attendance->>'status','absent'))
      on conflict (session_id, member_id) do update
        set status=excluded.status;
    end loop;

    -- A match absent from the authoritative local snapshot represents a
    -- cancelled match and must not survive in history.
    delete from public.matches m
    where m.club_id=p_club_id
      and m.session_id=v_session_id
      and m.local_id is not null
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(v_session->'matches','[]'::jsonb)) x
        where x->>'localId'=m.local_id
      );

    for v_match in select value from jsonb_array_elements(coalesce(v_session->'matches','[]'::jsonb))
    loop
      select c.id into v_court_id
      from public.courts c
      where c.club_id=p_club_id
        and c.session_id=v_session_id
        and c.court_no=(v_match->>'courtNo')::integer;

      if v_court_id is null then
        raise exception 'match_court_not_found:%', v_match->>'courtNo' using errcode='23503';
      end if;

      insert into public.matches(
        club_id, session_id, court_id, local_id, match_code, mode, status, result,
        started_at, finished_at, result_edited_at, created_at
      ) values (
        p_club_id,
        v_session_id,
        v_court_id,
        v_match->>'localId',
        v_match->>'matchCode',
        v_match->>'mode',
        v_match->>'status',
        nullif(v_match->>'result',''),
        nullif(v_match->>'startedAt','')::timestamptz,
        nullif(v_match->>'finishedAt','')::timestamptz,
        nullif(v_match->>'resultEditedAt','')::timestamptz,
        coalesce(nullif(v_match->>'createdAt','')::timestamptz, now())
      )
      on conflict (club_id, local_id) do update
        set session_id=excluded.session_id,
            court_id=excluded.court_id,
            match_code=excluded.match_code,
            mode=excluded.mode,
            status=excluded.status,
            result=excluded.result,
            started_at=excluded.started_at,
            finished_at=excluded.finished_at,
            result_edited_at=excluded.result_edited_at
      returning id into v_match_id;

      delete from public.match_players where match_id=v_match_id;

      insert into public.match_players(club_id, match_id, member_id, team, slot)
      select p_club_id, v_match_id, m.id, 'A', x.ord::smallint
      from jsonb_array_elements_text(coalesce(v_match->'teamA','[]'::jsonb)) with ordinality as x(local_id,ord)
      join public.members m on m.club_id=p_club_id and m.local_id=x.local_id;

      insert into public.match_players(club_id, match_id, member_id, team, slot)
      select p_club_id, v_match_id, m.id, 'B', x.ord::smallint
      from jsonb_array_elements_text(coalesce(v_match->'teamB','[]'::jsonb)) with ordinality as x(local_id,ord)
      join public.members m on m.club_id=p_club_id and m.local_id=x.local_id;

      if (select count(*) from public.match_players mp where mp.match_id=v_match_id)
         <> jsonb_array_length(coalesce(v_match->'teamA','[]'::jsonb)) + jsonb_array_length(coalesce(v_match->'teamB','[]'::jsonb)) then
        raise exception 'match_player_mapping_incomplete:%', v_match->>'localId' using errcode='23503';
      end if;
    end loop;
  end loop;

  for v_event in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    insert into private.sync_operations(
      operation_id, club_id, device_id, entity_type, entity_id, action,
      base_version, payload, client_created_at, applied_at, status, error_message
    ) values (
      (v_event->>'operation_id')::uuid,
      p_club_id,
      v_device_id,
      'club_snapshot',
      p_club_id,
      'update',
      p_base_revision,
      v_event,
      coalesce((v_event->>'client_created_at')::timestamptz, now()),
      now(),
      'applied',
      null
    )
    on conflict (operation_id) do update
      set device_id=excluded.device_id,
          base_version=excluded.base_version,
          payload=excluded.payload,
          applied_at=now(),
          status='applied',
          error_message=null,
          received_at=now();
  end loop;

  update public.clubs
    set sync_revision=v_revision+1
  where id=p_club_id;

  return jsonb_build_object('status','applied','revision',v_revision+1,'replayed',false);
end;
$$;

revoke all on function public.apply_club_snapshot(uuid,uuid,text,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.apply_club_snapshot(uuid,uuid,text,bigint,jsonb,jsonb) to service_role;
