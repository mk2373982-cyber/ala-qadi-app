-- Enforce a per-user monthly limit for automatic backups.
alter table public.user_backups
  add column if not exists auto_backup_month text,
  add column if not exists auto_backup_count integer not null default 0;

update public.user_backups
set auto_backup_count = least(greatest(coalesce(auto_backup_count, 0), 0), 4)
where auto_backup_count is null or auto_backup_count < 0 or auto_backup_count > 4;

alter table public.user_backups
  alter column auto_backup_count set default 0,
  alter column auto_backup_count set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_backups_auto_backup_count_check'
      and conrelid = 'public.user_backups'::regclass
  ) then
    alter table public.user_backups
      add constraint user_backups_auto_backup_count_check
      check (auto_backup_count between 0 and 4);
  end if;
end
$migration$;

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
