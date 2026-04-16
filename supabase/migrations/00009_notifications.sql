-- ============================================================
-- Notifications table — logs every outbound message
-- (Telegram, email, in-app) for auditability and retry.
-- ============================================================

create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null check (channel in ('telegram', 'email', 'inapp')),
  recipient_user_id uuid references auth.users(id),
  template_key      text not null,
  payload           jsonb default '{}',
  sent_at           timestamptz,
  delivered_at      timestamptz,
  error             text,
  created_at        timestamptz default now()
);

create index idx_notifications_recipient on public.notifications (recipient_user_id);
create index idx_notifications_template  on public.notifications (template_key);
create index idx_notifications_created   on public.notifications (created_at);

-- RLS: managers can read notifications for their property's users
alter table public.notifications enable row level security;

create policy "Managers can view notifications"
  on public.notifications for select
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager')
    )
  );
