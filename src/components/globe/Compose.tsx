"use client";

import { useEffect, useRef, useState } from "react";
import type { ResolvedSong } from "@/lib/songs";
import type { Post } from "@/lib/types";
import { shrinkPhoto, type GlobeApi } from "./api";
import { Cover, CloseIcon, coverRadius } from "./ui";

type Step = "paste" | "finding" | "ready" | "posting";

const LinkIcon = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-none opacity-70">
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

// The sheet for today's song: paste a link, the song fills itself in, add an
// optional comment and photo, post.
export function Compose({
  api,
  userId,
  onClose,
  onPosted,
}: {
  api: GlobeApi;
  userId: string;
  onClose(): void;
  onPosted(post: Post): void;
}) {
  const [step, setStep] = useState<Step>("paste");
  const [url, setUrl] = useState("");
  const [song, setSong] = useState<ResolvedSong | null>(null);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canPaste, setCanPaste] = useState(() => typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
  const fileRef = useRef<HTMLInputElement>(null);
  const asked = useRef("");

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.preview)), [photo]);

  const find = async (raw: string) => {
    const link = raw.trim();
    if (!/^https?:\/\/\S+$/i.test(link) || asked.current === link) return;
    asked.current = link;
    setUrl(link);
    setError(null);
    setStep("finding");
    const r = await api.previewSong(link);
    if (asked.current !== link) return;
    if (r.song) {
      setSong(r.song);
      setStep("ready");
    } else {
      setError(r.error ?? "Couldn't find that song.");
      setStep("paste");
      asked.current = "";
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        find(text);
      }
    } catch {
      setCanPaste(false);
    }
  };

  const post = async () => {
    if (!song) return;
    setStep("posting");
    setError(null);
    let photoUrl: string | null = null;
    if (photo) {
      const up = await api.uploadPhoto(userId, await shrinkPhoto(photo.file));
      if (!up.url) {
        setError(up.error ?? "Couldn't upload the photo.");
        setStep("ready");
        return;
      }
      photoUrl = up.url;
    }
    const r = await api.createPost({
      songUrl: song.songUrl,
      pageUrl: song.pageUrl,
      title: song.title,
      artist: song.artist,
      album: song.album,
      artworkUrl: song.artworkUrl,
      previewUrl: song.previewUrl,
      links: song.links,
      caption: draft.trim(),
      photoUrl,
    });
    if (r.post) onPosted(r.post);
    else {
      setError(r.error ?? "Couldn't post. Try again.");
      setStep("ready");
    }
  };

  const linked = step !== "paste";

  return (
    <div className="fixed inset-0 z-[520] flex flex-col justify-end bg-card-ink/[0.18]">
      <button type="button" aria-label="Cancel" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        className="rise-in relative mx-3 mb-[max(12px,env(safe-area-inset-bottom))] flex w-auto flex-col gap-3.5 self-stretch rounded-[30px] px-[18px] pb-5 pt-4 text-card-ink sm:mx-auto sm:w-[420px]"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(13,42,63,0.08)",
          boxShadow: "0 -10px 50px -20px rgba(13,42,63,0.35)",
        }}
      >
        <div className="flex items-center">
          <div className="display text-[19px]">Today&apos;s song</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-my-2 -mr-2.5 ml-auto flex h-11 w-11 items-center justify-center"
          >
            <CloseIcon />
          </button>
        </div>

        <label className="flex h-[50px] items-center gap-2.5 rounded-2xl border border-card-ink/12 bg-card-ink/[0.04] pl-4 pr-1.5">
          <LinkIcon />
          <input
            value={url}
            readOnly={linked}
            onChange={(e) => {
              setUrl(e.target.value);
              find(e.target.value);
            }}
            onFocus={(e) => linked && e.currentTarget.select()}
            placeholder="Paste a song link"
            aria-label="Song link"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-full min-w-0 flex-1 truncate bg-transparent text-base outline-none placeholder:text-muted read-only:text-[13px] read-only:text-muted"
          />
          {!linked && canPaste && (
            <button type="button" onClick={paste} className="h-[38px] rounded-xl bg-accent px-4 text-[13px] font-semibold text-white">
              Paste
            </button>
          )}
          {linked && step !== "posting" && (
            <button
              type="button"
              aria-label="Use a different link"
              onClick={() => {
                asked.current = "";
                setUrl("");
                setSong(null);
                setStep("paste");
              }}
              className="flex h-[38px] w-[38px] items-center justify-center text-muted"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </label>

        {step === "finding" && (
          <div className="flex items-center gap-3.5 py-0.5">
            <div className="h-[76px] w-[76px] flex-none animate-pulse bg-card-ink/10" style={{ borderRadius: coverRadius(76) }} />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-[70%] animate-pulse rounded-md bg-card-ink/10" />
              <div className="h-2.5 w-1/2 animate-pulse rounded-md bg-card-ink/10" />
              <div className="h-2.5 w-2/5 animate-pulse rounded-md bg-card-ink/10" />
            </div>
          </div>
        )}

        {song && (step === "ready" || step === "posting") && (
          <>
            <div className="flex items-center gap-3.5">
              <Cover src={song.artworkUrl} seed={song.title} size={76} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="display truncate text-lg leading-tight">{song.title}</div>
                <div className="truncate text-[13px]">{song.artist}</div>
                {song.album && <div className="truncate text-xs text-muted">{song.album}</div>}
              </div>
            </div>
            <div className="flex items-stretch gap-2.5">
              <div className="relative flex-1 rounded-2xl border border-card-ink/12 bg-card-ink/[0.04] px-3.5 pb-[22px] pt-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 100))}
                  maxLength={100}
                  placeholder="Add a comment"
                  aria-label="Comment, optional, up to 100 characters"
                  className="block h-[52px] w-full resize-none bg-transparent text-base leading-snug outline-none placeholder:text-muted sm:text-sm"
                />
                <div className="absolute bottom-2 right-3 text-[10px] text-muted">{draft.length}/100</div>
              </div>
              {photo ? (
                <div className="relative w-[86px] flex-none overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.preview} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    aria-label="Remove photo"
                    className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(2,17,20,0.7)] text-white">
                      <CloseIcon size={10} />
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Add a photo"
                  className="flex w-[86px] flex-none flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-card-ink/25 text-[11px] font-semibold text-muted"
                >
                  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="15" rx="3" />
                    <circle cx="12" cy="12.5" r="3.5" />
                    <path d="M8 5l1.5-2h5L16 5" />
                  </svg>
                  Photo
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) setPhoto({ file, preview: URL.createObjectURL(file) });
                }}
              />
            </div>
            <button
              type="button"
              onClick={post}
              disabled={step === "posting"}
              className="h-[52px] rounded-[26px] bg-accent text-[15px] font-semibold text-white disabled:opacity-70"
            >
              {step === "posting" ? "Posting…" : "Post"}
            </button>
          </>
        )}
        {error && <p className="-mt-1 px-1 text-[13px] text-accent-deep">{error}</p>}
      </div>
    </div>
  );
}
