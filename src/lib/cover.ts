// Album art at the size it's shown. Apple will hand over any size you put in
// the link and Spotify keeps three (64, 300 and 640), but posts keep the
// biggest, 1000 pixels square for Apple. A phone showing a friends list of
// 38-pixel covers would otherwise download and unpack dozens of those, a few
// megabytes of memory each, and the covers come in slowly while the globe
// stutters. `px` is how big it's drawn on screen, in CSS pixels.
const SPOTIFY = /^(https:\/\/(?:i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\/image\/ab67616d)(0000b273|00001e02|00004851)/;
const APPLE = /\/\d+x\d+bb\.(jpg|png|webp)$/;

export function coverAt<T extends string | null | undefined>(url: T, px: number): T {
  if (!url) return url;
  const want = px * 3; // sharp on a 3x screen
  if (SPOTIFY.test(url)) return url.replace(SPOTIFY, `$1${want <= 300 ? "00001e02" : "0000b273"}`) as T;
  if (/\.mzstatic\.com\//.test(url) && APPLE.test(url)) {
    const n = want <= 300 ? 300 : want <= 600 ? 600 : 1000;
    return url.replace(APPLE, `/${n}x${n}bb.$1`) as T;
  }
  return url;
}
