-- Song of the Day: a profile picture, shown at the heart of your core.
--
-- The picture itself goes in the photos bucket under <your id>/avatar/, which
-- the existing "your own folder" storage policies already cover, and which
-- the daily photo sweep leaves alone (it only clears files at the top of your
-- folder).

alter table public.profiles
  add column if not exists avatar_url text check (avatar_url ~ '^https://');
