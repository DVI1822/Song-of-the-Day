// The song's key: one row per song, whatever version was posted (song_tags uses it).


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
