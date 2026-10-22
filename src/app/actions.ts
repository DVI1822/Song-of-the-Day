"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/data";
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

export async function createPost(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, userId, profile } = await getSession();
  if (!userId) redirect("/login");
  if (!profile) redirect("/welcome");

  const songUrl = String(form.get("song_url") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const artist = String(form.get("artist") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim();
  const artwork = String(form.get("artwork_url") ?? "");
  const pageUrl = String(form.get("page_url") ?? "");
  let links: unknown = {};
  try {
    links = JSON.parse(String(form.get("links") ?? "{}"));
  } catch {}

  if (!parseSongUrl(songUrl)) return { error: "That link doesn't look like a song." };
  if (!title) return { error: "The song needs a title." };
  if (caption.length > 100) return { error: "Keep the caption to 100 characters." };

  const https = (v: string) => (v.startsWith("https://") ? v : null);
  const { error } = await supabase.from("posts").insert({
    song_url: songUrl,
    page_url: https(pageUrl),
    title: title.slice(0, 200),
    artist: artist.slice(0, 200),
    artwork_url: https(artwork),
    platform_links: cleanLinks(links),
    caption,
  });

  if (error) {
    if (error.code === "23505") return { error: "You've already shared today's song." };
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function deleteTodayPost(postId: string) {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  await supabase.from("posts").delete().eq("id", postId);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

export async function follow(profileId: string) {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  await supabase.from("follows").insert({ following_id: profileId });
  revalidatePath("/", "layout");
}

export async function unfollow(profileId: string) {
  const { supabase, userId } = await getSession();
  if (!userId) redirect("/login");
  await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", profileId);
  revalidatePath("/", "layout");
}
