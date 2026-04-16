-- ============================================================
-- Assign the first signed-up user as super_admin for Jayla Selfcatering.
-- This runs once; future staff are managed via the web UI.
-- ============================================================

-- Give the owner the super_admin role and link to the property.
-- Uses a subquery so it works regardless of when the user signed up.
update public.profiles
set
  role_id     = (select id from public.roles where name = 'super_admin'),
  property_id = '00000000-0000-0000-0000-000000000001'
where email = 'nambilij@ketchupsolutions.com';
