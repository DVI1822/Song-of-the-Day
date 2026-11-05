-- TopTrack: songs play as 30-second samples and open in your own music app,
-- so TopTrack no longer connects to anyone's Spotify (no Spotify Connect).
-- This deletes the Spotify keys kept for the people who had connected.
--
-- Run this once in the Supabase SQL Editor. It's safe to run again.

drop table if exists public.spotify_links;
