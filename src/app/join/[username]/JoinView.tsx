import Link from "next/link";
import { Artwork } from "@/components/Artwork";
import { CoreOrb } from "@/components/CoreOrb";
import { LegalLinks } from "@/components/Legal";
import { buttonClass } from "@/components/Shell";
import type { Post, Profile } from "@/lib/types";

// Where an invite link lands: the inviter's songs circling their core, a
// little globe with an empty spot waiting for you.
// How far the ring leans toward you.
const TILT = 18;

export function JoinView({
  profile,
  posts,
  today,
  me,
  mine,
  already,
}: {
  profile: Profile;
  posts: Post[];
  today: Post | null;
  me: string | null;
  mine: boolean;
  already: boolean;
}) {
  const first = profile.display_name.split(" ")[0];
  // Their songs plus your empty spot, round the core.
  const tiles: (Post | "you" | "empty")[] = [...posts];
  tiles.splice(Math.min(2, tiles.length), 0, "you");
  while (tiles.length < 6) tiles.push("empty");
  const n = tiles.length;
  const R = n > 6 ? 140 : 125;

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: "linear-gradient(180deg, #BFE2F5 0%, #E4F3FB 55%, #FFFFFF 100%)" }}
    >
      <div className="aura fixed left-1/2 top-[34%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2" />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center px-5 pb-10 pt-8 text-center">
        <div className="display text-[15px] tracking-tight">Song of the Day</div>

        <div className="relative mt-4 flex h-[340px] w-full items-center justify-center" style={{ perspective: 900 }}>
          <div className="preserve-3d relative" style={{ transform: `rotateX(${-TILT}deg) rotateZ(-23.4deg)` }}>
            <div className="preserve-3d absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <CoreOrb size={96} />
            </div>
            <div className="preserve-3d" style={{ animation: "orbit 45s linear infinite" }}>
              {tiles.map((t, i) => (
                // round the ring, but always turned to face you
                <div
                  key={i}
                  className="preserve-3d absolute"
                  style={{ transform: `rotateY(${(i * 360) / n}deg) translateZ(${R}px) rotateY(${(-i * 360) / n}deg)` }}
                >
                  <div className="preserve-3d" style={{ animation: "orbit 45s linear infinite reverse" }}>
                    <div
                      className="absolute -left-[36px] -top-[36px] h-[72px] w-[72px]"
                      style={{ transform: `rotateZ(23.4deg) rotateX(${TILT}deg)` }}
                    >
                      {typeof t === "object" ? (
                        <Artwork
                          src={t.artwork_url}
                          alt={`${t.title} by ${t.artist}`}
                          className="h-full w-full rounded-[19px] shadow-[0_10px_24px_-12px_rgba(13,42,63,0.5)]"
                        />
                      ) : t === "you" ? (
                        <div className="flex h-full w-full items-center justify-center rounded-[19px] border-2 border-dashed border-accent/70 bg-white/50 text-[11px] font-semibold text-accent-deep">
                          {mine ? "a friend" : "you"}
                        </div>
                      ) : (
                        <div className="h-full w-full rounded-[19px] border border-ink/15 bg-white/30" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h1 className="display mt-2 text-[30px] leading-tight">
          {mine ? "This is your invite link" : `${first} saved you a spot on their globe`}
        </h1>
        <p className="mt-2 max-w-[300px] text-sm text-muted">
          {mine
            ? "Send it to friends. Whoever joins through it lands on your globe, and you on theirs."
            : "Everyone shares one song a day, the one that hit hardest. Join and you'll be on each other's globes."}
        </p>

        {today && !mine && (
          <div className="mt-5 flex w-full max-w-[300px] items-center gap-3 rounded-[22px] border border-line bg-white/70 p-2.5 text-left backdrop-blur">
            <Artwork src={today.artwork_url} alt="" className="h-12 w-12 flex-none rounded-[13px]" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                {first}&apos;s song today
              </div>
              <div className="truncate text-sm font-semibold">{today.title}</div>
              <div className="truncate text-xs text-muted">{today.artist}</div>
            </div>
          </div>
        )}

        <div className="mt-auto flex w-full max-w-[300px] flex-col gap-2 pt-8">
          {mine || already ? (
            <Link href="/" className={buttonClass}>
              {mine ? "Back to your globe" : `${first} is on your globe`}
            </Link>
          ) : (
            <a href={`/join/${profile.username}/go`} className={buttonClass}>
              {me ? `Add ${first} to your globe` : `Join ${first}`}
            </a>
          )}
          {!me && <p className="text-xs text-muted">Free. Just an email, no password.</p>}
        </div>
        <LegalLinks className="mt-6" />
      </main>
    </div>
  );
}
