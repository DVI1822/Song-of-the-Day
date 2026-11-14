"use client";

import type { CSSProperties } from "react";
import { paintedCover } from "./math";
import { initials } from "@/lib/day";
import { coverAt } from "@/lib/cover";

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
  // Big covers (an opened song) sit on the copy the Globe's tile already
  // loaded, so the real artwork is there from the first frame and only
  // sharpens when the full-size one arrives, instead of a blank painted
  // square for as long as the download takes.
  const under = src && size > 200 ? `url("${coverAt(src, 200).replace(/"/g, "%22")}") center / cover, ` : "";
  return (
    <div
      className={`relative flex-none overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: coverRadius(size), background: under + paintedCover(seed), ...style }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverAt(src, size)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading={size > 200 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
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

// Someone's little circle in a list: their picture if they've chosen one,
// otherwise their initials.
export function Face({
  p,
  size = 34,
  tone = "coral",
  className = "",
}: {
  p: { display_name: string; avatar_url?: string | null } | null | undefined;
  size?: number;
  tone?: "coral" | "sea";
  className?: string;
}) {
  const name = p?.display_name ?? "?";
  const url = p?.avatar_url;
  const bg = tone === "sea" ? "linear-gradient(135deg, #DDE3F5, #A9DCD6)" : "linear-gradient(135deg, #FFE1D6, #F6A9A0)";
  return (
    <span
      className={`flex flex-none items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.32)),
        background: url ? `center / cover no-repeat url("${url}"), ${bg}` : bg,
        color: tone === "sea" ? "#245866" : "#8A2A22",
      }}
      role={url ? "img" : undefined}
      aria-label={url ? name : undefined}
    >
      {!url && initials(name)}
    </span>
  );
}

// The left tabs' icons (GlobeApp), also drawn in the key.
export function TabIcon({ name }: { name: "friends" | "find" | "songs" }) {
  const p = { "aria-hidden": true, width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (name === "friends")
    return (
      <svg {...p}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.5c2.6 0 4.6 1.6 5.5 4.5" />
      </svg>
    );
  if (name === "find")
    return (
      <svg {...p}>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5.5 5.5" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

// Bring the songs to the front: the button at the globe's bottom right.
export const RecenterIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </svg>
);
