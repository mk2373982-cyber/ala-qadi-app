-- Per-account application backups. Access is restricted to the server-side service role.
create table if not exists public.user_backups (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  backup_data jsonb not null,
  updated_at timestamptz not null default now()
);

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_backups_user_id_fkey'
      and conrelid = 'public.user_backups'::regclass
  ) then
    alter table public.user_backups
      add constraint user_backups_user_id_fkey
      foreign key (user_id) references public.app_users(id) on delete cascade;
  end if;
end
$migration$;

alter table public.user_backups enable row level security;

revoke all privileges on table public.user_backups from public, anon, authenticated;
grant select, insert, update on table public.user_backups to service_role;
