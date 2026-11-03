import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./supabase/env";
import type { ArtistPhoto, SongFact, SongFacts } from "./types";

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
// A song nobody found anything on is looked for again after this long.
const RETRY_EMPTY_MS = 6 * 3_600_000;
// Bumped when the way facts are made changes, so empty answers from before
// are tried again.
const VERSION = "v3";

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

// qid: its Wikidata item; image: the photo at the top of the article
type Page = { title: string; text: string; url: string; qid?: string; image?: string };

async function wiki(params: Record<string, string>, host = "en.wikipedia.org") {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ ...params, format: "json", formatversion: "2" })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  return res.json();
}

async function search(q: string): Promise<string[]> {
  const j = await wiki({ action: "query", list: "search", srsearch: q, srlimit: "6" });
  return (j?.query?.search ?? []).map((r: { title: string }) => r.title);
}

async function page(title: string): Promise<Page | null> {
  const j = await wiki({ action: "query", prop: "extracts|info|pageprops|pageimages", inprop: "url", ppprop: "wikibase_item", piprop: "name", explaintext: "1", redirects: "1", titles: title });
  const p = j?.query?.pages?.[0];
  if (!p || p.missing || !p.extract) return null;
  return {
    title: p.title,
    text: p.extract,
    url: p.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
    qid: p.pageprops?.wikibase_item,
    image: p.pageimage,
  };
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

// --- a photo of the artist -------------------------------------------------------

// Not the photo everyone has seen: one from the artist's Wikimedia Commons
// category (live shots, old press photos...), never the one at the top of
// their Wikipedia article, picked by the song so different songs by the same
// artist get different photos. Commons photos are free to show with a credit.

const NOT_A_PHOTO = /logo|signature|autograph|album|cover|poster|ticket|flyer|map|chart|award|plaque|grave|tomb|stamp|coin|banner|sign\b|setlist|wristband|merch|\.svg|\.png/i;
const strip = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

type CommonsFile = {
  title: string;
  imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; width: number; height: number; mime: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }[];
};

async function commonsCategory(qid: string): Promise<string | null> {
  const j = await wiki({ action: "wbgetclaims", entity: qid, property: "P373" }, "www.wikidata.org");
  return j?.claims?.P373?.[0]?.mainsnak?.datavalue?.value ?? null;
}

async function filesIn(cat: string): Promise<CommonsFile[]> {
  const j = await wiki(
    {
      action: "query",
      generator: "categorymembers",
      gcmtitle: `Category:${cat}`,
      gcmtype: "file",
      gcmlimit: "50",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "960",
      iiextmetadatafilter: "Artist|LicenseShortName|Restrictions",
    },
    "commons.wikimedia.org",
  );
  return j?.query?.pages ?? [];
}

export async function findPhoto(art: Page | null, key: string): Promise<ArtistPhoto | null> {
  if (!art?.qid) return null;
  const cat = await commonsCategory(art.qid);
  if (!cat) return null;
  // the category itself, plus a few of its own (like "<artist> in concert")
  const files = await filesIn(cat);
  if (files.length < 12) {
    const sub = await wiki({ action: "query", list: "categorymembers", cmtitle: `Category:${cat}`, cmtype: "subcat", cmlimit: "40" }, "commons.wikimedia.org");
    const name = bare(mainArtist(art.title.replace(/\s*\([^)]*\)\s*$/, "")));
    const subs = ((sub?.query?.categorymembers ?? []) as { title: string }[])
      .map((c) => c.title.replace(/^Category:/, ""))
      .filter((t) => bare(t).includes(name) && !NOT_A_PHOTO.test(t))
      .sort((x, y) => hash(key + x) - hash(key + y))
      .slice(0, 3);
    for (const more of await Promise.all(subs.map((t) => filesIn(t).catch(() => [])))) files.push(...more);
  }
  const main = art.image ? bare(art.image) : null;
  const ok = files.filter((f) => {
    const i = f.imageinfo?.[0];
    if (!i?.thumburl || i.mime !== "image/jpeg") return false;
    if (i.width < 500 || i.height < 400 || i.width / i.height > 1.9 || i.height / i.width > 1.6) return false;
    if (NOT_A_PHOTO.test(f.title)) return false;
    if (main && bare(f.title.replace(/^File:/, "")) === main) return false;
    const m = i.extmetadata ?? {};
    if (!m.LicenseShortName?.value || (m.Restrictions?.value ?? "").includes("trademarked")) return false;
    return true;
  });
  const seen = new Set<string>();
  const uniq = ok.filter((f) => !seen.has(f.title) && seen.add(f.title)).sort((a, b) => a.title.localeCompare(b.title));
  if (!uniq.length) return null;
  const f = uniq[hash(key) % uniq.length];
  const i = f.imageinfo![0];
  const m = i.extmetadata ?? {};
  return {
    url: i.thumburl!,
    width: i.thumbwidth ?? 960,
    height: i.thumbheight ?? 960,
    page: i.descriptionurl,
    credit: strip(m.Artist?.value ?? "").slice(0, 80) || "Wikimedia Commons",
    license: strip(m.LicenseShortName?.value ?? ""),
  };
}

// --- picking the facts ---------------------------------------------------------

// Where Claude may look besides the Wikipedia articles: music press and
// reference sites that report on how songs were made. Sites that block
// Anthropic's search (the BBC, the Guardian, Pitchfork, Genius, the New York
// Times...) can't be on this list: the whole request is refused if one is.
export const SITES: Record<string, string> = {
  "en.wikipedia.org": "Wikipedia",
  "rollingstone.com": "Rolling Stone",
  "npr.org": "NPR",
  "nme.com": "NME",
  "billboard.com": "Billboard",
  "stereogum.com": "Stereogum",
  "consequence.net": "Consequence",
  "uncut.co.uk": "Uncut",
  "loudersound.com": "Louder",
  "soundonsound.com": "Sound On Sound",
  "mixonline.com": "Mix",
  "musicradar.com": "MusicRadar",
  "spin.com": "Spin",
  "udiscovermusic.com": "uDiscover Music",
  "songfacts.com": "Songfacts",
  "allmusic.com": "AllMusic",
  "complex.com": "Complex",
  "xxlmag.com": "XXL",
  // smaller and independent artists
  "bandcamp.com": "Bandcamp",
  "thefader.com": "The Fader",
  "pastemagazine.com": "Paste",
  "brooklynvegan.com": "BrooklynVegan",
  "dazeddigital.com": "Dazed",
  "clashmusic.com": "Clash",
  "atwoodmagazine.com": "Atwood Magazine",
  "undertheradarmag.com": "Under the Radar",
  "lineofbestfit.com": "The Line of Best Fit",
  "kexp.org": "KEXP",
  "exclaim.ca": "Exclaim!",
  "wbez.org": "WBEZ",
};

export function siteName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const hit = Object.keys(SITES).find((d) => host === d || host.endsWith(`.${d}`));
    return hit ? SITES[hit] : host;
  } catch {
    return "Source";
  }
}

const SYSTEM = `You write the short "behind the song" notes for TopTrack, an app where friends each share the one song that hit hardest today. Right after someone posts their song, a few of your notes appear under it.

You may get Wikipedia articles about the song and its artist, and you can search music press sites. Look for up to 3 facts a fan would enjoy learning: how and where the song was written or recorded, who played on it, what inspired it, a surprising detail about its story, or something striking about the artist. Prefer facts about this exact song (check it's the right song by the right artist); when there's little about the song, find facts about the artist instead (where they're from, how they started, how they make their music). Skip dry facts (chart positions, sales, certifications, release dates, track lengths) unless they're genuinely remarkable, and never say only that "X is a song by Y". Search at most three times, and only if the articles don't already give you good material. Song titles and artist names are often ordinary words, so search the way a fan would: the artist's name in quotes with the song title, then the artist's name in quotes with words like musician, band, album or interview. If the song finds nothing, search for the artist: who they are, where they're from, other bands they've been in, how they make their music.

Rules:
- Every fact must come from a source you were given or found, and be cited. Do not add anything from your own knowledge, even if you're sure it's true.
- Each fact is one sentence of at most 140 characters, plain and conversational, no emoji, no exclamation marks.
- Write nothing but the facts, each on its own line, in this form:
FACT (song): <the fact>
FACT (artist): <the fact>
- Fewer facts is fine. If nothing is worth saying, write NONE.`;

// Added when the music press had nothing: the search may go anywhere then.
const WIDER = `The music sites had nothing on this one, so now you can search the whole web. Use pages that report on the artist: music press, local papers and radio, interviews, the artist's or label's own pages, Bandcamp. Skip lyrics sites, fan wikis, AI-written pages, and anything about a different artist with a similar name.`;

type Cite = { url: string; title: string };

// Claude's answer arrives as text pieces, each with the passages it cites.
// Put the pieces back into lines and keep the FACT lines that cite something.
export function factsFrom(
  blocks: { type: string; text?: string; citations?: unknown[] | null }[],
  docs: Page[],
): SongFact[] {
  const lines: { text: string; cites: Cite[] }[] = [{ text: "", cites: [] }];
  for (const b of blocks) {
    if (b.type !== "text" || !b.text) continue;
    const cites: Cite[] = [];
    for (const c of (b.citations ?? []) as { type: string; url?: string; title?: string; document_index?: number }[]) {
      if (c.type === "web_search_result_location" && c.url) cites.push({ url: c.url, title: c.title ?? "" });
      else if (c.type === "char_location" && c.document_index !== undefined && docs[c.document_index])
        cites.push({ url: docs[c.document_index].url, title: docs[c.document_index].title });
    }
    const parts = b.text.split("\n");
    parts.forEach((part, k) => {
      if (k > 0) lines.push({ text: "", cites: [] });
      const line = lines[lines.length - 1];
      line.text += part;
      if (part.trim()) line.cites.push(...cites);
    });
  }
  const out: SongFact[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    const m = l.text.trim().match(/^FACT \((song|artist)\):\s*(.+)$/i);
    if (!m || !l.cites.length) continue;
    const text = m[2].trim();
    if (text.length < 12 || text.length > 180 || seen.has(bare(text))) continue;
    seen.add(bare(text));
    const c = l.cites[0];
    out.push({ text, about: m[1].toLowerCase() === "artist" ? "artist" : "song", source: { name: siteName(c.url), url: c.url } });
  }
  return out.slice(0, 3);
}

// null: the call itself failed (so the answer isn't kept and is tried again)
async function withClaude(title: string, artist: string, song: Page | null, art: Page | null): Promise<SongFact[] | null> {
  // the articles go in as documents, so Claude can cite exact passages
  const docs = [song && { ...song, text: story(song.text, 12_000) }, art && { ...art, text: story(art.text, song ? 5_000 : 9_000) }].filter(
    (d): d is Page => Boolean(d),
  );
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...docs.map((d) => ({
      type: "document" as const,
      source: { type: "text" as const, media_type: "text/plain" as const, data: d.text },
      title: `Wikipedia: ${d.title}`,
      citations: { enabled: true },
    })),
    { type: "text", text: `The song someone just posted: "${title}" by ${artist}.` },
  ];
  const client = new Anthropic({ timeout: 75_000, maxRetries: 1 });
  let sites = Object.keys(SITES);
  // First only the music press on the list; if that finds nothing (a small
  // artist the press hasn't covered), anywhere on the web. Either way every
  // fact must cite where it came from.
  const attempt = async (open: boolean): Promise<SongFact[]> => {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: open ? [...content, { type: "text", text: WIDER }] : content },
    ];
    const ask = () =>
      client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: SYSTEM,
        tools: [
          open
            ? { type: "web_search_20260209", name: "web_search", max_uses: 3 }
            : { type: "web_search_20260209", name: "web_search", max_uses: 3, allowed_domains: sites },
        ],
        messages,
      });
    for (let turn = 0; turn < 3; turn++) {
      const res = await ask().catch((e) => {
        // a site on the list that has since blocked Anthropic's search: drop it and ask again
        const blocked = e instanceof Anthropic.BadRequestError && e.message.match(/not accessible to our user agent: \[([^\]]*)\]/);
        if (!blocked) throw e;
        const gone = new Set(blocked[1].split(",").map((d) => d.trim().replace(/^'|'$/g, "")));
        console.warn(`song facts: these sites block the search, take them off the list: ${[...gone].join(", ")}`);
        sites = sites.filter((d) => !gone.has(d));
        return ask();
      });
      // a long search can pause the turn; hand it back to carry on
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") {
        console.warn(`song facts: Claude stopped (${res.stop_reason}) on "${title}" by ${artist}`);
        return [];
      }
      const facts = factsFrom(res.content, docs);
      if (!facts.length) {
        const said = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        console.warn(`song facts: no cited facts for "${title}" by ${artist}${open ? " (whole web)" : ""}. Claude wrote: ${said.slice(0, 500)}`);
      }
      return facts;
    }
    return [];
  };
  try {
    const facts = await attempt(false);
    return facts.length ? facts : await attempt(true);
  } catch (e) {
    console.error(`song facts: Claude call failed for "${title}" by ${artist}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
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
    .map((text) => ({ text, about: song ? "song" : "artist", source: { name: "Wikipedia", url: p.url } }));
}

// keep: false when part of it failed, so it isn't saved and is tried again
async function make(title: string, artist: string): Promise<SongFacts & { keep: boolean }> {
  const [s, a] = await Promise.allSettled([findSong(title, artist), findArtist(artist)]);
  const song = s.status === "fulfilled" ? s.value : null;
  const art = a.status === "fulfilled" ? a.value : null;
  for (const r of [s, a]) if (r.status === "rejected") console.error("song facts: Wikipedia failed", r.reason);
  // Wikipedia being down isn't the same as having nothing: don't keep that
  const down = !song && !art && (s.status === "rejected" || a.status === "rejected");
  const key = process.env.ANTHROPIC_API_KEY;
  if (down && !key) throw new Error("Wikipedia didn't answer");
  console.log(`song facts: "${title}" by ${artist}: song page ${song?.title ?? "none"}, artist page ${art?.title ?? "none"}`);
  // Claude can still search the music press when Wikipedia has nothing
  if (!song && !art && !key) return { facts: [], keep: true };
  const [picked, photo] = await Promise.all([
    key ? withClaude(title, artist, song, art) : plain(song, art),
    findPhoto(art, songKey(title, artist)).catch((e) => {
      console.error("song facts: photo failed", e);
      return null;
    }),
  ]);
  // if Claude couldn't, the article's opening lines beat nothing
  const facts = picked?.length ? picked : plain(song, art);
  return { facts, photo, keep: picked !== null && !down };
}

// --- the cache -----------------------------------------------------------------

function admin() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}

const pending = new Map<string, ReturnType<typeof make>>();

export async function factsFor(title: string, artist: string): Promise<SongFacts> {
  const key = songKey(title, artist);
  if (!key || key === "|") return { facts: [] };
  const db = admin();
  if (db) {
    const { data } = await db.from("song_facts").select("facts, photo, made_by, created_at").eq("song_key", key).maybeSingle();
    const fresh = data && String(data.made_by).endsWith(VERSION) && Date.now() - Date.parse(data.created_at) < RETRY_EMPTY_MS;
    // facts made before the Anthropic key was added are made again with it
    const upgrade = process.env.ANTHROPIC_API_KEY && String(data?.made_by).startsWith("wikipedia");
    if (data && !upgrade && (data.facts?.length || fresh))
      return { facts: data.facts ?? [], photo: data.photo ?? null };
  }
  if (!db) console.warn("song facts: SUPABASE_SECRET_KEY isn't set, so nothing is saved");
  let job = pending.get(key);
  if (!job) {
    job = make(title, artist).finally(() => pending.delete(key));
    pending.set(key, job);
  }
  const { keep, ...out } = await job;
  if (db && keep) {
    await db
      .from("song_facts")
      .upsert({ song_key: key, title: cleanTitle(title), artist: mainArtist(artist), facts: out.facts, photo: out.photo ?? null, made_by: `${process.env.ANTHROPIC_API_KEY ? MODEL : "wikipedia"} ${VERSION}`, created_at: new Date().toISOString() });
  }
  return out;
}
