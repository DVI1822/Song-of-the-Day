import "server-only";
import { redirect } from "next/navigation";
import { isConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";
import { todayIn } from "./day";
import type { AddedMe, Core, Friend, Post, Profile } from "./types";

export async function getSession() {
  // Until Supabase is connected, the home page explains what to do.
  if (!isConfigured) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  if (!userId) return { supabase, userId: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();
  return { supabase, userId, profile };
}

// For pages that need you signed in with a profile set up.
export async function requireProfile() {
  const s = await getSession();
  if (!s.userId) redirect("/login");
  if (!s.profile) redirect("/welcome");
  return { supabase: s.supabase, profile: s.profile };
}

export async function getGlobe(profile: Profile) {
  const supabase = await createClient();
  const [{ data: follows }, { data: mySongs }, { data: redo }, { data: followers }, { data: following }] = await Promise.all([
    supabase
      .from("follows")
      .select("created_at, profile:profiles!follows_following_id_fkey(*)")
      .eq("follower_id", profile.id)
      .order("created_at", { ascending: true })
      .limit(90),
    supabase.from("posts").select("*").eq("user_id", profile.id).order("day", { ascending: false }).limit(400),
    supabase
      .from("post_redos")
      .select("day")
      .eq("user_id", profile.id)
      .eq("day", todayIn(profile.timezone))
      .maybeSingle(),
    // who added you, newest first, and everyone you've added (for "add back")
    supabase
      .from("follows")
      .select("created_at, profile:profiles!follows_follower_id_fkey(*)")
      .eq("following_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("follows").select("following_id").eq("follower_id", profile.id),
  ]);
  const mine = new Set((following ?? []).map((f) => f.following_id as string));
  const addedMe: AddedMe[] = (followers ?? [])
    .map((f) => ({ ...(f.profile as unknown as Profile), added_at: f.created_at as string }))
    .filter((p) => p.id && !mine.has(p.id));

  const people = (follows ?? [])
    .map((f) => ({ followed_at: f.created_at as string, profile: f.profile as unknown as Profile }))
    .filter((f) => f.profile);
  const ids = people.map((p) => p.profile.id);
  const { data: posts } = ids.length
    ? await supabase.from("today_posts").select("*").in("user_id", ids)
    : { data: [] as Post[] };
  const byUser = new Map((posts as Post[]).map((p) => [p.user_id, p]));

  const friends: Friend[] = people.map(({ profile: p, followed_at }) => ({
    ...p,
    followed_at,
    post: byUser.get(p.id) ?? null,
  }));
  const songs = (mySongs ?? []) as Post[];
  const today = todayIn(profile.timezone);
  return {
    friends,
    myPost: songs.find((p) => p.day === today) ?? null,
    mySongs: songs,
    redoUsed: Boolean(redo),
    addedMe,
  };
}

export async function getCore(userId: string): Promise<Core | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  if (!profile) return null;
  const [{ data: posts }, followers, following] = await Promise.all([
    supabase.from("posts").select("*").eq("user_id", profile.id).order("day", { ascending: false }).limit(400),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
  ]);
  return {
    profile,
    posts: (posts ?? []) as Post[],
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

export async function getProfilePage(username: string, viewerId: string | null) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle<Profile>();
  if (!profile) return null;

  const [{ data: posts }, followers, following, viewerFollows] = await Promise.all([
    supabase
      .from("posts")
      .select("*")
      .eq("user_id", profile.id)
      .order("day", { ascending: false })
      .limit(1000),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    viewerId && viewerId !== profile.id
      ? supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    profile,
    posts: (posts ?? []) as Post[],
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    isFollowing: Boolean(viewerFollows.data),
  };
}
