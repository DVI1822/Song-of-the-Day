import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/data";
import { exchangeCode, spotifyApi } from "@/lib/spotify";

// Spotify sends people back here after they allow playback.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const done = (result: string) => {
    const res = NextResponse.redirect(`${origin}/settings?spotify=${result}`);
    res.cookies.delete({ name: "sp_verifier", path: "/spotify" });
    res.cookies.delete({ name: "sp_state", path: "/spotify" });
    return res;
  };

  const code = searchParams.get("code");
  const verifier = request.cookies.get("sp_verifier")?.value;
  if (!code || !verifier || searchParams.get("state") !== request.cookies.get("sp_state")?.value)
    return done(searchParams.get("error") === "access_denied" ? "cancelled" : "failed");

  const { supabase, userId } = await getSession();
  if (!userId) return NextResponse.redirect(`${origin}/login`);

  const t = await exchangeCode(code, verifier, `${origin}/spotify/callback`);
  if (!t?.refresh_token) return done("failed");
  const me = await spotifyApi(t.access_token, "/me").then((r) => (r.ok ? r.json() : null));

  const { error } = await supabase.from("spotify_links").upsert({
    user_id: userId,
    refresh_token: t.refresh_token,
    access_token: t.access_token,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    spotify_name: me?.display_name ?? me?.id ?? null,
  });
  return done(error ? "failed" : "linked");
}
