create schema if not exists api;

revoke all on schema api from public;
grant usage on schema api to anon;

create table if not exists api.supabase_keepalive (
  singleton boolean primary key default true check (singleton),
  last_heartbeat_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table api.supabase_keepalive enable row level security;

revoke all on api.supabase_keepalive from public;
revoke all on api.supabase_keepalive from anon;
revoke all on api.supabase_keepalive from authenticated;

create or replace function api.keepalive()
returns jsonb
language plpgsql
security definer
set search_path = api, public, pg_temp
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  insert into api.supabase_keepalive (singleton, last_heartbeat_at, updated_at)
  values (true, v_now, v_now)
  on conflict (singleton) do update
  set last_heartbeat_at = excluded.last_heartbeat_at,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'timestamp', v_now
  );
end;
$$;

revoke all on function api.keepalive() from public;
grant execute on function api.keepalive() to anon;

comment on table api.supabase_keepalive is
  'Dedicated heartbeat row used by an external scheduler to keep the Supabase Free project active.';

comment on function api.keepalive() is
  'Idempotent heartbeat RPC for external keepalive jobs. Safe to call periodically.';
