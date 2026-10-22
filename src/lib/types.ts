import type { PlatformLinks } from "./songs";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  timezone: string;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  day: string; // YYYY-MM-DD, in the poster's timezone
  song_url: string;
  page_url: string | null;
  title: string;
  artist: string;
  artwork_url: string | null;
  platform_links: PlatformLinks;
  caption: string;
  created_at: string;
};

// Someone you follow, plus today's song if they've posted one.
export type Friend = Profile & { post: Post | null; followed_at: string };
