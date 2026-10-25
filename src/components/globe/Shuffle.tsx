"use client";

import { useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/types";
import { spotifyUriOf, usePreview } from "./Preview";
import { glass } from "./ui";

// Shuffle all: every song on the Globe, in a random order. Anyone who linked
// Spotify hears them whole on their Spotify app, the list handed to Spotify
// in one go; everyone else hears the 30-second previews back to back. The
// Globe turns to each song as it comes on.

type Song = { k: number; post: Post };
const KEY = "shuffle";

function shuffled<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Shuffle({ songs, dark, onNow }: { songs: Song[]; dark: boolean; onNow(k: number | null): void }) {
  const pv = usePreview();
  const [queue, setQueue] = useState<{ list: Song[]; whole: boolean } | null>(null);
  const [now, setNow] = useState<Song | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const told = useRef(onNow);
  useEffect(() => {
    told.current = onNow;
  });

  const on = pv.key === KEY && queue !== null;
  const connect = pv.connect?.linked ? pv.connect : null;

  // another song started, or it ran out: let the Globe go
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !on) told.current(null);
    was.current = on;
  }, [on]);

  // whole songs: ask Spotify now and then which one it's on
  useEffect(() => {
    if (!on || !queue.whole || !connect) return;
    const check = () =>
      connect.now().then((n) => {
        const song = n?.uri ? queue.list.find((s) => spotifyUriOf(s.post) === n.uri) : undefined;
        if (song) {
          setNow((cur) => {
            if (cur?.k !== song.k) told.current(song.k);
            return song;
          });
        }
      });
    check();
    const t = setInterval(check, 4000);
    return () => clearInterval(t);
  }, [on, queue, connect]);

  if (!songs.length) return null;

  const playPreview = (list: Song[], i: number) => {
    if (i >= list.length) {
      pv.stop();
      return;
    }
    setNow(list[i]);
    told.current(list[i].k);
    pv.play(KEY, list[i].post.preview_url!, () => playPreview(list, i + 1));
  };

  const previews = (order: Song[]) => {
    const list = order.filter((s) => s.post.preview_url);
    if (!list.length) {
      setNote(connect ? null : "Connect Spotify in Settings to shuffle whole songs.");
      return false;
    }
    setQueue({ list, whole: false });
    playPreview(list, 0);
    return true;
  };

  const start = async () => {
    setNote(null);
    const order = shuffled(songs);
    const whole = order.filter((s) => spotifyUriOf(s.post)?.startsWith("spotify:track:"));
    if (connect && whole.length) {
      setBusy(true);
      const r = await connect.playAll(whole.map((s) => spotifyUriOf(s.post)!));
      setBusy(false);
      if ("ok" in r) {
        pv.claim(KEY, () => void connect.pause());
        setQueue({ list: whole, whole: true });
        setNow(whole[0]);
        told.current(whole[0].k);
        return;
      }
      if (r.error === "no-device") {
        setNote("Open Spotify on your phone or computer, then shuffle again to hear whole songs.");
        return;
      }
    }
    previews(order);
  };

  const next = () => {
    if (!queue || !now) return;
    if (queue.whole && connect) {
      connect.next();
      const i = queue.list.findIndex((s) => s.k === now.k);
      const song = queue.list[i + 1];
      if (song) {
        setNow(song);
        told.current(song.k);
      }
    } else {
      const i = queue.list.findIndex((s) => s.k === now.k);
      playPreview(queue.list, i + 1);
    }
  };

  const ink = dark ? "#EEF3F8" : "#0D2A3F";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => (on ? pv.stop() : start())}
          disabled={busy}
          aria-label={on ? "Stop shuffle" : "Shuffle all songs"}
          className="flex h-9 max-w-[240px] items-center gap-2 rounded-full px-4 text-[13px] font-semibold"
          style={{ ...glass(dark), color: ink }}
        >
          {on ? <StopIcon /> : <ShuffleIcon />}
          <span className="truncate">{on && now ? `${now.post.title} · ${now.post.artist}` : busy ? "Starting…" : "Shuffle all"}</span>
        </button>
        {on && (
          <button
            type="button"
            onClick={next}
            aria-label="Next song"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ ...glass(dark), color: ink }}
          >
            <NextIcon />
          </button>
        )}
      </div>
      {note && (
        <p className="max-w-[260px] text-center text-[11px]" style={{ color: ink, opacity: 0.7 }}>
          {note}
        </p>
      )}
    </div>
  );
}

const ShuffleIcon = () => (
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);
const StopIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);
const NextIcon = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 4.5v15l11-7.5zM17 4h3v16h-3z" />
  </svg>
);
