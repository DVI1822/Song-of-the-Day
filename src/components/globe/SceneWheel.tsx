"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SCENE_KEY, scenePick, type ScenePick } from "@/lib/setting";
import { glass } from "./ui";

// The backdrop dial low on the right-hand side, level with the Core tab: a wheel whose
// middle sits just off the screen's edge, so only the scene you're on peeks
// out and the others wait round the rim, out of sight. Spin it (or tap for the next one)
// to change what's drawn behind the Globe. Kept on this device, the same
// choice as the picker in Settings.

export const SCENE_EVENT = "tt-scene";

const RO = 80; // the dial's outer edge
const OFF = 28; // how far past the screen's edge its middle sits
const RIM = 54; // emblems sit this far from the middle
const W = RO - OFF + 4; // the slice of it that shows
const H = 2 * Math.ceil(Math.sqrt(RO * RO - OFF * OFF)) + 4;
const CX = W + OFF,
  CY = H / 2;
const STEP = 40; // degrees between emblems
const HOME = 180; // where the shown emblem sits: straight in from the edge

const ink = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
const I = ({ children }: { children: ReactNode }) => (
  <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" {...ink}>
    {children}
  </svg>
);

export const SCENES: { pick: ScenePick; name: string; icon: ReactNode }[] = [
  {
    pick: "auto",
    name: "Where I am",
    icon: (
      <I>
        <path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z" />
        <circle cx="12" cy="10.5" r="2.2" />
      </I>
    ),
  },
  {
    pick: "mountain",
    name: "Mountains",
    icon: (
      <I>
        <path d="M2.5 19.5 9 8l3.6 6.2L15 10.5l6.5 9z" />
        <path d="M7.4 10.8 9 12l1.6-1.3" />
      </I>
    ),
  },
  {
    pick: "coast",
    name: "Coast",
    icon: (
      <I>
        <path d="M10 18V8.5l1-2.5h2l1 2.5V18" />
        <path d="M10 11.5h4M9.5 6h5" />
        <path d="M2.5 20.5c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.1-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.1 1.2" />
      </I>
    ),
  },
  {
    pick: "country",
    name: "Farmland",
    icon: (
      <I>
        <path d="M3.5 20V11l5-4 5 4v9z" />
        <path d="M6.5 20v-4h4v4M6.5 16l4 4M10.5 16l-4 4" />
        <path d="M15.5 20V8.5a2.5 2.5 0 0 1 5 0V20" />
        <path d="M2.5 20h19" />
      </I>
    ),
  },
  {
    pick: "woods",
    name: "Woods & lakes",
    icon: (
      <I>
        <path d="M8 3.5 3.5 11h2.4L3 15.5h10L10.1 11h2.4z" />
        <path d="M8 15.5V19" />
        <path d="M14 18.5c1.3-1.2 5.4-1.2 7 0-1.6 1.3-5.7 1.3-7 0z" />
        <path d="M17 6l-2.6 4.5h5.2z" />
        <path d="M17 10.5V13" />
      </I>
    ),
  },
  {
    pick: "desert",
    name: "Desert",
    icon: (
      <I>
        <path d="M10 20V5.5a2 2 0 0 1 4 0V20" />
        <path d="M10 13.5H8a2 2 0 0 1-2-2V9M14 11.5h2a2 2 0 0 0 2-2V7.5" />
        <path d="M3 20h18" />
        <circle cx="19" cy="3.8" r="1.3" />
      </I>
    ),
  },
  {
    pick: "suburb",
    name: "Suburbs",
    icon: (
      <I>
        <path d="M3.5 20v-7.5L9 8l5.5 4.5V20z" />
        <path d="M7.5 20v-4h3v4" />
        <path d="M17.5 20v-3.5" />
        <circle cx="17.5" cy="13.5" r="3" />
        <path d="M2.5 20h19" />
      </I>
    ),
  },
  {
    pick: "city",
    name: "City",
    icon: (
      <I>
        <path d="M3 20V11h4v9M7 20V5h5v15M12 20V9h4v11M16 20v-6.5h5V20" />
        <path d="M9 8h1M9 11h1M9 14h1M13.8 12h.4M13.8 15h.4" />
        <path d="M2 20h20" />
      </I>
    ),
  },
  {
    pick: "off",
    name: "No backdrop",
    icon: (
      <I>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M6.7 17.3 17.3 6.7" />
      </I>
    ),
  },
];

const N = SCENES.length;

// tell the Globe and remember it
export function choose(p: ScenePick) {
  try {
    if (p === "auto") localStorage.removeItem(SCENE_KEY);
    else localStorage.setItem(SCENE_KEY, p);
  } catch {}
  window.dispatchEvent(new CustomEvent(SCENE_EVENT, { detail: p }));
}

export function SceneWheel({
  top,
  dark,
  wheelRef,
}: {
  dark: boolean;
  wheelRef?: (el: HTMLDivElement | null) => void;
  top: number;
}) {
  // the wheel's turn in degrees; the emblem at HOME is SCENES[slot]
  const [turn, setTurn] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    a0: number;
    t0: number;
    moved: number;
    last: number;
  } | null>(null);
  const labelT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const i = Math.max(
      0,
      SCENES.findIndex((s) => s.pick === scenePick()),
    );
    // emblem i sits at HOME + i*STEP + turn, so turn it back by i steps
    queueMicrotask(() => setTurn(-i * STEP));
  }, []);

  const slotOf = (t: number) => ((Math.round(-t / STEP) % N) + N) % N;

  const settle = (t: number, show = true) => {
    const snapped = Math.round(t / STEP) * STEP;
    setTurn(snapped);
    const s = SCENES[slotOf(snapped)];
    if (s.pick !== scenePick()) choose(s.pick);
    if (show) {
      setLabel(s.name);
      if (labelT.current) clearTimeout(labelT.current);
      labelT.current = setTimeout(() => setLabel(null), 1400);
    }
  };

  // angle of a point round the wheel's middle, in degrees
  const angle = (x: number, y: number) => {
    const r = box.current!.getBoundingClientRect();
    return (Math.atan2(y - (r.top + CY), x - (r.left + CX)) * 180) / Math.PI;
  };

  return (
    <>
      {/* which one it is, for a moment after a turn */}
      <span
        aria-hidden
        className="pointer-events-none absolute z-[6] -translate-y-1/2 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold transition-opacity duration-300"
        style={{
          ...glass(dark),
          right: W + 6,
          top: top + CY,
          opacity: label ? 1 : 0,
        }}
      >
        {label ?? ""}
      </span>
      <div
        ref={(el) => {
          box.current = el;
          wheelRef?.(el);
        }}
        className="absolute right-0 z-[6] select-none overflow-hidden"
        style={{
          top,
          width: W,
          height: H,
          touchAction: "none",
          clipPath: `circle(${RO}px at ${CX}px ${CY}px)`,
        }}
        onPointerDown={(e) => {
          // only the rim near the shown emblem catches a touch
          const a = angle(e.clientX, e.clientY);
          drag.current = { a0: a, t0: turn, moved: 0, last: a };
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const a = angle(e.clientX, e.clientY);
          let delta = a - d.last;
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          d.last = a;
          d.moved += Math.abs(delta);
          setTurn((t) => t + delta);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          setDragging(false);
          if (!d) return;
          // a tap: on to the next one
          if (d.moved < 4) settle(d.t0 - STEP);
          else settle(turn);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          settle(turn, false);
        }}
        onWheel={(e) => settle(turn + (e.deltaY > 0 ? -STEP : STEP))}
        role="button"
        tabIndex={0}
        aria-label={`Backdrop: ${SCENES[slotOf(turn)].name}. Tap or spin to change it`}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" ||
            e.key === " " ||
            e.key === "ArrowDown" ||
            e.key === "ArrowRight"
          )
            settle(turn - STEP);
          if (e.key === "ArrowUp" || e.key === "ArrowLeft") settle(turn + STEP);
        }}
      >
        {/* the dial: a quarter of the wheel's rim, with ticks that turn with it */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
          width={W}
          height={W}
          overflow="visible"
        >
          <circle
            cx={CX}
            cy={CY}
            r={RO - 1}
            fill={dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.18)"}
            stroke="rgba(13,42,63,0.18)"
            strokeWidth="1"
          />
          <circle
            cx={CX}
            cy={CY}
            r={RIM - 26}
            fill="none"
            stroke="rgba(13,42,63,0.14)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <g
            style={{
              transform: `rotate(${turn}deg)`,
              transformOrigin: `${CX}px ${CY}px`,
              transition: dragging
                ? "none"
                : "transform 420ms cubic-bezier(.2,1.4,.4,1)",
            }}
          >
            {Array.from({ length: N * 4 }, (_, i) => {
              const a = ((HOME + (i * STEP) / 4) * Math.PI) / 180;
              const r1 = RO - 5,
                r2 = RO - (i % 4 === 0 ? 12 : 8);
              return (
                <line
                  key={i}
                  x1={+(CX + Math.cos(a) * r1).toFixed(2)}
                  y1={+(CY + Math.sin(a) * r1).toFixed(2)}
                  x2={+(CX + Math.cos(a) * r2).toFixed(2)}
                  y2={+(CY + Math.sin(a) * r2).toFixed(2)}
                  stroke={dark ? "rgba(236,240,248,0.3)" : "rgba(13,42,63,0.25)"}
                  strokeWidth={i % 4 === 0 ? 1.4 : 0.8}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        </svg>
        {/* the emblems round the rim; all but one are off the screen */}
        {SCENES.map((s, i) => {
          const a = ((HOME + i * STEP + turn) * Math.PI) / 180;
          const x = Math.round((CX + Math.cos(a) * RIM) * 10) / 10,
            y = Math.round((CY + Math.sin(a) * RIM) * 10) / 10;
          // the ones turned away slip off the edge and fade
          let off =
            ((((HOME + i * STEP + turn - HOME) % 360) + 540) % 360) - 180;
          off = Math.abs(off);
          return (
            <span
              key={s.pick}
              aria-hidden
              className="pointer-events-none absolute flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                left: x - 20,
                opacity: Math.round(Math.max(0, 1 - Math.max(0, off - 8) / 22) * 100) / 100,
                top: y - 20,
                // see-through, so it sits quietly at the edge
                background: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.38)",
                border: `1.5px solid ${dark ? "rgba(236,240,248,0.45)" : "rgba(29,36,51,0.35)"}`,
                color: dark ? "rgba(236,240,248,0.75)" : "rgba(13,42,63,0.7)",
                transition: dragging
                  ? "none"
                  : "left 420ms cubic-bezier(.2,1.4,.4,1), top 420ms cubic-bezier(.2,1.4,.4,1), opacity 300ms",
              }}
            >
              {s.icon}
            </span>
          );
        })}
      </div>
    </>
  );
}
