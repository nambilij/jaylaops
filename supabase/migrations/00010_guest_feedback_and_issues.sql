-- ============================================================
-- Phase 3: Guest Feedback & Issues
-- ============================================================

-- ============================================================
-- GUEST FEEDBACK
-- Submitted by guests via QR code — no login required.
-- Public endpoint, rate-limited.
-- ============================================================
create table public.guest_feedback (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id),
  unit_id           uuid not null references public.units(id),
  qr_token_used     uuid,
  ratings           jsonb not null default '{}',
  -- ratings: { cleanliness: 1-5, comfort: 1-5, communication: 1-5, overall: 1-5 }
  clean_on_arrival  boolean,
  comments          text,
  guest_contact     text,
  is_urgent         boolean default false,
  reference_number  text unique,
  ip_hash           text,
  user_agent        text,
  submitted_at      timestamptz default now(),
  created_at        timestamptz default now()
);

create index idx_feedback_property_date on public.guest_feedback (property_id, submitted_at desc);
create index idx_feedback_unit          on public.guest_feedback (unit_id);
create index idx_feedback_urgent        on public.guest_feedback (is_urgent) where is_urgent = true;

-- RLS: managers can read all feedback; no public insert policy
-- (inserts happen via service role from the server action)
alter table public.guest_feedback enable row level security;

create policy "Managers can view feedback"
  on public.guest_feedback for select
  using (property_id = public.auth_property_id());

-- ============================================================
-- ISSUES
-- Raised by staff or guests. Tracks problems in units.
-- ============================================================
create table public.issues (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id),
  unit_id       uuid references public.units(id),
  reported_by   uuid references auth.users(id),
  reporter_type text not null default 'staff'
    check (reporter_type in ('staff', 'guest')),
  severity      text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'urgent')),
  category      text,
  title         text not null,
  description   text,
  status        text not null default 'OPEN'
    check (status in ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  assignee_id   uuid references auth.users(id),
  resolved_at   timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index idx_issues_property_status on public.issues (property_id, status, severity);
create index idx_issues_unit            on public.issues (unit_id);
create index idx_issues_assignee        on public.issues (assignee_id);

-- ============================================================
-- ISSUE COMMENTS
-- ============================================================
create table public.issue_comments (
  id          uuid primary key default gen_random_uuid(),
  issue_id    uuid not null references public.issues(id) on delete cascade,
  author_id   uuid references auth.users(id),
  body        text not null,
  created_at  timestamptz default now()
);

create index idx_issue_comments_issue on public.issue_comments (issue_id);

-- ============================================================
-- ISSUE PHOTOS
-- ============================================================
create table public.issue_photos (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid not null references public.issues(id) on delete cascade,
  storage_path  text not null,
  file_name     text,
  created_at    timestamptz default now()
);

create index idx_issue_photos_issue on public.issue_photos (issue_id);

-- ============================================================
-- AUTO-UPDATE
-- ============================================================
create trigger set_issues_updated_at
  before update on public.issues
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS for issues
-- ============================================================
alter table public.issues enable row level security;
alter table public.issue_comments enable row level security;
alter table public.issue_photos enable row level security;

-- Anyone in the property can view issues
create policy "Users can view property issues"
  on public.issues for select
  using (property_id = public.auth_property_id());

-- Anyone in the property can create issues
create policy "Users can create issues"
  on public.issues for insert
  with check (property_id = public.auth_property_id());

-- Managers can update issues
create policy "Managers can manage issues"
  on public.issues for update
  using (
    property_id = public.auth_property_id()
    and exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager', 'supervisor')
    )
  );

-- Issue comments
create policy "Users can view issue comments"
  on public.issue_comments for select
  using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id
      and i.property_id = public.auth_property_id()
    )
  );

create policy "Users can add issue comments"
  on public.issue_comments for insert
  with check (
    exists (
      select 1 from public.issues i
      where i.id = issue_id
      and i.property_id = public.auth_property_id()
    )
  );

-- Issue photos
create policy "Users can view issue photos"
  on public.issue_photos for select
  using (
    exists (
      select 1 from public.issues i
      where i.id = issue_id
      and i.property_id = public.auth_property_id()
    )
  );

create policy "Users can add issue photos"
  on public.issue_photos for insert
  with check (
    exists (
      select 1 from public.issues i
      where i.id = issue_id
      and i.property_id = public.auth_property_id()
    )
  );

-- ============================================================
-- Storage bucket for issue photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('issue-photos', 'issue-photos', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload issue photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'issue-photos');

create policy "Authenticated users can view issue photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'issue-photos');

-- ============================================================
-- Storage bucket for guest photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('guest-photos', 'guest-photos', false)
on conflict (id) do nothing;

-- Guest photos are uploaded via service role, no user policy needed
