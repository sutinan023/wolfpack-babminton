-- Apply explicit DELETE_SESSION sync events after the authoritative snapshot.
-- The client guards these rules too, but the database remains authoritative.
create or replace function private.apply_delete_session_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_session_id uuid;
  v_local_id text;
begin
  if new.status <> 'applied' or new.payload->>'event_type' <> 'DELETE_SESSION' then
    return new;
  end if;

  v_local_id := nullif(new.payload->'payload'->>'sessionId','');
  if v_local_id is null then
    raise exception 'session_delete_id_missing' using errcode='22023';
  end if;

  select s.id into v_session_id
  from public.sessions s
  where s.club_id=new.club_id and s.local_id=v_local_id
  for update;

  -- A retried delete is successful when the row is already gone.
  if v_session_id is null then
    return new;
  end if;

  if exists (select 1 from public.matches m where m.session_id=v_session_id) then
    raise exception 'session_delete_has_matches' using errcode='23503';
  end if;
  if exists (
    select 1 from public.session_attendance a
    where a.session_id=v_session_id and a.status <> 'absent'
  ) then
    raise exception 'session_delete_has_checkin' using errcode='23503';
  end if;

  delete from public.session_attendance where session_id=v_session_id;
  delete from public.courts where session_id=v_session_id;
  delete from public.sessions where id=v_session_id and club_id=new.club_id;
  return new;
end;
$$;

drop trigger if exists apply_delete_session_event_trigger on private.sync_operations;
create trigger apply_delete_session_event_trigger
after insert or update of status, payload on private.sync_operations
for each row execute function private.apply_delete_session_event();
