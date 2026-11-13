-- App data is accessed through server routes using SUPABASE_SERVICE_ROLE_KEY.
-- Anonymous and authenticated browser roles must never access these tables directly.
alter table public.app_users enable row level security;
alter table public.app_settings enable row level security;
alter table public.auth_rate_limits enable row level security;

revoke all privileges on table public.app_users, public.app_settings, public.auth_rate_limits
  from public, anon, authenticated;

-- The rate-limit RPC is server-only and must remain unavailable to browser roles.
revoke all privileges on function public.consume_auth_rate_limits(text[], integer[], integer)
  from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limits(text[], integer[], integer)
  to service_role;
