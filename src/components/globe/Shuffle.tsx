"use client";

import { useEffect, useState } from "react";
import type { Post } from "@/lib/types";
import { usePreview } from "./Preview";
import { Cover, glass } from "./ui";

// Shuffle all: every song on the Globe, in a random order. Anyone who linked
// Spotify hears them whole on their Spotify app, the list handed to Spotify
// in one go; everyone else hears the 30-second previews back to back.
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

  if (pv.shuffle || pv.track) return <Controls who={who} />;
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
        aria-label="Shuffle all songs"
        className="flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold"
        style={glass(false)}
      >
        <ShuffleIcon />
        {busy ? "Starting…" : "Shuffle all"}
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

// The tiny now-playing pill: cover, song, album when it fits, who played it.
function Controls({ who }: { who?: Who }) {
  const pv = usePreview();
  const sh = pv.shuffle;
  const now = sh?.now ?? pv.track?.post;
  if (!now) return null;
  const paused = sh ? sh.paused : Boolean(pv.track?.paused);
  const by = who?.name(now) ?? null;
  const btn = "flex h-7 w-7 flex-none items-center justify-center rounded-full";
  const info = (
    <>
      <Cover src={now.artwork_url} seed={now.title} size={28} style={{ borderRadius: 999 }} />
      <span className="flex min-w-0 flex-1 flex-col pl-2 pr-1 text-left leading-[1.15]">
        <span className="truncate text-[12px] font-semibold">{now.title}</span>
        <span className="truncate text-[10.5px]">
          {by && <span className="font-semibold text-accent">{by}</span>}
          {by && now.album && <span className="opacity-40"> · </span>}
          {now.album && <span className="opacity-60">{now.album}</span>}
          {!by && !now.album && <span className="opacity-60">{now.artist}</span>}
        </span>
      </span>
    </>
  );
  return (
    <div className="flex h-10 w-[min(272px,calc(100vw-40px))] items-center rounded-full py-1 pl-1 pr-1" style={glass(false)}>
      {who ? (
        <button
          type="button"
          onClick={() => who.open(now)}
          aria-label={`${now.title}${by ? `, played by ${by}` : ""}. Show it on the globe`}
          className="flex min-w-0 flex-1 items-center rounded-full"
        >
          {info}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center">{info}</div>
      )}
      <button type="button" onClick={sh ? pv.shuffleToggle : pv.toggle} aria-label={paused ? "Play" : "Pause"} className={btn}>
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      {sh && (
        <button type="button" onClick={pv.shuffleNext} aria-label="Next song" className={btn}>
          <NextIcon />
        </button>
      )}
      <button type="button" onClick={pv.stop} aria-label="Stop" className={`${btn} opacity-50`}>
        <CloseIcon />
      </button>
    </div>
  );
}

const ShuffleIcon = () => (
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);
const PlayIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);
const NextIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 4.5v15l11-7.5zM17 4h3v16h-3z" />
  </svg>
);
const CloseIcon = () => (
  <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
