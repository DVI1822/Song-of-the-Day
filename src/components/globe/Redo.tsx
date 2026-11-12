"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { glass } from "./ui";

// Your one redo a day, from your own song's cover: two arrows chasing each
// other round on the cover's bottom left. One tap opens it out into "Erase
// and redo" (so a stray tap doesn't spend the day's redo), and a second tap
// sends a pencil in to rub the cover out, top to bottom, before the paste
// sheet comes back for another song.

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
        aria-label={asking ? "Erase it and pick another song (your one redo today)" : "Redo today's song"}
        aria-expanded={open}
        className="pointer-events-auto flex h-10 items-center overflow-hidden rounded-full transition-[width] duration-300 ease-[cubic-bezier(.2,.75,.25,1)]"
        style={{ ...glass(false), width: open ? 154 : 40 }}
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
          Erase and redo
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The pencil. While it runs, `clip` (the cover) is cut away behind the
// eraser in strokes, left to right then back, working down the cover, with a
// faint rubbed-out ghost left underneath and crumbs falling off the eraser.
// ---------------------------------------------------------------------------

const ROWS = 5;
const ENTER = 320,
  STROKE = 380,
  LEAVE = 380;
export const ERASE_MS = ENTER + ROWS * STROKE + LEAVE;

const noise = (k: number) => {
  const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (u: number) => u * u * (3 - 2 * u);

type Crumb = { x: number; y: number; vx: number; vy: number; r: number; born: number; c: string };

export function Eraser({
  size,
  clip,
  ghost,
  run,
  onErased,
}: {
  size: number;
  clip: RefObject<HTMLDivElement | null>;
  ghost: RefObject<HTMLDivElement | null>;
  run: number; // bumps to start
  onErased(): void;
}) {
  const pencil = useRef<HTMLDivElement>(null);
  const crumbs = useRef<HTMLCanvasElement>(null);
  const done = useRef(onErased);
  useEffect(() => {
    done.current = onErased;
  });

  useEffect(() => {
    if (!run) return;
    const W = size,
      H = size,
      b = H / ROWS,
      over = b * 0.55; // the eraser's reach past its middle
    const list: Crumb[] = [];
    const ctx = crumbs.current?.getContext("2d") ?? null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (crumbs.current) {
      crumbs.current.width = Math.round((W + 80) * dpr);
      crumbs.current.height = Math.round((H + 120) * dpr);
    }
    let raf = 0,
      last = 0;
    const t0 = performance.now();

    // a ragged line along y from x0 to x1 (k seeds it, so it holds still)
    const edge = (y: number, x0: number, x1: number, k: number) => {
      const pts: string[] = [];
      const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 14));
      for (let j = 0; j <= n; j++) {
        const x = x0 + ((x1 - x0) * j) / n;
        const jit = j === 0 || j === n ? 0 : (noise(k * 97 + Math.round(x / 14)) - 0.5) * b * 0.22;
        pts.push(`${x.toFixed(1)}px ${(y + jit).toFixed(1)}px`);
      }
      return pts;
    };
    // the eraser's own end, down the row: a soft, crumbly curve
    const tip = (x: number, top: number, dir: 1 | -1, k: number) => {
      const pts: string[] = [];
      for (let j = 0; j <= 6; j++) {
        const v = j / 6,
          bulge = Math.sin(v * Math.PI) * b * 0.28,
          jit = (noise(k * 31 + j) - 0.5) * b * 0.12;
        pts.push(`${(x + dir * (bulge + jit)).toFixed(1)}px ${(top + v * b).toFixed(1)}px`);
      }
      return pts;
    };

    const frame = (now: number) => {
      const t = now - t0;
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      const el = clip.current;

      // where the eraser is
      let row = 0,
        ex = W + 40,
        ey = -40,
        lift = 1;
      if (t < ENTER) {
        const u = smooth(t / ENTER);
        ex = -over + (W + 120) * (1 - u) * 0.9 + 0 * u;
        ey = b / 2 - 140 * (1 - u);
        lift = 1 - u;
      } else if (t < ENTER + ROWS * STROKE) {
        const s = (t - ENTER) / STROKE;
        row = Math.floor(s);
        const u = s - row,
          dir = row % 2 === 0 ? 1 : -1,
          // a quick turn at each end, steady across
          p = 0.12 * smooth(Math.min(1, u / 0.12)) + 0.88 * Math.max(0, (u - 0.12) / 0.88),
          reach = -over + p * (W + 2 * over);
        ex = dir === 1 ? reach : W - reach;
        ey = row * b + b / 2;
        lift = 0;
      } else {
        const u = smooth(Math.min(1, (t - ENTER - ROWS * STROKE) / LEAVE));
        row = ROWS;
        ex = (ROWS % 2 === 0 ? -over : W + over) + 60 * u;
        ey = H - b / 2 - 160 * u;
        lift = u;
      }
      const scrub = lift < 1 ? Math.sin(t / 26) * b * 0.22 * (1 - lift) : 0;

      // cut the cover away behind it
      if (el) {
        if (t < ENTER) el.style.clipPath = "";
        else if (row >= ROWS) el.style.clipPath = "polygon(0 0, 0 0, 0 0)";
        else {
          const top = row * b,
            bot = top + b,
            dir = row % 2 === 0 ? 1 : -1,
            cut = Math.max(0, Math.min(W, ex + dir * over * 0.6));
          const pts =
            dir === 1
              ? [
                  ...edge(top, cut, W, row),
                  `${W}px ${H}px`,
                  `0px ${H}px`,
                  ...edge(bot, 0, cut, row + 1),
                  ...tip(cut, top, 1, row).reverse(),
                ]
              : [
                  `0px ${top}px`,
                  ...edge(top, 0, cut, row),
                  ...tip(cut, top, -1, row),
                  ...edge(bot, cut, W, row + 1),
                  `${W}px ${H}px`,
                  `0px ${H}px`,
                ];
          el.style.clipPath = `polygon(${pts.join(",")})`;
        }
      }
      // the rubbed-out ghost fades as the pencil leaves
      if (ghost.current) {
        const g = t < ENTER ? 0 : row >= ROWS ? 1 - lift : 1;
        ghost.current.style.opacity = (0.16 * g).toFixed(3);
      }
      // the pencil, its eraser on (ex, ey), leaning up and to the right
      if (pencil.current) {
        const wob = Math.sin(t / 26) * 4 * (1 - lift);
        pencil.current.style.opacity = t > ERASE_MS - 120 ? String(Math.max(0, (ERASE_MS - t) / 120)) : "1";
        pencil.current.style.transform = `translate(${ex.toFixed(1)}px, ${(ey + scrub).toFixed(1)}px) rotate(${(-38 + wob).toFixed(1)}deg)`;
      }
      // crumbs
      if (ctx) {
        if (lift === 0 && ex > -10 && ex < W + 10 && Math.random() < dt / 22) {
          list.push({
            x: ex + (Math.random() - 0.5) * 10,
            y: ey + scrub + (Math.random() - 0.3) * b * 0.4,
            vx: (Math.random() - 0.5) * 0.12,
            vy: -0.05 - Math.random() * 0.08,
            r: 1 + Math.random() * 1.8,
            born: t,
            c: Math.random() < 0.7 ? "232,150,168" : "120,124,134",
          });
        }
        ctx.setTransform(dpr, 0, 0, dpr, 40 * dpr, 40 * dpr);
        ctx.clearRect(-40, -40, W + 80, H + 120);
        for (let i = list.length - 1; i >= 0; i--) {
          const c = list[i],
            age = t - c.born;
          if (age > 700) {
            list.splice(i, 1);
            continue;
          }
          c.vy += 0.0012 * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          ctx.fillStyle = `rgba(${c.c},${(1 - age / 700).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (t < ERASE_MS) raf = requestAnimationFrame(frame);
      else {
        ctx?.clearRect(-40, -40, W + 80, H + 120);
        done.current();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [run, size, clip, ghost]);

  if (!run) return null;
  const len = Math.round(Math.max(150, size * 0.62));
  const thick = Math.max(16, Math.round(size * 0.07));
  return (
    <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-[4]" style={{ width: size, height: size }}>
      <canvas ref={crumbs} className="absolute" style={{ left: -40, top: -40, width: size + 80, height: size + 120 }} />
      <div ref={pencil} className="absolute left-0 top-0" style={{ transformOrigin: "0 0", willChange: "transform" }}>
        <Pencil len={len} thick={thick} />
      </div>
    </div>
  );
}

// A yellow pencil lying along +x from its eraser at (0, 0).
function Pencil({ len, thick }: { len: number; thick: number }) {
  const h = thick,
    er = h * 0.95, // eraser
    fe = h * 0.7, // ferrule
    tipL = h * 1.5,
    body = len - er - fe - tipL;
  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    top: -h / 2,
    filter: "drop-shadow(0 10px 10px rgba(13,42,63,0.28))",
  };
  return (
    <svg width={len} height={h} viewBox={`0 0 ${len} ${h}`} style={style}>
      {/* eraser */}
      <path d={`M${er} 0H${h * 0.32}Q0 0 0 ${h * 0.32}V${h * 0.68}Q0 ${h} ${h * 0.32} ${h}H${er}Z`} fill="#F49AB0" />
      <path d={`M${er} ${h * 0.12}H${h * 0.3}Q${h * 0.12} ${h * 0.12} ${h * 0.12} ${h * 0.34}`} stroke="#FFD2DC" strokeWidth={h * 0.1} fill="none" strokeLinecap="round" />
      {/* ferrule */}
      <rect x={er} y={0} width={fe} height={h} fill="#B9C1C9" />
      <rect x={er + fe * 0.3} y={0} width={fe * 0.12} height={h} fill="#8E98A3" />
      <rect x={er + fe * 0.62} y={0} width={fe * 0.12} height={h} fill="#8E98A3" />
      {/* body, three faces */}
      <rect x={er + fe} y={0} width={body} height={h / 3} fill="#FFD866" />
      <rect x={er + fe} y={h / 3} width={body} height={h / 3} fill="#F6C23E" />
      <rect x={er + fe} y={(2 * h) / 3} width={body} height={h / 3} fill="#DCA521" />
      {/* sharpened wood and lead */}
      <path d={`M${er + fe + body} 0L${len - h * 0.38} ${h * 0.36}V${h * 0.64}L${er + fe + body} ${h}Z`} fill="#F1D3A6" />
      <path d={`M${len - h * 0.38} ${h * 0.36}L${len} ${h / 2}L${len - h * 0.38} ${h * 0.64}Z`} fill="#3A3F47" />
    </svg>
  );
}
