-- Per-account application backups. Access is restricted to the server-side service role.
create table if not exists public.user_backups (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  backup_data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

revoke all privileges on table public.user_backups from public, anon, authenticated;
grant select, insert, update on table public.user_backups to service_role;
