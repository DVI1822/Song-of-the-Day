-- Song of the Day: where a song was posted from.
--
-- A city, guessed from the poster's connection when they post (the same
-- guess the weather uses), shown next to their name and the time.
alter table public.posts add column if not exists place text check (char_length(place) <= 80);
