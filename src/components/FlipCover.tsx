"use client";

import { useState } from "react";
import { Artwork } from "./Artwork";

// The big square cover. Tap it to flip over and read the caption.
export function FlipCover({
  artwork,
  title,
  caption,
  footer,
  className = "",
}: {
  artwork: string | null;
  title: string;
  caption: string;
  footer: string;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-label={flipped ? "Flip back to the cover" : "Flip the cover to read the caption"}
      className={`relative block aspect-square w-full cursor-pointer [perspective:1400px] ${className}`}
    >
      <div
        className="preserve-3d relative h-full w-full transition-transform duration-[800ms] ease-[cubic-bezier(.2,.75,.25,1)]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <div className="backface-hidden absolute inset-0 overflow-hidden shadow-[0_40px_90px_-30px_rgba(47,111,126,0.9),0_0_60px_-10px_rgba(217,255,248,0.33)]" style={{ borderRadius: "9%" }}>
          <Artwork src={artwork} alt={`Cover of ${title}`} className="h-full w-full" />
        </div>
        <div
          className="backface-hidden absolute inset-0 overflow-hidden"
          style={{ transform: "rotateY(180deg)", borderRadius: "9%" }}
        >
          <Artwork src={artwork} alt="" className="absolute inset-0 h-full w-full scale-110 blur-md" />
          <div className="absolute inset-0 bg-white/[0.88]" />
          <div className="absolute inset-[8%] flex flex-col justify-between text-left">
            <svg aria-hidden width="30" height="30" viewBox="0 0 24 24" fill="#D7262B">
              <path d="M4 18v-5c0-4 2-7 6-8l1 2c-2 1-3 2.5-3 4h3v7zm9 0v-5c0-4 2-7 6-8l1 2c-2 1-3 2.5-3 4h3v7z" />
            </svg>
            <p className="display text-[clamp(18px,6.5vw,26px)] leading-snug text-card-ink">
              {caption || <span className="text-card-muted">No caption today. Just the song.</span>}
            </p>
            <p className="text-xs text-card-muted">{footer}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
