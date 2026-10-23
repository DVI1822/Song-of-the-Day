import { NextResponse } from "next/server";
import { getSession } from "@/lib/data";
import { SCOPES, pkce, spotifyClientId } from "@/lib/spotify";

// "Connect Spotify" starts here and goes to Spotify's own permission screen.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { userId } = await getSession();
  if (!userId) return NextResponse.redirect(`${origin}/login`);
  if (!spotifyClientId) return NextResponse.redirect(`${origin}/settings?spotify=unset`);

  const { verifier, challenge, state } = await pkce();
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: spotifyClientId,
    response_type: "code",
    redirect_uri: `${origin}/spotify/callback`,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES,
  }).toString();

  const res = NextResponse.redirect(url);
  const cookie = { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax" as const, maxAge: 600, path: "/spotify" };
  res.cookies.set("sp_verifier", verifier, cookie);
  res.cookies.set("sp_state", state, cookie);
  return res;
}
