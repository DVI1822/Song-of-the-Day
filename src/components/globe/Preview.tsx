"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { embedFor } from "@/lib/songs";
import type { Post } from "@/lib/types";

// What's playing, for the whole site. It lives in the root layout, so a song
// keeps going after you close its card or move to another page, until you
// pause it or start another. One shared audio element plays the 30-second
// samples, so starting one song always stops the last. Whole songs open in the
// listener's own music app; nothing plays a whole song in TopTrack.
export type ShuffleState = { list: Post[]; now: Post; paused: boolean };
export type Track = { post: Post; paused: boolean; kind: "clip" };
type Controls = { pause(): void; resume(): void };
type PreviewState = {
  key: string | null;
  at: number;
  play(key: string, url: string, onEnd?: () => void, post?: Post): void;
  stop(): void;
  // the single song that's playing (or paused), for the mini player
  track: Track | null;
  toggle(): void;
  // Shuffle all
  shuffle: ShuffleState | null;
  startShuffle(posts: Post[]): Promise<string | null>;
  shuffleNext(): void;
  // back to the start of this song, or, right at its start, the one before
  shufflePrev(): void;
  shuffleToggle(): void;
  // the Globe shows its own player bar, so the mini player steps aside
  docked: boolean;
  setDocked(on: boolean): void;
  // how far into the 30-second sample we are, while one is playing (so its
  // beat can be followed)
  clipTime(): number | null;
};
const Ctx = createContext<PreviewState | null>(null);
export const SHUFFLE = "shuffle";

function shuffled<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const ended = useRef<(() => void) | null>(null);
  const controls = useRef<Controls | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [track, setTrack] = useState<Track | null>(null);
  const [shuffle, setShuffle] = useState<ShuffleState | null>(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    a.addEventListener("timeupdate", () => setAt(a.currentTime));
    a.addEventListener("ended", () => {
      const next = ended.current;
      ended.current = null;
      if (next) return next();
      setKey(null);
      setAt(0);
      setTrack(null);
    });
    a.addEventListener("error", () => setKey(null));
    audio.current = a;
    return () => a.pause();
  }, []);

  const silence = useCallback(() => {
    ended.current = null;
    audio.current?.pause();
    controls.current = null;
  }, []);

  const stop = useCallback(() => {
    silence();
    setKey(null);
    setAt(0);
    setShuffle(null);
    setTrack(null);
  }, [silence]);

  const play = useCallback<PreviewState["play"]>(
    (k, url, onEnd, post) => {
      const a = audio.current;
      if (!a) return;
      silence();
      ended.current = onEnd ?? null;
      controls.current = { pause: () => a.pause(), resume: () => void a.play() };
      a.src = url;
      a.currentTime = 0;
      setAt(0);
      setKey(k);
      if (k !== SHUFFLE) setShuffle(null);
      setTrack(post ? { post, kind: "clip", paused: false } : null);
      a.play().catch(() => setKey(null));
    },
    [silence],
  );

  const toggle = useCallback(() => {
    if (!track || !controls.current) return;
    if (track.paused) controls.current.resume();
    else controls.current.pause();
    setTrack({ ...track, paused: !track.paused });
  }, [track]);

  // Shuffle with previews: one clip after another until the list runs out.
  const clip = useCallback(
    (list: Post[], from: number) => {
      const go = (i: number) => {
        if (i >= list.length) return stop();
        play(SHUFFLE, list[i].preview_url!, () => go(i + 1));
        setShuffle({ list, now: list[i], paused: false });
      };
      go(from);
    },
    [play, stop],
  );

  const startShuffle = useCallback(
    async (posts: Post[]) => {
      const list = shuffled(posts).filter((p) => p.preview_url);
      if (!list.length) return "None of these songs has a sample to play.";
      clip(list, 0);
      return null;
    },
    [clip],
  );

  const shuffleNext = useCallback(() => {
    if (!shuffle) return;
    const i = shuffle.list.findIndex((p) => p.id === shuffle.now.id);
    clip(shuffle.list, i + 1);
  }, [shuffle, clip]);

  const shufflePrev = useCallback(() => {
    const a = audio.current;
    const i = shuffle ? shuffle.list.findIndex((p) => p.id === shuffle.now.id) : -1;
    if (shuffle && i > 0 && (a?.currentTime ?? 0) < 3) return clip(shuffle.list, i - 1);
    if (!a?.src) return;
    a.currentTime = 0;
    setAt(0);
  }, [shuffle, clip]);

  const shuffleToggle = useCallback(() => {
    if (!shuffle) return;
    const paused = !shuffle.paused;
    if (paused) audio.current?.pause();
    else void audio.current?.play();
    setShuffle({ ...shuffle, paused });
  }, [shuffle]);

  const clipTime = useCallback(() => {
    const a = audio.current;
    return a?.src && !a.paused ? a.currentTime : null;
  }, []);

  return (
    <Ctx.Provider
      value={{
        key,
        at,
        play,
        stop,
        track,
        toggle,
        shuffle,
        startShuffle,
        shuffleNext,
        shufflePrev,
        shuffleToggle,
        docked,
        setDocked,
        clipTime,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePreview() {
  return useContext(Ctx)!;
}

const clock = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export function spotifyHref(post: Pick<Post, "platform_links" | "title" | "artist">) {
  return (
    post.platform_links?.spotify ?? `https://open.spotify.com/search/${encodeURIComponent(`${post.title} ${post.artist}`)}`
  );
}

const PlayIcon = ({ size }: { size: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
const PauseIcon = ({ size }: { size: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);
export const OpenIcon = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);


// One play button for the song's 30-second sample, which keeps playing after
// this card closes. A song with no sample shows its platform's own player
// instead, as that platform makes it (for Spotify, Spotify's embed with its
// 30 seconds). Whole songs open in the listener's own music app.
export function SongPlayer({
  post,
  big = false,
  extra,
}: {
  post: Post;
  big?: boolean;
  extra?: React.ReactNode;
}) {
  const pv = usePreview();
  const key = `song-${post.id}`;
  // the song Play is on counts as this card's own, so pause here pauses it
  const inShuffle = pv.shuffle?.now.id === post.id;
  const mine = pv.key === key || inShuffle;
  const [embedOpen, setEmbedOpen] = useState(false);
  const links = post.platform_links ?? {};
  const embed = embedFor(links, post.song_url);
  const paused = mine && (inShuffle ? pv.shuffle?.paused : pv.track?.paused);
  const canPlay = Boolean(post.preview_url || embed);
  const size = big ? 54 : 44;
  const playing = embedOpen || (mine && !paused);

  const toggle = () => {
    if (embedOpen) return setEmbedOpen(false);
    // pause, or carry on, without losing your place
    if (inShuffle) return pv.shuffleToggle();
    if (mine && pv.track) return pv.toggle();
    if (post.preview_url) pv.play(key, post.preview_url, undefined, post);
    else if (embed) {
      pv.stop();
      setEmbedOpen(true);
    }
  };

  const progress = mine ? { at: pv.at * 1000, of: 30_000 } : null;
  // the other apps it's on, for anyone who doesn't use Spotify
  const also = (
    [
      ["appleMusic", "Apple Music"],
      ["youtubeMusic", "YouTube Music"],
    ] as const
  ).filter(([p]) => links[p]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        {canPlay && (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause sample" : "Play a 30-second sample"}
            className="flex flex-none items-center justify-center rounded-full bg-accent text-white"
            style={{ width: size, height: size }}
          >
            {playing ? <PauseIcon size={big ? 20 : 16} /> : <PlayIcon size={big ? 20 : 16} />}
          </button>
        )}
        <a
          href={spotifyHref(post)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-card-ink text-[13px] font-semibold text-white"
          style={{ height: big ? 46 : 44 }}
        >
          <OpenIcon />
          Open in Spotify
        </a>
        {extra}
      </div>
      {progress && (
        <div className="flex flex-col gap-1.5">
          <div className="relative h-[3px] overflow-hidden rounded-sm bg-card-ink/12">
            <div
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-300 ease-linear"
              style={{ width: `${Math.min(100, (progress.at / progress.of) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>{clock(progress.at)}</span>
            <span>sample {clock(progress.of)}</span>
          </div>
        </div>
      )}
      {(also.length > 0 || post.page_url) && (
        <p className="-mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
          <span>Or open in</span>
          {also.map(([p, name], i) => (
            <span key={p}>
              {i > 0 && <span className="mr-1.5 opacity-50">·</span>}
              <a href={links[p]} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                {name}
              </a>
            </span>
          ))}
          {post.page_url && (
            <span>
              {also.length > 0 && <span className="mr-1.5 opacity-50">·</span>}
              <a href={post.page_url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                {also.length ? "more apps" : "your music app"}
              </a>
            </span>
          )}
        </p>
      )}
      {embed && embedOpen && (
        <iframe
          title={embed.platform === "spotify" ? "Spotify player" : "Player"}
          src={embed.src}
          height={embed.height}
          className="rise-in w-full rounded-2xl border-0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}
    </div>
  );
}
