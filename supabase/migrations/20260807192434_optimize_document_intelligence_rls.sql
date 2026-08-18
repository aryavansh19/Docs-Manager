create index if not exists ingestion_jobs_file_id_idx on public.ingestion_jobs (file_id);
create index if not exists search_feedback_selected_file_id_idx on public.search_feedback (selected_file_id);
drop index if exists public.files_user_created_idx;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check ((select auth.uid()) = id);

drop policy if exists "Users can view own files" on public.files;
create policy "Users can view own files" on public.files for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own files" on public.files;
create policy "Users can insert own files" on public.files for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own files" on public.files;
create policy "Users can update own files" on public.files for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own files" on public.files;
create policy "Users can delete own files" on public.files for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own document chunks" on public.document_chunks;
create policy "Users can view own document chunks" on public.document_chunks for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own document chunks" on public.document_chunks;
create policy "Users can insert own document chunks" on public.document_chunks for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own document chunks" on public.document_chunks;
create policy "Users can update own document chunks" on public.document_chunks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own document chunks" on public.document_chunks;
create policy "Users can delete own document chunks" on public.document_chunks for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own ingestion jobs" on public.ingestion_jobs;
create policy "Users can view own ingestion jobs" on public.ingestion_jobs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can view own search feedback" on public.search_feedback;
create policy "Users can view own search feedback" on public.search_feedback for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own search feedback" on public.search_feedback;
create policy "Users can insert own search feedback" on public.search_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
