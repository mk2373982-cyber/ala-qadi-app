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

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_settings enable row level security;
-- No client policies: access only through server routes using SUPABASE_SERVICE_ROLE_KEY.

insert into public.app_settings(key, value) values
  ('payment', '{"paymentPhone":"","paymentInstapay":"","whatsappNumber":"","pricingNote":""}'::jsonb)
on conflict (key) do nothing;
