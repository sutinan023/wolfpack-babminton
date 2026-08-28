create table if not exists public.club_backups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_by uuid not null,
  label text not null default '',
  snapshot jsonb not null,
  member_count integer not null default 0 check (member_count >= 0),
  session_count integer not null default 0 check (session_count >= 0),
  sync_revision bigint not null default 0 check (sync_revision >= 0),
  created_at timestamptz not null default now(),
  constraint club_backups_label_length check (char_length(label) <= 100),
  constraint club_backups_snapshot_shape check (
    jsonb_typeof(snapshot)='object'
    and jsonb_typeof(snapshot->'members')='array'
    and jsonb_typeof(snapshot->'sessions')='array'
  )
);

create index if not exists club_backups_club_created_idx
  on public.club_backups(club_id, created_at desc);

alter table public.club_backups enable row level security;
revoke all on public.club_backups from public, anon, authenticated;

create or replace function private.trim_club_backups()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  delete from public.club_backups b
  where b.club_id=new.club_id
    and b.id in (
      select old.id
      from public.club_backups old
      where old.club_id=new.club_id
      order by old.created_at desc, old.id desc
      offset 20
    );
  return new;
end;
$$;

drop trigger if exists trim_club_backups_trigger on public.club_backups;
create trigger trim_club_backups_trigger
after insert on public.club_backups
for each row execute function private.trim_club_backups();
