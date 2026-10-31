"use client";

import { useEffect, useRef } from "react";
import type { HalloweenName } from "./halloween";

// The Halloween looks' moving parts (see halloween.ts), drawn on two canvases:
// "back" sits behind the globe (moon, bats, ghosts, the pumpkin patch) and
// "front" over it (mist, cobweb and spider, embers, a bat that swoops close).
// Nothing here takes a tap.

type Props = { name: HalloweenName; layer: "back" | "front"; w: number; h: number; cx: number; cy: number; R: number };

const TAU = Math.PI * 2;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function HalloweenScene({ name, layer, w, h, cx, cy, R }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d");
    if (!g) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const draw = DRAW[name][layer];
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = still ? 4 : (now - t0) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      draw(g, t, { w, h, cx, cy, R });
      if (!still) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [name, layer, w, h, cx, cy, R]);
  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${layer === "front" ? "z-[3]" : ""}`}
    />
  );
}

type Box = { w: number; h: number; cx: number; cy: number; R: number };
type Draw = (g: CanvasRenderingContext2D, t: number, b: Box) => void;

// ---------------------------------------------------------------------------
// shapes
// ---------------------------------------------------------------------------

// a bat, wings up at flap 1 and down at -1
function bat(g: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  const tip = -10 * flap;
  g.beginPath();
  // left wing
  g.moveTo(-2, -1);
  g.quadraticCurveTo(-8, -6 + tip * 0.6, -16, -3 + tip);
  g.quadraticCurveTo(-14, 1 + tip * 0.5, -12, 3 + tip * 0.3);
  g.quadraticCurveTo(-10, 1, -8, 4);
  g.quadraticCurveTo(-6, 2, -4, 4);
  g.quadraticCurveTo(-3, 2, -1, 3);
  // right wing
  g.lineTo(1, 3);
  g.quadraticCurveTo(3, 2, 4, 4);
  g.quadraticCurveTo(6, 2, 8, 4);
  g.quadraticCurveTo(10, 1, 12, 3 + tip * 0.3);
  g.quadraticCurveTo(14, 1 + tip * 0.5, 16, -3 + tip);
  g.quadraticCurveTo(8, -6 + tip * 0.6, 2, -1);
  g.closePath();
  g.fill();
  // body and ears
  g.beginPath();
  g.ellipse(0, 0.5, 2.2, 3.4, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(-1.8, -2);
  g.lineTo(-1.4, -4.6);
  g.lineTo(-0.4, -2.6);
  g.lineTo(0.4, -2.6);
  g.lineTo(1.4, -4.6);
  g.lineTo(1.8, -2);
  g.fill();
  g.restore();
}

// a sheet ghost with a wavy hem
function ghost(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, alpha: number) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.globalAlpha = alpha;
  const grad = g.createLinearGradient(0, -20, 0, 22);
  grad.addColorStop(0, "rgba(235,255,248,0.95)");
  grad.addColorStop(1, "rgba(180,255,225,0)");
  g.fillStyle = grad;
  g.shadowColor = "rgba(150,255,210,0.8)";
  g.shadowBlur = 18;
  g.beginPath();
  g.moveTo(-12, 0);
  g.arc(0, -8, 12, Math.PI, 0);
  g.lineTo(12, 14);
  for (let i = 0; i <= 6; i++) {
    const hx = 12 - i * 4;
    g.lineTo(hx, 18 + 4 * Math.sin(t * 4 + i * 1.3));
  }
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "rgba(10,30,25,0.85)";
  g.beginPath();
  g.ellipse(-4.5, -9, 2, 3, 0, 0, TAU);
  g.ellipse(4.5, -9, 2, 3, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(0, -2.5, 2.2, 2.8 + Math.sin(t * 2) * 0.6, 0, 0, TAU);
  g.fill();
  g.restore();
}

// a jack-o'-lantern, lit from inside
function pumpkin(g: CanvasRenderingContext2D, x: number, y: number, s: number, flick: number) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // glow on the ground
  const glow = g.createRadialGradient(0, 6, 2, 0, 6, 40);
  glow.addColorStop(0, `rgba(255,150,40,${0.35 * flick})`);
  glow.addColorStop(1, "rgba(255,150,40,0)");
  g.fillStyle = glow;
  g.fillRect(-40, -34, 80, 80);
  // body: three lobes
  for (const [ox, rx, c] of [
    [-7, 9, "#9C3A0A"],
    [7, 9, "#9C3A0A"],
    [0, 10, "#C4510F"],
  ] as [number, number, string][]) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(ox, 0, rx, 11, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = "#3D4A1E";
  g.beginPath();
  g.moveTo(-1.5, -10);
  g.quadraticCurveTo(0, -16, 3, -17);
  g.lineTo(3.5, -15);
  g.quadraticCurveTo(1.5, -13, 1.5, -10);
  g.fill();
  // the face
  g.fillStyle = `rgba(255,${200 + 40 * flick},${80 + 60 * flick},1)`;
  g.shadowColor = "rgba(255,190,60,0.9)";
  g.shadowBlur = 8 * flick;
  g.beginPath();
  g.moveTo(-8, -3);
  g.lineTo(-3, -3);
  g.lineTo(-5.5, -7);
  g.closePath();
  g.moveTo(8, -3);
  g.lineTo(3, -3);
  g.lineTo(5.5, -7);
  g.closePath();
  g.moveTo(-9, 2);
  g.quadraticCurveTo(0, 10, 9, 2);
  g.lineTo(6, 3.5);
  g.lineTo(4.5, 2);
  g.lineTo(2, 4.5);
  g.lineTo(0, 3);
  g.lineTo(-2, 4.5);
  g.lineTo(-4.5, 2);
  g.lineTo(-6, 3.5);
  g.closePath();
  g.fill();
  g.restore();
}

function moon(g: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string, glowC: string, craters: string) {
  const halo = g.createRadialGradient(x, y, r * 0.8, x, y, r * 2.6);
  halo.addColorStop(0, glowC);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = halo;
  g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  const body = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  body.addColorStop(0, inner);
  body.addColorStop(1, outer);
  g.fillStyle = body;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = craters;
  for (const [dx, dy, cr] of [
    [-0.35, -0.2, 0.16],
    [0.25, 0.3, 0.22],
    [0.3, -0.38, 0.1],
    [-0.2, 0.45, 0.09],
    [0.55, 0.0, 0.07],
  ]) {
    g.beginPath();
    g.arc(x + dx * r, y + dy * r, cr * r, 0, TAU);
    g.fill();
  }
}

// soft drifting fog: overlapping blurred blobs along a band
function fogBand(g: CanvasRenderingContext2D, t: number, w: number, y: number, height: number, n: number, speed: number, alpha: number, seed: number, rgb: string) {
  for (let i = 0; i < n; i++) {
    const r = height * (0.7 + hash(seed + i) * 0.9);
    const span = w + r * 4;
    const x = ((hash(seed + i * 3) * span + t * speed * (0.6 + hash(seed + i * 7))) % span) - r * 2;
    const yy = y + (hash(seed + i * 5) - 0.5) * height * 0.8 + Math.sin(t * 0.3 + i) * 6;
    const grad = g.createRadialGradient(x, yy, 0, x, yy, r);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, yy, r * 1.8, r, 0, 0, TAU);
    g.fill();
  }
}

// bats crossing on looping paths
function bats(g: CanvasRenderingContext2D, t: number, b: Box, n: number, seed: number, size: [number, number], color: string, yBand: [number, number]) {
  for (let i = 0; i < n; i++) {
    const dur = 9 + hash(seed + i) * 8;
    const p = ((t + hash(seed + i * 3) * dur) % dur) / dur;
    const dir = hash(seed + i * 5) > 0.5 ? 1 : -1;
    const x = dir > 0 ? -40 + p * (b.w + 80) : b.w + 40 - p * (b.w + 80);
    const y0 = b.h * (yBand[0] + (yBand[1] - yBand[0]) * hash(seed + i * 7));
    const y = y0 + Math.sin(p * TAU * 2 + i) * 22 + Math.sin(t * 3 + i) * 4;
    const s = size[0] + (size[1] - size[0]) * hash(seed + i * 11);
    bat(g, x, y, s, Math.sin(t * (14 + hash(i) * 6) + i * 2), color);
  }
}

// ---------------------------------------------------------------------------
// the three looks
// ---------------------------------------------------------------------------

const DRAW: Record<HalloweenName, { back: Draw; front: Draw }> = {
  pumpkin: {
    back(g, t, b) {
      const mr = Math.min(b.w, b.h) * 0.13;
      moon(g, b.w * 0.8, b.h * 0.16, mr, "#FFF2C2", "#F5A742", "rgba(255,170,70,0.35)", "rgba(200,110,40,0.25)");
      // wisps of cloud crossing the moon
      fogBand(g, t, b.w, b.h * 0.18, 26, 4, 10, 0.18, 3, "120,60,110");
      bats(g, t, b, 6, 1, [0.9, 1.6], "#12060F", [0.1, 0.3]);
      // the patch: dark hills along the bottom with lanterns glowing on them
      g.fillStyle = "#12061A";
      g.beginPath();
      g.moveTo(0, b.h);
      g.lineTo(0, b.h * 0.86);
      g.quadraticCurveTo(b.w * 0.25, b.h * 0.8, b.w * 0.5, b.h * 0.86);
      g.quadraticCurveTo(b.w * 0.78, b.h * 0.92, b.w, b.h * 0.84);
      g.lineTo(b.w, b.h);
      g.fill();
      // a crooked fence
      g.strokeStyle = "#12061A";
      g.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const x = b.w * 0.62 + i * 18;
        const y = b.h * (0.88 - 0.03 * (i / 6));
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (hash(i) - 0.5) * 4, y - 24 - hash(i + 9) * 8);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(b.w * 0.6, b.h * 0.86);
      g.lineTo(b.w, b.h * 0.835);
      g.stroke();
      const spots: [number, number, number][] = [
        [0.12, 0.885, 0.9],
        [0.3, 0.86, 0.65],
        [0.86, 0.9, 1.0],
        [0.72, 0.915, 0.7],
        [0.5, 0.905, 0.55],
      ];
      spots.forEach(([fx, fy, s], i) => {
        const flick = 0.75 + 0.25 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 5.3 + i);
        pumpkin(g, b.w * fx, b.h * fy, s * 1.3, flick);
      });
    },
    front(g, t, b) {
      // now and then a bat swoops right past you
      const cyc = 7;
      const p = (t % cyc) / cyc;
      if (p < 0.35) {
        const q = p / 0.35;
        const x = -60 + q * (b.w + 120);
        const y = b.h * 0.62 - Math.sin(q * Math.PI) * b.h * 0.3;
        bat(g, x, y, 2.2 + Math.sin(q * Math.PI) * 1.4, Math.sin(t * 16), "#0D0410");
      }
      // falling leaves
      for (let i = 0; i < 6; i++) {
        const dur = 10 + hash(i + 40) * 6;
        const q = ((t + hash(i + 50) * dur) % dur) / dur;
        const x = b.w * hash(i + 60) + Math.sin(q * TAU * 1.5 + i) * 30;
        const y = -20 + q * (b.h + 40);
        g.save();
        g.translate(x, y);
        g.rotate(t * (1 + hash(i)) + i);
        g.fillStyle = ["#D9541E", "#F2A33A", "#9E2F12"][i % 3];
        g.globalAlpha = 0.85;
        g.beginPath();
        g.ellipse(0, 0, 6, 3, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    },
  },

  haunted: {
    back(g, t, b) {
      const mr = Math.min(b.w, b.h) * 0.1;
      moon(g, b.w * 0.24, b.h * 0.17, mr, "#F4FFF9", "#AFCFC4", "rgba(170,255,220,0.22)", "rgba(80,120,110,0.2)");
      fogBand(g, t, b.w, b.h * 0.2, 30, 5, 8, 0.22, 11, "140,180,170");
      // dead trees, either side
      const tree = (x: number, base: number, s: number, flip: number) => {
        g.save();
        g.translate(x, base);
        g.scale(s * flip, s);
        g.strokeStyle = "#030807";
        g.lineCap = "round";
        const branch = (len: number, ang: number, wdt: number, depth: number) => {
          if (depth === 0) return;
          g.lineWidth = wdt;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(0, -len);
          g.stroke();
          g.save();
          g.translate(0, -len);
          for (const k of [-1, 1]) {
            g.save();
            g.rotate(ang * k + (hash(depth * 7 + k) - 0.5) * 0.4);
            branch(len * 0.72, ang, wdt * 0.62, depth - 1);
            g.restore();
          }
          g.restore();
        };
        branch(60, 0.5, 9, 6);
        g.restore();
      };
      tree(18, b.h * 0.99, 1.15, 1);
      tree(b.w - 10, b.h * 1.0, 0.95, -1);
      // ghosts drifting slowly across behind the globe
      for (let i = 0; i < 3; i++) {
        const dur = 22 + i * 7;
        const q = ((t + i * 9) % dur) / dur;
        const dir = i % 2 ? -1 : 1;
        const x = dir > 0 ? -40 + q * (b.w + 80) : b.w + 40 - q * (b.w + 80);
        const y = b.h * (0.22 + 0.2 * i) + Math.sin(t * 1.2 + i) * 12;
        ghost(g, x, y, 1.1 + 0.3 * i, t + i, 0.55 * Math.sin(q * Math.PI));
      }
      // will-o'-the-wisps
      for (let i = 0; i < 14; i++) {
        const x = b.w * hash(i + 100) + Math.sin(t * 0.5 + i) * 20;
        const y = b.h * (0.55 + 0.4 * hash(i + 200)) + Math.cos(t * 0.7 + i * 2) * 14;
        const a = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
        const grad = g.createRadialGradient(x, y, 0, x, y, 9);
        grad.addColorStop(0, `rgba(170,255,210,${0.9 * a})`);
        grad.addColorStop(1, "rgba(170,255,210,0)");
        g.fillStyle = grad;
        g.fillRect(x - 9, y - 9, 18, 18);
      }
      fogBand(g, t, b.w, b.h * 0.9, 60, 8, 14, 0.35, 21, "150,200,185");
    },
    front(g, t, b) {
      // mist rolling round the globe's feet and up past the buttons
      fogBand(g, t, b.w, b.cy + b.R * 0.95, 50, 7, 18, 0.28, 31, "190,230,215");
      fogBand(g, t, b.w, b.h * 0.97, 70, 7, 24, 0.32, 41, "170,215,200");
      // one ghost passes in front now and then
      const cyc = 16;
      const q = (t % cyc) / cyc;
      if (q < 0.5) {
        const p = q / 0.5;
        const x = b.w + 50 - p * (b.w + 100);
        const y = b.cy - b.R * 0.3 + Math.sin(p * TAU * 1.5) * 30;
        ghost(g, x, y, 2.2, t, 0.7 * Math.sin(p * Math.PI));
      }
    },
  },

  blood: {
    back(g, t, b) {
      // a huge moon right behind the globe
      const mr = b.R * 1.32;
      const pulse = 0.85 + 0.15 * Math.sin(t * 0.8);
      moon(g, b.cx, b.cy - b.R * 0.12, mr, "#FF7A55", "#6A0610", `rgba(220,20,40,${0.4 * pulse})`, "rgba(90,0,12,0.12)");
      // thin dark clouds across it
      fogBand(g, t, b.w, b.cy - b.R * 0.6, 16, 4, 9, 0.3, 51, "10,0,3");
      fogBand(g, t, b.w, b.cy + b.R * 0.55, 14, 3, 7, 0.28, 61, "10,0,3");
      bats(g, t, b, 9, 7, [0.7, 1.3], "#050002", [0.12, 0.42]);
      // a ridge with a crooked graveyard
      g.fillStyle = "#070103";
      g.beginPath();
      g.moveTo(0, b.h);
      g.lineTo(0, b.h * 0.9);
      g.quadraticCurveTo(b.w * 0.5, b.h * 0.84, b.w, b.h * 0.9);
      g.lineTo(b.w, b.h);
      g.fill();
      const stones: [number, number, number][] = [
        [0.08, 0.89, 0.1],
        [0.2, 0.875, -0.15],
        [0.78, 0.875, 0.08],
        [0.9, 0.89, -0.12],
      ];
      for (const [fx, fy, rot] of stones) {
        g.save();
        g.translate(b.w * fx, b.h * fy);
        g.rotate(rot);
        g.beginPath();
        g.moveTo(-9, 4);
        g.lineTo(-9, -12);
        g.arc(0, -12, 9, Math.PI, 0);
        g.lineTo(9, 4);
        g.fill();
        g.restore();
      }
      // a cross on the hill
      g.fillRect(b.w * 0.64 - 2, b.h * 0.85 - 26, 4, 28);
      g.fillRect(b.w * 0.64 - 9, b.h * 0.85 - 19, 18, 4);
    },
    front(g, t, b) {
      // embers rising
      for (let i = 0; i < 26; i++) {
        const dur = 6 + hash(i + 300) * 6;
        const q = ((t + hash(i + 310) * dur) % dur) / dur;
        const x = b.w * hash(i + 320) + Math.sin(t * 1.5 + i) * 14;
        const y = b.h + 10 - q * b.h * (0.6 + 0.4 * hash(i + 330));
        const a = Math.sin(q * Math.PI) * (0.6 + 0.4 * Math.sin(t * 8 + i));
        const r = 1.2 + hash(i + 340) * 1.8;
        g.fillStyle = `rgba(255,${80 + Math.round(90 * hash(i))},40,${a.toFixed(3)})`;
        g.shadowColor = "rgba(255,60,30,0.9)";
        g.shadowBlur = 6;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      g.shadowBlur = 0;
      // a cobweb in the top-left corner
      const cxw = 0,
        cyw = 0,
        rad = Math.min(150, b.w * 0.38);
      g.strokeStyle = "rgba(235,220,225,0.42)";
      g.lineWidth = 0.8;
      const spokes = 7;
      for (let i = 0; i < spokes; i++) {
        const a = (i / (spokes - 1)) * (Math.PI / 2);
        g.beginPath();
        g.moveTo(cxw, cyw);
        g.lineTo(cxw + Math.cos(a) * rad, cyw + Math.sin(a) * rad);
        g.stroke();
      }
      for (let k = 1; k <= 6; k++) {
        const rr = (rad * k) / 6.4;
        g.beginPath();
        for (let i = 0; i < spokes; i++) {
          const a = (i / (spokes - 1)) * (Math.PI / 2);
          const x = cxw + Math.cos(a) * rr,
            y = cyw + Math.sin(a) * rr;
          if (i === 0) g.moveTo(x, y);
          else {
            const am = ((i - 0.5) / (spokes - 1)) * (Math.PI / 2);
            g.quadraticCurveTo(cxw + Math.cos(am) * rr * 0.86, cyw + Math.sin(am) * rr * 0.86, x, y);
          }
        }
        g.stroke();
      }
      // its spider, letting itself down and climbing back
      const sx = b.w * 0.86;
      const drop = 70 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 110;
      g.strokeStyle = "rgba(235,220,225,0.5)";
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx, drop);
      g.stroke();
      g.save();
      g.translate(sx, drop + 6);
      g.rotate(Math.sin(t * 1.3) * 0.15);
      g.fillStyle = "#0A0003";
      g.strokeStyle = "#0A0003";
      g.lineWidth = 1.4;
      for (const k of [-1, 1])
        for (let j = 0; j < 4; j++) {
          const wig = Math.sin(t * 6 + j) * 0.12;
          g.beginPath();
          g.moveTo(0, -1 + j * 1.6);
          g.quadraticCurveTo(k * 9, -8 + j * 4, k * (12 + j), 2 + j * 4 + wig * 10);
          g.stroke();
        }
      g.beginPath();
      g.ellipse(0, 4, 5.5, 6.5, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.arc(0, -3, 3.2, 0, TAU);
      g.fill();
      g.fillStyle = "#E0102E";
      g.beginPath();
      g.moveTo(0, 1.5);
      g.lineTo(2, 4);
      g.lineTo(0, 6.5);
      g.lineTo(-2, 4);
      g.fill();
      g.restore();
    },
  },
};
