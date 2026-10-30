"use client";

import { useEffect, useRef } from "react";
import type { Post } from "@/lib/types";
import { alpha, drift, useCoreLook } from "./coreLook";

// Inside someone's core. Flying in, its rings of signal rush out past you;
// then you're in a slow tunnel of them, in the colours of their music, with
// their songs riding the rings towards you. Drawn at the screen's own
// resolution, so it stays sharp however big it gets.

const NEON = ["#5ef2ff", "#9b8cff", "#ff5fd2", "#b4ff5e"];
const RINGS = 16;
const DEEP = 4; // how far down the tunnel the rings go
const TAU = Math.PI * 2;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// their colours, lit up: the same hues, saturated and bright enough to glow
function vivid(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const s = d ? Math.max(0.75, d / (1 - Math.abs(max + min - 1))) : 0;
  const l = 0.6;
  const k = (n: number) => (n + h * 2) % 12; // h is in sixths of a turn
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

// the waveform on a ring: a few slow sines that never quite repeat
const wave = (th: number, i: number, t: number) =>
  Math.sin(th * 3 + t * 0.9 + i * 1.7) * 0.55 +
  Math.sin(th * 7 - t * 1.4 + i * 0.6) * 0.3 +
  Math.sin(th * 13 + t * 2.1 + i * 2.9) * 0.15;

export function CoreInside({
  posts,
  timeZone,
  from,
  cy,
  zoom,
}: {
  posts: Post[] | null;
  timeZone: string;
  from: number; // where the core was on screen as you flew in
  cy: number; // where the tunnel settles: around their picture
  zoom: () => number; // the camera's zoom: the inside shows as you reach the core
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const look = useCoreLook(posts, timeZone);
  const colors = look?.colors.length ? look.colors.map(vivid) : NEON;
  const live = useRef({ colors, cy, from, zoom, covers: [] as (HTMLImageElement | null)[] });

  // the covers that ride the rings: their newest songs
  const coverKey = (posts ?? []).slice(0, RINGS).map((p) => p.artwork_url ?? "").join("|");
  useEffect(() => {
    live.current.covers = coverKey.split("|").filter(Boolean).map((src) => {
      const im = new Image();
      im.decoding = "async";
      im.src = src;
      return im;
    });
  }, [coverKey]);
  useEffect(() => {
    live.current.colors = colors;
    live.current.cy = cy;
    live.current.from = from;
    live.current.zoom = zoom;
  });

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // rings start far down the tunnel, a small bright core ahead of you
    const z = Array.from({ length: RINGS }, (_, i) => (i / RINGS) * DEEP + 1.6);
    let t0: number | null = null; // when the camera reached the core
    let last = performance.now(),
      raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // seen only once the camera is deep enough, fading as it flies back out
      const zm = live.current.zoom();
      cv.style.opacity = clamp01((zm - 1.8) / 1.4).toFixed(3);
      if (t0 === null) {
        if (zm < 1.8) {
          raf = requestAnimationFrame(frame);
          return;
        }
        t0 = now;
      }
      const t = (now - t0) / 1000;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = window.innerWidth,
        h = window.innerHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      const { colors, covers } = live.current;
      // the tunnel opens where the core was, then rises to sit around their picture
      const rise = clamp01((t - 0.5) / 1.1),
        cy = live.current.from + (live.current.cy - live.current.from) * rise * rise * (3 - 2 * rise);
      const cx = w / 2;
      const F = Math.min(w, h) * 0.24;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";

      // the dark of the inside, tinted with their colours
      ctx.fillStyle = "#04050c";
      ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 3; k++) {
        const a = t * 0.05 + k * 2.1;
        const x = cx + Math.cos(a) * w * 0.35,
          y = cy + Math.sin(a * 1.3) * h * 0.25;
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.7);
        g.addColorStop(0, drift(colors, k * 1.3 + t * 0.03, 0, 0.13));
        g.addColorStop(1, drift(colors, k * 1.3 + t * 0.03, 0, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      // the tunnel bends as you drift through it: the far end wanders a little
      const vx = cx + Math.sin(t * 0.23) * w * 0.07,
        vy = cy + Math.cos(t * 0.17) * h * 0.035;
      // the heart of it, far ahead
      const heart = ctx.createRadialGradient(vx, vy, 0, vx, vy, F * 0.9);
      heart.addColorStop(0, drift(colors, t * 0.08, 0.5, 0.5));
      heart.addColorStop(0.3, drift(colors, t * 0.08 + 1, 0, 0.14));
      heart.addColorStop(1, drift(colors, t * 0.08 + 1, 0, 0));
      ctx.fillStyle = heart;
      ctx.fillRect(0, 0, w, h);

      // flying in, the rings rush past; then they drift slowly towards you
      const speed = calm ? 0.05 : 0.14 + 3.2 * Math.exp(-t * 2.2);
      for (let i = 0; i < RINGS; i++) {
        z[i] -= speed * dt;
        if (z[i] < 0.12) z[i] += DEEP;
      }
      const order = [...z.keys()].sort((a, b) => z[b] - z[a]); // far first

      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = ctx.lineCap = "round";
      for (const i of order) {
        const d = z[i];
        const r = F / d;
        // fade in from the far end, out as it passes you
        const a = clamp01((DEEP - 0.3 - d) / 1.2) * clamp01((d - 0.12) / 0.3) * clamp01(t * 1.5 + 0.2);
        if (a < 0.01 || r > Math.hypot(w, h) * 1.5) continue;
        const amp = 0.05 + 0.03 * Math.sin(t * 0.7 + i);
        const spin = t * 0.05 * (i % 2 ? 1 : -1) + i;
        const n = Math.min(240, Math.max(60, Math.round(r / 3)));
        const near = clamp01(1 - d / DEEP),
          ox = vx + (cx - vx) * near,
          oy = vy + (cy - vy) * near;
        ctx.beginPath();
        for (let k = 0; k <= n; k++) {
          const th = (k / n) * TAU;
          const rr = r * (1 + amp * wave(th + spin, i, t));
          const x = ox + Math.cos(th) * rr,
            y = oy + Math.sin(th) * rr * 0.94;
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        const c = i * 0.7 + t * 0.04;
        const lw = Math.max(0.8, 1.6 / Math.sqrt(d));
        ctx.strokeStyle = drift(colors, c, 0, 0.12 * a);
        ctx.lineWidth = lw * 7;
        ctx.stroke();
        ctx.strokeStyle = drift(colors, c, 0, 0.85 * a);
        ctx.lineWidth = lw * 1.4;
        ctx.stroke();
        ctx.strokeStyle = drift(colors, c, 0.7, 0.7 * a);
        ctx.lineWidth = lw * 0.5;
        ctx.stroke();
      }

      // their songs, riding the rings
      ctx.globalCompositeOperation = "source-over";
      for (const i of order) {
        const im = covers[i];
        if (!im || !im.complete || !im.naturalWidth) continue;
        const d = z[i];
        const r = F / d;
        const s = Math.min(150, r * 0.34);
        // not over their picture and name: songs show once their ring is out past them
        const a =
          clamp01((DEEP - 0.4 - d) / 0.9) * clamp01((d - 0.25) / 0.35) * clamp01(t * 1.2 - 0.4) * clamp01((r - 95) / 40);
        if (a < 0.01 || s < 6) continue;
        const ang = i * 2.39996 + t * 0.03;
        const near = clamp01(1 - d / DEEP);
        const x = vx + (cx - vx) * near + Math.cos(ang) * r - s / 2,
          y = vy + (cy - vy) * near + Math.sin(ang) * r * 0.94 - s / 2;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = drift(colors, i * 0.7, 0, 0.6);
        ctx.shadowBlur = s * 0.3;
        roundRect(ctx, x, y, s, s, s * 0.22);
        ctx.fillStyle = "#000";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.clip();
        ctx.drawImage(im, x, y, s, s);
        ctx.restore();
      }

      // a soft vignette keeps the eye in the middle
      const v = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.85);
      v.addColorStop(0, "rgba(4,5,12,0)");
      v.addColorStop(1, alpha("#04050c", 0.75));
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[499] h-full w-full"
      style={{ opacity: 0 }}
    />
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
