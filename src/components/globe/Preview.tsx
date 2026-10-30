"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { embedFor } from "@/lib/songs";
import type { Post } from "@/lib/types";
import type { SpotifyConnect } from "./api";

// What's playing, for the whole site. It lives in the root layout, so a song
// keeps going after you close its card or move to another page, until you
// pause it or start another. One shared audio element plays 30-second
// previews; Spotify (Connect, or its hidden player) claims the same slot with
// its own stop, so starting one song always stops the last.
export type ShuffleState = { list: Post[]; whole: boolean; now: Post; paused: boolean };
export type Track = { post: Post; paused: boolean; kind: "clip" | "connect" | "embed" };
type Controls = { pause(): void; resume(): void };
type EmbedState = { uri: string; playing: boolean; position: number; duration: number };
type Connect = (SpotifyConnect & { linked: boolean }) | null;
type PreviewState = {
  key: string | null;
  at: number;
  play(key: string, url: string, onEnd?: () => void, post?: Post): void;
  claim(key: string, stop: () => void, track?: { post: Post; kind: Track["kind"]; controls: Controls }): void;
  stop(): void;
  // the single song that's playing (or paused), for the mini player
  track: Track | null;
  toggle(): void;
  connect: Connect;
  setConnect(c: Connect): void;
  // Spotify's hidden player, kept here so it outlives the card that started it
  embed: EmbedState | null;
  embedShown: boolean;
  spotifyController(uri: string): Promise<SpotifyController>;
  showEmbed(on: boolean): void;
  // Shuffle all
  shuffle: ShuffleState | null;
  startShuffle(posts: Post[]): Promise<string | null>;
  shuffleNext(): void;
  shuffleToggle(): void;
  // the Globe shows its own player bar, so the mini player steps aside
  docked: boolean;
  setDocked(on: boolean): void;
  // how far into the 30-second preview we are, while it's what's playing (so
  // its beat can be followed); null for a whole song, which the site can't hear
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
  const other = useRef<(() => void) | null>(null);
  const ended = useRef<(() => void) | null>(null);
  const controls = useRef<Controls | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const embedCtl = useRef<{ uri: string; ctl: Promise<SpotifyController> } | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [track, setTrack] = useState<Track | null>(null);
  const [connect, setConnect] = useState<Connect>(null);
  const [embed, setEmbed] = useState<EmbedState | null>(null);
  const [embedShown, setEmbedShown] = useState(false);
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
    other.current?.();
    other.current = null;
    controls.current = null;
    setEmbedShown(false);
  }, []);

  const stop = useCallback(() => {
    silence();
    setKey(null);
    setAt(0);
    setShuffle(null);
    setTrack(null);
  }, [silence]);

  const claim = useCallback<PreviewState["claim"]>(
    (k, stopIt, t) => {
      silence();
      other.current = stopIt;
      controls.current = t?.controls ?? null;
      setAt(0);
      setKey(k);
      if (k !== SHUFFLE) setShuffle(null);
      setTrack(t ? { post: t.post, kind: t.kind, paused: false } : null);
    },
    [silence],
  );

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

  // One hidden Spotify player for the site; asking for another song swaps it.
  const spotifyController = useCallback((uri: string) => {
    if (embedCtl.current?.uri === uri) return embedCtl.current.ctl;
    embedCtl.current?.ctl.then((c) => c.destroy());
    const el = document.createElement("div");
    host.current?.replaceChildren(el);
    setEmbed(null);
    const ctl = loadSpotify().then(
      (api) =>
        new Promise<SpotifyController>((resolve) =>
          api.createController(el, { uri, width: "100%", height: 80 }, (c) => {
            c.addListener("playback_update", (e) => {
              const { isPaused, position, duration } = e.data;
              setEmbed({ uri, playing: !isPaused, position, duration });
              setTrack((t) => (t?.kind === "embed" && spotifyUriOf(t.post) === uri ? { ...t, paused: isPaused } : t));
              if (!isPaused) setEmbedShown(false);
            });
            resolve(c);
          }),
        ),
    );
    embedCtl.current = { uri, ctl };
    return ctl;
  }, []);

  // A whole song on Spotify Connect can be paused or end on the phone: check in.
  const connectPost = track?.kind === "connect" ? track.post : null;
  useEffect(() => {
    if (!connectPost || !connect) return;
    const uri = spotifyUriOf(connectPost);
    const t = setInterval(() => {
      connect.now().then((n) => {
        const paused = !(n && n.uri === uri && n.playing);
        setTrack((tr) => (tr?.post === connectPost && tr.paused !== paused ? { ...tr, paused } : tr));
      });
    }, 5000);
    return () => clearInterval(t);
  }, [connectPost, connect]);

  // Shuffle with previews: one clip after another until the list runs out.
  const clip = useCallback(
    (list: Post[], from: number) => {
      const go = (i: number) => {
        if (i >= list.length) return stop();
        play(SHUFFLE, list[i].preview_url!, () => go(i + 1));
        setShuffle({ list, whole: false, now: list[i], paused: false });
      };
      go(from);
    },
    [play, stop],
  );

  const startShuffle = useCallback(
    async (posts: Post[]) => {
      const order = shuffled(posts);
      const c = connect?.linked ? connect : null;
      const whole = order.filter((p) => spotifyUriOf(p)?.startsWith("spotify:track:"));
      if (c && whole.length) {
        const r = await c.playAll(whole.map((p) => spotifyUriOf(p)!));
        if ("ok" in r) {
          claim(SHUFFLE, () => void c.pause());
          setShuffle({ list: whole, whole: true, now: whole[0], paused: false });
          return null;
        }
        if (r.error === "no-device") return "Open Spotify on your phone or computer, then shuffle again to hear whole songs.";
        if (r.error === "not-here") return "Open the Spotify app on this device, then shuffle again to hear whole songs here.";
      }
      const list = order.filter((p) => p.preview_url);
      if (!list.length) return c ? null : "Connect Spotify in Settings to shuffle whole songs.";
      clip(list, 0);
      return null;
    },
    [connect, claim, clip],
  );

  const shuffleNext = useCallback(() => {
    if (!shuffle) return;
    const i = shuffle.list.findIndex((p) => p.id === shuffle.now.id);
    if (!shuffle.whole) return clip(shuffle.list, i + 1);
    void connect?.next();
    const now = shuffle.list[i + 1];
    if (now) setShuffle({ ...shuffle, now, paused: false });
  }, [shuffle, connect, clip]);

  const shuffleToggle = useCallback(() => {
    if (!shuffle) return;
    const paused = !shuffle.paused;
    if (shuffle.whole) void (paused ? connect?.pause() : connect?.resume());
    else if (paused) audio.current?.pause();
    else void audio.current?.play();
    setShuffle({ ...shuffle, paused });
  }, [shuffle, connect]);

  // Whole songs play on Spotify, which moves on by itself: now and then ask
  // it which song it's on, and whether it's paused.
  const whole = shuffle?.whole ? shuffle.list : null;
  useEffect(() => {
    if (!whole || !connect) return;
    const check = () =>
      connect.now().then((n) => {
        const now = n?.uri ? whole.find((p) => spotifyUriOf(p) === n.uri) : undefined;
        if (now) setShuffle((s) => (s?.list === whole ? { ...s, now, paused: !n!.playing } : s));
      });
    check();
    const t = setInterval(check, 4000);
    return () => clearInterval(t);
  }, [whole, connect]);

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
        claim,
        stop,
        track,
        toggle,
        connect,
        setConnect,
        embed,
        embedShown,
        spotifyController,
        showEmbed: setEmbedShown,
        shuffle,
        startShuffle,
        shuffleNext,
        shuffleToggle,
        docked,
        setDocked,
        clipTime,
      }}
    >
      {children}
      {/* Spotify's player, out of sight unless a browser insists on a tap */}
      <div
        ref={host}
        aria-hidden={!embedShown}
        className={
          embedShown
            ? "rise-in fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[950] mx-auto max-w-[420px] overflow-hidden rounded-xl"
            : "pointer-events-none fixed left-0 top-0 -z-10 h-20 w-[300px] opacity-0"
        }
      />
    </Ctx.Provider>
  );
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

// The spotify:track:… for a post, if it's a Spotify song.
export function spotifyUriOf(post: Pick<Post, "platform_links" | "song_url">) {
  const embed = embedFor(post.platform_links ?? {}, post.song_url);
  const m = embed?.platform === "spotify" ? embed.src.match(/\/embed\/(track|album)\/([A-Za-z0-9]+)/) : null;
  return m ? `spotify:${m[1]}:${m[2]}` : null;
}

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
// so it can be tapped. Songs from elsewhere use our 30-second preview,
// then that platform's player. The song keeps playing after this card closes.
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
  const mine = pv.key === key;
  const [embedOpen, setEmbedOpen] = useState(false);
  const embed = embedFor(post.platform_links ?? {}, post.song_url);
  const spotifyUri = spotifyUriOf(post);
  const sp = pv.embed && pv.embed.uri === spotifyUri ? pv.embed : null;
  const [waiting, setWaiting] = useState(false);
  // Spotify Connect: where it's playing and how far along
  const connect = pv.connect?.linked && spotifyUri ? pv.connect : null;
  const [cx, setCx] = useState<{ device: string; playing: boolean; position: number; duration: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { spotifyController, showEmbed } = pv;

  // the big card gets Spotify ready as soon as it opens, so play is instant,
  // unless Spotify's player is busy with another song
  const embedBusy = pv.track?.kind === "embed";
  useEffect(() => {
    if (big && spotifyUri && !connect && !embedBusy) spotifyController(spotifyUri);
  }, [big, spotifyUri, connect, embedBusy, spotifyController]);
  // it started: stop waiting (set during render, React's way to follow a prop)
  if (waiting && sp?.playing) setWaiting(false);
  // still not playing after a few seconds: show Spotify's player for a tap
  const stuck = waiting && !sp?.playing;
  useEffect(() => {
    if (!stuck) return;
    const t = setTimeout(() => {
      setWaiting(false);
      showEmbed(true);
    }, 3500);
    return () => clearTimeout(t);
  }, [stuck, showEmbed]);

  // Connect playback ticks along here and checks in with Spotify now and then
  const cxPlaying = Boolean(cx?.playing) && mine;
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

  const paused = mine && pv.track?.paused;
  const canPlay = Boolean(embed || post.preview_url);
  const size = big ? 54 : 44;
  const playing = embedOpen || (mine && !paused);

  // Spotify's own player, hidden, driven by our button
  const playEmbed = () => {
    if (!spotifyUri) return;
    const c = spotifyController(spotifyUri);
    const pause = () => void c.then((x) => x.pause());
    pv.claim(key, pause, { post, kind: "embed", controls: { pause, resume: () => void c.then((x) => x.resume()) } });
    setWaiting(true);
    c.then((x) => x.play());
  };

  const toggle = () => {
    if (embedOpen) return setEmbedOpen(false);
    // pause, or carry on, without losing your place
    if (mine && pv.track) {
      if (cx) setCx({ ...cx, playing: Boolean(paused) });
      return pv.toggle();
    }
    if (connect && spotifyUri) {
      setNote(null);
      const pause = () => {
        connect.pause();
        setCx((c) => c && { ...c, playing: false });
      };
      pv.claim(key, pause, { post, kind: "connect", controls: { pause, resume: () => void connect.resume() } });
      // pick up where it was paused
      const from = cx && cx.duration && cx.position < cx.duration - 2000 ? cx.position : 0;
      setCx({ device: cx?.device ?? "", playing: true, position: from, duration: cx?.duration ?? 0 });
      connect.play(spotifyUri, from).then((r) => {
        if ("ok" in r) return setCx((c) => c && { ...c, device: r.device });
        setCx(null);
        if (r.error === "no-device") setNote("Open Spotify on your phone or computer, then press play again to hear the whole song there.");
        if (r.error === "not-here") setNote("Open the Spotify app on this device, then press play again to hear the whole song here.");
        if (r.error === "premium") setNote("Whole songs need Spotify Premium, so this is Spotify's preview.");
        playEmbed();
      });
    } else if (spotifyUri) {
      playEmbed();
    } else if (post.preview_url) {
      pv.play(key, post.preview_url, undefined, post);
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
    ? sp && sp.duration > 0 && (mine || sp.position > 0)
      ? { at: sp.position, of: sp.duration, preview: sp.duration <= 31_000 }
      : null
    : mine
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
      {cx && cxPlaying && cx.device && <p className="-mt-1 text-[11px] text-muted">Playing on {cx.device}</p>}
      {note && <p className="-mt-1 text-[11px] text-muted">{note}</p>}
      {big && spotifyUri && pv.connect && !pv.connect.linked && (
        <a href="/spotify/connect" className="-mt-1 self-start text-[11px] font-semibold text-muted underline underline-offset-4">
          Hear whole songs: connect Spotify
        </a>
      )}
      {mine && pv.embedShown && (
        <p className="-mt-1 text-[11px] text-muted">This browser needs one tap on Spotify&apos;s play button, just below.</p>
      )}
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
