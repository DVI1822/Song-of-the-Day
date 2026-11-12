"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { glass } from "./ui";

// Your one redo a day, from your own song's cover: two arrows chasing each
// other round on the cover's bottom left. One tap opens it out into "Redo
// today's song" (so a stray tap doesn't spend the day's redo), and a second tap
// sucks the cover through a hole in its middle, like a cloth into a vacuum,
// before the paste sheet comes back for another song.

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
// The vacuum. While today's song is taken back, the cover is pulled through a
// hole in its middle like a cloth sucked in by a vacuum behind it: the middle
// gives first and dips into shadow, then the rest follows faster and faster,
// bunching into folds, the corners trailing last. The cover is drawn on a
// canvas as a mesh of triangles so it can bend. A tiny pop as it goes.
// ---------------------------------------------------------------------------

const PULL = 1050,
  POP = 380;
export const SINK_MS = PULL + POP;
const N = 18; // mesh cells per side
const FOLDS = 7; // radial folds as it bunches up

// how far in (0 to 1) a point that starts r from the middle (0 to ~1.41) has
// been pulled at time t (0 to 1): the middle first, the corners last, and
// always speeding up, like a vacuum taking hold
function pull(r: number, t: number) {
  const lag = 0.4;
  const u = Math.min(1, Math.max(0, t * (1 + lag) - lag * (r / Math.SQRT2)));
  // a slow give at first, then it goes
  return u * u * (0.35 + 0.65 * u);
}

// draw the image's triangle (s0, s1, s2) onto the canvas triangle (d0, d1, d2)
function tri(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s: [number, number, number, number, number, number],
  d: [number, number, number, number, number, number],
) {
  const [sx0, sy0, sx1, sy1, sx2, sy2] = s;
  const [dx0, dy0, dx1, dy1, dx2, dy2] = d;
  const den = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (!den) return;
  const a = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) / den,
    b = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) / den,
    c = ((dx2 - dx0) * (sx1 - sx0) - (dx1 - dx0) * (sx2 - sx0)) / den,
    e = ((dy2 - dy0) * (sx1 - sx0) - (dy1 - dy0) * (sx2 - sx0)) / den;
  ctx.save();
  ctx.beginPath();
  // a hair bigger than the triangle, so no seams show between them
  const cx = (dx0 + dx1 + dx2) / 3,
    cy = (dy0 + dy1 + dy2) / 3,
    g = 1.12;
  ctx.moveTo(cx + (dx0 - cx) * g, cy + (dy0 - cy) * g);
  ctx.lineTo(cx + (dx1 - cx) * g, cy + (dy1 - cy) * g);
  ctx.lineTo(cx + (dx2 - cx) * g, cy + (dy2 - cy) * g);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, e, dx0 - a * sx0 - c * sy0, dy0 - b * sx0 - e * sy0);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export function Singularity({
  size,
  src,
  target,
  run,
  onDone,
}: {
  size: number;
  src: string | null;
  target: RefObject<HTMLDivElement | null>;
  run: number; // bumps to start
  onDone(): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!run) return;
    let raf = 0,
      off = false;
    const anims: Animation[] = [];
    const ring0 = ring.current;
    const cv = canvas.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = size;

    const pop = () => {
      if (ring0?.animate)
        anims.push(
          ring0.animate(
            [
              { transform: "scale(0.05)", opacity: 0.9 },
              { transform: "scale(1)", opacity: 0, easing: "cubic-bezier(.2,.75,.25,1)" },
            ],
            { duration: POP, fill: "forwards" },
          ),
        );
    };
    // no picture to bend (a painted cover): it just gets pulled in
    const plain = () => {
      const el = target.current;
      if (el?.animate)
        anims.push(
          el.animate(
            [
              { transform: "scale(1)", filter: "brightness(1)" },
              { transform: "scale(0)", filter: "brightness(0.4)", easing: "cubic-bezier(.6,0,.9,.5)" },
            ],
            { duration: PULL, fill: "forwards" },
          ),
        );
      setTimeout(() => !off && pop(), PULL);
    };
    const bend = (img: HTMLImageElement) => {
      const el = target.current;
      const ctx = cv?.getContext("2d");
      if (!ctx || !cv) return plain();
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(W * dpr);
      if (el?.animate) anims.push(el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" }));
      // the picture's square, cropped like object-fit: cover, on a canvas of
      // its own so every triangle draws from the same ready square
      const S = Math.round(W * dpr),
        sq = document.createElement("canvas");
      sq.width = S;
      sq.height = S;
      const iw = img.naturalWidth,
        ih = img.naturalHeight,
        side = Math.min(iw, ih);
      const sctx = sq.getContext("2d");
      if (!sctx) return plain();
      if (side > 0 && !/^data:image\/svg/.test(img.src)) sctx.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, S, S);
      else sctx.drawImage(img, 0, 0, S, S); // an svg with no size of its own
      const ox = 0,
        oy = 0,
        k = S / W;
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / PULL);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, W);
        // where each point of the mesh is now
        const P: number[] = [];
        for (let j = 0; j <= N; j++)
          for (let i = 0; i <= N; i++) {
            const u = (i / N) * 2 - 1,
              v = (j / N) * 2 - 1,
              r = Math.hypot(u, v),
              a = Math.atan2(v, u),
              p = pull(r, t),
              // folds: the cloth bunches as it goes in, more as it gets close
              fold = Math.sin(a * FOLDS + r * 3) * 0.06 * p * (1 - p) * 4 * r,
              rr = r * (1 - p),
              aa = a + fold;
            P.push(W / 2 + (Math.cos(aa) * rr * W) / 2, W / 2 + (Math.sin(aa) * rr * W) / 2);
          }
        const at = (i: number, j: number) => (j * (N + 1) + i) * 2;
        for (let j = 0; j < N; j++)
          for (let i = 0; i < N; i++) {
            const A = at(i, j),
              B = at(i + 1, j),
              C = at(i, j + 1),
              D = at(i + 1, j + 1);
            const sx = (q: number) => ox + (q * W * k) / N,
              x0 = sx(i),
              x1 = sx(i + 1),
              y0 = oy + (j * W * k) / N,
              y1 = oy + ((j + 1) * W * k) / N;
            tri(ctx, sq, [x0, y0, x1, y0, x0, y1], [P[A], P[A + 1], P[B], P[B + 1], P[C], P[C + 1]]);
            tri(ctx, sq, [x1, y0, x1, y1, x0, y1], [P[B], P[B + 1], P[D], P[D + 1], P[C], P[C + 1]]);
          }
        // the shadow down the hole, only on the cloth
        ctx.globalCompositeOperation = "source-atop";
        const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, (W / 2) * (1.1 - 0.6 * t));
        g.addColorStop(0, `rgba(13,22,34,${(0.15 + 0.6 * t).toFixed(3)})`);
        g.addColorStop(1, "rgba(13,22,34,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, W);
        ctx.globalCompositeOperation = "source-over";
        if (t < 1) raf = requestAnimationFrame(frame);
        else {
          ctx.clearRect(0, 0, W, W);
          pop();
        }
      };
      raf = requestAnimationFrame(frame);
    };

    if (!src) plain();
    else {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => !off && bend(img);
      img.onerror = () => !off && plain();
      img.src = src;
    }
    const t = setTimeout(() => done.current(), SINK_MS);
    return () => {
      off = true;
      clearTimeout(t);
      cancelAnimationFrame(raf);
      anims.forEach((a) => a.cancel());
      cv?.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
    };
  }, [run, size, src, target]);

  if (!run) return null;
  const ringSize = Math.round(size * 0.4);
  return (
    <div aria-hidden className="pointer-events-none absolute left-0 top-0 z-[4]" style={{ width: size, height: size }}>
      <canvas ref={canvas} className="absolute inset-0" style={{ width: size, height: size }} />
      <div
        ref={ring}
        className="absolute rounded-full border-2 border-coral"
        style={{ width: ringSize, height: ringSize, left: (size - ringSize) / 2, top: (size - ringSize) / 2, opacity: 0 }}
      />
    </div>
  );
}
