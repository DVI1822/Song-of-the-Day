import { Shell } from "@/components/Shell";
import { requireProfile } from "@/lib/data";
import { todayIn } from "@/lib/day";
import type { Post } from "@/lib/types";
import { Composer } from "./Composer";
import { AlreadyPosted } from "./AlreadyPosted";

export default async function PostPage() {
  const { supabase, profile } = await requireProfile();
  const [{ data: today }, { data: redo }] = await Promise.all([
    supabase.from("today_posts").select("*").eq("user_id", profile.id).maybeSingle<Post>(),
    supabase.from("post_redos").select("day").eq("user_id", profile.id).eq("day", todayIn(profile.timezone)).maybeSingle(),
  ]);

  return (
    <Shell back={{ href: "/", label: "Globe" }}>
      <h1 className="display text-3xl">Today&apos;s song</h1>
      <p className="mb-6 mt-1 text-muted">The one that hit hardest. One per day, so make it count.</p>
      {today ? (
        <AlreadyPosted post={today} profile={profile} redoUsed={Boolean(redo)} />
      ) : (
        <Composer redoUsed={Boolean(redo)} />
      )}
    </Shell>
  );
}
