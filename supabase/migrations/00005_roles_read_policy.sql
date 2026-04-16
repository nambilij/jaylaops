-- ============================================================
-- Allow any logged-in user to read the roles lookup table.
--
-- Problem: RLS was enabled on roles but no SELECT policy existed,
-- so the join profiles→roles returned null for every user.
-- ============================================================

create policy "Authenticated users can read roles"
  on public.roles for select
  using (auth.uid() is not null);
