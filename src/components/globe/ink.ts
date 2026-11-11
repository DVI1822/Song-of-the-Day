// The drawn look: the whole Globe as simple ink lines, to match the
// line-drawn places behind it (line.ts, world.ts). On for everyone;
// ?ink=0 turns it off on this device (remembered), ?ink=1 turns it back on.
//
// What changes: the glass ball becomes an ink circle with a few lines of
// latitude and longitude turning with it and a couple of shine marks (no
// shadow on the ground); the songs get an ink outline; the core's
// neon rings are drawn in ink with a coral and a green one; and the buttons,
// tabs and panels become paper with a wobbly ink edge (globals.css, under
// [data-ink]). The lines "boil" a few times a second, the way hand-drawn
// animation does.

import { camV, PERSPECTIVE, type Camera, type V3 } from "./math";

const KEY = "tt-ink";
let on: boolean | null = null;

export function inkMode(): boolean {
  if (on !== null) return on;
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("ink");
  try {
    if (q === "1") localStorage.setItem(KEY, "1");
    if (q === "0") localStorage.setItem(KEY, "0");
    on = localStorage.getItem(KEY) !== "0";
  } catch {
    on = q !== "0";
  }
  return on;
}

export const INK: V3 = [29, 36, 51];
export const CHALK: V3 = [236, 240, 248];
export const CORAL: V3 = [255, 94, 87];
export const GREEN: V3 = [120, 200, 120];

const TAU = Math.PI * 2;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// smooth 1D noise, so a line wanders rather than jitters
function noise(x: number, seed: number) {
  const i = Math.floor(x),
    f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i + seed * 57.3) * (1 - u) + hash(i + 1 + seed * 57.3) * u) * 2 - 1;
}
export const css = (c: V3, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// which of three wobbles the lines are on right now: they redraw ~4 times a
// second, like a pencil test
export const boil = (t: number) => Math.floor(t * 4) % 3;

function fit(cv: HTMLCanvasElement, w: number, h: number, dpr: number) {
  const W = Math.round(w * dpr),
    H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
}

// a line through points, wobbled sideways a little along its length
export function wobbly(g: CanvasRenderingContext2D, pts: [number, number][], seed: number, amp = 0.9) {
  if (pts.length < 2) return;
  g.beginPath();
  let d = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i) d += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    const a = i < pts.length - 1 ? pts[i + 1] : pts[i - 1];
    let nx = -(a[1] - y),
      ny = a[0] - x;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const o = noise(d / 22, seed) * amp;
    if (i) g.lineTo(x + nx * o, y + ny * o);
    else g.moveTo(x + nx * o, y + ny * o);
  }
  g.stroke();
}

export type InkGlobeFrame = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  R: number; // the ball's outline on screen
  Rb: number; // where the songs sit
  zoom: number;
  cam: Camera;
  op: number; // fades out flying into a song or the core
  dk: number;
  day: number;
  sun: V3; // toward the sun, camera space
  t: number;
};

export function drawInkGlobe(cv: HTMLCanvasElement | null, f: InkGlobeFrame) {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  fit(cv, f.w, f.h, dpr);
  cv.style.opacity = f.op.toFixed(3);
  const g = cv.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  if (f.op <= 0.01) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.lineCap = "round";
  g.lineJoin = "round";
  const night = f.dk > 0.6;
  const ink = night ? CHALK : INK;
  const b = boil(f.t);

  // lines of latitude and longitude, turning with the songs; the far side
  // faint and broken, seen through the glass
  const Rg = f.Rb * 0.97 * f.zoom;
  const P = PERSPECTIVE;
  const proj = (v: V3) => {
    const e = camV(v, f.cam);
    const k = P / (P - Rg * e[2]);
    return { x: f.cx + Rg * e[0] * k, y: f.cy + Rg * e[1] * k, z: e[2] };
  };
  const curves: V3[][] = [];
  for (const lat of [-60, -30, 0, 30, 60]) {
    const la = (lat * Math.PI) / 180;
    const c: V3[] = [];
    for (let i = 0; i <= 96; i++) {
      const lo = (i / 96) * TAU;
      c.push([Math.cos(la) * Math.sin(lo), -Math.sin(la), Math.cos(la) * Math.cos(lo)]);
    }
    curves.push(c);
  }
  for (let m = 0; m < 6; m++) {
    const lo = (m / 6) * Math.PI;
    const c: V3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU;
      c.push([Math.cos(a) * Math.sin(lo), Math.sin(a), Math.cos(a) * Math.cos(lo)]);
    }
    curves.push(c);
  }
  curves.forEach((c, ci) => {
    const pts = c.map(proj);
    for (const front of [false, true]) {
      let run: [number, number][] = [];
      const flush = () => {
        if (run.length > 1) {
          if (!front) g.setLineDash([3, 5]);
          g.strokeStyle = css(ink, front ? 0.42 : 0.16);
          g.lineWidth = front ? 1.1 : 0.9;
          wobbly(g, run, ci * 7 + b, 0.8);
          g.setLineDash([]);
        }
        run = [];
      };
      for (const p of pts) {
        if (p.z > 0 === front) run.push([p.x, p.y]);
        else flush();
      }
      flush();
    }
  });

  // the outline of the ball, drawn twice the way a quick sketch overlaps
  // itself where the pen comes round
  const R = f.R * f.zoom;
  const ring = (r: number, a0: number, a1: number, seed: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const a = a0 + ((a1 - a0) * i) / 120;
      pts.push([f.cx + Math.cos(a) * r, f.cy + Math.sin(a) * r]);
    }
    wobbly(g, pts, seed, 1.1);
  };
  g.strokeStyle = css(ink, 0.9);
  g.lineWidth = 2.2;
  ring(R, -2.2, -2.2 + TAU + 0.18, 3 + b);
  // a few shine marks on the side facing the sun
  const sa = Math.atan2(f.sun[1], f.sun[0]);
  const shine = night ? 0.35 : 0.75 * (0.4 + 0.6 * f.day);
  g.strokeStyle = css(night ? CHALK : [255, 255, 255], shine);
  g.lineWidth = 3;
  ring(R * 0.86, sa - 0.42, sa + 0.12, 11 + b);
  g.lineWidth = 2.4;
  ring(R * 0.86, sa + 0.24, sa + 0.34, 12 + b);
  // and a little shadow line inside on the far side
  g.strokeStyle = css(ink, 0.3);
  g.lineWidth = 1.4;
  ring(R * 0.93, sa + Math.PI - 0.7, sa + Math.PI + 0.7, 13 + b);
}

// colour of the core's ring i in ink: mostly ink, one coral and one green
export function inkRing(i: number, night: boolean): V3 {
  if (i % 5 === 2) return CORAL;
  if (i % 5 === 4) return GREEN;
  return night ? CHALK : INK;
}
