"use client";

import { useEffect, useState, type Ref } from "react";
import type { Friend, Profile, Score } from "@/lib/types";
import type { GlobeApi } from "./api";
import { PullTab } from "./pull";
import { CloseIcon, Face, glass } from "./ui";

// Your TopTrack: once you've posted, you crown the one song on your globe
// that hit hardest today (never your own) with the crown button in the row
// under a friend's song. A gold crown then lands above the card, off it,
// shakes, and confetti rains down over the song. Each crown is a point for
// that friend. The Leaderboard tab on the right adds them up for the month,
// taking in each day's crowns the next morning. Who crowned whom is never shown.

const INK = "#0d2a3f";
const CORAL = "#ff5e57";
const GOLD = "#ffc94a";

// The crown, drawn in a 24 box: three points with a ball on each tip.
const CROWN = "M4.6 18.6 3.4 8.3l5 4.1L12 5.6l3.6 6.8 5-4.1-1.2 10.3Z";
const TIPS: [number, number][] = [
  [3.4, 7.2],
  [12, 4.4],
  [20.6, 7.2],
];

// The crown as a line icon in the song's button row, like save, like and
// notes: navy lines, coloured in coral once it's your pick.
export function CrownIcon({ on, size = 46, stroke = 1.4 }: { on: boolean; size?: number; stroke?: number }) {
  const w = (stroke * 24) / size;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinejoin="round">
      <path d={CROWN} fill={on ? GOLD : "none"} className="transition-[fill] duration-300" />
      <path d="M5.2 16h13.6" strokeLinecap="round" />
      {TIPS.map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={1.05} fill={on ? CORAL : "none"} />
      ))}
    </svg>
  );
}

// The fourth button in the row. A tap crowns the song, or takes it back.
export function CrownButton({ on, onTap }: { on: boolean; onTap(): void }) {
  const [pop, setPop] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        if (!on) setPop((n) => n + 1);
        onTap();
      }}
      aria-pressed={on}
      aria-label={on ? "Your TopTrack today. Tap to take it back" : "Crown this as your TopTrack today"}
      className="relative flex h-14 w-14 items-center justify-center rounded-full text-card-ink"
    >
      <span key={pop} className="flex" style={{ animation: pop ? "crown-pop .55s cubic-bezier(.2,.9,.3,1.3)" : undefined }}>
        <CrownIcon on={on} />
      </span>
    </button>
  );
}

// The big coloured crown on top of a crowned cover, in the drawn style. It
// lands with a shake and a burst of ink lines, and confetti rains down the
// card. `burst` goes up on each new crowning, so it plays again.
export function CoverCrown({ burst, fall, top }: { burst: number; fall: number; top: number }) {
  return (
    <div
      aria-hidden
      data-motion
      className="pointer-events-none absolute left-1/2 z-[4] -translate-x-1/2"
      style={{ width: 0, height: 0, top }}
    >
      <span key={`c${burst}`} className="absolute -left-[32px] -top-[46px] block" style={{ animation: burst ? "crown-land .9s cubic-bezier(.36,.07,.19,.97) both" : undefined }}>
        <svg width="64" height="48" viewBox="2 3.4 20 16" className="block overflow-visible drop-shadow-[2px_3px_0_rgba(13,42,63,0.3)]">
          <path d={CROWN} fill={GOLD} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
          <path d="M6.4 9.6 7 15M12 8.2v6.6M17.6 9.6 17 15" stroke="#fff3c4" strokeWidth={0.7} strokeLinecap="round" />
          <path d="M5.2 16h13.6" stroke={INK} strokeWidth={0.85} strokeLinecap="round" />
          {TIPS.map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={1.25} fill={CORAL} stroke={INK} strokeWidth={0.8} />
          ))}
          <circle cx="12" cy="13" r="1.1" fill={CORAL} stroke={INK} strokeWidth={0.75} />
        </svg>
        {burst > 0 && (
          <svg width="90" height="70" viewBox="0 0 90 70" className="absolute -left-[13px] -top-[16px] overflow-visible" style={{ animation: "crown-lines .6s .12s ease-out both" }}>
            <g stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none">
              <path d="M45 2v8M12 14l7 5M78 14l-7 5M3 38h8M79 38h8" />
            </g>
          </svg>
        )}
      </span>
      {burst > 0 && <Confetti key={`f${burst}`} seed={burst} fall={fall} />}
    </div>
  );
}

// Ink-outlined bits in the app's colours: strips, triangles, dots, squiggles.
const BITS = [CORAL, INK, "#b9e4c9", GOLD, "#fffdf6"];
function Confetti({ seed, fall }: { seed: number; fall: number }) {
  // the same scatter every render for one crowning, a new one next time
  const rnd = (i: number, k: number) => {
    const x = Math.sin(seed * 97.1 + i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return (
    <>
      {Array.from({ length: 90 }, (_, i) => {
        const c = BITS[i % BITS.length];
        const shape = i % 4;
        const dx = (rnd(i, 1) - 0.5) * 380;
        const style = {
          "--dx": `${dx}px`,
          "--up": `${-20 - rnd(i, 2) * 50}px`,
          "--dy": `${fall * (0.45 + rnd(i, 3) * 0.75)}px`,
          "--r": `${(rnd(i, 4) - 0.5) * 900}deg`,
          animation: `confetti-fall ${1.6 + rnd(i, 5) * 1.4}s cubic-bezier(.25,.6,.4,1) ${0.2 + rnd(i, 6) * 0.6}s both`,
        } as React.CSSProperties;
        return (
          <svg key={i} width="14" height="12" viewBox="0 0 14 12" className="absolute -left-[7px] -top-[6px] overflow-visible" style={style}>
            {shape === 0 && <rect x="1" y="2" width="10" height="5" rx="1" fill={c} stroke={INK} strokeWidth="1.3" />}
            {shape === 1 && <path d="M1 10 6.5 1 12 10Z" fill={c} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />}
            {shape === 2 && <circle cx="6" cy="6" r="3.6" fill={c} stroke={INK} strokeWidth="1.3" />}
            {shape === 3 && <path d="M1 7q3-6 6 0t6 0" fill="none" stroke={c === "#fffdf6" ? INK : c} strokeWidth="2.4" strokeLinecap="round" />}
          </svg>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// The Leaderboard tab, alone on the right edge, with a little crown floating
// over it that gives a shake every few seconds to get you to open it.
// ---------------------------------------------------------------------------

export function BoardTab({
  open,
  dark,
  onOpen,
  onClose,
  onPull,
  tabTop,
  top,
  width,
  height,
  tabRef,
  children,
}: {
  open: boolean;
  dark: boolean;
  onOpen(): void;
  onClose(): void;
  onPull(): void; // the tab started being dragged out
  tabTop: number;
  top: number;
  width: number;
  height: number;
  tabRef?: Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <>
      <PullTab
        buttonRef={tabRef}
        pull={{ side: "right", open, travel: width + 46, panel: "tt-board", onStart: onPull, onOpen, onClose }}
        onClick={open ? onClose : onOpen}
        aria-label="Leaderboard"
        aria-expanded={open}
        className="absolute right-0 z-[430] box-border flex h-[132px] w-[38px] flex-col items-center justify-center gap-2 rounded-l-[18px] !border-r-0 transition-shadow"
        style={{
          top: tabTop,
          ...glass(dark),
          ...(open ? { background: "#FFFFFF", boxShadow: "inset -3px 0 0 #D7262B, 0 8px 30px -14px rgba(13,42,63,0.3)" } : {}),
        }}
      >
        {!open && (
          <span aria-hidden data-motion className="pointer-events-none absolute -top-[24px] left-[6px]" style={{ animation: "crown-bob 2.6s ease-in-out infinite" }}>
            <svg width="26" height="20" viewBox="2 3.4 20 16" className="block overflow-visible" style={{ transformOrigin: "50% 90%", animation: "crown-nudge 5.5s ease-in-out 1.5s infinite" }}>
              <path d={CROWN} fill={GOLD} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
              {TIPS.map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r={1.25} fill={CORAL} stroke={INK} strokeWidth={0.9} />
              ))}
            </svg>
          </span>
        )}
        <CrownIcon on={false} size={18} stroke={1.8} />
        <span className="whitespace-nowrap text-[11px] font-semibold tracking-[0.06em] [writing-mode:vertical-rl]">Leaderboard</span>
      </PullTab>
      <div
        id="tt-board"
        role="dialog"
        aria-label="Leaderboard"
        inert={!open}
        className="absolute right-[46px] z-[425] box-border flex flex-col overflow-hidden rounded-[26px] transition-[opacity,transform] duration-[260ms] ease-out"
        style={{
          top,
          width,
          height,
          ...glass(dark),
          boxShadow: "-18px 0 50px -28px rgba(0,0,0,0.7)",
          opacity: open ? 1 : 0,
          transform: `translateX(${open ? 0 : 60}px)`,
          pointerEvents: open ? undefined : "none",
        }}
      >
        <div className="flex items-center gap-2 pb-1 pl-[18px] pr-1.5 pt-3">
          <h2 className="display text-lg">Leaderboard</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-11 w-11 items-center justify-center">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// The Leaderboard itself: a plain list, most points first. Only the one at
// the very top wears the little crown.
// ---------------------------------------------------------------------------

type Row = { p: Profile; month: number; last: number };

export function Leaderboard({
  api,
  me,
  friends,
  open,
  tick,
  onCore,
}: {
  api: GlobeApi;
  me: Profile;
  friends: Friend[];
  open: boolean;
  tick: number; // goes up when your crown moves, to fetch again
  onCore(p: Profile): void;
}) {
  const [scores, setScores] = useState<Score[] | null>(api.ranks ? null : []);
  // the board covers finished days, so on the 1st it still shows last month
  const [month] = useState(() => new Date(Date.now() - 86_400_000).toLocaleString(undefined, { month: "long" }));

  // fetched on open, after your own crowning, and every 20s while open
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
    { p: me, hidden: false },
    ...friends.map((f) => ({ p: f as Profile, hidden: f.hidden })),
  ]
    .filter((r) => !r.hidden)
    .map((r) => ({ p: r.p, month: byId.get(r.p.id)?.month ?? 0, last: byId.get(r.p.id)?.last ?? 0 }));
  const rows = people.sort((a, b) => b.month - a.month || b.last - a.last || a.p.display_name.localeCompare(b.p.display_name));
  // shared places for equal points: 1, 2, 2, 4
  const place = (i: number) => {
    let j = i;
    while (j > 0 && rows[j - 1].month === rows[i].month) j--;
    return j + 1;
  };
  const top = rows[0]?.month ?? 0;

  return (
    <div className="flex-1 overflow-y-auto px-2.5 pb-4">
      <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{month}</div>
      {scores === null ? (
        <div className="px-2 py-3 text-[13px] text-muted">Counting…</div>
      ) : (
        <>
          {top === 0 && (
            <div className="px-2 pb-2 text-[13px] leading-snug text-muted">No points yet this month. Today&apos;s crowns count tomorrow morning.</div>
          )}
          {rows.map((r, i) => (
            <button
              key={r.p.id}
              type="button"
              onClick={() => onCore(r.p)}
              aria-label={`${r.p.id === me.id ? "You" : r.p.display_name}, ${r.month} points this month`}
              className={`flex h-[54px] w-full items-center gap-2.5 rounded-[14px] px-2 text-left ${r.p.id === me.id ? "bg-coral/10" : ""}`}
            >
              <span className="w-6 flex-none text-center font-bubble text-[15px] font-semibold tabular-nums text-muted">
                {r.month > 0 ? place(i) : "–"}
              </span>
              <span className="relative flex-none">
                <Face p={r.p} size={32} />
                {i === 0 && r.month > 0 && (
                  <svg aria-hidden width="20" height="15" viewBox="2 3.4 20 16" className="absolute -top-[11px] left-1/2 -translate-x-1/2 -rotate-[8deg] overflow-visible">
                    <path d={CROWN} fill={GOLD} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{r.p.id === me.id ? "You" : r.p.display_name}</span>
                {r.last > 0 && <span className="text-[11px] font-semibold leading-tight tabular-nums text-accent">+{r.last} yesterday</span>}
              </span>
              <span className="w-9 flex-none text-right font-bubble text-[17px] font-semibold tabular-nums">{r.month}</span>
            </button>
          ))}
          <p className="px-2 pt-2 text-[11px] leading-snug text-muted">
            Each time someone crowns your song their TopTrack, you get a point. Points land each morning for the day before. Nobody sees who crowned whom.
          </p>
        </>
      )}
    </div>
  );
}
