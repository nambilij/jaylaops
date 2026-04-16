-- ============================================================
-- Audit Logs — append-only table tracking who did what.
--
-- Columns (from PRD §5):
--   actor       — user ID who performed the action
--   action      — what happened, e.g. 'user.invited', 'task.approved'
--   entity      — table name, e.g. 'profiles', 'units'
--   entity_id   — primary key of the affected row
--   diff        — JSON of what changed (old vs new values)
--   ip          — request IP address
--   ua          — user agent string
--   created_at  — when it happened
--
-- Append-only: a trigger blocks UPDATE and DELETE so nobody
-- can tamper with the history. Retention: 7 years (POPIA).
-- ============================================================

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id),
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  diff        jsonb default '{}',
  ip          text,
  ua          text,
  created_at  timestamptz default now()
);

-- Index for common queries: by actor, by entity, by time
create index idx_audit_actor     on public.audit_logs (actor_id);
create index idx_audit_entity    on public.audit_logs (entity, entity_id);
create index idx_audit_created   on public.audit_logs (created_at);

-- ============================================================
-- Append-only trigger: block any UPDATE or DELETE
-- ============================================================
create or replace function public.audit_logs_immutable()
returns trigger as $$
begin
  raise exception 'audit_logs is append-only — updates and deletes are not allowed';
  return null;
end;
$$ language plpgsql;

create trigger enforce_audit_immutable
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ============================================================
-- RLS: only super_admin and manager can read audit logs.
-- Any authenticated server-side code can insert (via service role).
-- ============================================================
alter table public.audit_logs enable row level security;

-- Managers and above can read logs for their property's users
create policy "Managers can view audit logs"
  on public.audit_logs for select
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager')
    )
  );

-- Service role (server-side) inserts — no user-facing insert policy needed
-- because audit entries are written by server actions using the admin client.
