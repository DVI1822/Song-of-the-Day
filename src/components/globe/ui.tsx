"use client";

import type { CSSProperties } from "react";
import { paintedCover } from "./math";

// Album covers everywhere share the tiles' rounded-square shape.
export const coverRadius = (px: number) => Math.max(2, Math.round(0.26 * px));

export function Cover({
  src,
  seed,
  size,
  className = "",
  style,
}: {
  src: string | null | undefined;
  seed: string;
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`relative flex-none overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: coverRadius(size), background: paintedCover(seed), ...style }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false} />
      )}
    </div>
  );
}

export const glass = (dark: boolean): CSSProperties => ({
  background: `rgba(255,255,255,${dark ? 0.93 : 0.78})`,
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(13,42,63,0.10)",
  boxShadow: "0 8px 30px -14px rgba(13,42,63,0.25)",
  color: "#0D2A3F",
});

export const glassThin = (dark: boolean): CSSProperties => ({
  background: `rgba(255,255,255,${dark ? 0.9 : 0.62})`,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(13,42,63,0.08)",
  boxShadow: "0 -10px 40px -24px rgba(13,42,63,0.3)",
  color: "#0D2A3F",
});

export const CloseIcon = ({ size = 18 }: { size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const BackIcon = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const SearchIcon = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-none opacity-70">
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5.5 5.5" />
  </svg>
);
