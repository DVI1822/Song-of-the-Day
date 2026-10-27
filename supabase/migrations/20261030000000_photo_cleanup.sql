-- Song of the Day: photos last one day.
--
-- A song's photo belongs to its day. Once the poster's midnight passes, the
-- song archives without it: the next time they open the site their old
-- photos are unlinked from their songs and deleted from storage (a redo
-- deletes the old photo straight away). Songs and captions stay.

-- Let people see what's in their own photo folder, so the site can tidy it
-- (and so deleting an account can find every photo). Photos themselves stay
-- reachable by link as before.
drop policy if exists "List your own photos" on storage.objects;
create policy "List your own photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Unlink the photos from your songs on days that have ended.
create function public.clear_old_photos() returns void
language sql security definer set search_path = '' as $$
  update public.posts set photo_url = null
  where user_id = auth.uid()
    and photo_url is not null
    and day < public.current_day(auth.uid());
$$;

revoke all on function public.clear_old_photos() from public, anon;
grant execute on function public.clear_old_photos() to authenticated;
