"use client";

import type { GlobeApi } from "@/components/globe/api";
import { GlobeApp } from "@/components/globe/GlobeApp";
import { addDays, todayIn } from "@/lib/day";
import type { Activity, AddedMe, Friend, Message, Note, Post, Profile, Reactions, SavedSong } from "@/lib/types";

// The Globe with made-up friends. Works without signing in; nothing is saved.

// Painted stand-in covers: [top, bottom, sun, sunX, sunY, sunSize, hill1, hill2]
const PALETTES: [string, string, string, number, number, number, string, string][] = [
  ["#DDE3F5", "#7F8FC4", "#FFFFFF", 58, 22, 24, "#5D6CA3", "#3D4A7E"],
  ["#A9DCD6", "#2F6F7E", "#FFEBC2", 56, 18, 26, "#245866", "#173C47"],
  ["#D7EBC9", "#4E7A4A", "#F7FBEA", 18, 22, 30, "#355E34", "#1F3F23"],
  ["#F8DDE3", "#B57C9B", "#FFFFFF", 60, 14, 22, "#84506F", "#5E3753"],
  ["#FFC7A1", "#6B4C8C", "#FFEBC7", 38, 38, 34, "#4A3267", "#2C1E44"],
  ["#3C6F8A", "#0B1820", "#E2ECF2", 66, 16, 14, "#18343F", "#0E2129"],
  ["#FFE3C4", "#E08A6B", "#FFFFFF", 50, 30, 24, "#B8604B", "#7E3E33"],
  ["#C4D2D6", "#536A73", "#F2F6F7", 30, 20, 18, "#3D525A", "#28383E"],
  ["#FFE6A6", "#C9782E", "#FFF8E0", 62, 18, 26, "#9C5A22", "#6B3C16"],
  ["#CFE0DA", "#5E8A80", "#FFFFFF", 24, 26, 22, "#456B62", "#2E4C45"],
  ["#E4F5B8", "#5FA05A", "#FFFFFF", 66, 24, 22, "#3F7A3E", "#285428"],
  ["#4A4F7A", "#14162B", "#E9E4FF", 32, 22, 16, "#2A2D52", "#191B36"],
  ["#C9E4F0", "#3F6F96", "#FFFFFF", 30, 24, 20, "#2D547A", "#1B3956"],
  ["#FBE3C8", "#C9877A", "#FFF7EA", 62, 30, 28, "#9C5F5A", "#6E3F40"],
  ["#E8DFF6", "#7A63B8", "#FFFFFF", 62, 26, 20, "#584391", "#3B2C66"],
];

function cover(i: number) {
  const [a, b, sun, x, y, r, h1, h2] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="${x + r / 2}" cy="${y + r / 2}" r="${r / 2}" fill="${sun}"/><ellipse cx="25" cy="103" rx="55" ry="45" fill="${h1}"/><ellipse cx="85" cy="115" rx="55" ry="45" fill="${h2}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const A = ["Silver", "Hollow", "Amber", "Velvet", "Northern", "Quiet", "Wild", "Cedar", "Lunar", "Salt", "Ember", "Willow", "Slow", "Open", "Coral"];
const B = ["Rivers", "Static", "Hours", "Signal", "Garden", "Tides", "Season", "Echo", "Lanterns", "Valley", "Motel", "Fields", "Satellite", "Rain", "Arcade"];
const C = ["Club", "Union", "Choir", "Parade", "Society", "Radio"];
const PLACES = ["Austin, TX", "Brooklyn, NY", "Portland, OR", "Denver, CO", "Lisbon, Portugal", "Chicago, IL", "Oakland, CA", "Nashville, TN", "Toronto, Canada"];
const CAPS = [
  "windows down on the coast road, fog finally lifting",
  "first coffee on the porch and this one stopped me mid-sip",
  "lunch walk, every cherry tree on the block going off at once",
  "top of the parking garage, nobody else up there",
  "empty highway home, every single light turned green for me",
  "sunrise run, this carried me the last mile",
  "",
  "library window seat, rain on glass, could have stayed forever",
  "kitchen dance break, nobody saw, thank god",
  "friends in the back seat screaming the chorus",
];
const NAMES = [
  "Maya R.", "Jonah K.", "Priya S.", "Luis M.", "Sam T.", "Ava L.", "Theo B.", "Noor H.", "Kenji W.", "Rosa D.",
  "Eli P.", "Ivy C.", "Marco F.", "June A.", "Felix O.", "Hana Y.", "Omar Z.", "Lena V.", "Ravi N.", "Tess G.",
  "Diego Q.", "Mila J.", "Arjun E.", "Zoe I.", "Kai U.", "Nina X.", "Ben W.", "Sora T.", "Iris M.", "Finn D.",
  "Cleo R.", "Max H.", "Esme K.", "Nico P.", "Ruth A.", "Tariq S.", "Wren L.", "Oscar B.", "Ada F.", "Leo N.",
];
const POOL = ["Hazel Q.", "Marcus V.", "Tilly O.", "Dev P.", "Sasha N.", "Rio C.", "Bea W.", "Quinn J.", "Ezra F.", "Luca G."];

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const pickOf = <T,>(list: T[], i: number, k: number) => list[Math.floor(rnd(i, k) * list.length)];

const now = new Date();
const TZ = typeof window === "undefined" ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone;
const TODAY = todayIn(TZ, now);

function profile(i: number, name: string): Profile {
  return {
    id: `u${i}`,
    username: name.toLowerCase().replace(/[^a-z]/g, ""),
    display_name: name,
    timezone: TZ,
    created_at: now.toISOString(),
  };
}

function song(i: number, user: string, day: string, hoursAgo: number): Post {
  return {
    id: `p${user}-${day}`,
    user_id: user,
    day,
    // a real track so the play button can be tried in the demo
    song_url: "https://open.spotify.com/track/003vvx7Niy0yvhvHt4a68B",
    page_url: null,
    title: `${pickOf(A, i, 4)} ${pickOf(B, i, 5)}`,
    artist: `${pickOf(B, i, 6)} ${pickOf(C, i, 7)}`,
    album: `${pickOf(A, i, 13)} ${pickOf(B, i, 14)}`,
    artwork_url: cover(i * 7 + 3),
    preview_url: null,
    photo_url: null,
    platform_links: {},
    caption: CAPS[i % CAPS.length],
    place: PLACES[i % PLACES.length],
    created_at: new Date(now.getTime() - hoursAgo * 3600e3).toISOString(),
  };
}

function history(user: string, seed: number, days: number, from = 1) {
  return Array.from({ length: days }, (_, d) => song(seed * 31 + d, user, addDays(TODAY, -(d + from)), 24 * (d + from) - 4));
}

const ME = profile(0, "You");
const FRIENDS: Friend[] = NAMES.map((name, i) => ({
  ...profile(i + 1, name),
  followed_at: now.toISOString(),
  // a couple of them just added you back
  followed_back_at: i === 3 || i === 7 ? new Date(now.getTime() - (i + 1) * 300_000).toISOString() : null,
  hidden: false,
  post: rnd(i, 12) < 0.28 ? null : song(i + 1, `u${i + 1}`, TODAY, 1 + rnd(i, 1) * 10),
}));
const MY_SONGS = history("u0", 0, 40);

// Feels and notes on friends' songs: a few made up per song, plus whatever
// you do in the demo (kept until the page reloads).
const NOTE_LINES = [
  "this one hits every time",
  "ok adding this to my morning playlist",
  "the bridge!!",
  "you always find these first",
  "on repeat since you posted it",
];
const reactions = new Map<string, Reactions>();
// Songs you saved to your core: two to start, plus whatever you save.
const SAVED: SavedSong[] = FRIENDS.filter((f) => f.post)
  .slice(3, 5)
  .map((f, j) => ({ ...f.post!, by: f, saved_at: new Date(now.getTime() - (j + 1) * 86_400_000).toISOString() }));
function reactionsOf(postId: string): Reactions {
  let r = reactions.get(postId);
  if (!r) {
    const seed = [...postId].reduce((a, c) => a + c.charCodeAt(0), 0);
    const by = (j: number) => FRIENDS[(seed + j * 5) % FRIENDS.length];
    const feels = Array.from({ length: 2 + (seed % 6) }, (_, j) => ({
      user: by(j),
      created_at: new Date(now.getTime() - (j + 1) * 1_500_000).toISOString(),
    }));
    const notes: Note[] = Array.from({ length: seed % 3 }, (_, j) => ({
      id: `${postId}-n${j}`,
      post_id: postId,
      body: NOTE_LINES[(seed + j) % NOTE_LINES.length],
      created_at: new Date(now.getTime() - (3 - j) * 2_400_000).toISOString(),
      user: by(j + 2),
    }));
    r = { feels, notes };
    reactions.set(postId, r);
  }
  return r;
}

// The globe chat: some chatter from friends, a message waiting for you, and
// one more that turns up live a few seconds in.
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
const say = (id: string, from: Profile, body: string, min: number, to: Profile | null = null, read = true): Message => ({
  id,
  user_id: from.id,
  to_id: to?.id ?? null,
  body,
  created_at: ago(min),
  read_at: to && read ? ago(min) : null,
});
const CHAT: Message[] = [
  say("c1", FRIENDS[2], "who else woke up to rain and put on something sad", 190),
  say("c2", FRIENDS[5], "guilty. it's that kind of tuesday", 186),
  say("c3", ME, "posted mine already, not sorry", 120),
  say("c4", FRIENDS[0], "the globe is so full today 🌍", 64),
  say("c5", FRIENDS[8], "whoever posted the jazz one, more of that please", 38),
  say("c6", FRIENDS[4], "that was me!! glad it landed", 35),
  say("c7", FRIENDS[11 % FRIENDS.length], "midnight countdown at 3 hours, get your songs in", 9),
  say("d1", FRIENDS[3], "your song yesterday was perfect for my drive", 300, ME),
  say("d2", ME, "right?? that chorus", 290, FRIENDS[3]),
  say("d3", FRIENDS[3], "send me the whole album", 22, ME, false),
  say("d4", ME, "you have to hear the live version", 1500, FRIENDS[6]),
];

const demoApi: GlobeApi = {
  async previewSong() {
    await new Promise((r) => setTimeout(r, 1100));
    return {
      song: {
        songUrl: "https://song.link/demo",
        pageUrl: null,
        title: "Paper Moons",
        artist: "Lune Harbor",
        album: "Tideline",
        artworkUrl: cover(0),
        previewUrl: null,
        links: {},
      },
    };
  },
  async uploadPhoto(_, photo) {
    return { url: URL.createObjectURL(photo) };
  },
  async createPost(input) {
    return {
      post: {
        ...song(0, "u0", TODAY, 0),
        id: `mine-${Date.now()}`,
        title: input.title,
        artist: input.artist,
        album: input.album,
        artwork_url: input.artworkUrl,
        caption: input.caption,
        photo_url: input.photoUrl,
        created_at: new Date().toISOString(),
      },
    };
  },
  async deleteTodayPost() {
    return undefined;
  },
  async searchPeople(q) {
    const term = q.trim().replace(/^@/, "").toLowerCase();
    return POOL.map((name, j) => ({ ...profile(100 + j, name), following: false })).filter(
      (p) => !term || p.username.includes(term) || p.display_name.toLowerCase().includes(term),
    );
  },
  async follow(id) {
    const j = Number(id.slice(1)) - 100;
    const p = profile(100 + j, POOL[j]);
    return { friend: { ...p, followed_at: new Date().toISOString(), followed_back_at: null, hidden: false, post: song(200 + j, p.id, TODAY, 2) } };
  },
  async matchContacts(emails) {
    // pretend the first picked contact is already here
    return emails.slice(0, 1).map((email, j) => ({ ...profile(100 + j, POOL[j]), email, following: false }));
  },
  async report() {
    await new Promise((r) => setTimeout(r, 500));
    return {};
  },
  async block() {
    await new Promise((r) => setTimeout(r, 500));
    return {};
  },
  async hideSongs() {
    await new Promise((r) => setTimeout(r, 300));
    return {};
  },
  async reactions(postId) {
    await new Promise((r) => setTimeout(r, 250));
    const r = reactionsOf(postId);
    return { feels: [...r.feels], notes: [...r.notes], saved: SAVED.some((s) => s.id === postId) };
  },
  async save(postId, on) {
    const i = SAVED.findIndex((s) => s.id === postId);
    if (i >= 0) SAVED.splice(i, 1);
    const f = FRIENDS.find((x) => x.post?.id === postId);
    if (on && f?.post) SAVED.unshift({ ...f.post, by: f, saved_at: new Date().toISOString() });
    return {};
  },
  async saved() {
    await new Promise((r) => setTimeout(r, 200));
    return [...SAVED];
  },
  async feel(postId, on) {
    const r = reactionsOf(postId);
    r.feels = r.feels.filter((f) => f.user.id !== ME.id);
    if (on) r.feels.unshift({ user: ME, created_at: new Date().toISOString() });
    return {};
  },
  async addNote(postId, body) {
    await new Promise((r) => setTimeout(r, 300));
    const note: Note = { id: `${postId}-${Date.now()}`, post_id: postId, body: body.trim(), created_at: new Date().toISOString(), user: ME };
    reactionsOf(postId).notes.push(note);
    return { note };
  },
  async deleteNote(noteId) {
    for (const r of reactions.values()) r.notes = r.notes.filter((n) => n.id !== noteId);
    return {};
  },
  chat: {
    async load() {
      await new Promise((r) => setTimeout(r, 300));
      return [...CHAT];
    },
    async send(body, toId) {
      const m: Message = { id: `m${Date.now()}`, user_id: ME.id, to_id: toId, body: body.trim(), created_at: new Date().toISOString(), read_at: null };
      CHAT.push(m);
      return { message: m };
    },
    async remove(id) {
      const i = CHAT.findIndex((m) => m.id === id);
      if (i >= 0) CHAT.splice(i, 1);
      return {};
    },
    async markRead(fromId) {
      for (const m of CHAT) if (m.user_id === fromId && m.to_id === ME.id) m.read_at ??= new Date().toISOString();
    },
    async people() {
      return [];
    },
    listen(on) {
      const t = setTimeout(() => on.add({ ...say(`live${Date.now()}`, FRIENDS[1], "ok who's listening to the same thing right now", 0) }), 6000);
      return () => clearTimeout(t);
    },
  },
  async loadCore(id) {
    const f = FRIENDS.find((x) => x.id === id);
    const p = f ?? profile(Number(id.slice(1)), POOL[Number(id.slice(1)) - 100] ?? "Friend");
    const seed = Number(id.slice(1));
    const posts = [...(f?.post ? [f.post] : []), ...history(id, seed, 8 + Math.floor(rnd(seed, 3) * 50))];
    return { profile: p, posts, followers: 12, following: 20 };
  },
};

// Two people from the pool who added you, so "Added you" has something in it.
const ADDED_ME: AddedMe[] = [0, 1].map((j) => ({
  ...profile(100 + j, POOL[j]),
  added_at: new Date(Date.now() - (j + 1) * 3_600_000).toISOString(),
}));

// Someone liked your song and someone left a note, for "On your song".
const ACTIVITY: Activity[] = [
  { kind: "note", id: "a1", at: new Date(now.getTime() - 600_000).toISOString(), user: FRIENDS[4], body: "this is exactly my monday" },
  { kind: "feel", id: "a2", at: new Date(now.getTime() - 1_200_000).toISOString(), user: FRIENDS[9] },
  { kind: "feel", id: "a3", at: new Date(now.getTime() - 2_400_000).toISOString(), user: FRIENDS[1] },
];

export function DemoGlobe() {
  return (
    <GlobeApp
      me={ME}
      myPost={null}
      friends={FRIENDS}
      mySongs={MY_SONGS}
      redoUsed={false}
      addedMe={ADDED_ME}
      activity={ACTIVITY}
      api={demoApi}
    />
  );
}
