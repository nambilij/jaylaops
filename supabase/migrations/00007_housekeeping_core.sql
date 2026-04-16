-- ============================================================
-- Phase 1: Housekeeping Core tables
--
-- Creates: task_templates, task_checklist_items, daily_tasks,
--          task_photos, task_status_history, inspections
-- ============================================================

-- ============================================================
-- TASK TEMPLATES
-- A template defines a type of cleaning task, e.g. "Clean Bathroom".
-- Managers create these; the system uses them to generate daily tasks.
-- ============================================================
create table public.task_templates (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  name              text not null,
  description       text,
  area_id           uuid references public.areas(id),
  cadence           text not null default 'daily'
    check (cadence in ('daily', 'checkin', 'checkout', 'weekly')),
  estimated_minutes int default 30,
  required_photos   int default 1,
  is_active         boolean default true,
  sort_order        int default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index idx_templates_property on public.task_templates (property_id);

-- ============================================================
-- TASK CHECKLIST ITEMS
-- Ordered steps within a template, e.g. "Strip bedding", "Vacuum floor".
-- ============================================================
create table public.task_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.task_templates(id) on delete cascade,
  label         text not null,
  sort_order    int default 0,
  created_at    timestamptz default now()
);

create index idx_checklist_template on public.task_checklist_items (template_id);

-- ============================================================
-- DAILY TASKS
-- A concrete task for a specific unit on a specific date.
-- Generated from templates (manually or via cron).
-- Follows the state machine: GENERATED → PENDING → IN_PROGRESS →
--   AWAITING_INSPECTION → APPROVED / REJECTED → (reopen)
-- ============================================================
create table public.daily_tasks (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  template_id       uuid references public.task_templates(id),
  unit_id           uuid not null references public.units(id),
  assignee_id       uuid references auth.users(id),
  status            text not null default 'PENDING'
    check (status in ('GENERATED', 'PENDING', 'IN_PROGRESS', 'AWAITING_INSPECTION', 'APPROVED', 'REJECTED', 'SKIPPED')),
  scheduled_for     date not null default current_date,
  started_at        timestamptz,
  completed_at      timestamptz,
  inspected_at      timestamptz,
  inspector_id      uuid references auth.users(id),
  rejection_reason  text,
  checklist_state   jsonb default '[]',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Critical indexes from PRD §5
create index idx_tasks_property_date_status on public.daily_tasks (property_id, scheduled_for, status);
create index idx_tasks_assignee_active on public.daily_tasks (assignee_id) where status in ('PENDING', 'IN_PROGRESS');

-- ============================================================
-- TASK PHOTOS
-- Photos attached to a completed task as proof of work.
-- Stored in Supabase Storage bucket 'task-photos'.
-- ============================================================
create table public.task_photos (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.daily_tasks(id) on delete cascade,
  storage_path text not null,
  file_name   text,
  taken_at    timestamptz default now(),
  created_at  timestamptz default now()
);

create index idx_task_photos_task on public.task_photos (task_id);

-- ============================================================
-- TASK STATUS HISTORY
-- Append-only ledger of every status change on a task.
-- ============================================================
create table public.task_status_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.daily_tasks(id) on delete cascade,
  actor_id    uuid references auth.users(id),
  from_status text,
  to_status   text not null,
  reason      text,
  created_at  timestamptz default now()
);

create index idx_status_history_task on public.task_status_history (task_id);

-- Make task_status_history append-only (same as audit_logs)
create trigger enforce_status_history_immutable
  before update or delete on public.task_status_history
  for each row execute function public.audit_logs_immutable();

-- ============================================================
-- INSPECTIONS
-- A supervisor/manager reviews a completed task.
-- ============================================================
create table public.inspections (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.daily_tasks(id) on delete cascade,
  inspector_id  uuid not null references auth.users(id),
  result        text not null check (result in ('approved', 'rejected')),
  notes         text,
  score         int check (score between 1 and 5),
  created_at    timestamptz default now()
);

create index idx_inspections_task on public.inspections (task_id);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create trigger set_task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

create trigger set_daily_tasks_updated_at
  before update on public.daily_tasks
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Task templates: anyone in the property can read; managers can manage
alter table public.task_templates enable row level security;

create policy "Users can view property templates"
  on public.task_templates for select
  using (property_id = public.auth_property_id());

create policy "Managers can manage templates"
  on public.task_templates for all
  using (
    property_id = public.auth_property_id()
    and exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager', 'supervisor')
    )
  );

-- Checklist items: same visibility as templates
alter table public.task_checklist_items enable row level security;

create policy "Users can view checklist items"
  on public.task_checklist_items for select
  using (
    exists (
      select 1 from public.task_templates t
      where t.id = template_id
      and t.property_id = public.auth_property_id()
    )
  );

create policy "Managers can manage checklist items"
  on public.task_checklist_items for all
  using (
    exists (
      select 1 from public.task_templates t
      join public.profiles p on p.property_id = t.property_id
      join public.roles r on r.id = p.role_id
      where t.id = template_id
      and p.id = auth.uid()
      and r.name in ('super_admin', 'manager', 'supervisor')
    )
  );

-- Daily tasks: anyone in the property can read; assignees and managers can update
alter table public.daily_tasks enable row level security;

create policy "Users can view property tasks"
  on public.daily_tasks for select
  using (property_id = public.auth_property_id());

create policy "Managers can manage all tasks"
  on public.daily_tasks for all
  using (
    property_id = public.auth_property_id()
    and exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager', 'supervisor')
    )
  );

create policy "Assignees can update their tasks"
  on public.daily_tasks for update
  using (assignee_id = auth.uid());

-- Task photos: viewable by property; insertable by task assignee
alter table public.task_photos enable row level security;

create policy "Users can view task photos"
  on public.task_photos for select
  using (
    exists (
      select 1 from public.daily_tasks t
      where t.id = task_id
      and t.property_id = public.auth_property_id()
    )
  );

create policy "Assignees can add task photos"
  on public.task_photos for insert
  with check (
    exists (
      select 1 from public.daily_tasks t
      where t.id = task_id
      and t.assignee_id = auth.uid()
    )
  );

-- Status history: viewable by property; inserted via server
alter table public.task_status_history enable row level security;

create policy "Users can view status history"
  on public.task_status_history for select
  using (
    exists (
      select 1 from public.daily_tasks t
      where t.id = task_id
      and t.property_id = public.auth_property_id()
    )
  );

-- Inspections: viewable by property; managers can insert
alter table public.inspections enable row level security;

create policy "Users can view inspections"
  on public.inspections for select
  using (
    exists (
      select 1 from public.daily_tasks t
      where t.id = task_id
      and t.property_id = public.auth_property_id()
    )
  );

create policy "Inspectors can create inspections"
  on public.inspections for insert
  with check (
    exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager', 'supervisor')
    )
  );
