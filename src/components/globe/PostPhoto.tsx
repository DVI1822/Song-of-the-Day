"use client";

import { useEffect, useRef, useState } from "react";
import { glass } from "./ui";

// The photo on your own song today, after it's posted. Bottom right of the
// cover, across from the redo. With no photo yet, the camera adds one (from
// either side of the card). Once there's a photo, the camera shows on the
// back beside it, to swap it for another or take it off. None of this uses
// up the redo: the song stays, only its photo changes.
export function PhotoButton({
  has,
  flipped,
  onPhoto,
  onAdded,
}: {
  has: boolean;
  flipped: boolean;
  // a file to add or swap in, or null to take it off; an error if it failed
  onPhoto(file: File | null): Promise<string | undefined>;
  // a photo went on: turn the card over so you can see it
  onAdded(): void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<"add" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // the menu folds back up if you leave it
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 5000);
    return () => clearTimeout(t);
  }, [asking]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  if (has && !flipped && !busy) return null;

  const run = async (file: File | null) => {
    setAsking(false);
    setError(null);
    setBusy(file ? "add" : "remove");
    const err = await onPhoto(file).catch(() => "Couldn't change the photo. Try again.");
    setBusy(null);
    if (err) setError(err);
    else if (file && !flipped) onAdded();
  };
  const pick = () => fileRef.current?.click();

  return (
    <div data-motion className="absolute bottom-3 right-3 z-[2] flex max-w-[calc(100%-76px)] flex-col items-end gap-1.5">
      {error && (
        <span role="status" className="rise-in rounded-2xl px-3 py-1.5 text-right text-[12px] leading-snug text-accent-deep" style={glass(false)}>
          {error}
        </span>
      )}
      {asking && has && flipped && (
        <div className="rise-in flex flex-col overflow-hidden rounded-2xl text-[14px] font-semibold" style={glass(false)}>
          <button type="button" onClick={pick} className="px-4 py-2.5 text-left">
            New photo
          </button>
          <div className="h-px bg-card-ink/10" />
          <button type="button" onClick={() => run(null)} className="px-4 py-2.5 text-left text-accent-deep">
            Remove photo
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={!!busy}
        onClick={(e) => {
          e.stopPropagation();
          if (has) setAsking((a) => !a);
          else pick();
        }}
        aria-label={has ? "Change or remove the photo" : "Add a photo to your song"}
        aria-expanded={has ? asking : undefined}
        className="pointer-events-auto flex h-10 items-center justify-center gap-1.5 rounded-full px-3"
        style={{ ...glass(false), minWidth: 40 }}
      >
        <CameraIcon />
        {busy && (
          <span className="text-[13px] font-semibold">{busy === "add" ? "Adding…" : "Removing…"}</span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) run(file);
        }}
      />
    </div>
  );
}

const CameraIcon = () => (
  <svg aria-hidden width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="15" rx="3" />
    <circle cx="12" cy="12.5" r="3.5" />
    <path d="M8 5l1.5-2h5L16 5" />
  </svg>
);
