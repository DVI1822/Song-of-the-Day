"use client";

import { useState } from "react";
import { embedFor, PLATFORM_NAMES, type PlatformLinks } from "@/lib/songs";

// A play button that opens the song's own platform player.
export function Player({
  links,
  songUrl,
  pageUrl,
  size = 54,
}: {
  links: PlatformLinks;
  songUrl: string;
  pageUrl?: string | null;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const embed = embedFor(links, songUrl);

  if (!embed) {
    return (
      <a
        href={pageUrl ?? songUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-white"
      >
        Listen
      </a>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Hide player" : "Play"}
          className="flex flex-none items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-deep"
          style={{ width: size, height: size }}
        >
          {open ? (
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          )}
        </button>
        {pageUrl && (
          <a href={pageUrl} target="_blank" rel="noreferrer" className="text-xs text-muted underline-offset-4 hover:underline">
            Open in your app
          </a>
        )}
      </div>
      {open && (
        <iframe
          title={`${PLATFORM_NAMES[embed.platform]} player`}
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
