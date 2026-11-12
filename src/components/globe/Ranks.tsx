"use client";

import { useEffect, useState } from "react";
import type { Friend, Picks, Post, Profile, Score } from "@/lib/types";
import type { GlobeApi } from "./api";
import { Cover, Face } from "./ui";

// Ranking: once you've posted, you give three of today's songs on your globe
// your 1st, 2nd and 3rd (never your own). They're worth 3, 2 and 1 points.
// The medals sit on each friend's song card; the Leaderboard, inside the
// Globe tab, shows your three picks and everyone's points this month, live.
// Points start again on the 1st. Who gave whom points is never shown.

export const POINTS = [3, 2, 1] as const;
const PLACE = ["1st", "2nd", "3rd"] as const;

// One drawn medal: an ink ring with the place in it, coral once it's given.
export function Medal({ n, on, size = 34 }: { n: 1 | 2 | 3; on: boolean; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 34 34" className="flex-none overflow-visible">
      {on && <circle cx="18.5" cy="19" r="13.5" fill="#0d2a3f" opacity="0.9" />}
      <path
        d="M17 3.6c7.6-.2 13.5 5.6 13.4 13.2-.1 7.5-6 13.6-13.6 13.6C9.3 30.4 3.5 24.6 3.6 17 3.7 9.6 9.6 3.8 17 3.6Z"
        fill={on ? "#ff5e57" : "rgba(255,255,255,0.7)"}
        stroke="#0d2a3f"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {on && <path d="M9.5 11.5c1.6-2.2 3.8-3.4 6.4-3.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.8" />}
      <text
        x="17"
        y="22.3"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill={on ? "#fff" : "#0d2a3f"}
        style={{ fontFamily: "var(--font-bubble)" }}
      >
        {n}
      </text>
    </svg>
  );
}

// The three medals on a friend's song card. Tap one to give the song that
// place; tap the one it already has to take it back. Another song holding
// that place steps off.
export function RankMedals({
  postId,
  picks,
  onRank,
}: {
  postId: string;
  picks: Picks;
  onRank(rank: 1 | 2 | 3, postId: string): Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pop, setPop] = useState<number | null>(null);
  const tap = async (n: 1 | 2 | 3) => {
    setError(null);
    if (picks[n - 1] !== postId) setPop(n);
    const e = await onRank(n, postId);
    if (e) setError(e);
  };
  const mine = picks.indexOf(postId);
  return (
    <div className="relative flex flex-none flex-col items-end">
      <div className="flex items-center gap-0.5" role="group" aria-label="Rank this song">
        {([1, 2, 3] as const).map((n) => {
          const on = mine === n - 1;
          return (
            <button
              key={n}
              type="button"
              onClick={() => tap(n)}
              aria-pressed={on}
              aria-label={on ? `Your ${PLACE[n - 1]} today. Tap to take it back` : `Rank it ${PLACE[n - 1]}, ${POINTS[n - 1]} points`}
              className="flex h-11 w-[38px] items-center justify-center"
            >
              <span
                key={on && pop === n ? "pop" : "still"}
                data-motion
                className="block"
                style={on && pop === n ? { animation: "medal-pop .5s cubic-bezier(.2,.9,.3,1.4)" } : undefined}
              >
                <Medal n={n} on={on} size={32} />
              </span>
            </button>
          );
        })}
      </div>
      {error && <div className="absolute right-1 top-full z-10 w-[200px] text-right text-[11px] leading-snug text-accent-deep">{error}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Leaderboard, the first of the Globe tab's two sides.
// ---------------------------------------------------------------------------

type Row = { p: Profile; month: number; today: number; k: number | null };

export function Leaderboard({
  api,
  me,
  friends,
  myPost,
  picks,
  open,
  tick,
  onRank,
  onOpen,
  onCore,
}: {
  api: GlobeApi;
  me: Profile;
  friends: Friend[];
  myPost: Post | null; // you rank once you've posted
  picks: Picks;
  open: boolean;
  tick: number; // goes up when your own picks change, to fetch again
  onRank(rank: 1 | 2 | 3, postId: string | null): Promise<string | null>;
  onOpen(k: number): void; // fly to a friend's song
  onCore(p: Profile): void;
}) {
  const [scores, setScores] = useState<Score[] | null>(api.ranks ? null : []);

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
    { p: me, k: null, month: 0, today: 0 },
    ...friends.map((f, k) => ({ p: f as Profile, k, month: 0, today: 0, hidden: f.hidden })).filter((r) => !r.hidden),
  ].map((r) => ({ ...r, month: byId.get(r.p.id)?.month ?? 0, today: byId.get(r.p.id)?.today ?? 0 }));
  const rows = people.sort((a, b) => b.month - a.month || b.today - a.today || a.p.display_name.localeCompare(b.p.display_name));
  // shared places for equal points: 1, 2, 2, 4
  const place = (i: number) => {
    let j = i;
    while (j > 0 && rows[j - 1].month === rows[i].month) j--;
    return j + 1;
  };
  const anyPoints = rows.some((r) => r.month > 0);
  const podium = anyPoints ? rows.slice(0, 3).filter((r) => r.month > 0) : [];

  const posts = new Map(friends.flatMap((f, k) => (f.post ? [[f.post.id, { f, k, post: f.post }] as const] : [])));
  const now = new Date();
  const month = now.toLocaleString(undefined, { month: "long" });

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-4">
      <Kicker>Your top three today</Kicker>
      {!myPost ? (
        <div className="px-2 pb-2 text-[13px] leading-snug text-muted">Post your song, then rank three of today&apos;s from your globe.</div>
      ) : (
        <div className="flex flex-col gap-0.5 pb-1">
          {([1, 2, 3] as const).map((n) => {
            const got = picks[n - 1] ? posts.get(picks[n - 1]!) : null;
            return (
              <div key={n} className="flex h-[48px] items-center gap-2.5 pl-1">
                <Medal n={n} on={Boolean(got)} size={30} />
                {got ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpen(got.k)}
                      aria-label={`Open ${got.f.display_name}'s song, ${got.post.title}`}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <Cover src={got.post.artwork_url} seed={got.post.title} size={30} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-semibold">{got.post.title}</span>
                        <span className="truncate text-[11px] text-muted">{got.f.display_name}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRank(n, null)}
                      aria-label={`Take back your ${PLACE[n - 1]}`}
                      className="flex h-11 w-9 flex-none items-center justify-center text-muted"
                    >
                      <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-muted">
                    {POINTS[n - 1]} {POINTS[n - 1] === 1 ? "point" : "points"} · tap {n} on a friend&apos;s song
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Kicker>{month}</Kicker>
      {scores === null ? (
        <div className="px-2 py-3 text-[13px] text-muted">Counting…</div>
      ) : (
        <>
          {podium.length > 0 && <Podium rows={podium} meId={me.id} onCore={onCore} />}
          {!anyPoints && (
            <div className="px-2 pb-2 text-[13px] leading-snug text-muted">No points yet this month. Rank today&apos;s songs to get it going.</div>
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
              {r.today > 0 && <span className="flex-none text-[11px] font-semibold tabular-nums text-accent">+{r.today} today</span>}
              <span className="w-9 flex-none text-right font-bubble text-[17px] font-semibold tabular-nums">{r.month}</span>
            </button>
          ))}
          <p className="px-2 pt-2 text-[11px] leading-snug text-muted">
            1st is 3 points, 2nd is 2, 3rd is 1. Nobody sees who ranked them.
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
            aria-label={`${PLACE[n - 1]}: ${r.p.id === meId ? "You" : r.p.display_name}, ${r.month} points`}
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
