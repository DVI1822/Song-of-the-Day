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

export function Shuffle({ songs }: { songs: Post[] }) {
  const pv = usePreview();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setDocked } = pv;
  useEffect(() => {
    setDocked(true);
    return () => setDocked(false);
  }, [setDocked]);

  if (pv.shuffle || pv.track) return <Controls />;
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

function Controls() {
  const pv = usePreview();
  const sh = pv.shuffle;
  const now = sh?.now ?? pv.track?.post;
  if (!now) return null;
  const paused = sh ? sh.paused : Boolean(pv.track?.paused);
  const btn = "flex h-9 w-9 flex-none items-center justify-center rounded-full";
  return (
    <div className="flex h-12 max-w-[340px] items-center gap-1 rounded-full py-1.5 pl-1.5 pr-1" style={glass(false)}>
      <Cover src={now.artwork_url} seed={now.title} size={36} />
      <div className="flex min-w-0 flex-1 flex-col px-1.5 leading-tight">
        <span className="truncate text-[13px] font-semibold">{now.title}</span>
        <span className="truncate text-[11px] opacity-60">{now.artist}</span>
      </div>
      <button type="button" onClick={sh ? pv.shuffleToggle : pv.toggle} aria-label={paused ? "Play" : "Pause"} className={btn}>
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      {sh && (
        <button type="button" onClick={pv.shuffleNext} aria-label="Next song" className={btn}>
          <NextIcon />
        </button>
      )}
      <button type="button" onClick={pv.stop} aria-label="Stop" className={btn}>
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
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
const PauseIcon = () => (
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);
const NextIcon = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 4.5v15l11-7.5zM17 4h3v16h-3z" />
  </svg>
);
const CloseIcon = () => (
  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
