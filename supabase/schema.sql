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
  updated_at timestamptz not null default now()
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
