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

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Who added you: those you haven't added back yet (newest first), and when
// each of the rest added you, to tell when someone added you back.
async function addedYou(supabase: Supabase, userId: string, mine: Set<string>) {
  const { data } = await supabase
    .from("follows")
    .select("created_at, profile:profiles!follows_follower_id_fkey(*)")
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const all = (data ?? [])
    .map((f) => ({ ...(f.profile as unknown as Profile), added_at: f.created_at as string }))
    .filter((p) => p.id);
  return {
    addedMe: all.filter((p) => !mine.has(p.id)) as AddedMe[],
    addedAt: new Map(all.map((p) => [p.id, p.added_at])),
  };
}

const backAt = (addedAt: Map<string, string>, id: string, followedAt: string) => {
  const at = addedAt.get(id);
  return at && Date.parse(at) > Date.parse(followedAt) ? at : null;
};

export async function getGlobe(profile: Profile) {
  const supabase = await createClient();
  const [{ data: follows }, { data: mySongs }, { data: redo }, { data: hidden }] = await Promise.all([
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
    supabase.from("hidden_songs").select("hidden_id"),
  ]);
  const people = (follows ?? [])
    .map((f) => ({ followed_at: f.created_at as string, profile: f.profile as unknown as Profile }))
    .filter((f) => f.profile);
  const ids = people.map((p) => p.profile.id);
  const [{ data: posts }, { addedMe, addedAt }] = await Promise.all([
    ids.length ? supabase.from("today_posts").select("*").in("user_id", ids) : Promise.resolve({ data: [] as Post[] }),
    addedYou(supabase, profile.id, new Set(ids)),
  ]);
  const byUser = new Map((posts as Post[]).map((p) => [p.user_id, p]));
  const hiddenIds = new Set((hidden ?? []).map((h) => h.hidden_id as string));

  const friends: Friend[] = people.map(({ profile: p, followed_at }) => ({
    ...p,
    followed_at,
    followed_back_at: backAt(addedAt, p.id, followed_at),
    hidden: hiddenIds.has(p.id),
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

// What's new since the Globe opened: today's songs from the people you
// follow, who added you, and who added you back.
export type News = { posts: Post[]; addedMe: AddedMe[]; backAt: Record<string, string> };

export async function getNews(userId: string): Promise<News> {
  const supabase = await createClient();
  const { data: follows } = await supabase.from("follows").select("following_id, created_at").eq("follower_id", userId);
  const ids = (follows ?? []).map((f) => f.following_id as string);
  const [{ data: posts }, { addedMe, addedAt }] = await Promise.all([
    ids.length ? supabase.from("today_posts").select("*").in("user_id", ids) : Promise.resolve({ data: [] as Post[] }),
    addedYou(supabase, userId, new Set(ids)),
  ]);
  const back: Record<string, string> = {};
  for (const f of follows ?? []) {
    const at = backAt(addedAt, f.following_id as string, f.created_at as string);
    if (at) back[f.following_id as string] = at;
  }
  return { posts: (posts ?? []) as Post[], addedMe, backAt: back };
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
