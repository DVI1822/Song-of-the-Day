import "server-only";

// Spotify Connect: our play button starts a song on the listener's own
// Spotify app (phone, computer, speaker), so Premium listeners hear the whole
// thing. Sign-in uses PKCE, so only the public client ID is needed.
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

type Supabase = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export const spotifyClientId = process.env.SPOTIFY_CLIENT_ID ?? "";
export const SCOPES = "user-read-playback-state user-modify-playback-state";

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

export async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { verifier, challenge, state };
}

type TokenReply = { access_token: string; refresh_token?: string; expires_in: number };

async function token(body: Record<string, string>): Promise<TokenReply | null> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: spotifyClientId, ...body }),
    cache: "no-store",
  });
  return res.ok ? res.json() : null;
}

export function exchangeCode(code: string, verifier: string, redirectUri: string) {
  return token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier });
}

// A fresh access token for this person, or null if they haven't linked Spotify.
export async function accessToken(supabase: Supabase, userId: string) {
  const { data: link } = await supabase
    .from("spotify_links")
    .select("refresh_token, access_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle<{ refresh_token: string; access_token: string | null; expires_at: string | null }>();
  if (!link) return null;
  if (link.access_token && link.expires_at && Date.parse(link.expires_at) > Date.now() + 30_000) return link.access_token;

  const t = await token({ grant_type: "refresh_token", refresh_token: link.refresh_token });
  if (!t) return null;
  await supabase
    .from("spotify_links")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? link.refresh_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);
  return t.access_token;
}

export async function spotifyApi(accessToken: string, path: string, init: RequestInit = {}) {
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}
