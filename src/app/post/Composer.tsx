"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { createPost, previewSong } from "@/app/actions";
import { Artwork } from "@/components/Artwork";
import { Card, buttonClass, inputClass } from "@/components/Shell";
import type { ResolvedSong } from "@/lib/songs";

const MAX = 100;

export function Composer({ redoUsed }: { redoUsed: boolean }) {
  const [link, setLink] = useState("");
  const [song, setSong] = useState<ResolvedSong | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [caption, setCaption] = useState("");
  const [lookupError, setLookupError] = useState<string>();
  const [looking, startLookup] = useTransition();
  const [state, post, posting] = useActionState(createPost, undefined);
  const lastLookup = useRef("");

  function lookup(url: string) {
    const trimmed = url.trim();
    if (!trimmed || trimmed === lastLookup.current) return;
    lastLookup.current = trimmed;
    setLookupError(undefined);
    startLookup(async () => {
      const res = await previewSong(trimmed);
      if (res.song) {
        setSong(res.song);
        setTitle(res.song.title);
        setArtist(res.song.artist);
      } else {
        setSong(null);
        setLookupError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Paste a song link</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://open.spotify.com/track/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => lookup(e.clipboardData.getData("text"))}
            onBlur={() => lookup(link)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookup(link))}
            className={inputClass}
          />
        </label>
        <p className="mt-2 text-xs text-card-muted">
          Spotify, Apple Music, YouTube, SoundCloud, Tidal or Deezer. We&apos;ll find the cover and match it on every
          platform.
        </p>
        {looking && <p className="mt-3 text-sm text-card-muted">Finding your song…</p>}
        {lookupError && <p className="mt-3 text-sm text-accent-deep">{lookupError}</p>}
      </Card>

      {song && (
        <form action={post} className="rise-in flex flex-col gap-5">
          <div className="mx-auto w-full max-w-[350px] overflow-hidden rounded-[9%] shadow-[0_40px_90px_-30px_rgba(47,111,126,0.9)]">
            <Artwork src={song.artworkUrl} alt={`Cover of ${title}`} className="aspect-square w-full" />
          </div>
          <Card className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-card-muted">Title</span>
                <input name="title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-card-muted">Artist</span>
                <input name="artist" maxLength={200} value={artist} onChange={(e) => setArtist(e.target.value)} className={inputClass} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between text-xs font-semibold text-card-muted">
                <span>Caption (shows on the back of the cover)</span>
                <span className={caption.length > MAX - 10 ? "text-accent-deep" : ""}>
                  {caption.length}/{MAX}
                </span>
              </span>
              <textarea
                name="caption"
                maxLength={MAX}
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Where were you when it hit?"
                className={`${inputClass} h-auto resize-none py-3`}
              />
            </label>
            <input type="hidden" name="song_url" value={song.songUrl} />
            <input type="hidden" name="page_url" value={song.pageUrl ?? ""} />
            <input type="hidden" name="artwork_url" value={song.artworkUrl ?? ""} />
            <input type="hidden" name="links" value={JSON.stringify(song.links)} />
            {redoUsed && <p className="text-xs text-card-muted">You&apos;ve used today&apos;s redo, so this one is final.</p>}
            {state?.error && <p className="text-sm text-accent-deep">{state.error}</p>}
            <button className={buttonClass} disabled={posting}>
              {posting ? "Sharing…" : "Share today's song"}
            </button>
          </Card>
        </form>
      )}
    </div>
  );
}
