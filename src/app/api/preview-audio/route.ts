import { type NextRequest } from "next/server";

// A song's 30-second preview, passed through so the Globe may listen for its
// beat (Apple's and Spotify's servers don't let pages read the audio
// directly). Only preview hosts, only audio, and at most 3MB.
const HOSTS = [/\.itunes\.apple\.com$/, /\.mzstatic\.com$/, /^p\.scdn\.co$/];

export async function GET(request: NextRequest) {
  let url: URL;
  try {
    url = new URL(request.nextUrl.searchParams.get("u") ?? "");
  } catch {
    return new Response(null, { status: 400 });
  }
  if (url.protocol !== "https:" || !HOSTS.some((h) => h.test(url.hostname))) return new Response(null, { status: 400 });

  const res = await fetch(url, { redirect: "error" }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  const size = Number(res?.headers.get("content-length") ?? 0);
  if (!res?.ok || !/^audio\/|^application\/octet-stream/.test(type) || size > 3_000_000)
    return new Response(null, { status: 502 });
  const body = await res.arrayBuffer();
  if (body.byteLength > 3_000_000) return new Response(null, { status: 502 });
  return new Response(body, {
    headers: { "content-type": type, "cache-control": "public, max-age=86400, s-maxage=604800" },
  });
}
