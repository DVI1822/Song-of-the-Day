"use client";

import { useEffect, useRef, useState } from "react";
import { inviteUrl } from "@/lib/invite";
import type { Post } from "@/lib/types";
import { H_STORY, SECONDS, SKIES, type StorySky, W_STORY, drawFrame, prepare, videoType } from "./storyVideo";
import { CloseIcon } from "./ui";

// Your song as an Instagram Story: a short video of your globe turning under
// the sky you pick (it starts on the one outside), with your invite link to
// stick on top. Sites can't post to Instagram, so the video goes through the
// phone's share sheet (Instagram is in it) and the link goes on with
// Instagram's own link sticker. Where the browser can't record video, it's a
// picture.

type Made = { file: File; url: string; video: boolean };
type Story = Made | "failed" | null;

export type StoryOf = { songs: Post[]; colors: string[] | null; sky(): StorySky };

// Draws the Story into the canvas while it records, so the preview is the
// recording. The file is ready before the share tap, since iPhone drops
// shares that wait.
function useStory(canvas: React.RefObject<HTMLCanvasElement | null>, post: Post, name: string, of: StoryOf, sky: StorySky) {
  const [story, setStory] = useState<{ sky: StorySky; story: Story; at: number }>({ sky, story: null, at: 0 });
  useEffect(() => {
    let live = true,
      raf = 0,
      url = "",
      rec: MediaRecorder | null = null;
    const done = (s: Story) => live && setStory({ sky, story: s, at: 1 });
    const still = async () => {
      const blob = await new Promise<Blob | null>((r) => canvas.current!.toBlob(r, "image/png"));
      if (!blob) throw new Error("no picture");
      return blob;
    };
    (async () => {
      const c = canvas.current!;
      const ctx = c.getContext("2d")!;
      const s = await prepare({ post, name, songs: of.songs, colors: of.colors, sky });
      if (!live) return;
      drawFrame(ctx, s, 0);
      const type = videoType();
      if (!type) {
        const blob = await still();
        url = URL.createObjectURL(blob);
        return done({ file: new File([blob], "song-of-the-day.png", { type: "image/png" }), url, video: false });
      }
      const chunks: Blob[] = [];
      rec = new MediaRecorder(c.captureStream(30), { mimeType: type, videoBitsPerSecond: 8_000_000 });
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((r) => (rec!.onstop = () => r()));
      rec.start(500);
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = (now - t0) / 1000;
        drawFrame(ctx, s, Math.min(t, SECONDS));
        if (live) setStory((p) => (p.sky === sky && !p.story ? { ...p, at: Math.min(1, t / SECONDS) } : p));
        if (t < SECONDS) raf = requestAnimationFrame(tick);
        else rec!.stop();
      };
      raf = requestAnimationFrame(tick);
      await stopped;
      if (!live) return;
      const blob = new Blob(chunks, { type: "video/mp4" });
      if (!blob.size) throw new Error("empty video");
      url = URL.createObjectURL(blob);
      done({ file: new File([blob], "song-of-the-day.mp4", { type: "video/mp4" }), url, video: true });
    })().catch(() => done("failed"));
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      if (rec && rec.state !== "inactive") rec.stop();
      if (url) URL.revokeObjectURL(url);
    };
    // the songs and colours are read once when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, sky]);
  return story.sky === sky ? story : { sky, story: null as Story, at: 0 };
}

export function ShareSheet({
  post,
  name,
  username,
  of,
  initialSky,
  onClose,
}: {
  post: Post;
  name: string;
  username: string;
  of: StoryOf;
  initialSky: StorySky;
  onClose(): void;
}) {
  const [sky, setSky] = useState(initialSky);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { story, at } = useStory(canvas, post, name, of, sky);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const link = inviteUrl(typeof window === "undefined" ? "" : window.location.origin, username);
  const ready = story && story !== "failed" ? story : null;
  const canShare = !!ready && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [ready.file] });

  const share = async () => {
    if (!ready) return;
    // the link rides along on the clipboard, ready for the sticker; neither
    // waits, so both still count as part of the tap
    navigator.clipboard?.writeText(link).catch(() => {});
    await navigator.share({ files: [ready.file] }).catch(() => {});
    setNote("Your link's copied. In Instagram, add a Link sticker and paste it.");
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const pill = "flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold";

  return (
    <div className="fixed inset-0 z-[490] flex flex-col justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-[#0D2A3F]/30" />
      <div
        role="dialog"
        aria-label="Share to your Story"
        className="rise-in relative mx-auto flex w-full max-w-[520px] flex-col rounded-t-[28px] border border-white/60 bg-white/[0.92] text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 -20px 60px -30px rgba(13,42,63,0.45)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="display text-xl">Share to your Story</div>
            <div className="truncate text-xs text-muted">Friends tap the link and land on your globe</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center">
            <CloseIcon />
          </button>
        </div>

        <div className="flex justify-center px-5 py-2">
          <div
            className="relative overflow-hidden rounded-[18px] bg-[#0A1530]"
            style={{ height: "min(42vh, 400px)", aspectRatio: "9 / 16", boxShadow: "0 24px 60px -24px rgba(13,42,63,0.6)" }}
          >
            {/* drawn into while it records; then the finished video plays */}
            <canvas
              ref={canvas}
              width={W_STORY}
              height={H_STORY}
              aria-hidden
              className="absolute inset-0 h-full w-full"
              style={{ visibility: ready?.video ? "hidden" : "visible" }}
            />
            {ready?.video && (
              <video src={ready.url} autoPlay loop muted playsInline aria-label="Your song on the globe, as a Story" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {!ready && (
              <div className="absolute inset-x-3 bottom-3 overflow-hidden rounded-full bg-black/25 text-center text-[11px] text-white backdrop-blur">
                <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${Math.round(at * 100)}%` }} />
                <div className="relative py-1">{story === "failed" ? "Couldn't make it. Try another sky." : "Making your Story…"}</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-1.5 px-4 pt-2" role="radiogroup" aria-label="Sky">
          {SKIES.map((s) => (
            <button
              key={s.k}
              type="button"
              role="radio"
              aria-checked={sky === s.k}
              onClick={() => setSky(s.k)}
              className={`h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${sky === s.k ? "bg-card-ink text-white" : "bg-card-ink/[0.06]"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="px-5 pb-1 pt-3 text-center text-[12px] leading-snug text-muted">
          {note ?? "Pick Instagram, then Story. Add a Link sticker with your link so people can join."}
        </div>

        <div className="flex gap-2 px-4 pb-4 pt-2">
          {canShare || !ready ? (
            <button type="button" onClick={share} disabled={!ready} className={`${pill} bg-accent text-white disabled:opacity-50`}>
              <ShareIcon />
              Share to Instagram
            </button>
          ) : (
            <a href={ready.url} download={ready.file.name} className={`${pill} bg-accent text-white`}>
              <ShareIcon />
              {ready.video ? "Save video" : "Save picture"}
            </a>
          )}
          <button type="button" onClick={copy} className={`${pill} bg-card-ink/[0.06]`}>
            <LinkIcon />
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const ShareIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    aria-hidden
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
  </svg>
);
const LinkIcon = () => (
  <svg
    aria-hidden
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />
  </svg>
);
