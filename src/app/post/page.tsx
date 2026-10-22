import { Shell } from "@/components/Shell";
import { requireProfile } from "@/lib/data";
import type { Post } from "@/lib/types";
import { Composer } from "./Composer";
import { AlreadyPosted } from "./AlreadyPosted";

export default async function PostPage() {
  const { supabase, profile } = await requireProfile();
  const { data: today } = await supabase
    .from("today_posts")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle<Post>();

  return (
    <Shell back={{ href: "/", label: "Globe" }}>
      <h1 className="display text-3xl">Today&apos;s song</h1>
      <p className="mb-6 mt-1 text-muted">The one that hit hardest. One per day, so make it count.</p>
      {today ? <AlreadyPosted post={today} profile={profile} /> : <Composer />}
    </Shell>
  );
}
