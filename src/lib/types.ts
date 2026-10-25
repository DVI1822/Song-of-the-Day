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
  album: string | null;
  preview_url: string | null;
  photo_url: string | null;
  platform_links: PlatformLinks;
  caption: string;
  created_at: string;
};

// Someone you follow, plus today's song if they've posted one.
export type Friend = Profile & { post: Post | null; followed_at: string };

// Someone who added you that you haven't added back.
export type AddedMe = Profile & { added_at: string };

// Everything shown when you fly into someone's core.
export type Core = {
  profile: Profile;
  posts: Post[]; // newest first
  followers: number;
  following: number;
};
