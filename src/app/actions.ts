"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCore, getSession } from "@/lib/data";
import { supabaseUrl } from "@/lib/supabase/env";
import type { Core, Friend, Post, Profile } from "@/lib/types";
import { cleanLinks, parseSongUrl, resolveSong, type ResolvedSong } from "@/lib/songs";

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
