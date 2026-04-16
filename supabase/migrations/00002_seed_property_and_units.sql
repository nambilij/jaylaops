-- ============================================================
-- Seed: Jayla Selfcatering property + 6 units + standard areas
-- ============================================================

-- Insert the property
insert into public.properties (id, name, address, city, country, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Jayla Selfcatering and Accommodations',
  '39 Andimba Toivo ya Toivo Street, Suiderhof',
  'Windhoek',
  'NA',
  'Africa/Windhoek'
);

-- Insert 6 units
insert into public.units (property_id, name, short_code, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'Room 1', 'R1', 1),
  ('00000000-0000-0000-0000-000000000001', 'Room 2', 'R2', 2),
  ('00000000-0000-0000-0000-000000000001', 'Room 3', 'R3', 3),
  ('00000000-0000-0000-0000-000000000001', 'Room 4', 'R4', 4),
  ('00000000-0000-0000-0000-000000000001', 'Room 5', 'R5', 5),
  ('00000000-0000-0000-0000-000000000001', 'Room 6', 'R6', 6);

-- Insert standard cleaning areas (shared across all rooms)
insert into public.areas (property_id, name, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'Bedroom',    1),
  ('00000000-0000-0000-0000-000000000001', 'Bathroom',   2),
  ('00000000-0000-0000-0000-000000000001', 'Kitchen',    3),
  ('00000000-0000-0000-0000-000000000001', 'Entrance',   4),
  ('00000000-0000-0000-0000-000000000001', 'Outdoor',    5);
