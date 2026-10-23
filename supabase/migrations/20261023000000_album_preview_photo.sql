-- Song of the Day: album names, 30-second previews and photos on posts.
--
-- Run this once in the Supabase SQL Editor after the first migration.
-- It's safe to run again.

alter table public.posts
  add column if not exists album text check (char_length(album) <= 200),
  add column if not exists preview_url text check (preview_url ~ '^https://'),
  add column if not exists photo_url text check (photo_url ~ '^https://');

-- Views remember their column list, so rebuild this one to pick up the new
-- columns.
create or replace view public.today_posts with (security_invoker = true) as
  select p.*
  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  where p.day = (now() at time zone pr.timezone)::date;

-- Needed when "Automatically expose new tables" is off (the posts delete
-- policy calls it).
grant execute on function public.current_day(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Photos: a public bucket, where each person can only add or remove files in
-- their own folder (named after their user id). File names are random, so a
-- photo is only reachable by someone who already has its link.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Upload your own photos" on storage.objects;
create policy "Upload your own photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Remove your own photos" on storage.objects;
create policy "Remove your own photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
