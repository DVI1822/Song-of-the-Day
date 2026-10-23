"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { findYouTube } from "@/app/actions";
import { embedFor, youtubeId } from "@/lib/songs";
import type { Post } from "@/lib/types";

// One shared audio element for 30-second previews, so starting one song
// stops the last.
type PreviewState = { key: string | null; at: number; play(key: string, url: string): void; stop(): void };
const Ctx = createContext<PreviewState | null>(null);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
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

  const stop = useCallback(() => {
    audio.current?.pause();
    setKey(null);
    setAt(0);
  }, []);

  const play = useCallback((k: string, url: string) => {
    const a = audio.current;
    if (!a) return;
    a.src = url;
    a.currentTime = 0;
    setAt(0);
    setKey(k);
    a.play().catch(() => setKey(null));
  }, []);

  return <Ctx.Provider value={{ key, at, play, stop }}>{children}</Ctx.Provider>;
}

export function usePreview() {
  return useContext(Ctx)!;
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

export const ytEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

export function VideoFrame({ src, className = "" }: { src: string; className?: string }) {
  return (
    <iframe
      title="Song player"
      src={src}
      className={`border-0 bg-black ${className}`}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}

// Play plays the whole song, from YouTube. If no video can be found it falls
// back to the 30-second preview, then to the platform's own embed. `onVideo`
// lets the song card show the video where the cover is.
export function SongPlayer({
  post,
  id,
  big = false,
  extra,
  onVideo,
}: {
  post: Post;
  id: string;
  big?: boolean;
  extra?: React.ReactNode;
  onVideo?: (src: string | null) => void;
}) {
  const pv = usePreview();
  const [video, setVideo] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const known = youtubeId(post.platform_links?.youtube) ?? youtubeId(post.platform_links?.youtubeMusic);
  const searchable = !post.song_url.includes("song.link/demo");
  const embed = embedFor(post.platform_links ?? {}, post.song_url);
  const canPlay = Boolean(known || searchable || post.preview_url || embed);
  const previewOn = pv.key === id;
  const size = big ? 54 : 44;
  const sec = previewOn ? Math.floor(pv.at) : 0;
  const playing = Boolean(video) || previewOn || embedOpen;

  const showVideo = (src: string | null) => {
    setVideo(src);
    onVideo?.(src);
  };
  useEffect(() => () => onVideo?.(null), [onVideo]);

  const toggle = async () => {
    if (playing) {
      showVideo(null);
      setEmbedOpen(false);
      if (previewOn) pv.stop();
      return;
    }
    pv.stop();
    let vid = known;
    if (!vid && searchable) {
      setBusy(true);
      vid = await findYouTube(post.title, post.artist).catch(() => null);
      setBusy(false);
    }
    if (vid) showVideo(ytEmbed(vid));
    else if (post.preview_url) pv.play(id, post.preview_url);
    else if (embed) setEmbedOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        {canPlay && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-label={playing ? "Stop" : "Play the full song"}
            className="flex flex-none items-center justify-center rounded-full bg-accent text-white disabled:opacity-70"
            style={{ width: size, height: size }}
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : playing ? (
              <PauseIcon size={big ? 20 : 16} />
            ) : (
              <PlayIcon size={big ? 20 : 16} />
            )}
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
      {previewOn && (
        <div className="flex flex-col gap-1.5">
          <div className="relative h-[3px] overflow-hidden rounded-sm bg-card-ink/12">
            <div
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-300 ease-linear"
              style={{ width: `${Math.min(100, (pv.at / 30) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>0:{String(sec).padStart(2, "0")}</span>
            <span>preview 0:30</span>
          </div>
        </div>
      )}
      {video && !onVideo && <VideoFrame src={video} className="rise-in aspect-video w-full rounded-2xl" />}
      {embed && embedOpen && (
        <iframe
          title="Player"
          src={embed.src}
          height={embed.platform === "spotify" ? 80 : embed.height}
          className="rise-in w-full rounded-2xl border-0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )}
    </div>
  );
}
