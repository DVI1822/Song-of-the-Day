"use client";

import { useEffect, useRef } from "react";
import { coreColor, corePoints, nearFar } from "./signal";

// The core as a small picture: the Signal sphere of waves, slowly turning,
// for the Core tab, core buttons and anywhere else the core stands for
// someone. `rings` thins it out for tiny sizes; `tint` ("r,g,b") draws it in
// one colour instead of the neon spectrum.
// `moving` keeps it turning even when the phone asks for less motion, and
// `speed` turns it faster.
export function SignalCore({
  className,
  rings,
  still,
  tint,
  moving,
  speed = 1,
  palette,
  weight = 1,
}: {
  className?: string;
  rings?: number;
  still?: boolean;
  tint?: string;
  moving?: boolean;
  speed?: number;
  palette?: string[]; // "r,g,b" per ring, in turn
  weight?: number; // line thickness, times
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const calm = still || (!moving && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let raf = 0;
    const t0 = performance.now() - Math.random() * 20000;
    const paint = (now: number) => {
      const size = cv.clientWidth || 16;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const W = Math.round(size * dpr);
      if (cv.width !== W) cv.width = cv.height = W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, W);
      ctx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);
      ctx.lineJoin = "round";
      const t = ((now - t0) / 1000) * speed;
      const n = rings ?? (size < 24 ? 5 : size < 60 ? 8 : 13);
      const Rc = size * 0.4;
      const w = Math.max(1.1, size / 50) * weight;
      const all = corePoints(n, Rc, { yaw: t * 0.35, pitch: -0.35 + 0.1 * Math.sin(t * 0.3), roll: 0 }, t, size < 24 ? 0.1 : 0.13, size < 24 ? 60 : 120);
      for (const front of [false, true])
        all.forEach((pts, i) => {
          for (const run of nearFar(pts, front)) {
            if (run.length < 2) continue;
            const line = (style: string, lw: number) => {
              ctx.strokeStyle = style;
              ctx.lineWidth = lw;
              ctx.beginPath();
              run.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
              ctx.stroke();
            };
            // a faint glow, then the line, so it reads on light glass and dark sky alike
            const own = palette ? palette[i % palette.length] : tint;
            const col = (a: number) => (own ? `rgba(${own},${a})` : coreColor(i * (3.6 / n) + t * 0.08, 0, a));
            line(col(own ? (front ? 0.2 : 0.06) : front ? 0.25 : 0.08), w * 3);
            line(col(front ? 1 : 0.4), front ? w : w * 0.7);
          }
        });
      if (!calm) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [rings, still, tint, moving, speed, palette, weight]);
  return <canvas ref={ref} aria-hidden className={className} />;
}
