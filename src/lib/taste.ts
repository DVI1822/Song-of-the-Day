import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cleanTitle, mainArtist, songKey } from "./facts";
import { supabaseUrl } from "./supabase/env";
import { createClient } from "./supabase/server";
import type { Taste, TasteOverview } from "./types";

// Someone's taste in music, built from the songs they've picked.
//
// Each song's genre and release year come from Apple's free iTunes catalog
// (and, with LASTFM_API_KEY set, its top Last.fm tags), kept once per song in
// song_tags. iTunes allows about 20 lookups a minute, so a long history is
// filled in a few songs at a time and the core asks again while `pending`.
//
// The counts (genres, decades, artists) are made fresh each time. The Taste
// Overview, a name for their sound and a few lines about it, is written by
// Claude from their picks and kept in taste_profiles until a few new picks
// are in or a week has gone by.

const MODEL = process.env.TASTE_MODEL || process.env.FACTS_MODEL || "claude-haiku-5-5";
const LOOKUPS = 12; // songs looked up per visit
const REWRITE_AFTER = 3; // new picks before the overview is written again
const REWRITE_DAYS = 7;
const UA = "TopTrack/1.0 (https://www.mytoptrack.io)";

type Tag = { song_key: string; genre: string | null; released: number | null; tags: string[] };
type Pick = { title: string; artist: string; artwork_url: string | null; day: string };

function admin() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createAdmin(supabaseUrl, key, { auth: { persistSession: false } });
}

// --- looking songs up --------------------------------------------------------------

const bare = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]/g, "");

// iTunes' genres, said the way people say them
const GENRE: Record<string, string> = {
  alternative: "Alternative",
  "hip-hop/rap": "Hip-hop",
  "hip hop/rap": "Hip-hop",
  rap: "Hip-hop",
  "r&b/soul": "R&B & soul",
  soul: "R&B & soul",
  "singer/songwriter": "Singer-songwriter",
  dance: "Dance & electronic",
  electronic: "Dance & electronic",
  "electronica/dance": "Dance & electronic",
  house: "Dance & electronic",
  techno: "Dance & electronic",
  "indie pop": "Indie",
  "indie rock": "Indie",
  "hard rock": "Rock",
  "adult alternative": "Alternative",
  "soundtrack": "Soundtrack",
  "original score": "Soundtrack",
  "k-pop": "K-pop",
  "latin urban": "Latin",
  "música mexicana": "Latin",
  "pop latino": "Latin",
  "urbano latino": "Latin",
};
export function genreName(g: string | null) {
  if (!g) return null;
  const k = g.trim().toLowerCase();
  return GENRE[k] ?? g.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function itunes(title: string, artist: string): Promise<{ genre: string | null; released: number | null } | null> {
  const term = `${cleanTitle(title)} ${mainArtist(artist)}`.trim();
  const res = await fetch(`https://itunes.apple.com/search?entity=song&limit=10&term=${encodeURIComponent(term)}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null; // rate limited (403) or down: try again another visit
  const data = await res.json();
  type R = { trackName?: string; artistName?: string; primaryGenreName?: string; releaseDate?: string };
  const list: R[] = data.results ?? [];
  const want = bare(cleanTitle(title)),
    who = bare(mainArtist(artist));
  const hit =
    list.find((r) => bare(r.trackName ?? "") === want && bare(r.artistName ?? "").includes(who)) ??
    list.find((r) => bare(r.trackName ?? "") === want) ??
    list.find((r) => bare(r.artistName ?? "").includes(who)) ??
    null;
  if (!hit) return { genre: null, released: null };
  const y = Number(hit.releaseDate?.slice(0, 4));
  return { genre: hit.primaryGenreName ?? null, released: y > 1900 ? y : null };
}

// Last.fm's tags people gave the song (or, failing that, the artist): the
// moods and scenes iTunes' one genre misses.
const JUNK = /seen live|favou?rite|love|awesome|best|my |albums? i own|spotify|^\d{2,4}s?$|under \d|beautiful|cool/i;
async function lastfm(title: string, artist: string): Promise<string[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  const get = async (q: string) => {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?format=json&api_key=${key}&autocorrect=1&${q}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tags: { name: string; count: number }[] = data.toptags?.tag ?? [];
    return tags
      .filter((t) => t.count >= 10 && !JUNK.test(t.name))
      .map((t) => t.name.toLowerCase())
      .slice(0, 6);
  };
  const a = mainArtist(artist);
  const song = await get(`method=track.gettoptags&artist=${encodeURIComponent(a)}&track=${encodeURIComponent(cleanTitle(title))}`);
  return song.length >= 2 ? song : get(`method=artist.gettoptags&artist=${encodeURIComponent(a)}`);
}

async function lookUp(p: Pick): Promise<Tag | null> {
  const [it, tags] = await Promise.all([itunes(p.title, p.artist).catch(() => null), lastfm(p.title, p.artist).catch(() => [])]);
  if (!it) return null;
  return { song_key: songKey(p.title, p.artist), genre: it.genre, released: it.released, tags };
}

// --- the Taste Overview ------------------------------------------------------------

function line(p: Pick, t: Tag | undefined) {
  const bits = [t?.released, genreName(t?.genre ?? null), ...(t?.tags ?? []).slice(0, 4)].filter(Boolean).join(", ");
  const dow = new Date(p.day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${p.day} (${dow}): "${cleanTitle(p.title)}" by ${p.artist}${bits ? ` [${bits}]` : ""}`;
}

async function write(picks: Pick[], tags: Map<string, Tag>, today: string): Promise<TasteOverview | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ timeout: 40_000, maxRetries: 1 });
  const songs = picks.slice(0, 80).map((p) => line(p, tags.get(songKey(p.title, p.artist))));
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: `On TopTrack, a music app, people post one song a day: the song that hit hardest that day. Here are someone's picks, newest first (today is ${today}), with release year, genre and listener tags where known:

${songs.join("\n")}

Write their Taste Overview, shown on their profile to them and to friends. Reply with only a JSON object:
{
  "name": a fun, specific name for their sound, 2 to 4 words, like "The Golden Hour Drifter" or "Basement Show Romantic". No emoji, no artist names.
  "blurb": 2 or 3 short sentences (under 45 words in all) about their taste: the sounds, eras and moods they keep coming back to, and any pattern (weekends vs weeknights, old vs new). Describe the music, not the person: no "you", "they" or "this person". Plain words, warm and a little playful, never mean. Only claim what the picks show.
  "words": 4 or 5 short lowercase phrases (1 to 3 words each) for their taste, like "warm guitars" or "70s soul".
  "month": one sentence under 20 words on how this calendar month's picks differ from last month's, or null if this month has fewer than 3 picks.
}`,
      },
    ],
  });
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  const o = JSON.parse(json) as Partial<TasteOverview>;
  if (typeof o.name !== "string" || typeof o.blurb !== "string") return null;
  return {
    name: o.name.trim().slice(0, 48),
    blurb: o.blurb.trim().slice(0, 400),
    words: Array.isArray(o.words) ? o.words.filter((w) => typeof w === "string").map((w) => w.trim().slice(0, 24)).slice(0, 5) : [],
    month: typeof o.month === "string" && o.month.trim() ? o.month.trim().slice(0, 160) : null,
  };
}

// --- putting it together -----------------------------------------------------------

const busy = new Map<string, Promise<Taste | null>>();

export function tasteFor(userId: string): Promise<Taste | null> {
  let job = busy.get(userId);
  if (!job) {
    job = make(userId).finally(() => busy.delete(userId));
    busy.set(userId, job);
  }
  return job;
}

async function make(userId: string): Promise<Taste | null> {
  const supabase = await createClient();
  const db = admin();
  // what the person asking can see: blocked people's songs never come back
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    supabase.from("posts").select("title, artist, artwork_url, day").eq("user_id", userId).order("day", { ascending: false }).limit(1000),
  ]);
  if (!profile) return null;
  const picks = (rows ?? []) as Pick[];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone || "UTC" }).format(new Date());

  // every song's tags we already have
  const keys = [...new Set(picks.map((p) => songKey(p.title, p.artist)))];
  const tags = new Map<string, Tag>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await supabase.from("song_tags").select("song_key, genre, released, tags").in("song_key", keys.slice(i, i + 200));
    for (const t of (data ?? []) as Tag[]) tags.set(t.song_key, t);
  }
  // and a few more, newest first
  const todo = keys.filter((k) => !tags.has(k));
  const batch = todo.slice(0, LOOKUPS).map((k) => picks.find((p) => songKey(p.title, p.artist) === k)!);
  const found: Tag[] = [];
  for (let i = 0; i < batch.length; i += 4) {
    const got = await Promise.all(batch.slice(i, i + 4).map((p) => lookUp(p).catch(() => null)));
    for (const t of got) if (t) found.push(t);
    if (got.some((t) => !t)) break; // iTunes said slow down
  }
  for (const t of found) tags.set(t.song_key, t);
  if (db && found.length) await db.from("song_tags").upsert(found.map((t) => ({ ...t, looked_at: new Date().toISOString() })));
  const pending = keys.some((k) => !tags.has(k));

  // the counts
  const genres = new Map<string, number>(),
    decades = new Map<number, number>(),
    artists = new Map<string, { name: string; n: number; artwork: string | null }>();
  for (const p of picks) {
    const t = tags.get(songKey(p.title, p.artist));
    const g = genreName(t?.genre ?? null);
    if (g) genres.set(g, (genres.get(g) ?? 0) + 1);
    if (t?.released) {
      const d = Math.floor(t.released / 10) * 10;
      decades.set(d, (decades.get(d) ?? 0) + 1);
    }
    const name = mainArtist(p.artist);
    const k = name.toLowerCase();
    if (!name) continue;
    const a = artists.get(k) ?? { name, n: 0, artwork: p.artwork_url };
    a.n++;
    artists.set(k, a);
  }

  // the overview: kept, unless enough has changed to write it again
  let overview: TasteOverview | null = null;
  const { data: kept } = await supabase.from("taste_profiles").select("picks, overview, made_at").eq("user_id", userId).maybeSingle();
  overview = (kept?.overview as TasteOverview | undefined) ?? null;
  const stale =
    !kept ||
    Math.abs(picks.length - kept.picks) >= REWRITE_AFTER ||
    Date.now() - Date.parse(kept.made_at) > REWRITE_DAYS * 86_400_000;
  // written once most songs are looked up, so it isn't built on a handful
  const ready = picks.length >= 3 && tags.size >= keys.length * 0.7;
  if (stale && ready && db) {
    const fresh = await write(picks, tags, today).catch((e) => {
      console.error("taste: overview failed", e);
      return null;
    });
    if (fresh) {
      overview = fresh;
      await db
        .from("taste_profiles")
        .upsert({ user_id: userId, picks: picks.length, overview: fresh, made_by: MODEL, made_at: new Date().toISOString() });
    }
  }

  return {
    picks: picks.length,
    overview,
    genres: [...genres].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    decades: [...decades].map(([decade, n]) => ({ decade, n })).sort((a, b) => a.decade - b.decade),
    artists: [...artists.values()].sort((a, b) => b.n - a.n).slice(0, 5),
    pending,
  };
}
