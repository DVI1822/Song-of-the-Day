import Link from "next/link";
import { FollowButton } from "@/components/FollowButton";
import { Card, Shell, inputClass } from "@/components/Shell";
import { requireProfile } from "@/lib/data";
import { initials } from "@/lib/day";
import type { Profile } from "@/lib/types";

export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const { supabase, profile } = await requireProfile();
  const q = String((await searchParams).q ?? "").trim().slice(0, 40);

  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", profile.id);
  const followingIds = new Set((follows ?? []).map((f) => f.following_id as string));

  let results: Profile[] = [];
  if (q) {
    // Strip characters that mean something to PostgREST filters.
    const term = q.replace(/[%_,()*\\]/g, "");
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .neq("id", profile.id)
      .limit(30);
    results = data ?? [];
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30);
    results = data ?? [];
  }

  return (
    <Shell back={{ href: "/", label: "Globe" }}>
      <h1 className="display text-3xl">Find people</h1>
      <p className="mb-6 mt-1 text-muted">Everyone you follow gets a tile on your Globe.</p>
      <form className="mb-5">
        <input name="q" defaultValue={q} placeholder="Search by name or @username" className={inputClass} />
      </form>
      <Card className="flex flex-col p-2">
        {!q && <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-card-muted">Newest</div>}
        {results.length === 0 && <p className="p-4 text-sm text-card-muted">Nobody found{q ? ` for “${q}”` : " yet"}.</p>}
        {results.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-soft/60">
            <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[26%] border border-dashed border-card-muted text-xs font-semibold text-card-muted">
                {initials(p.display_name)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{p.display_name}</span>
                <span className="truncate text-xs text-card-muted">@{p.username}</span>
              </span>
            </Link>
            <FollowButton profileId={p.id} following={followingIds.has(p.id)} compact />
          </div>
        ))}
      </Card>
    </Shell>
  );
}
