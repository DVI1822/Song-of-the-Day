"use client";

import { useEffect, useState } from "react";
import { inviteUrl } from "@/lib/invite";
import type { Post } from "@/lib/types";
import { CloseIcon } from "./ui";

// Your song as an Instagram Story: a 9:16 picture of it on the globe, with
// your invite link to stick on top. Sites can't post to Instagram, so the
// picture goes through the phone's share sheet (Instagram is in it) and the
// link goes on with Instagram's own link sticker.

type Story = { file: File; url: string } | "failed" | null;

// Fetched as soon as the song opens, so the share tap still counts as a tap
// when the sheet hands the file over (iPhone drops shares that wait).
export function useStory(username: string, post: Post, on: boolean) {
  const [story, setStory] = useState<Story>(null);
  useEffect(() => {
    if (!on) return;
    let url = "";
    let live = true;
    fetch(`/join/${username}/story?post=${post.id}`)
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setStory({ file: new File([blob], "song-of-the-day.png", { type: "image/png" }), url });
      })
      .catch(() => live && setStory("failed"));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [username, post.id, on]);
  return story;
}

export function ShareSheet({ story, username, onClose }: { story: Story; username: string; onClose(): void }) {
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
            style={{ height: "min(46vh, 420px)", aspectRatio: "9 / 16", boxShadow: "0 24px 60px -24px rgba(13,42,63,0.6)" }}
          >
            {ready ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ready.url} alt="Your song on the globe, as a Story" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-white/70">
                {story === "failed" ? "Couldn't make the picture. Try again in a moment." : "Making your Story…"}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-1 pt-2 text-center text-[12px] leading-snug text-muted">
          {note ?? "Pick Instagram, then Story. Add a Link sticker with your link so people can join."}
        </div>

        <div className="flex gap-2 px-4 pb-4 pt-2">
          {canShare || !ready ? (
            <button type="button" onClick={share} disabled={!ready} className={`${pill} bg-accent text-white disabled:opacity-50`}>
              <ShareIcon />
              Share to Instagram
            </button>
          ) : (
            <a href={ready.url} download="song-of-the-day.png" className={`${pill} bg-accent text-white`}>
              <ShareIcon />
              Save picture
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
