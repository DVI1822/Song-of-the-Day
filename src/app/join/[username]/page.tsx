import { notFound } from "next/navigation";
import { todayIn } from "@/lib/day";
import { createClient } from "@/lib/supabase/server";
import type { Post, Profile } from "@/lib/types";
import { JoinView } from "./JoinView";

async function inviter(username: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle<Profile>();
  if (!profile) return null;
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", profile.id)
    .order("day", { ascending: false })
    .limit(7);
  return { supabase, profile, posts: (posts ?? []) as Post[] };
}

export async function generateMetadata({ params }: PageProps<"/join/[username]">) {
  const { username } = await params;
  const page = await inviter(username);
  const name = page?.profile.display_name ?? `@${username}`;
  const title = "Share your Song of the Day with the world";
  const description = `${name} saved you a spot on their globe.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image" } };
}

export default async function JoinPage({ params }: PageProps<"/join/[username]">) {
  const { username } = await params;
  const page = await inviter(username);
  if (!page) notFound();
  const { supabase, profile, posts } = page;
  const today = posts.find((p) => p.day === todayIn(profile.timezone)) ?? null;

  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub ?? null;
  const mine = me === profile.id;
  const { data: already } =
    me && !mine
      ? await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", me)
          .eq("following_id", profile.id)
          .maybeSingle()
      : { data: null };

  return <JoinView profile={profile} posts={posts} today={today} me={me} mine={mine} already={Boolean(already)} />;
}
