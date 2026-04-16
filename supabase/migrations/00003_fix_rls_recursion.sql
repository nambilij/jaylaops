-- ============================================================
-- Fix: infinite recursion in RLS policies on profiles
--
-- Problem: policies on profiles (and other tables) do
--   SELECT property_id FROM profiles WHERE id = auth.uid()
-- which triggers RLS on profiles again → infinite loop.
--
-- Solution: a SECURITY DEFINER function that bypasses RLS
-- to safely look up the current user's property_id.
-- ============================================================

-- Helper function: returns the current user's property_id without triggering RLS
create or replace function public.auth_property_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select property_id from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- Drop the broken policies and recreate them using the helper
-- ============================================================

-- PROFILES policies
drop policy if exists "Managers can view property profiles" on public.profiles;
drop policy if exists "Users can view own profile"          on public.profiles;
drop policy if exists "Users can update own profile"        on public.profiles;

-- Users can always view their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Managers can view all profiles in their property (no recursion now)
create policy "Managers can view property profiles"
  on public.profiles for select
  using (
    property_id = public.auth_property_id()
  );

-- PROPERTIES policies
drop policy if exists "Users can view their property" on public.properties;

create policy "Users can view their property"
  on public.properties for select
  using (
    id = public.auth_property_id()
  );

-- UNITS policies
drop policy if exists "Users can view property units" on public.units;
drop policy if exists "Managers can manage units"     on public.units;

create policy "Users can view property units"
  on public.units for select
  using (
    property_id = public.auth_property_id()
  );

create policy "Managers can manage units"
  on public.units for all
  using (
    property_id = public.auth_property_id()
    and exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager')
    )
  );

-- AREAS policies
drop policy if exists "Users can view property areas" on public.areas;
drop policy if exists "Managers can manage areas"     on public.areas;

create policy "Users can view property areas"
  on public.areas for select
  using (
    property_id = public.auth_property_id()
  );

create policy "Managers can manage areas"
  on public.areas for all
  using (
    property_id = public.auth_property_id()
    and exists (
      select 1 from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid()
      and r.name in ('super_admin', 'manager')
    )
  );
