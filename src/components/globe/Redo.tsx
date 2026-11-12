"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { glass } from "./ui";

// Your one redo a day, from your own song's cover: two arrows chasing each
// other round on the cover's bottom left. One tap opens it out into "Redo
// today's song" (so a stray tap doesn't spend the day's redo), and a second tap
// pulls the cover into a point in its middle, like a singularity, before the
// paste sheet comes back for another song.

export const RedoArrows = ({ size = 19 }: { size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19.4 9.2A8 8 0 0 0 5.2 7.6" />
    <path d="M4.6 14.8a8 8 0 0 0 14.2 1.6" />
    <path d="M19.8 4.4v4.9h-4.9" />
    <path d="M4.2 19.6v-4.9h4.9" />
  </svg>
);

export function RedoButton({ error, onRedo }: { error: string | null; onRedo(): void }) {
  const [asking, setAsking] = useState(false);
  // turns once when the card opens, after the cover's toss
  const [turn, setTurn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTurn(true), 4200);
    return () => clearTimeout(t);
  }, []);
  // folds back up if you leave it
  useEffect(() => {
    if (!asking) return;
    const t = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(t);
  }, [asking]);

  const open = asking || !!error;
  return (
    <div data-motion className="absolute bottom-3 left-3 z-[2] flex max-w-[calc(100%-76px)] flex-col items-start gap-1.5">
      {error && (
        <span className="rise-in rounded-2xl px-3 py-1.5 text-[12px] leading-snug text-accent-deep" style={glass(false)}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (asking) onRedo();
          else setAsking(true);
        }}
        aria-label={asking ? "Yes, take it back and pick another song (your one redo today)" : "Redo today's song"}
        aria-expanded={open}
        className="pointer-events-auto flex h-10 items-center overflow-hidden rounded-full transition-[width] duration-300 ease-[cubic-bezier(.2,.75,.25,1)]"
        style={{ ...glass(false), width: open ? 180 : 40 }}
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center">
          <span
            className="flex"
            style={{
              animation: asking
                ? "redo-turn 0.7s cubic-bezier(.2,.75,.25,1) both"
                : turn
                  ? "redo-turn 1.1s cubic-bezier(.2,.75,.25,1) both"
                  : undefined,
            }}
          >
            <RedoArrows />
          </span>
        </span>
        <span
          className="whitespace-nowrap pr-4 text-[13px] font-semibold transition-opacity duration-200"
          style={{ opacity: open ? 1 : 0 }}
        >
          Redo today&apos;s song
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The singularity. While today's song is taken back, the cover (`target`)
// gives a small breath in, then gets pulled into a point in its middle,
// turning faster as it shrinks. The point flashes once and a thin ring
// ripples out from it, then it's gone.
// ---------------------------------------------------------------------------

const PULL = 900,
  POP = 520;
export const SINK_MS = PULL + POP;

export function Singularity({
  size,
  target,
  run,
  onDone,
}: {
  size: number;
  target: RefObject<HTMLDivElement | null>;
  run: number; // bumps to start
  onDone(): void;
}) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!run) return;
    const el = target.current;
    const anims: Animation[] = [];
    if (el?.animate) {
      anims.push(
        el.animate(
          [
            { transform: "scale(1) rotate(0deg)", filter: "brightness(1) blur(0px)", borderRadius: "3%", offset: 0 },
            { transform: "scale(1.04) rotate(4deg)", filter: "brightness(1) blur(0px)", borderRadius: "3%", offset: 0.14, easing: "cubic-bezier(.55,0,.9,.45)" },
            { transform: "scale(0) rotate(-300deg)", filter: "brightness(1.6) blur(2px)", borderRadius: "50%", offset: 1 },
          ],
          { duration: PULL, fill: "forwards" },
        ),
      );
    }
    if (dot.current?.animate)
      anims.push(
        dot.current.animate(
          [
            { transform: "scale(0)", opacity: 0, offset: 0 },
            { transform: "scale(0)", opacity: 0, offset: PULL / SINK_MS - 0.04 },
            { transform: "scale(1.5)", opacity: 1, offset: (PULL + 90) / SINK_MS, easing: "ease-in" },
            { transform: "scale(0)", opacity: 0, offset: 1 },
          ],
          { duration: SINK_MS, fill: "forwards" },
        ),
      );
    if (ring.current?.animate)
      anims.push(
        ring.current.animate(
          [
            { transform: "scale(0)", opacity: 0, offset: 0 },
            { transform: "scale(0)", opacity: 0.9, offset: PULL / SINK_MS },
            { transform: "scale(1)", opacity: 0, offset: 1, easing: "cubic-bezier(.2,.75,.25,1)" },
          ],
          { duration: SINK_MS, fill: "forwards", easing: "linear" },
        ),
      );
    const t = setTimeout(() => done.current(), SINK_MS);
    return () => {
      clearTimeout(t);
      anims.forEach((a) => a.cancel());
    };
  }, [run, target]);

  if (!run) return null;
  const ringSize = Math.round(size * 0.55);
  return (
    <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-[4]" style={{ width: size, height: size }}>
      <div
        ref={ring}
        className="absolute rounded-full border-2 border-coral"
        style={{ width: ringSize, height: ringSize, left: (size - ringSize) / 2, top: (size - ringSize) / 2, opacity: 0 }}
      />
      <div
        ref={dot}
        className="absolute h-3 w-3 rounded-full bg-white"
        style={{
          left: size / 2 - 6,
          top: size / 2 - 6,
          opacity: 0,
          boxShadow: "0 0 10px 3px rgba(255,255,255,0.9), 0 0 26px 8px rgba(255,94,87,0.55)",
        }}
      />
    </div>
  );
}
