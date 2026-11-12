import type { PlatformLinks } from "./songs";

export type Profile = {
  id: string;
  username: string;
  display_name: string; // "First Last", shown around the app
  first_name?: string | null; // null for people who joined before names were required
  last_name?: string | null;
  timezone: string;
  created_at: string;
  avatar_url?: string | null; // their picture, if they've chosen one
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
// is when they added you back, if they did after you added them; follows_me is
// whether they have you on their globe too (only then can you chat); hidden means
// you've hidden their songs from your globe; streak is how many days in a row
// they've posted, counting today (missing until the streaks migration is run).
export type Friend = Profile & { post: Post | null; followed_at: string; followed_back_at: string | null;
  follows_me: boolean;
  hidden: boolean;
  streak?: number;
};

// Someone who added you that you haven't added back.
export type AddedMe = Profile & { added_at: string };

// Someone not on your globe yet, and the people on your globe they know.
export type MayKnow = Profile & { mutuals: Profile[] };

// Everything shown when you fly into someone's core.
export type Core = {
  profile: Profile;
  posts: Post[]; // newest first
  followers: number;
  following: number;
};

// A note left on a song, with who left it.
export type Note = { id: string; post_id: string; body: string; created_at: string; user: Profile };

// Who liked a song ("feels"), the notes on it, and whether you saved it to
// your core.
export type Reactions = { feels: { user: Profile; created_at: string }[]; notes: Note[]; saved?: boolean };

// A song you saved to your core, with who posted it.
export type SavedSong = Post & { by: Profile; saved_at: string };

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

// A few facts about a song, from Wikipedia and music sites (see lib/facts.ts).
// source: the page the fact was taken from (Wikipedia or a music site)
export type SongFact = { text: string; about: "song" | "artist"; source?: { name: string; url: string } };
// photo: a less-seen photo of the artist from Wikimedia Commons, with who took it
export type ArtistPhoto = { url: string; width: number; height: number; page: string; credit: string; license: string };
export type SongFacts = { facts: SongFact[]; photo?: ArtistPhoto | null };

// People who joined before first and last names were required get asked once.
export function needsFullName(p: Pick<Profile, "first_name" | "last_name">) {
  return !p.first_name?.trim() || !p.last_name?.trim();
}
