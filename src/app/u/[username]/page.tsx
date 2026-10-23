import Link from "next/link";
import { notFound } from "next/navigation";
import { Artwork } from "@/components/Artwork";
import { CoreOrb } from "@/components/CoreOrb";
import { FollowButton } from "@/components/FollowButton";
import { Card, Shell } from "@/components/Shell";
import { formatDay, formatTime, monthKey, monthName, streak, todayIn, usualHour } from "@/lib/day";
import { getProfilePage, getSession } from "@/lib/data";
import type { Post } from "@/lib/types";
import { ArchiveRow } from "./ArchiveRow";
import { TodayCard } from "./TodayCard";

export async function generateMetadata({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  return { title: `@${username} · Song of the Day` };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const { userId } = await getSession();
  const page = await getProfilePage(username, userId);
  if (!page) notFound();
  const { profile, posts, followers, following, isFollowing } = page;
  const mine = userId === profile.id;

  const today = todayIn(profile.timezone);
  const todayPost = posts.find((p) => p.day === today) ?? null;
  const archive = posts.filter((p) => p.day < today);
  const days = posts.map((p) => p.day);
  const peak = usualHour(posts.map((p) => p.created_at), profile.timezone);

  // Each month of the archive is a playlist.
  const months = new Map<string, Post[]>();
  for (const p of archive) {
    const k = monthKey(p.day);
    months.set(k, [...(months.get(k) ?? []), p]);
  }
  const thisYear = today.slice(0, 4);

  return (
    <Shell back={{ href: "/", label: "Globe" }}>
      <Card className="rise-in flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-deep">
            {mine ? "Your core" : `${profile.display_name}'s core`}
          </div>
          {mine ? (
            <Link href="/settings" className="text-xs font-semibold text-accent-deep">
              Edit
            </Link>
          ) : userId ? (
            <FollowButton profileId={profile.id} following={isFollowing} compact />
          ) : (
            <Link href="/login" className="text-xs font-semibold text-accent-deep">
              Sign in to follow
            </Link>
          )}
        </div>

        <div className="-mt-2 flex items-center gap-5">
          <div className="m-2">
            <CoreOrb />
          </div>
          <div className="min-w-0">
            <h1 className="display truncate text-3xl leading-tight">{profile.display_name}</h1>
            <p className="text-sm text-card-muted">@{profile.username}</p>
            <p className="mt-1 text-xs text-card-muted">
              {followers} {followers === 1 ? "follower" : "followers"} · {following} following
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat value={streak(days, today)} label="day streak" />
          <Stat value={posts.length} label="songs shared" />
          <Stat value={peak ?? "–"} label="usual post time" />
        </div>

        {todayPost ? (
          <TodayCard post={todayPost} who={profile.display_name} timezone={profile.timezone} />
        ) : (
          <div className="rounded-[20px] border border-dashed border-card-muted/50 p-4 text-sm text-card-muted">
            {mine ? (
              <>
                No song yet today.{" "}
                <Link href="/" className="font-semibold text-accent-deep">
                  Share one
                </Link>
              </>
            ) : (
              `${profile.display_name} hasn't shared today's song yet.`
            )}
          </div>
        )}

        {months.size > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="display text-lg">Playlists</h2>
            <div className="grid grid-cols-3 gap-3">
              {[...months.entries()].map(([key, list]) => (
                <a key={key} href={`#m-${key}`} className="flex flex-col gap-1.5">
                  <div className="relative aspect-square overflow-hidden rounded-[26%]">
                    <Artwork src={list[0].artwork_url} alt="" className="h-full w-full" />
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-card px-2 text-[10px] font-semibold leading-5">
                      {list.length}
                    </span>
                  </div>
                  <span className="text-xs font-semibold">{monthName(key, key.slice(0, 4) !== thisYear)}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col">
          <h2 className="display pb-2 text-lg">Archive</h2>
          {archive.length === 0 && (
            <p className="text-sm text-card-muted">
              Every song lands here at midnight, building a playlist of {mine ? "your" : "their"} days.
            </p>
          )}
          {[...months.entries()].map(([key, list]) => (
            <div key={key} id={`m-${key}`} className="scroll-mt-6">
              <div className="pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-card-muted">
                {monthName(key, key.slice(0, 4) !== thisYear)}
              </div>
              {list.map((p, i) => (
                <ArchiveRow
                  key={p.id}
                  post={p}
                  date={formatDay(p.day)}
                  time={formatTime(p.created_at, profile.timezone)}
                  divider={i > 0}
                />
              ))}
            </div>
          ))}
        </section>
      </Card>
    </Shell>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[18px] bg-soft p-3">
      <div className="display text-2xl">{value}</div>
      <div className="text-[11px] text-card-muted">{label}</div>
    </div>
  );
}
