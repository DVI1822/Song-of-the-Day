-- TopTrack: the same rules for who sees what, checked once per read instead
-- of once per row.
--
-- public.can_view() asks the database the same question every time ("is the
-- site public, or is this person a member?"), but written bare in a policy it
-- gets asked again for every row a read touches: every post in a profile's
-- archive, every follow, every feel. Wrapped as (select public.can_view()) the
-- database asks it once per read and reuses the answer. Nobody sees anything
-- different. This is the fix Supabase recommends for policies that call a
-- function.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again.

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles
  for select using (
    id = (select auth.uid())
    or ((select public.can_view()) and id not in (select public.hidden_people()))
  );

drop policy if exists "Posts are public" on public.posts;
create policy "Posts are public" on public.posts
  for select using ((select public.can_view()) and user_id not in (select public.hidden_people()));

drop policy if exists "Follows are public" on public.follows;
create policy "Follows are public" on public.follows
  for select using (
    (select public.can_view())
    and follower_id not in (select public.hidden_people())
    and following_id not in (select public.hidden_people())
  );

drop policy if exists "Feels follow their song" on public.feels;
create policy "Feels follow their song" on public.feels
  for select using (
    (select public.can_view())
    and user_id not in (select public.hidden_people())
    and post_id in (select p.id from public.posts p)
  );

drop policy if exists "Notes follow their song" on public.notes;
create policy "Notes follow their song" on public.notes
  for select using (
    (select public.can_view())
    and user_id not in (select public.hidden_people())
    and post_id in (select p.id from public.posts p)
  );
