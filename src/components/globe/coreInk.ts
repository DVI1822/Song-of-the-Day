// The core in the drawn look (ink.ts): falling into it and the inside.
//
// Diving in, the core's edge opens like the lip of a drawn hole and grows
// past the screen, with a sheet of paper (navy after dark) inside it. Speed
// lines rush past the way they do in a comic, and the core's waveform rings
// come up out of the deep as boiling ink lines, one coral and one green
// among them, with their songs riding the rings in ink frames. Flying out
// plays it all backwards: the lines rush in and the lip closes back to the
// core.

import { CHALK, CORAL, INK, css, inkRing, wobbly } from "./ink";
import type { V3 } from "./math";

const TAU = Math.PI * 2;
export const PAPER: V3 = [255, 253, 246];
export const NIGHT_PAPER: V3 = [22, 28, 48];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// a wobbly closed loop: a circle (squashed by sy) pushed by f(th)
function loop(cx: number, cy: number, r: number, sy: number, f: (th: number) => number, n: number) {
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const th = (k / n) * TAU;
    const rr = r * (1 + f(th));
    pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr * sy]);
  }
  return pts;
}

function path(g: CanvasRenderingContext2D, pts: [number, number][]) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
}

// a rounded square as points, for an ink frame round a cover
function squarePts(x: number, y: number, s: number, r: number) {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [x + s - r, y + r, -Math.PI / 2],
    [x + s - r, y + s - r, 0],
    [x + r, y + s - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  pts.push(pts[0]);
  return pts;
}

export type InkInside = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  p: number; // 0 at the core on the globe, 1 all the way in
  F: number; // the tunnel's focal size
  R0: number; // the core as the camera sees it now
  edge: number; // the lip of the hole, growing past the screen
  t: number;
  rush: number; // how fast you're falling (zoom's log rate a second): + in, - out
  night: boolean;
  z: number[]; // each ring's depth
  order: number[]; // far first
  deep: number;
  wave: (th: number, i: number, t: number) => number;
  covers: (HTMLImageElement | null)[];
};

export function drawInkInside(g: CanvasRenderingContext2D, f: InkInside) {
  const { w, h, cx, cy, p, F, edge, t, night } = f;
  const ink = night ? CHALK : INK;
  const paper = night ? NIGHT_PAPER : PAPER;
  // lines redraw ~12 times a second, wobbles ~4: drawn on twos, boiling
  const b = Math.floor(t * 4) % 3;
  const frame = Math.floor(t * 12);
  const diag = Math.hypot(w, h);
  g.lineJoin = g.lineCap = "round";

  // the hole: a wobbly circle round the core that opens past the screen
  const lipAmp = (th: number) => 0.012 * Math.sin(th * 5 + b * 2.1) + 0.008 * Math.sin(th * 11 - b);
  const hole = loop(cx, cy, edge, 1, lipAmp, 160);
  g.save();
  path(g, hole);
  g.fillStyle = css(paper, clamp01(p * 3 + 0.35));
  g.fill();
  g.clip();

  // a faint grain of pencil hatching in the paper, so it reads as a page
  g.strokeStyle = css(ink, 0.05 * clamp01(p * 2));
  g.lineWidth = 1;
  // (all in one path: one stroke instead of seventy-eight)
  g.beginPath();
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3.3 + 1) * w,
      y = hash(i * 7.1 + 2) * h,
      L = 8 + 10 * hash(i);
    for (let k = 0; k < 3; k++) {
      g.moveTo(x + k * 4, y + k * 2);
      g.lineTo(x + k * 4 + L * 0.6, y + k * 2 - L);
    }
  }
  g.stroke();

  // speed lines: falling in they streak out from the middle, flying out
  // they pull in; redrawn on twos so they flicker like a drawn rush
  const sp = clamp01(Math.abs(f.rush) / 1.1);
  if (sp > 0.03) {
    const n = Math.round(16 + 26 * sp);
    // the ink wedges in one path and the coral ones in another, one fill each
    const alpha = (0.25 + 0.55 * sp) * clamp01(p * 4);
    for (const coral of [false, true]) {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        if ((i % 9 === 4) !== coral) continue;
        const s = frame * 31.7 + i * 5.13;
        const a = hash(s) * TAU;
        const r0 = (0.16 + 0.34 * hash(s + 1)) * diag * 0.5;
        const len = (0.12 + 0.3 * hash(s + 2)) * diag * 0.5 * (0.5 + sp);
        const wdt = 0.8 + 2.2 * hash(s + 3) * sp;
        // a wedge: thick at the outside, a point toward the middle
        const ca = Math.cos(a),
          sa = Math.sin(a);
        const x0 = cx + ca * r0,
          y0 = cy + sa * r0,
          x1 = cx + ca * (r0 + len),
          y1 = cy + sa * (r0 + len);
        g.moveTo(x0, y0);
        g.lineTo(x1 - sa * wdt, y1 + ca * wdt);
        g.lineTo(x1 + sa * wdt, y1 - ca * wdt);
        g.closePath();
      }
      g.fillStyle = css(coral ? CORAL : ink, alpha);
      g.fill();
    }
  }

  // the core's rings, coming up out of the deep: thin and pale far down,
  // bold as they pass you
  for (const i of f.order) {
    const d = f.z[i];
    const r = F / d;
    const a = clamp01((f.deep + 1.3 - d) / 1.2) * clamp01((d - 0.12) / 0.3);
    if (a < 0.01 || r > diag * 1.5) continue;
    const amp = 0.05 + 0.03 * Math.sin(t * 0.7 + i);
    const spin = t * 0.05 * (i % 2 ? 1 : -1) + i;
    const tq = Math.floor(t * 12) / 12; // the waveform moves on twos
    const n = Math.min(220, Math.max(48, Math.round(r / 3)));
    const pts = loop(cx, cy, r, 0.94, (th) => amp * f.wave(th + spin, i, tq), n);
    const near = clamp01(1.6 / d / 3);
    g.strokeStyle = css(inkRing(i, night), a * (0.35 + 0.65 * near));
    g.lineWidth = Math.max(0.8, Math.min(4.5, 2 / Math.sqrt(d)));
    // a far ring is a quick dashed pencil line; near ones are solid ink
    if (d > f.deep * 0.75) g.setLineDash([4, 6]);
    wobbly(g, pts, i * 13 + b, Math.min(3, 0.8 + r / 260));
    g.setLineDash([]);
  }

  // their songs, riding the rings in little ink frames
  for (const i of f.order) {
    const im = f.covers[i];
    if (!im || !im.complete || !im.naturalWidth) continue;
    const d = f.z[i];
    const r = F / d;
    const s = Math.min(150, r * 0.34);
    const a = clamp01((f.deep + 1.2 - d) / 0.9) * clamp01((d - 0.25) / 0.35) * clamp01(p * 2 - 1) * clamp01((r - 95) / 40);
    if (a < 0.01 || s < 6) continue;
    const ang = i * 2.39996 + t * 0.03;
    const x = cx + Math.cos(ang) * r - s / 2,
      y = cy + Math.sin(ang) * r * 0.94 - s / 2;
    const sq = squarePts(x, y, s, s * 0.22);
    g.save();
    g.globalAlpha = a;
    path(g, sq);
    g.clip();
    g.drawImage(im, x, y, s, s);
    g.restore();
    g.globalAlpha = a;
    g.strokeStyle = css(ink, 0.9);
    g.lineWidth = Math.max(1.2, s / 40);
    wobbly(g, sq, i * 5 + b, Math.min(1.6, s / 60));
    g.globalAlpha = 1;
  }
  g.restore();

  // the lip itself, drawn twice the way a quick sketch overlaps, gone once
  // it's past the corners of the screen
  if (edge < diag * 0.75) {
    const lip = clamp01((diag * 0.75 - edge) / (diag * 0.2));
    g.strokeStyle = css(ink, 0.95 * lip);
    g.lineWidth = 2.6;
    wobbly(g, hole, 3 + b, 1.4);
    g.strokeStyle = css(ink, 0.5 * lip);
    g.lineWidth = 1.2;
    wobbly(g, loop(cx, cy, edge * 0.985, 1, lipAmp, 160).slice(10, 130), 9 + b, 1.6);
  }
}
