"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { embedFor } from "@/lib/songs";
import type { Post } from "@/lib/types";
import type { SpotifyConnect } from "./api";

// One shared audio element for 30-second previews, so starting one song
// stops the last. Spotify's player claims the same slot with its own stop.
type PreviewState = {
  key: string | null;
  at: number;
  play(key: string, url: string): void;
  claim(key: string, stop: () => void): void;
  stop(): void;
  connect: (SpotifyConnect & { linked: boolean }) | null;
};
const Ctx = createContext<PreviewState | null>(null);

export function PreviewProvider({
  children,
  connect,
}: {
  children: React.ReactNode;
  connect: (SpotifyConnect & { linked: boolean }) | null;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const other = useRef<(() => void) | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    a.addEventListener("timeupdate", () => setAt(a.currentTime));
    a.addEventListener("ended", () => {
      setKey(null);
      setAt(0);
    });
    a.addEventListener("error", () => setKey(null));
    audio.current = a;
    return () => a.pause();
  }, []);

  const silence = useCallback(() => {
    audio.current?.pause();
    other.current?.();
    other.current = null;
  }, []);

  const stop = useCallback(() => {
    silence();
    setKey(null);
    setAt(0);
  }, [silence]);

  const claim = useCallback(
    (k: string, stopIt: () => void) => {
      silence();
      other.current = stopIt;
      setAt(0);
      setKey(k);
    },
    [silence],
  );

  const play = useCallback(
    (k: string, url: string) => {
      const a = audio.current;
      if (!a) return;
      silence();
      a.src = url;
      a.currentTime = 0;
      setAt(0);
      setKey(k);
      a.play().catch(() => setKey(null));
    },
    [silence],
  );

  return <Ctx.Provider value={{ key, at, play, claim, stop, connect }}>{children}</Ctx.Provider>;
}

export function usePreview() {
  return useContext(Ctx)!;
}

// Spotify's iFrame API lets our own play button drive its player, which we
// keep out of sight. https://developer.spotify.com/documentation/embeds/references/iframe-api
type SpotifyUpdate = { data: { isPaused: boolean; isBuffering: boolean; position: number; duration: number } };
type SpotifyController = {
  play(): void;
  resume(): void;
  pause(): void;
  destroy(): void;
  addListener(event: "ready", cb: () => void): void;
  addListener(event: "playback_update", cb: (e: SpotifyUpdate) => void): void;
};
type SpotifyApi = {
  createController(el: HTMLElement, opts: { uri: string; width: string; height: number }, cb: (c: SpotifyController) => void): void;
};
let spotifyApi: Promise<SpotifyApi> | null = null;
function loadSpotify() {
  spotifyApi ??= new Promise((resolve) => {
    (window as unknown as { onSpotifyIframeApiReady(api: SpotifyApi): void }).onSpotifyIframeApiReady = resolve;
    const tag = document.createElement("script");
    tag.src = "https://open.spotify.com/embed/iframe-api/v1";
    tag.async = true;
    document.body.appendChild(tag);
  });
  return spotifyApi;
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

// One play button. Anyone who linked Spotify hears the song start on their
// own Spotify app (Spotify Connect), whole, if they have Premium. Otherwise
// Spotify songs play through Spotify's player, hidden: anyone
// signed in to Spotify in this browser hears the whole song, everyone else
// Spotify's 30 seconds. If a browser won't let our button start it (some
// phones insist on a tap inside Spotify's own player), the player shows up
// below so it can be tapped. Songs from elsewhere use our 30-second preview,
// then that platform's player.
export function SongPlayer({
  post,
  id,
  big = false,
  extra,
}: {
  post: Post;
  id: string;
  big?: boolean;
  extra?: React.ReactNode;
}) {
  const pv = usePreview();
  const [embedOpen, setEmbedOpen] = useState(false);
  const embed = embedFor(post.platform_links ?? {}, post.song_url);
  const uri = embed?.platform === "spotify" ? embed.src.match(/\/embed\/(track|album)\/([A-Za-z0-9]+)/) : null;
  const spotifyUri = uri ? `spotify:${uri[1]}:${uri[2]}` : null;

  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<Promise<SpotifyController> | null>(null);
  const started = useRef(false);
  const [sp, setSp] = useState({ playing: false, position: 0, duration: 0 });
  const [waiting, setWaiting] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  // Spotify Connect: where it's playing and how far along
  const connect = pv.connect?.linked && spotifyUri ? pv.connect : null;
  const [cx, setCx] = useState<{ device: string; playing: boolean; position: number; duration: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const controller = useCallback(() => {
    if (!spotifyUri || !host.current) return null;
    const el = document.createElement("div");
    host.current.appendChild(el);
    ctl.current ??= loadSpotify().then(
      (api) =>
        new Promise<SpotifyController>((resolve) =>
          api.createController(el, { uri: spotifyUri, width: "100%", height: 80 }, (c) => {
            c.addListener("playback_update", (e) => {
              const { isPaused, position, duration } = e.data;
              setSp({ playing: !isPaused, position, duration });
              if (!isPaused) {
                setWaiting(false);
                setShowPlayer(false);
              }
            });
            resolve(c);
          }),
        ),
    );
    return ctl.current;
  }, [spotifyUri]);

  // the big card gets Spotify ready as soon as it opens, so play is instant
  useEffect(() => {
    if (big) controller();
  }, [big, controller]);
  useEffect(
    () => () => {
      ctl.current?.then((c) => c.destroy());
      ctl.current = null;
    },
    [],
  );
  // another song started
  useEffect(() => {
    if (pv.key !== id) ctl.current?.then((c) => c.pause());
  }, [pv.key, id]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => {
      setWaiting(false);
      setShowPlayer(true);
    }, 3500);
    return () => clearTimeout(t);
  }, [waiting]);

  // Connect playback ticks along here and checks in with Spotify now and then
  const cxPlaying = Boolean(cx?.playing);
  useEffect(() => {
    if (!cxPlaying || !connect || !spotifyUri) return;
    let n = 0;
    const t = setInterval(() => {
      n++;
      setCx((c) => {
        if (!c?.playing) return c;
        const position = c.position + 1000;
        return c.duration && position >= c.duration ? { ...c, playing: false, position: c.duration } : { ...c, position };
      });
      if (n % 15 === 0 || n === 1)
        connect.now().then((now) => {
          if (!now) return;
          setCx((c) =>
            c && now.uri === spotifyUri
              ? { ...c, playing: now.playing, position: now.position, duration: now.duration || c.duration }
              : c && { ...c, playing: false },
          );
        });
    }, 1000);
    return () => clearInterval(t);
  }, [cxPlaying, connect, spotifyUri]);

  const previewOn = pv.key === id && !spotifyUri;
  const connectOn = pv.key === id && cxPlaying;
  const spotifyOn = pv.key === id && Boolean(spotifyUri) && (sp.playing || waiting || connectOn);
  const canPlay = Boolean(embed || post.preview_url);
  const size = big ? 54 : 44;
  const playing = embedOpen || previewOn || spotifyOn;

  // Spotify's own player, hidden, driven by our button
  const playEmbed = () => {
    const c = controller();
    if (!c) return;
    pv.claim(id, () => {
      ctl.current?.then((x) => x.pause());
    });
    setWaiting(true);
    c.then((x) => {
      if (started.current) x.resume();
      else x.play();
      started.current = true;
    });
  };

  const toggle = () => {
    if (playing) {
      setEmbedOpen(false);
      setWaiting(false);
      pv.stop();
      return;
    }
    if (connect && spotifyUri) {
      setNote(null);
      pv.claim(id, () => {
        connect.pause();
        setCx((c) => c && { ...c, playing: false });
      });
      // pick up where it was paused
      const from = cx && cx.duration && cx.position < cx.duration - 2000 ? cx.position : 0;
      setCx({ device: cx?.device ?? "", playing: true, position: from, duration: cx?.duration ?? 0 });
      connect.play(spotifyUri, from).then((r) => {
        if ("ok" in r) return setCx((c) => c && { ...c, device: r.device });
        setCx(null);
        if (r.error === "no-device") setNote("Open Spotify on your phone or computer, then press play again to hear the whole song there.");
        if (r.error === "premium") setNote("Whole songs need Spotify Premium, so this is Spotify's preview.");
        playEmbed();
      });
    } else if (spotifyUri) {
      playEmbed();
    } else if (post.preview_url) {
      pv.play(id, post.preview_url);
    } else if (embed) {
      pv.stop();
      setEmbedOpen(true);
    }
  };


  const progress = cx
    ? cx.duration > 0
      ? { at: cx.position, of: cx.duration, preview: false }
      : null
    : spotifyUri
    ? sp.duration > 0 && (spotifyOn || sp.position > 0)
      ? { at: sp.position, of: sp.duration, preview: sp.duration <= 31_000 }
      : null
    : previewOn
      ? { at: pv.at * 1000, of: 30_000, preview: true }
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        {canPlay && (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
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
            <span>{progress.preview ? `preview ${clock(progress.of)}` : clock(progress.of)}</span>
          </div>
        </div>
      )}
      {spotifyUri && (
        <div
          ref={host}
          aria-hidden={!showPlayer}
          className={showPlayer ? "rise-in overflow-hidden rounded-xl" : "pointer-events-none fixed left-0 top-0 -z-10 h-20 w-[300px] opacity-0"}
        />
      )}
      {cx && connectOn && cx.device && <p className="-mt-1 text-[11px] text-muted">Playing on {cx.device}</p>}
      {note && <p className="-mt-1 text-[11px] text-muted">{note}</p>}
      {big && spotifyUri && pv.connect && !pv.connect.linked && (
        <a href="/spotify/connect" className="-mt-1 self-start text-[11px] font-semibold text-muted underline underline-offset-4">
          Hear whole songs: connect Spotify
        </a>
      )}
      {showPlayer && <p className="-mt-1 text-[11px] text-muted">This browser needs one tap on Spotify&apos;s play button to start.</p>}
      {embed && embedOpen && !spotifyUri && (
        <iframe
          title="Player"
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
