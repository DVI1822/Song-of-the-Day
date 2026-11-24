-- TopTrack: add a photo to today's song after it's posted.
--
-- You can change the photo (and only the photo) on your own song from today:
-- add one, swap it, or take it off. This isn't a redo, so post_redos isn't
-- touched. Older songs stay as they are (their photos are cleared at
-- midnight by clear_old_photos).
drop policy if exists "Change the photo on today's song" on public.posts;
create policy "Change the photo on today's song" on public.posts
  for update to authenticated
  using (user_id = (select auth.uid())
         and day = public.current_day((select auth.uid())))
  with check (user_id = (select auth.uid())
              and day = public.current_day((select auth.uid())));

grant update (photo_url) on public.posts to authenticated;
