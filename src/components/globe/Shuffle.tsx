"use client";

import { useEffect, useState } from "react";
import type { Post } from "@/lib/types";
import { usePreview } from "./Preview";
import { Cover, glass } from "./ui";

// Play: every song on the Globe, in a random order, as 30-second samples
// back to back.
// Whatever's playing (a shuffle or one song) lives in PreviewProvider, in the
// root layout, so it keeps going on every page: the Globe shows it in this
// bar, everywhere else in the mini player.

// On the Globe, the bar names who put the song there and, tapped, takes you to
// their tile.
type Who = { name: (p: Post) => string | null; open: (p: Post) => void };

export function Shuffle({ songs, who }: { songs: Post[]; who?: Who }) {
  const pv = usePreview();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setDocked } = pv;
  useEffect(() => {
    setDocked(true);
    return () => setDocked(false);
  }, [setDocked]);

  if (pv.shuffle || pv.track) return <Controls who={who} songs={songs} />;
  if (!songs.length) return null;

  const start = async () => {
    setNote(null);
    setBusy(true);
    setNote(await pv.startShuffle(songs));
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-label="Play every song on your globe"
        className="flex h-11 items-center gap-2 rounded-full pl-1.5 pr-5 text-[14px] font-semibold"
        style={glass(false)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ border: "1.6px solid currentColor" }}>
          <PlayIcon size={14} />
        </span>
        {busy ? "Starting…" : "Play"}
      </button>
      {note && (
        <p className="max-w-[260px] text-center text-[11px]" style={{ color: "#0D2A3F", opacity: 0.7 }}>
          {note}
        </p>
      )}
    </div>
  );
}

// Off the Globe: a small player pinned to the bottom of every other page.
export function MiniPlayer() {
  const pv = usePreview();
  if ((!pv.shuffle && !pv.track) || pv.docked) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-[900] flex justify-center px-4">
      <div className="pointer-events-auto">
        <Controls />
      </div>
    </div>
  );
}

// The now-playing player: the cover, the song and who put it on your globe on
// the left (tap either to open the song's card from its spot on the Globe),
// back, play/pause and next on the right.
function Controls({ who, songs }: { who?: Who; songs?: Post[] }) {
  const pv = usePreview();
  const sh = pv.shuffle;
  const now = sh?.now ?? pv.track?.post;
  if (!now) return null;
  const paused = sh ? sh.paused : Boolean(pv.track?.paused);
  const by = who?.name(now) ?? null;
  const rest = songs?.filter((p) => p.id !== now.id && p.preview_url) ?? [];
  const last = sh ? sh.list[sh.list.length - 1]?.id === now.id : !rest.length;
  // one song playing on its own: next carries on through the rest of the globe
  const next = sh ? pv.shuffleNext : () => void pv.startShuffle(rest);
  const btn = "flex h-10 w-10 flex-none items-center justify-center rounded-full disabled:opacity-30";
  const info = (
    <>
      <Cover src={now.artwork_url} seed={now.title} size={46} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pl-3 pr-1 text-left leading-[1.2]">
        <span className="truncate text-[14px] font-semibold">{now.title}</span>
        <span className="truncate text-[12px]">
          {by ? <span className="font-semibold text-accent">{by}</span> : <span className="opacity-60">{now.artist}</span>}
        </span>
      </span>
    </>
  );
  return (
    <div
      className="flex h-[62px] w-[min(360px,calc(100vw-32px))] items-center rounded-[22px] py-2 pl-2 pr-1.5"
      style={glass(false)}
    >
      {who ? (
        <button
          type="button"
          onClick={() => who.open(now)}
          aria-label={`${now.title}${by ? `, picked by ${by}` : ""}. Open the song`}
          className="flex min-w-0 flex-1 items-center rounded-[14px]"
        >
          {info}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center">{info}</div>
      )}
      <button type="button" onClick={pv.shufflePrev} aria-label="Back" className={btn}>
        <PrevIcon />
      </button>
      <button
        type="button"
        onClick={sh ? pv.shuffleToggle : pv.toggle}
        aria-label={paused ? "Play" : "Pause"}
        className={`${btn} h-11 w-11`}
        style={{ border: "1.8px solid currentColor" }}
      >
        {paused ? <PlayIcon size={16} /> : <PauseIcon />}
      </button>
      <button type="button" onClick={next} disabled={last} aria-label="Next song" className={btn}>
        <NextIcon />
      </button>
      {!who && (
        <button type="button" onClick={pv.stop} aria-label="Stop" className={`${btn} w-8 opacity-50`}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

// navy line icons, like the song card's buttons
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const PlayIcon = ({ size = 14 }: { size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" {...line} style={{ marginLeft: size / 8 }}>
    <path d="M7 4.8v14.4a.6.6 0 0 0 .9.5l11.6-7.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" {...line} strokeWidth={2.4}>
    <path d="M8.5 5v14M15.5 5v14" />
  </svg>
);
const NextIcon = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" {...line}>
    <path d="M5 6.2v11.6a.5.5 0 0 0 .8.4l8.4-5.8a.5.5 0 0 0 0-.8L5.8 5.8a.5.5 0 0 0-.8.4zM18.5 5.5v13" />
  </svg>
);
const PrevIcon = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" {...line}>
    <path d="M19 6.2v11.6a.5.5 0 0 1-.8.4l-8.4-5.8a.5.5 0 0 1 0-.8l8.4-5.8a.5.5 0 0 1 .8.4zM5.5 5.5v13" />
  </svg>
);
const CloseIcon = () => (
  <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const PlayAllIcon = () => <PlayIcon size={15} />;
