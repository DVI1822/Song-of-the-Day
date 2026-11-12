"use client";

import { useEffect, useState } from "react";
import type { Friend, Post, Profile, Score } from "@/lib/types";
import type { GlobeApi } from "./api";
import { Cover, Face } from "./ui";

// Your TopTrack: once you've posted, you pick the one song on your globe that
// hit hardest today (never your own) with the TopTrack hand on the bottom
// right of its cover. Each pick is a point for that friend. The Leaderboard,
// inside the Globe tab, shows your pick and everyone's points this month,
// adding each day's picks the next morning. Who picked whom is never shown.

// The raised hand from the TopTrack logo (Wordmark.tsx), drawn with an ink
// outline: paper white, or coral once it's your pick.
export function TopTrackHand({ on, size = 20 }: { on: boolean; size?: number }) {
  const fill = on ? "#ff5e57" : "#fffdf6";
  const p = { fill, stroke: "#0d2a3f", strokeWidth: 3.4, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden width={size} height={size * 1.18} viewBox="20 6 58 106" className="flex-none overflow-visible">
      <rect {...p} x="35" y="78" width="27" height="30" />
      <rect {...p} x="27" y="11" width="13.5" height="50" rx="6.75" />
      <rect {...p} x="62" y="47" width="10.5" height="25" rx="5.25" />
      <rect {...p} x="51.5" y="44" width="11" height="28" rx="5.5" />
      <rect {...p} x="40.5" y="42" width="11" height="30" rx="5.5" />
      <path {...p} d="M27 50 V72 C27 80 33 86 41 86 H60 C68 86 72.5 80 72.5 72 V64 Z" />
      <path {...p} d="M24 66 C24 60 30 58 36 60 L58 64 C63 65 64 72 59 73 L36 74 C29 74 24 72 24 66 Z" />
      <path d="M30.5 22 H37" stroke="#0d2a3f" strokeWidth={3.4} strokeLinecap="round" fill="none" />
    </svg>
  );
}

// The hand on the bottom right of a friend's cover. Tap it to make the song
// your TopTrack today: the hand jumps, coral rings ripple out, the cover's
// rim flashes coral and "My TopTrack" floats up. It stays lit after. Tap it
// again to take it back. Picking another song moves your pick there.
export function PickHand({
  picked,
  radius,
  onPick,
}: {
  picked: boolean;
  radius: number; // the cover's corners, for the coral flash round its rim
  onPick(on: boolean): Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const tap = async () => {
    setError(null);
    if (!picked) setBurst((b) => b + 1);
    const e = await onPick(!picked);
    if (e) {
      setError(e);
      setTimeout(() => setError(null), 3200);
    }
  };
  return (
    <>
      {/* the cover's rim flashing coral */}
      {burst > 0 && picked && (
        <span
          key={`rim${burst}`}
          aria-hidden
          data-motion
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{ borderRadius: radius, animation: "pick-rim 1.4s ease-out both" }}
        />
      )}
      <div className="absolute bottom-3 right-3 z-[3]">
        {burst > 0 && picked && (
          <span key={`fx${burst}`} aria-hidden data-motion className="pointer-events-none absolute inset-0">
            <span className="absolute -inset-1 rounded-full border-[2.5px] border-coral" style={{ animation: "pick-ring .9s ease-out .15s both" }} />
            <span className="absolute -inset-1 rounded-full border-[2px] border-card-ink" style={{ animation: "pick-ring .9s ease-out .3s both" }} />
            <span
              className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-full border-[1.8px] border-card-ink bg-coral px-2.5 py-0.5 font-bubble text-[13px] font-bold text-white shadow-[2px_2px_0_#0d2a3f]"
              style={{ animation: "pick-label 1.9s ease-out .25s both" }}
            >
              My TopTrack!
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={tap}
          aria-pressed={picked}
          aria-label={picked ? "Your TopTrack today. Tap to take it back" : "Make this your TopTrack today"}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border-[1.8px] border-card-ink transition-colors duration-300"
          style={{
            background: picked ? "#ff5e57" : "rgba(255,253,246,0.94)",
            boxShadow: picked ? "0 0 0 4px rgba(255,94,87,0.35), 2px 3px 0 #0d2a3f" : "0 4px 14px -6px rgba(13,42,63,0.5)",
          }}
        >
          <span
            key={`hand${burst}`}
            data-motion
            className="block"
            style={burst > 0 && picked ? { animation: "pick-hand .8s cubic-bezier(.2,.9,.3,1.3) both" } : undefined}
          >
            <TopTrackHand on={false} size={23} />
          </span>
        </button>
        {error && (
          <div className="absolute bottom-full right-0 mb-2 w-[200px] rounded-xl bg-white/95 px-2.5 py-1.5 text-right text-[11px] leading-snug text-accent-deep shadow">
            {error}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// The Leaderboard, the first of the Globe tab's two sides.
// ---------------------------------------------------------------------------

type Row = { p: Profile; month: number; last: number; k: number | null };

export function Leaderboard({
  api,
  me,
  friends,
  myPost,
  pick,
  open,
  tick,
  onPick,
  onOpen,
  onCore,
}: {
  api: GlobeApi;
  me: Profile;
  friends: Friend[];
  myPost: Post | null; // you rank once you've posted
  pick: string | null; // the post you made your TopTrack today
  open: boolean;
  tick: number; // goes up when your pick changes, to fetch again
  onPick(postId: string | null): Promise<string | null>;
  onOpen(k: number): void; // fly to a friend's song
  onCore(p: Profile): void;
}) {
  const [scores, setScores] = useState<Score[] | null>(api.ranks ? null : []);
  // the board covers finished days, so on the 1st it still shows last month
  const [month] = useState(() => new Date(Date.now() - 86_400_000).toLocaleString(undefined, { month: "long" }));

  // live: fetched on open, after your own picks, and every 20s while open
  useEffect(() => {
    if (!open || !api.ranks) return;
    let on = true;
    const get = () => api.ranks!.board().then((s) => on && setScores(s)).catch(() => {});
    get();
    const t = setInterval(get, 20_000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [open, tick, api]);

  const byId = new Map((scores ?? []).map((s) => [s.who, s]));
  const people: Row[] = [
    { p: me, k: null, month: 0, last: 0 },
    ...friends.map((f, k) => ({ p: f as Profile, k, month: 0, last: 0, hidden: f.hidden })).filter((r) => !r.hidden),
  ].map((r) => ({ ...r, month: byId.get(r.p.id)?.month ?? 0, last: byId.get(r.p.id)?.last ?? 0 }));
  const rows = people.sort((a, b) => b.month - a.month || b.last - a.last || a.p.display_name.localeCompare(b.p.display_name));
  // shared places for equal points: 1, 2, 2, 4
  const place = (i: number) => {
    let j = i;
    while (j > 0 && rows[j - 1].month === rows[i].month) j--;
    return j + 1;
  };
  const anyPoints = rows.some((r) => r.month > 0);
  const podium = anyPoints ? rows.slice(0, 3).filter((r) => r.month > 0) : [];

  const posts = new Map(friends.flatMap((f, k) => (f.post ? [[f.post.id, { f, k, post: f.post }] as const] : [])));
  const got = pick ? posts.get(pick) : null;

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-4">
      <Kicker>Your TopTrack today</Kicker>
      {!myPost ? (
        <div className="px-2 pb-2 text-[13px] leading-snug text-muted">Post your song, then pick the one on your globe that hit hardest.</div>
      ) : got ? (
        <div className="flex h-[52px] items-center gap-2.5 pb-1 pl-1">
          <TopTrackHand on size={22} />
          <button
            type="button"
            onClick={() => onOpen(got.k)}
            aria-label={`Open ${got.f.display_name}'s song, ${got.post.title}`}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <Cover src={got.post.artwork_url} seed={got.post.title} size={32} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold">{got.post.title}</span>
              <span className="truncate text-[11px] text-muted">{got.f.display_name}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label="Take back your TopTrack"
            className="flex h-11 w-9 flex-none items-center justify-center text-muted"
          >
            <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-1 pb-2 text-[12px] leading-snug text-muted">
          <TopTrackHand on={false} size={18} />
          Tap the hand on a friend&apos;s song to make it your TopTrack.
        </div>
      )}

      <Kicker>{month}</Kicker>
      {scores === null ? (
        <div className="px-2 py-3 text-[13px] text-muted">Counting…</div>
      ) : (
        <>
          {podium.length > 0 && <Podium rows={podium} meId={me.id} onCore={onCore} />}
          {!anyPoints && (
            <div className="px-2 pb-2 text-[13px] leading-snug text-muted">No points yet this month. Today&apos;s picks count tomorrow morning.</div>
          )}
          {rows.map((r, i) => (
            <button
              key={r.p.id}
              type="button"
              onClick={() => onCore(r.p)}
              aria-label={`${r.p.id === me.id ? "You" : r.p.display_name}, ${r.month} points this month`}
              className={`flex h-[50px] w-full items-center gap-2.5 rounded-[14px] px-2 text-left ${r.p.id === me.id ? "bg-coral/10" : ""}`}
            >
              <span className="w-6 flex-none text-center font-bubble text-[15px] font-semibold tabular-nums text-muted">
                {r.month > 0 ? place(i) : "–"}
              </span>
              <Face p={r.p} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.p.id === me.id ? "You" : r.p.display_name}</span>
              {r.last > 0 && <span className="flex-none text-[11px] font-semibold tabular-nums text-accent">+{r.last} yesterday</span>}
              <span className="w-9 flex-none text-right font-bubble text-[17px] font-semibold tabular-nums">{r.month}</span>
            </button>
          ))}
          <p className="px-2 pt-2 text-[11px] leading-snug text-muted">
            Each time someone makes your song their TopTrack, you get a point. Points land each morning for the day before. Nobody sees who picked whom.
          </p>
        </>
      )}
    </div>
  );
}

// The month's top three on a drawn podium: 2nd, 1st, 3rd.
function Podium({ rows, meId, onCore }: { rows: Row[]; meId: string; onCore(p: Profile): void }) {
  const order = [rows[1], rows[0], rows[2]];
  const heights = [44, 62, 32];
  return (
    <div className="flex items-end justify-center gap-2 px-2 pb-3 pt-1">
      {order.map((r, j) => {
        if (!r) return <div key={j} className="w-[72px]" />;
        const n = (j === 1 ? 1 : j === 0 ? 2 : 3) as 1 | 2 | 3;
        return (
          <button
            key={r.p.id}
            type="button"
            onClick={() => onCore(r.p)}
            aria-label={`${["1st", "2nd", "3rd"][n - 1]}: ${r.p.id === meId ? "You" : r.p.display_name}, ${r.month} points`}
            className="flex w-[72px] flex-col items-center gap-1"
          >
            {n === 1 && <Crown />}
            <Face p={r.p} size={n === 1 ? 40 : 34} />
            <span className="w-full truncate text-center text-[11px] font-semibold">{r.p.id === meId ? "You" : r.p.display_name.split(" ")[0]}</span>
            <span
              className="relative flex w-full items-start justify-center rounded-t-[10px] pt-1 font-bubble text-[15px] font-semibold tabular-nums"
              style={{
                height: heights[j],
                background: n === 1 ? "#ff5e57" : "rgba(255,255,255,0.75)",
                color: n === 1 ? "#fff" : "#0d2a3f",
                border: "1.8px solid #0d2a3f",
                borderBottomWidth: 0,
                boxShadow: "2px 3px 0 rgba(13,42,63,0.18)",
              }}
            >
              {r.month}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const Crown = () => (
  <svg aria-hidden width="22" height="16" viewBox="0 0 22 16" className="-mb-1">
    <path d="M2.5 13.5 1.6 4.2l5.2 4L11 1.8l4.3 6.4 5.1-4-.9 9.3Z" fill="#ff5e57" stroke="#0d2a3f" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</div>
);
