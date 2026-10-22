// Turning a pasted song link into title / artist / artwork, and into a
// player we can embed. We never host audio: playback is always the
// platform's own embed.

export type PlatformLinks = Partial<Record<Platform, string>>;
export type Platform =
  | "spotify"
  | "appleMusic"
  | "youtube"
  | "youtubeMusic"
  | "soundcloud"
  | "tidal"
  | "deezer"
  | "amazonMusic";

export type ResolvedSong = {
  songUrl: string;
  pageUrl: string | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
  links: PlatformLinks;
};

export const PLATFORM_NAMES: Record<Platform, string> = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtube: "YouTube",
  youtubeMusic: "YouTube Music",
  soundcloud: "SoundCloud",
  tidal: "Tidal",
  deezer: "Deezer",
  amazonMusic: "Amazon Music",
};

const PLATFORMS = Object.keys(PLATFORM_NAMES) as Platform[];

// Hosts we accept a pasted link from.
const SONG_HOSTS = [
  "open.spotify.com",
  "spotify.link",
  "music.apple.com",
  "itunes.apple.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "soundcloud.com",
  "on.soundcloud.com",
  "tidal.com",
  "listen.tidal.com",
  "deezer.com",
  "www.deezer.com",
  "music.amazon.com",
  "song.link",
  "album.link",
  "odesli.co",
];

export function parseSongUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return SONG_HOSTS.includes(url.hostname) ? url : null;
}

function httpsOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

// Ask song.link (Odesli) for the same song on every platform.
// Docs: https://linktr.ee/s/developers/
async function fromOdesli(url: string): Promise<ResolvedSong | null> {
  const api = new URL("https://api.song.link/v1-alpha.1/links");
  api.searchParams.set("url", url);
  api.searchParams.set("userCountry", "US");
  if (process.env.ODESLI_API_KEY) api.searchParams.set("key", process.env.ODESLI_API_KEY);

  const res = await fetch(api, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json();

  const entities: Record<string, OdesliEntity> = data.entitiesByUniqueId ?? {};
  const byPlatform: Record<string, { url: string; entityUniqueId: string }> =
    data.linksByPlatform ?? {};

  const links: PlatformLinks = {};
  for (const p of PLATFORMS) {
    const link = httpsOrNull(byPlatform[p]?.url);
    if (link) links[p] = link;
  }

  // Spotify and Apple have the cleanest titles and the biggest artwork.
  const preferred = ["spotify", "appleMusic", "deezer", "tidal"]
    .map((p) => entities[byPlatform[p]?.entityUniqueId])
    .concat(entities[data.entityUniqueId])
    .filter(Boolean);
  const main = preferred[0];
  if (!main?.title) return null;

  const art = preferred.find((e) => e.thumbnailUrl)?.thumbnailUrl;
  return {
    songUrl: url,
    pageUrl: httpsOrNull(data.pageUrl),
    title: main.title,
    artist: main.artistName ?? "",
    artworkUrl: biggerArtwork(httpsOrNull(art)),
    links,
  };
}

type OdesliEntity = {
  title?: string;
  artistName?: string;
  thumbnailUrl?: string;
};

// Apple serves artwork at whatever size you put in the URL.
function biggerArtwork(url: string | null) {
  if (!url) return url;
  return url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, "/1000x1000bb.$1");
}

// Backup when song.link is down: the platform's own oEmbed endpoint.
async function fromOEmbed(url: URL): Promise<ResolvedSong | null> {
  let endpoint: string | null = null;
  if (url.hostname === "open.spotify.com") endpoint = "https://open.spotify.com/oembed";
  else if (url.hostname.endsWith("youtube.com") || url.hostname === "youtu.be")
    endpoint = "https://www.youtube.com/oembed";
  else if (url.hostname.endsWith("soundcloud.com")) endpoint = "https://soundcloud.com/oembed";
  if (!endpoint) return null;

  const api = new URL(endpoint);
  api.searchParams.set("url", url.toString());
  api.searchParams.set("format", "json");
  const res = await fetch(api, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.title) return null;

  const platform: Platform = endpoint.includes("spotify")
    ? "spotify"
    : endpoint.includes("youtube")
      ? "youtube"
      : "soundcloud";
  return {
    songUrl: url.toString(),
    pageUrl: null,
    title: String(data.title).slice(0, 200),
    artist: platform === "spotify" ? "" : String(data.author_name ?? "").slice(0, 200),
    artworkUrl: httpsOrNull(data.thumbnail_url),
    links: { [platform]: url.toString() },
  };
}

export async function resolveSong(raw: string): Promise<ResolvedSong | null> {
  const url = parseSongUrl(raw);
  if (!url) return null;
  try {
    const hit = await fromOdesli(url.toString());
    if (hit) return hit;
  } catch {
    // fall through to the backup
  }
  try {
    return await fromOEmbed(url);
  } catch {
    return null;
  }
}

// Only keep links that are https and on a host we know.
export function cleanLinks(input: unknown): PlatformLinks {
  const out: PlatformLinks = {};
  if (!input || typeof input !== "object") return out;
  for (const p of PLATFORMS) {
    const v = (input as Record<string, unknown>)[p];
    if (typeof v === "string" && parseSongUrl(v)) out[p] = v;
  }
  return out;
}

export type Embed = { src: string; height: number; platform: Platform };

// Build a player URL from the song's links. We parse ids out of the links
// rather than trusting them, so the iframe can only ever point at a real
// platform player.
export function embedFor(links: PlatformLinks, songUrl?: string): Embed | null {
  const all: PlatformLinks = { ...links };
  const pasted = songUrl ? parseSongUrl(songUrl) : null;
  if (pasted) {
    const h = pasted.hostname;
    if (h === "open.spotify.com") all.spotify ??= songUrl;
    if (h === "music.apple.com") all.appleMusic ??= songUrl;
    if (h.endsWith("youtube.com") || h === "youtu.be") all.youtube ??= songUrl;
    if (h.endsWith("soundcloud.com")) all.soundcloud ??= songUrl;
  }

  if (all.spotify) {
    const m = new URL(all.spotify).pathname.match(/\/(track|album)\/([A-Za-z0-9]+)/);
    if (m) return { platform: "spotify", height: 152, src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` };
  }
  if (all.appleMusic) {
    const u = new URL(all.appleMusic);
    if (u.hostname === "music.apple.com") {
      return { platform: "appleMusic", height: 175, src: `https://embed.music.apple.com${u.pathname}${u.search}` };
    }
  }
  const yt = all.youtube ?? all.youtubeMusic;
  if (yt) {
    const u = new URL(yt);
    const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
    if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id))
      return { platform: "youtube", height: 200, src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (all.soundcloud) {
    return {
      platform: "soundcloud",
      height: 166,
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(all.soundcloud)}&color=%23d7262b&visual=false`,
    };
  }
  return null;
}
