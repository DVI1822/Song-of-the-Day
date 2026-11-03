import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./supabase/env";
import type { SongFact, SongFacts } from "./types";

// A few short facts about the song you posted (how it was made, the story
// behind it, the artist), shown under the Globe once you've posted.
//
// Where they come from: the song's Wikipedia article (and the artist's). If
// ANTHROPIC_API_KEY is set, Claude reads only that text and picks the best
// few facts, each with a word-for-word quote from the article; any fact whose
// quote isn't really in the article is thrown out, so nothing comes from the
// model's own memory. Without the key, the article's opening lines stand in.
//
// Each song's facts are made once and kept in the song_facts table (written
// with SUPABASE_SECRET_KEY, read by anyone signed in), so the same song posted
// by five friends is only looked up once.


const MODEL = "claude-opus-5-5";
const UA = "TopTrack/1.0 (https://www.mytoptrack.io)";
// A song with nothing on Wikipedia is looked for again after this long.
const RETRY_EMPTY_MS = 14 * 86_400_000;

// --- the song's key: one row per song, whatever version was posted ---------

// "Yellow - Remastered 2011" and "Yellow (feat. X)" are the same song here.
export function cleanTitle(title: string) {
  return title
    .replace(/\s+[-–—]\s+.*$/, "")
    .replace(/\s*[([](feat\.?|ft\.?|with|from|remaster|remastered|live|radio edit|single|mono|stereo|demo|bonus)[^)\]]*[)\]]/gi, "")
    .trim();
}

// The first credited artist: "Drake, Rihanna" and "Drake feat. Rihanna" are Drake.
export function mainArtist(artist: string) {
  return artist.split(/\s*,\s*|\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)[0].trim();
}

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—‐-]/g, "-")
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();

// letters and digits only, for matching titles
const bare = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");

export function songKey(title: string, artist: string) {
  return `${bare(mainArtist(artist))}|${bare(cleanTitle(title))}`;
}

// --- Wikipedia ---------------------------------------------------------------

type Page = { title: string; text: string; url: string };

async function wiki(params: Record<string, string>) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries({ ...params, format: "json", formatversion: "2" })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  return res.json();
}

async function search(q: string): Promise<string[]> {
  const j = await wiki({ action: "query", list: "search", srsearch: q, srlimit: "6" });
  return (j?.query?.search ?? []).map((r: { title: string }) => r.title);
}

async function page(title: string): Promise<Page | null> {
  const j = await wiki({ action: "query", prop: "extracts|info", inprop: "url", explaintext: "1", redirects: "1", titles: title });
  const p = j?.query?.pages?.[0];
  if (!p || p.missing || !p.extract) return null;
  return { title: p.title, text: p.extract, url: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}` };
}

// Keep the story (lead, background, recording, composition, release...) and
// drop the lists and tables that read badly as plain text.
const SKIP = /^(references|external links|notes|further reading|see also|sources|citations|bibliography|charts?|weekly charts|year-end charts|monthly charts|all-time charts|certifications?|certifications and sales|sales and certifications|track ?listings?|formats and track listings?|personnel|credits( and personnel)?|release history|accolades|awards and nominations|discography|filmography|tours?|concert tours|band members|members|cover versions|in popular culture)$/i;

export function story(text: string, max: number) {
  const out: string[] = [];
  let skipping = false;
  for (const line of text.split("\n")) {
    const h = line.match(/^(=+)\s*(.*?)\s*=+$/);
    if (h) {
      const level = h[1].length;
      if (level === 2) skipping = SKIP.test(h[2]);
      else if (!skipping && SKIP.test(h[2])) continue;
      if (!skipping) out.push(`\n${h[2]}:`);
      continue;
    }
    if (!skipping && line.trim()) out.push(line.trim());
  }
  const all = out.join("\n").trim();
  if (all.length <= max) return all;
  // stop at the end of a paragraph near the limit
  const cut = all.lastIndexOf("\n", max);
  return all.slice(0, cut > max * 0.6 ? cut : max);
}

const titleIs = (pageTitle: string, want: string) => {
  const t = bare(pageTitle.replace(/\s*\([^)]*\)\s*$/, ""));
  return t === bare(want);
};

// The song's own article: its title matches, and it's about this artist's song.
async function findSong(title: string, artist: string): Promise<Page | null> {
  const t = cleanTitle(title),
    a = mainArtist(artist);
  const titles = await search(`"${t}" ${a} song`);
  for (const pt of titles) {
    if (!titleIs(pt, t)) continue;
    const p = await page(pt);
    if (!p) continue;
    const head = norm(p.text.slice(0, 1500));
    if (head.includes(norm(a)) && /\b(song|single|track|recorded|written)\b/.test(head)) return p;
  }
  return null;
}

// The artist's article: its title matches and it's about a musician or band.
async function findArtist(artist: string): Promise<Page | null> {
  const a = mainArtist(artist);
  const titles = await search(`${a} musician OR band OR singer OR rapper`);
  for (const pt of [a, ...titles.filter((x) => x !== a)].slice(0, 5)) {
    if (!titleIs(pt, a)) continue;
    const p = await page(pt).catch(() => null);
    if (!p) continue;
    const head = norm(p.text.slice(0, 1200));
    if (/\b(singer|rapper|band|musician|songwriter|duo|group|dj|producer|composer|vocalist|record)\b/.test(head)) return p;
  }
  return null;
}

// --- picking the facts ---------------------------------------------------------

const SYSTEM = `You write the short "behind the song" notes for TopTrack, an app where friends each share the one song that hit hardest today. Right after someone posts their song, a few of your notes appear under it.

You get Wikipedia text about the song and/or its artist. Pick up to 3 facts from that text that a fan would enjoy learning: how and where the song was written or recorded, who played on it, what inspired it, a surprising detail about its story, or something striking about the artist. Prefer facts about this song; use the artist only when the song text is thin or missing. Skip dry facts (chart positions, sales, certifications, release dates, track lengths) unless they're genuinely remarkable, and never say only that "X is a song by Y".

Rules:
- Use only what the text says. Do not add anything from your own knowledge, even if you're sure it's true.
- Each fact is one sentence of at most 140 characters, plain and conversational, in present or past tense, no emoji, no exclamation marks.
- For each fact, give "quote": a passage copied exactly, character for character, from the text, that states the fact. Keep it under 300 characters.
- "about" is "song" or "artist".
- Fewer facts is fine. If nothing is worth saying, return an empty list.`;

const SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          quote: { type: "string" },
          about: { type: "string", enum: ["song", "artist"] },
        },
        required: ["text", "quote", "about"],
        additionalProperties: false,
      },
    },
  },
  required: ["facts"],
  additionalProperties: false,
};

type Drafted = { text: string; quote: string; about: "song" | "artist" };

// A fact stays only if its quote really is in the article it names.
export function verified(drafts: Drafted[], song: Page | null, artist: Page | null): SongFact[] {
  const seen = new Set<string>();
  const out: SongFact[] = [];
  for (const d of drafts) {
    const text = d.text?.trim();
    const quote = norm(d.quote ?? "");
    if (!text || text.length > 180 || quote.length < 12) continue;
    const src = [song, artist].filter(Boolean).map((p) => norm(p!.text));
    if (!src.some((s) => s.includes(quote))) continue;
    if (seen.has(bare(text))) continue;
    seen.add(bare(text));
    out.push({ text, about: d.about === "artist" ? "artist" : "song" });
  }
  return out.slice(0, 3);
}

async function withClaude(title: string, artist: string, song: Page | null, art: Page | null): Promise<SongFact[]> {
  const docs = [
    song && `<article about="song" title="${song.title}">\n${story(song.text, 12_000)}\n</article>`,
    art && `<article about="artist" title="${art.title}">\n${story(art.text, song ? 5_000 : 9_000)}\n</article>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `${docs}\n\nThe song someone just posted: "${title}" by ${artist}.` }],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return [];
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let drafts: Drafted[] = [];
  try {
    drafts = JSON.parse(text).facts ?? [];
  } catch {
    return [];
  }
  return verified(drafts, song, art);
}

// No key: the first couple of sentences of the song's article (or the
// artist's), which are true if not always thrilling.
export function plain(song: Page | null, art: Page | null): SongFact[] {
  const p = song ?? art;
  if (!p) return [];
  const lead = p.text.split(/\n\s*\n|\n=/)[0];
  const sentences = lead.match(/[^.!?]+(?:[.!?](?=\s+[A-Z"“]|$))+/g) ?? [];
  return sentences
    .map((s) => s.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 20 && s.length <= 180 && !/\bis an? (?:[\w-]+ )*(?:song|single)\b/i.test(s))
    .slice(0, 3)
    .map((text) => ({ text, about: song ? "song" : "artist" }));
}

async function make(title: string, artist: string): Promise<SongFacts> {
  const [s, a] = await Promise.allSettled([findSong(title, artist), findArtist(artist)]);
  const song = s.status === "fulfilled" ? s.value : null;
  const art = a.status === "fulfilled" ? a.value : null;
  // Wikipedia being down isn't the same as having nothing: don't keep that
  if (!song && !art && (s.status === "rejected" || a.status === "rejected")) throw new Error("Wikipedia didn't answer");
  if (!song && !art) return { facts: [], sources: [] };
  const facts = process.env.ANTHROPIC_API_KEY ? await withClaude(title, artist, song, art) : plain(song, art);
  const used = new Set(facts.map((f) => f.about));
  const sources = (
    [
      ["song", song],
      ["artist", art],
    ] as const
  ).flatMap(([about, p]) => (p && used.has(about) ? [{ title: p.title, url: p.url, about }] : []));
  return { facts, sources };
}

// --- the cache -----------------------------------------------------------------

function admin() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}

const pending = new Map<string, Promise<SongFacts>>();

export async function factsFor(title: string, artist: string): Promise<SongFacts> {
  const key = songKey(title, artist);
  if (!key || key === "|") return { facts: [], sources: [] };
  const db = admin();
  if (db) {
    const { data } = await db.from("song_facts").select("facts, sources, created_at").eq("song_key", key).maybeSingle();
    if (data && (data.facts?.length || Date.now() - Date.parse(data.created_at) < RETRY_EMPTY_MS))
      return { facts: data.facts ?? [], sources: data.sources ?? [] };
  }
  let job = pending.get(key);
  if (!job) {
    job = make(title, artist).finally(() => pending.delete(key));
    pending.set(key, job);
  }
  const out = await job;
  if (db) {
    await db
      .from("song_facts")
      .upsert({ song_key: key, title: cleanTitle(title), artist: mainArtist(artist), facts: out.facts, sources: out.sources, made_by: process.env.ANTHROPIC_API_KEY ? MODEL : "wikipedia", created_at: new Date().toISOString() });
  }
  return out;
}
