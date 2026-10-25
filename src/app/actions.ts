"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCore, getSession } from "@/lib/data";
import { supabaseUrl } from "@/lib/supabase/env";
import type { Core, Friend, Post, Profile } from "@/lib/types";
import { cleanLinks, parseSongUrl, resolveSong, type ResolvedSong } from "@/lib/songs";
import { accessToken, spotifyApi } from "@/lib/spotify";

export type FormState = { error?: string; ok?: boolean } | undefined;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, userId, profile } = await getSession();
  if (!userId) redirect("/login");

  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const displayName = String(form.get("display_name") ?? "").trim();
  const timezone = String(form.get("timezone") ?? "") || "UTC";

  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return { error: "Usernames are 3 to 20 letters, numbers or underscores." };
  if (!displayName || displayName.length > 40)
    return { error: "Your name should be 1 to 40 characters." };

  const row = { id: userId, username, display_name: displayName, timezone };
  const { error } = profile
    ? await supabase.from("profiles").update(row).eq("id", userId)
    : await supabase.from("profiles").insert(row);

  if (error) {
    if (error.code === "23505") return { error: "That username is taken. Try another." };
    if (error.code === "42501") return { error: "Your email isn't on the invite list yet." };
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  redirect(profile ? `/u/${username}` : "/");
}

export async function signOut() {
  const { supabase } = await getSession();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

export async function previewSong(url: string): Promise<{ song?: ResolvedSong; error?: string }> {
  const { userId } = await getSession();
  if (!userId) return { error: "Sign in first." };
  if (!parseSongUrl(url))
    return { error: "Paste a link from Spotify, Apple Music, YouTube, SoundCloud, Tidal or Deezer." };
  const song = await resolveSong(url);
  if (!song) return { error: "Couldn't find that song. Check the link and try again." };
  return { song };
}

export type NewPost = {
  songUrl: string;
  pageUrl: string | null;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  links: unknown;
  caption: string;
  photoUrl: string | null;
};

export async function createPost(input: NewPost): Promise<{ post?: Post; error?: string }> {
  const { supabase, userId, profile } = await getSession();
  if (!userId) redirect("/login");
  if (!profile) redirect("/welcome");

  const title = input.title.trim();
  const caption = input.caption.trim();
  if (!parseSongUrl(input.songUrl)) return { error: "That link doesn't look like a song." };
  if (!title) return { error: "The song needs a title." };
  if (caption.length > 100) return { error: "Keep the comment to 100 characters." };

  // Photos must be ones this person uploaded to their own folder.
  const photoBase = `${supabaseUrl}/storage/v1/object/public/photos/${userId}/`;
  const photo = input.photoUrl && input.photoUrl.startsWith(photoBase) ? input.photoUrl : null;

  const https = (v: string | null) => (v && v.startsWith("https://") ? v : null);
  const { data, error } = await supabase
    .from("posts")
    .insert({
      song_url: input.songUrl,
      page_url: https(input.pageUrl),
      title: title.slice(0, 200),
      artist: input.artist.trim().slice(0, 200),
      album: input.album.trim().slice(0, 200) || null,
      artwork_url: https(input.artworkUrl),
      preview_url: https(input.previewUrl),
      photo_url: photo,
      platform_links: cleanLinks(input.links),
      caption,
    })
    .select()
    .single<Post>();

  if (error) {
    if (error.code === "23505") return { error: "You've already shared today's song." };
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { post: data };
}

// Take back today's song so you can post another. One redo per day; the
// database refuses a second one.
export async function deleteTodayPost(postId: string): Promise<FormState> {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { error: error.code === "P0001" ? "You've already used today's redo." : error.message };
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

export async function searchPeople(q: string): Promise<(Profile & { following: boolean })[]> {
  const { supabase, userId } = await getSession();
  if (!userId) return [];
  // Strip characters that mean something to PostgREST filters.
  const term = q.trim().replace(/^@/, "").replace(/[%_,()*\\]/g, "").slice(0, 40);
  let query = supabase.from("profiles").select("*").neq("id", userId).limit(30);
  query = term
    ? query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
    : query.order("created_at", { ascending: false });
  const [{ data }, { data: follows }] = await Promise.all([
    query,
    supabase.from("follows").select("following_id").eq("follower_id", userId),
  ]);
  const followed = new Set((follows ?? []).map((f) => f.following_id as string));
  return ((data ?? []) as Profile[]).map((p) => ({ ...p, following: followed.has(p.id) }));
}

// Follow someone and hand back their tile for the Globe.
export async function follow(profileId: string): Promise<{ friend?: Friend; error?: string }> {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  const { error } = await supabase.from("follows").insert({ following_id: profileId });
  if (error && error.code !== "23505") return { error: error.message };
  const [{ data: profile }, { data: post }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).single<Profile>(),
    supabase.from("today_posts").select("*").eq("user_id", profileId).maybeSingle<Post>(),
  ]);
  if (!profile) return { error: "Couldn't find that person." };
  revalidatePath("/", "layout");
  return { friend: { ...profile, post: post ?? null, followed_at: new Date().toISOString() } };
}

export async function loadCore(userId: string): Promise<Core | null> {
  const { userId: me } = await getSession();
  if (!me) return null;
  return getCore(userId);
}

export async function unfollow(profileId: string) {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", profileId);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Spotify Connect: play on the listener's own Spotify app
// ---------------------------------------------------------------------------

export type SpotifyPlay =
  | { ok: true; device: string }
  | { error: "not-linked" | "no-device" | "premium" | "failed" };

// The device that's playing now, else whichever Spotify app is open.
async function spotifyDevice(token: string) {
  const list = await spotifyApi(token, "/me/player/devices").then((r) => (r.ok ? r.json() : null));
  type Device = { id: string | null; name: string; is_active: boolean; is_restricted: boolean };
  const devices: Device[] = (list?.devices ?? []).filter((d: Device) => d.id && !d.is_restricted);
  return devices.find((d) => d.is_active) ?? devices[0] ?? null;
}

async function startPlayback(body: object): Promise<SpotifyPlay> {
  const { supabase, userId } = await getSession();
  if (!userId) return { error: "not-linked" };
  const token = await accessToken(supabase, userId);
  if (!token) return { error: "not-linked" };
  const device = await spotifyDevice(token);
  if (!device) return { error: "no-device" };
  const res = await spotifyApi(token, `/me/player/play?device_id=${device.id}`, { method: "PUT", body: JSON.stringify(body) });
  if (res.ok) return { ok: true, device: device.name };
  if (res.status === 403) return { error: "premium" };
  if (res.status === 404) return { error: "no-device" };
  return { error: "failed" };
}

export async function spotifyPlay(uri: string, positionMs = 0): Promise<SpotifyPlay> {
  if (!/^spotify:(track|album):[A-Za-z0-9]+$/.test(uri)) return { error: "failed" };
  const at = Math.max(0, Math.floor(positionMs) || 0);
  return startPlayback(uri.startsWith("spotify:album:") ? { context_uri: uri } : { uris: [uri], position_ms: at });
}

// Shuffle all: the whole list goes to Spotify, which plays it through.
export async function spotifyPlayAll(uris: string[]): Promise<SpotifyPlay> {
  const list = uris.filter((u) => /^spotify:track:[A-Za-z0-9]+$/.test(u)).slice(0, 100);
  if (!list.length) return { error: "failed" };
  return startPlayback({ uris: list });
}

export async function spotifyNext(): Promise<void> {
  const { supabase, userId } = await getSession();
  if (!userId) return;
  const token = await accessToken(supabase, userId);
  if (token) await spotifyApi(token, "/me/player/next", { method: "POST" });
}

// Carry on from where it was paused, on the same Spotify app.
export async function spotifyResume(): Promise<SpotifyPlay> {
  return startPlayback({});
}

export async function spotifyPause(): Promise<void> {
  const { supabase, userId } = await getSession();
  if (!userId) return;
  const token = await accessToken(supabase, userId);
  if (token) await spotifyApi(token, "/me/player/pause", { method: "PUT" });
}

export type SpotifyNow = { uri: string | null; playing: boolean; position: number; duration: number } | null;

export async function spotifyNow(): Promise<SpotifyNow> {
  const { supabase, userId } = await getSession();
  if (!userId) return null;
  const token = await accessToken(supabase, userId);
  if (!token) return null;
  const res = await spotifyApi(token, "/me/player");
  if (res.status !== 200) return null;
  const p = await res.json();
  return {
    uri: p.context?.type === "album" ? p.context.uri : (p.item?.uri ?? null),
    playing: Boolean(p.is_playing),
    position: p.progress_ms ?? 0,
    duration: p.item?.duration_ms ?? 0,
  };
}

export async function unlinkSpotify() {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  await supabase.from("spotify_links").delete().eq("user_id", userId);
  revalidatePath("/settings");
}
