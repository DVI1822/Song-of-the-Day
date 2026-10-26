"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCore, getNews, getSession, type News } from "@/lib/data";
import { supabaseUrl } from "@/lib/supabase/env";
import type { Core, Friend, Post, Profile } from "@/lib/types";
import { cleanLinks, parseSongUrl, resolveSong, type ResolvedSong } from "@/lib/songs";
import { INVITE_COOKIE, cleanInvite } from "@/lib/invite";
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
  // Came in through someone's invite link: you're on each other's globes.
  if (!profile) {
    const jar = await cookies();
    const inviter = cleanInvite(jar.get(INVITE_COOKIE)?.value);
    if (inviter) {
      await supabase.rpc("accept_invite", { inviter });
      jar.delete(INVITE_COOKIE);
    }
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
// Safety: reports, blocks, deleting your account, copyright takedowns
// ---------------------------------------------------------------------------

export type ReportReason = "spam" | "offensive" | "harassment" | "copyright" | "other";
const REASONS: ReportReason[] = ["spam", "offensive", "harassment", "copyright", "other"];

export async function reportUser(input: {
  reportedId: string;
  postId?: string | null;
  reason: ReportReason;
  note?: string;
}): Promise<{ error?: string }> {
  const { supabase, userId } = await getSession();
  if (!userId) return { error: "Sign in to report." };
  if (!REASONS.includes(input.reason)) return { error: "Pick a reason." };
  const { error } = await supabase.from("reports").insert({
    reported_id: input.reportedId,
    post_id: input.postId ?? null,
    reason: input.reason,
    note: (input.note ?? "").trim().slice(0, 500),
  });
  return error ? { error: "Couldn't send that. Try again." } : {};
}

export async function blockUser(profileId: string): Promise<{ error?: string }> {
  const { supabase, userId } = await getSession();
  if (!userId) return { error: "Sign in to block." };
  const { error } = await supabase.rpc("block_user", { target: profileId });
  if (error) return { error: "Couldn't block them. Try again." };
  revalidatePath("/", "layout");
  return {};
}

export async function unblockUser(profileId: string) {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", profileId);
  revalidatePath("/", "layout");
}

// Everything goes: photos first (storage doesn't cascade), then the account,
// which takes the profile, songs, follows and Spotify link with it.
export async function deleteAccount(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, userId, profile } = await getSession();
  if (!userId) redirect("/login");
  const typed = String(form.get("confirm") ?? "").trim().replace(/^@/, "").toLowerCase();
  if (profile && typed !== profile.username) return { error: `Type ${profile.username} to confirm.` };

  const { data: photos } = await supabase.storage.from("photos").list(userId, { limit: 1000 });
  if (photos?.length) await supabase.storage.from("photos").remove(photos.map((f) => `${userId}/${f.name}`));
  const { error } = await supabase.rpc("delete_me");
  if (error) return { error: "Couldn't delete your account. Try again in a minute." };
  await supabase.auth.signOut();
  redirect("/?bye=1");
}

export async function fileTakedown(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await getSession();
  const field = (k: string) => String(form.get(k) ?? "").trim();
  const row = {
    name: field("name"),
    email: field("email"),
    work: field("work"),
    song_link: field("song_link"),
    good_faith: form.get("good_faith") === "on",
    signature: field("signature"),
  };
  if (!row.name || !row.email.includes("@") || !row.work || !row.song_link || !row.signature)
    return { error: "Please fill in every field." };
  if (!row.good_faith) return { error: "Please confirm the statement above your signature." };
  const { error } = await supabase.from("takedowns").insert(row);
  return error ? { error: "Couldn't send it. Try again." } : { ok: true };
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
  const [{ data: profile }, { data: post }, { data: hidden }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).single<Profile>(),
    supabase.from("today_posts").select("*").eq("user_id", profileId).maybeSingle<Post>(),
    supabase.from("hidden_songs").select("hidden_id").eq("hidden_id", profileId).maybeSingle(),
  ]);
  if (!profile) return { error: "Couldn't find that person." };
  revalidatePath("/", "layout");
  return {
    friend: { ...profile, post: post ?? null, followed_at: new Date().toISOString(), followed_back_at: null, hidden: Boolean(hidden) },
  };
}

// Hide someone's songs from your globe, or show them again. You keep
// following them, and they're never told.
export async function hideSongs(profileId: string, hide: boolean): Promise<{ error?: string }> {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  const { error } = hide
    ? await supabase.from("hidden_songs").insert({ hidden_id: profileId })
    : await supabase.from("hidden_songs").delete().eq("user_id", userId).eq("hidden_id", profileId);
  if (error && error.code !== "23505") return { error: "Couldn't change that. Try again." };
  revalidatePath("/", "layout");
  return {};
}

export async function loadNews(): Promise<News | null> {
  const { userId } = await getSession();
  if (!userId) return null;
  return getNews(userId);
}

// Which of the contacts you picked are already here. Phones hand over names,
// emails and numbers; only emails can be matched, since accounts are email.
export type ContactMatch = Profile & { following: boolean; email: string };

export async function matchContacts(emails: string[]): Promise<ContactMatch[]> {
  const { supabase, userId } = await getSession();
  if (!userId) return [];
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))].slice(0, 100);
  if (!list.length) return [];
  const [{ data }, { data: follows }] = await Promise.all([
    supabase.rpc("people_by_email", { emails: list }),
    supabase.from("follows").select("following_id").eq("follower_id", userId),
  ]);
  const followed = new Set((follows ?? []).map((f) => f.following_id as string));
  type Row = { id: string; username: string; display_name: string; email: string };
  return ((data ?? []) as Row[]).map((p) => ({
    ...p,
    timezone: "UTC",
    created_at: "",
    following: followed.has(p.id),
  }));
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
