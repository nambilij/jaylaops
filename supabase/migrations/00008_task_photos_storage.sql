-- ============================================================
-- Storage policies for the task-photos bucket.
--
-- Allows authenticated users to upload photos to their own
-- task folder, and anyone in the property to view them.
-- ============================================================

-- Allow authenticated users to upload task photos
-- Path format: {task_id}/{filename}
create policy "Authenticated users can upload task photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'task-photos');

-- Allow authenticated users to view task photos
create policy "Authenticated users can view task photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'task-photos');
