-- ============================================================
-- JaylaOps Foundation Migration
-- Creates: roles, profiles, properties, units, areas
-- ============================================================

-- Enable useful Postgres extensions
create extension if not exists "pgcrypto";   -- for gen_random_uuid()
create extension if not exists "citext";     -- for case-insensitive emails

-- ============================================================
-- ROLES (seeded lookup table — not a user-editable table)
-- Think of this as: "what job titles exist in the system?"
-- ============================================================
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,        -- e.g. 'super_admin', 'manager'
  label       text not null,               -- e.g. 'Super Admin', 'Manager'
  created_at  timestamptz default now()
);

-- Seed the four staff roles
insert into public.roles (name, label) values
  ('super_admin', 'Super Admin'),
  ('manager',     'Manager'),
  ('supervisor',  'Supervisor'),
  ('housekeeper', 'Housekeeper');

-- ============================================================
-- PROFILES (extends Supabase auth.users with app-specific data)
-- Every person who logs in gets a row here automatically.
-- ============================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           citext unique,
  full_name       text,
  phone           text,
  role_id         uuid references public.roles(id),
  property_id     uuid,  -- will reference properties once that table exists; added as FK below
  tg_user_id      bigint unique,           -- Telegram user ID (linked later)
  tg_link_code    text,                    -- one-time 6-digit linking code
  tg_link_expires timestamptz,             -- when the link code expires
  locale          text default 'en',
  is_active       boolean default true,
  avatar_url      text,
  last_login_at   timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Automatically create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PROPERTIES (the guest house itself — just one for now,
-- but the schema supports multiple for future growth)
-- ============================================================
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,               -- e.g. 'Jayla Selfcatering'
  address     text,
  city        text,
  country     text default 'ZA',
  timezone    text default 'Africa/Johannesburg',
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Now add the foreign key from profiles to properties
alter table public.profiles
  add constraint profiles_property_id_fkey
  foreign key (property_id) references public.properties(id);

-- ============================================================
-- UNITS (the 6 accommodation rooms/apartments)
-- Each unit has a unique QR token for guest feedback.
-- ============================================================
create table public.units (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  name         text not null,              -- e.g. 'Unit 1 — Protea Suite'
  short_code   text not null,              -- e.g. 'U1'
  description  text,
  qr_token     uuid unique default gen_random_uuid(),  -- for guest QR URL
  status       text default 'DIRTY'
    check (status in ('DIRTY','IN_PROGRESS','CLEANED','INSPECTED','GUEST_READY','PROBLEM_REPORTED')),
  is_active    boolean default true,
  sort_order   int default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- AREAS (parts of a unit that get cleaned separately)
-- e.g. 'Bedroom', 'Bathroom', 'Kitchen', 'Lounge'
-- ============================================================
create table public.areas (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  name         text not null,              -- e.g. 'Bathroom'
  description  text,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- This is the "lock on each filing cabinet drawer."
-- Users can only see/edit data belonging to their property.
-- ============================================================

-- Turn on RLS for every table
alter table public.profiles   enable row level security;
alter table public.properties enable row level security;
alter table public.units      enable row level security;
alter table public.areas      enable row level security;

-- Profiles: users can read their own profile; admins/managers can read all in their property
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Managers can view property profiles"
  on public.profiles for select
  using (
    property_id = (select property_id from public.profiles where id = auth.uid())
  );

-- Properties: anyone logged in can read their own property
create policy "Users can view their property"
  on public.properties for select
  using (
    id = (select property_id from public.profiles where id = auth.uid())
  );

-- Units: anyone in the property can view units
create policy "Users can view property units"
  on public.units for select
  using (
    property_id = (select property_id from public.profiles where id = auth.uid())
  );

-- Areas: anyone in the property can view areas
create policy "Users can view property areas"
  on public.areas for select
  using (
    property_id = (select property_id from public.profiles where id = auth.uid())
  );

-- Managers and above can insert/update units and areas
create policy "Managers can manage units"
  on public.units for all
  using (
    property_id = (select property_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager')
    )
  );

create policy "Managers can manage areas"
  on public.areas for all
  using (
    property_id = (select property_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager')
    )
  );

-- ============================================================
-- INDEXES (makes searches fast)
-- ============================================================
create index idx_profiles_property  on public.profiles (property_id);
create index idx_profiles_role      on public.profiles (role_id);
create index idx_units_property     on public.units (property_id);
create index idx_units_qr_token     on public.units (qr_token);
create index idx_areas_property     on public.areas (property_id);

-- ============================================================
-- UPDATED_AT TRIGGER (auto-updates the updated_at column)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create trigger set_units_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();
