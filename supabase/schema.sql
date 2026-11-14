-- Run once in Supabase SQL Editor. Holds account/license/payment metadata only.
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  password_hash text not null,
  status text not null default 'pending' check (status in ('pending','active','suspended','expired')),
  plan text not null default '1_month' check (plan in ('1_month','3_months','6_months','1_year','lifetime')),
  start_date timestamptz,
  end_date timestamptz,
  notes text,
  payment_status text not null default 'not_submitted' check (payment_status in ('not_submitted','pending_review','confirmed','rejected')),
  payment_reference text,
  payment_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_status_idx on public.app_users(status);
create index if not exists app_users_payment_status_idx on public.app_users(payment_status);

create table if not exists public.user_backups (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  backup_data jsonb not null,
  updated_at timestamptz not null default now(),
  auto_backup_month text,
  auto_backup_count integer not null default 0 check (auto_backup_count between 0 and 4)
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_settings enable row level security;
alter table public.user_backups enable row level security;
-- No client policies or table grants: access only through server routes using SUPABASE_SERVICE_ROLE_KEY.
revoke all privileges on table public.app_users, public.app_settings
  from public, anon, authenticated;
revoke all privileges on table public.user_backups from public, anon, authenticated;
grant select, insert, update on table public.user_backups to service_role;

create or replace function public.save_user_backup(
  p_user_id uuid,
  p_backup_data jsonb,
  p_mode text,
  p_current_month text
)
returns table (
  updated_at timestamptz,
  remaining_auto_backups integer,
  skipped boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auto_backup_count integer;
begin
  if p_user_id is null or p_backup_data is null then
    raise exception 'Backup user and data are required';
  end if;
  if p_mode is null or p_mode not in ('manual', 'auto') then
    raise exception 'Unsupported backup mode';
  end if;
  if p_current_month is null or p_current_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid backup month';
  end if;

  if p_mode = 'manual' then
    insert into public.user_backups as current_backup (user_id, backup_data, updated_at)
    values (p_user_id, p_backup_data, pg_catalog.clock_timestamp())
    on conflict (user_id) do update
      set backup_data = excluded.backup_data,
          updated_at = excluded.updated_at
    returning
      current_backup.updated_at,
      greatest(
        0,
        4 - case
          when current_backup.auto_backup_month = p_current_month
            then current_backup.auto_backup_count
          else 0
        end
      )
    into updated_at, remaining_auto_backups;

    skipped := false;
    return next;
    return;
  end if;

  insert into public.user_backups as current_backup (
    user_id,
    backup_data,
    updated_at,
    auto_backup_month,
    auto_backup_count
  )
  values (p_user_id, p_backup_data, pg_catalog.clock_timestamp(), p_current_month, 1)
  on conflict (user_id) do update
    set backup_data = excluded.backup_data,
        updated_at = excluded.updated_at,
        auto_backup_month = excluded.auto_backup_month,
        auto_backup_count = case
          when current_backup.auto_backup_month is distinct from p_current_month then 1
          else current_backup.auto_backup_count + 1
        end
    where current_backup.auto_backup_month is distinct from p_current_month
      or current_backup.auto_backup_count < 4
  returning current_backup.updated_at, current_backup.auto_backup_count
  into updated_at, v_auto_backup_count;

  if found then
    remaining_auto_backups := greatest(0, 4 - v_auto_backup_count);
    skipped := false;
  else
    updated_at := null;
    remaining_auto_backups := 0;
    skipped := true;
  end if;

  return next;
end;
$function$;

revoke all on function public.save_user_backup(uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.save_user_backup(uuid, jsonb, text, text)
  to service_role;

-- Shared atomic auth rate limits. Keys are HMAC digests; raw phone/IP values are never stored.
create table if not exists public.auth_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 1),
  updated_at timestamptz not null
);
create index if not exists auth_rate_limits_updated_at_idx on public.auth_rate_limits(updated_at);
alter table public.auth_rate_limits enable row level security;
revoke all privileges on table public.auth_rate_limits from public, anon, authenticated;

create or replace function public.consume_auth_rate_limits(
  p_key_hashes text[], p_max_attempts integer[], p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hash text;
  v_limit integer;
  v_attempts integer;
  v_allowed boolean := true;
begin
  if p_key_hashes is null or p_max_attempts is null
    or cardinality(p_key_hashes) = 0 or cardinality(p_key_hashes) > 3
    or cardinality(p_key_hashes) <> cardinality(p_max_attempts)
    or p_window_seconds is null
    or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit arguments' using errcode = '22023';
  end if;

  for v_hash, v_limit in
    select item.key_hash, item.max_attempts
    from unnest(p_key_hashes, p_max_attempts) as item(key_hash, max_attempts)
    order by item.key_hash
  loop
    if v_hash is null or v_hash !~ '^[a-f0-9]{64}$'
      or v_limit is null or v_limit < 1 or v_limit > 1000 then
      raise exception 'Invalid rate-limit key or limit' using errcode = '22023';
    end if;

    insert into public.auth_rate_limits as current_limit
      (key_hash, window_started_at, attempts, updated_at)
    values (v_hash, v_now, 1, v_now)
    on conflict (key_hash) do update
      set window_started_at = case
            when current_limit.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
            else current_limit.window_started_at
          end,
          attempts = case
            when current_limit.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
            else current_limit.attempts + 1
          end,
          updated_at = v_now
    returning attempts into v_attempts;

    if v_attempts > v_limit then v_allowed := false; end if;
  end loop;

  if mod(txid_current(), 2048) = 0 then
    with stale_keys as (
      select key_hash from public.auth_rate_limits
      where updated_at < v_now - interval '1 day'
      order by updated_at limit 250
    )
    delete from public.auth_rate_limits as limits
    using stale_keys where limits.key_hash = stale_keys.key_hash;
  end if;

  return v_allowed;
end;
$$;

revoke all on function public.consume_auth_rate_limits(text[], integer[], integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limits(text[], integer[], integer) to service_role;

insert into public.app_settings(key, value) values
  ('payment', '{"paymentPhone":"","paymentInstapay":"","whatsappNumber":"","pricingNote":""}'::jsonb)
on conflict (key) do nothing;
