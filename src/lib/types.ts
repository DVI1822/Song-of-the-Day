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
  place?: string | null; // roughly where it was posted from: a city
  created_at: string;
};

// Someone you follow, plus today's song if they've posted one. followed_back_at
// is when they added you back, if they did after you added them; hidden means
// you've hidden their songs from your globe.
export type Friend = Profile & { post: Post | null; followed_at: string; followed_back_at: string | null; hidden: boolean };

// Someone who added you that you haven't added back.
export type AddedMe = Profile & { added_at: string };

// Everything shown when you fly into someone's core.
export type Core = {
  profile: Profile;
  posts: Post[]; // newest first
  followers: number;
  following: number;
};

// A note left on a song, with who left it.
export type Note = { id: string; post_id: string; body: string; created_at: string; user: Profile };

// Who felt a song, and the notes on it.
export type Reactions = { feels: { user: Profile; created_at: string }[]; notes: Note[] };

// Something someone did on your song today: felt it, or left a note.
export type Activity = { kind: "feel" | "note"; id: string; at: string; user: Profile; body?: string };

// Something said in the globe chat (to_id null), or to one person.
export type Message = {
  id: string;
  user_id: string;
  to_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};
