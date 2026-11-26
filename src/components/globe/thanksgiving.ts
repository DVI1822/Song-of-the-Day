// Thanksgiving: Turkey Strut. For one day the Globe is a turkey's body: its
// tail feathers fan out behind the ball
// and its head peeks up over the top, bobbing. Drawn the doodle way
// (doodle-engine.js): paper base, loose watercolor washes, wobbly ink.
// The core's coral and green rings turn rust and gold.
//
// Only shows on Thanksgiving (the fourth Thursday of November) by the
// viewer's own clock, so it takes itself down at their midnight.
// ?holiday=turkey previews it on any day and ?holiday=off hides it.
//
// The feathers, neck and head are painted once (three wobbles each, for
// the boil) and each frame only stamps them, so it costs about as much as
// drawing three images.

// which of three wobbles the lines are on (same as ink.ts boil)
const boil = (t: number) => Math.floor(t * 4) % 3;

let query: string | null | undefined;

export function isThanksgiving(d: Date): boolean {
  if (d.getMonth() !== 10 || d.getDay() !== 4) return false;
  const n = Math.ceil(d.getDate() / 7);
  return n === 4;
}

// Is the turkey out right now? Only in the browser.
export function thanksgiving(): boolean {
  if (typeof window === "undefined") return false;
  if (query === undefined) query = new URLSearchParams(window.location.search).get("holiday");
  if (query === "off") return false;
  if (query === "turkey" || query === "thanksgiving") return true;
  return isThanksgiving(new Date());
}

// the core's two coloured rings
export const TG_RUST: [number, number, number] = [196, 98, 40];
export const TG_GOLD: [number, number, number] = [214, 158, 46];

const TAU = Math.PI * 2;
const INK = "#1d1b20";
const PAPER = "#f7f1e8";

type Pt = [number, number];

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// one painting pass: its own wobble, its own random hand
class Pen {
  r: () => number;
  grid: number[] = [];
  constructor(
    public g: CanvasRenderingContext2D,
    seed: number,
    public s: number, // the ball's radius / 160, so lines keep their weight
  ) {
    this.r = rng(seed);
    for (let i = 0; i < 256; i++) this.grid.push(this.r() * 2 - 1);
  }
  rnd(a: number, b: number) {
    return a + (b - a) * this.r();
  }
  nz(x: number) {
    const i = Math.floor(x),
      f = x - i,
      u = f * f * (3 - 2 * f);
    const a = this.grid[((i % 256) + 256) % 256],
      b = this.grid[(((i + 1) % 256) + 256) % 256];
    return a + (b - a) * u;
  }
  // a path that wanders off the straight line, like a pen
  jitter(pts: Pt[], amt: number, closed = false): Pt[] {
    const P = closed ? [...pts, pts[0]] : pts;
    const out: Pt[] = [];
    for (let i = 0; i < P.length - 1; i++) {
      const [a, b] = [P[i], P[i + 1]];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
        n = Math.max(1, Math.ceil(L / (9 * this.s)));
      const nx = -(b[1] - a[1]) / L,
        ny = (b[0] - a[0]) / L;
      for (let k = 0; k < n; k++) {
        const t = k / n,
          w = this.nz(a[0] * 0.03 + a[1] * 0.021 + t * L * 0.06) * amt;
        out.push([a[0] + (b[0] - a[0]) * t + nx * w, a[1] + (b[1] - a[1]) * t + ny * w]);
      }
    }
    out.push(P[P.length - 1]);
    return out;
  }
  path(pts: Pt[], closed: boolean) {
    const g = this.g;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (closed) g.closePath();
  }
  ink(pts: Pt[], lw = 1.6, closed = false, col = INK) {
    this.path(this.jitter(pts, 1.1 * this.s, closed), false);
    const g = this.g;
    g.strokeStyle = col;
    g.lineWidth = lw * this.s * this.rnd(0.85, 1.15);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke();
  }
  // opaque paper first, so nothing behind shows through
  base(poly: Pt[]) {
    this.path(poly, true);
    this.g.fillStyle = PAPER;
    this.g.fill();
  }
  // watercolor: a few offset see-through passes and a pooled darker edge,
  // never quite inside the lines
  wash(poly: Pt[], col: string, alpha = 0.8, loose = 1) {
    const g = this.g,
      s = this.s;
    const ox = this.rnd(-2, 2) * loose * s,
      oy = this.rnd(-1.5, 2) * loose * s;
    for (let k = 0; k < 3; k++) {
      const p = this.jitter(
        poly.map((q) => [q[0] + ox + this.rnd(-1.2, 1.2) * loose * s, q[1] + oy + this.rnd(-1.2, 1.2) * loose * s] as Pt),
        2.4 * loose * s,
        true,
      );
      this.path(p, true);
      g.fillStyle = rgba(col, alpha * (k ? 0.35 : 0.75));
      g.fill();
      if (!k) {
        g.strokeStyle = rgba(darker(col, 0.72), 0.35);
        g.lineWidth = 2 * s;
        g.stroke();
      }
    }
  }
}

function rgba(h: string, a: number) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function darker(h: string, k: number) {
  const n = parseInt(h.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.round(c * k));
  return "#" + ((1 << 24) + (f(n >> 16) << 16) + (f((n >> 8) & 255) << 8) + f(n & 255)).toString(16).slice(1);
}
const rot = (p: Pt, a: number): Pt => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];

// a feather lying along angle a, from radius r0 out to rt, widest near its
// tip; base colour, a cream band and a dark tip, like a real tail feather
function feather(p: Pen, a: number, r0: number, rt: number, w: number, col: string, band: string) {
  const len = rt - r0,
    mid = (r0 + rt) / 2,
    hl = len / 2;
  const out: Pt[] = [];
  for (let i = 0; i <= 28; i++) {
    const th = -Math.PI / 2 + (i / 28) * TAU;
    const c = Math.cos(th),
      sn = Math.sin(th);
    const x = mid + hl * Math.sign(c) * Math.abs(c) ** 0.8;
    const taper = 0.45 + 0.55 * ((x - r0) / len) ** 0.7;
    out.push([x, w * Math.sign(sn) * Math.abs(sn) ** 0.9 * taper]);
  }
  const poly = out.map((q) => rot(q, a));
  const g = p.g;
  p.base(poly);
  p.wash(poly, col, 0.9);
  // the bands, kept inside the feather
  g.save();
  p.path(poly, true);
  g.clip();
  const ring = (ra: number, rb: number, c: string, al: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 10; i++) pts.push(rot([ra, -w * 1.4 + (i / 10) * w * 2.8], a));
    for (let i = 10; i >= 0; i--) pts.push(rot([rb, -w * 1.4 + (i / 10) * w * 2.8], a));
    p.wash(pts, c, al, 0.6);
  };
  ring(rt - len * 0.3, rt - len * 0.17, band, 0.95);
  ring(rt - len * 0.08, rt + 4, "#4a2b1a", 0.9);
  g.restore();
  p.ink([...poly], 1.5, true);
  p.ink([rot([r0 + len * 0.15, 0], a), rot([rt - len * 0.12, 0], a)], 0.9);
  // a couple of barb strokes
  for (const u of [0.45, 0.62]) {
    const x = r0 + len * u;
    p.ink([rot([x, 0], a), rot([x + len * 0.1, -w * 0.55], a)], 0.6);
    p.ink([rot([x, 0], a), rot([x + len * 0.1, w * 0.55], a)], 0.6);
  }
}

// the tail fan, centred on the ball, radius R. The feathers are shortest
// straight up, so the fan stays under the date, and longest out the sides.
function paintTail(g: CanvasRenderingContext2D, R: number, seed: number) {
  const p = new Pen(g, seed, R / 160);
  const outer = ["#7a4527", "#8f5530", "#6b3a22"];
  const inner = ["#b5652a", "#c97a35", "#a9552a"];
  const a0 = Math.PI * 1.08,
    a1 = Math.PI * 1.92;
  const reach = (a: number, top: number, side: number) => R * (top + (side - top) * Math.abs(Math.cos(a)) ** 1.5);
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / (n - 1) + p.rnd(-0.015, 0.015);
    feather(p, a, R * 0.55, reach(a, 1.2, 1.5) * p.rnd(0.98, 1.01), R * 0.15, outer[i % 3], "#f1e2bf");
  }
  for (let i = 0; i < n - 1; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / (n - 1) + p.rnd(-0.015, 0.015);
    feather(p, a, R * 0.5, reach(a, 1.08, 1.3) * p.rnd(0.98, 1.01), R * 0.125, inner[i % 3], "#e9b949");
  }
}

// where the head sits: peeking up over the top of the ball, a bit right
const HEAD_A = (-72 * Math.PI) / 180;
const headAt = (R: number): Pt => rot([R * 1.1, 0], HEAD_A);

// the neck, rising from behind the ball to the head
function paintNeck(g: CanvasRenderingContext2D, R: number, seed: number) {
  const p = new Pen(g, seed, R / 160);
  const s = R / 160;
  const [hx, hy] = headAt(R);
  const a: Pt = rot([R * 0.8, 0], HEAD_A - 0.12);
  const c: Pt = rot([R * 0.98, 0], HEAD_A - 0.16);
  const left: Pt[] = [],
    right: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * hx,
      y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * hy;
    const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (hx - c[0]),
      dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (hy - c[1]);
    const L = Math.hypot(dx, dy) || 1,
      w = (11 - 3 * t) * s;
    left.push([x - (dy / L) * w, y + (dx / L) * w]);
    right.push([x + (dy / L) * w, y - (dx / L) * w]);
  }
  const neck = [...left, ...right.reverse()];
  p.base(neck);
  p.wash(neck, "#8f5530", 0.9);
  p.ink(neck, 1.6, true);
}

// the head, facing right, drawn over the ball's rim
function paintHead(g: CanvasRenderingContext2D, R: number, seed: number) {
  const p = new Pen(g, seed, R / 160);
  const s = R / 160;
  const [hx, hy] = headAt(R);
  const hr = 17 * s;
  const head: Pt[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    head.push([hx + Math.cos(a) * hr * 1.05, hy + Math.sin(a) * hr]);
  }
  p.base(head);
  p.wash(head, "#9fb8c9", 0.95);
  p.ink(head, 1.6, true);
  // beak, pointing right
  const beak: Pt[] = [
    [hx + hr * 0.85, hy - 4 * s],
    [hx + hr * 1.7, hy + 1 * s],
    [hx + hr * 0.85, hy + 6 * s],
  ];
  p.base(beak);
  p.wash(beak, "#f2b544", 1, 0.5);
  p.ink(beak, 1.3, true);
  // snood over the beak and the wattle under it
  const snood: Pt[] = [
    [hx + hr * 0.75, hy - 7 * s],
    [hx + hr * 1.15, hy - 3 * s],
    [hx + hr * 1.3, hy + 9 * s],
    [hx + hr * 1.12, hy + 14 * s],
    [hx + hr * 1.0, hy + 5 * s],
  ];
  p.base(snood);
  p.wash(snood, "#c8342b", 1, 0.5);
  p.ink(snood, 1.2, true);
  const wattle: Pt[] = [
    [hx + hr * 0.55, hy + 8 * s],
    [hx + hr * 0.92, hy + 10 * s],
    [hx + hr * 0.92, hy + 22 * s],
    [hx + hr * 0.6, hy + 25 * s],
    [hx + hr * 0.42, hy + 16 * s],
  ];
  p.base(wattle);
  p.wash(wattle, "#c8342b", 1, 0.5);
  p.ink(wattle, 1.2, true);
  // eye
  g.beginPath();
  g.arc(hx + hr * 0.3, hy - 4 * s, 4.4 * s, 0, TAU);
  g.fillStyle = "#fffaf0";
  g.fill();
  g.lineWidth = 1.2 * s;
  g.strokeStyle = INK;
  g.stroke();
  g.beginPath();
  g.arc(hx + hr * 0.4, hy - 4 * s, 2.1 * s, 0, TAU);
  g.fillStyle = INK;
  g.fill();
  // a little wisp of head feathers
  p.ink([[hx - 4 * s, hy - hr * 0.95], [hx - 8 * s, hy - hr * 1.5]], 1);
  p.ink([[hx + 1 * s, hy - hr * 0.98], [hx + 1 * s, hy - hr * 1.6]], 1);
}

// a painted piece and the box it covers, in units of R from the ball's centre
type Sprite = { c: HTMLCanvasElement; x: number; y: number; w: number; h: number };
type Sprites = { R: number; dpr: number; tail: Sprite[]; neck: Sprite[]; head: Sprite[] };
let sprites: Sprites | null = null;

type Paint = (g: CanvasRenderingContext2D, R: number, seed: number) => void;
// only as big as the piece, so the three wobbles stay light on memory
function sprite(R: number, dpr: number, box: [number, number, number, number], paint: Paint, seed: number): Sprite {
  const [x0, y0, x1, y1] = box.map((v) => v * R);
  const c = document.createElement("canvas");
  c.width = Math.ceil((x1 - x0) * dpr);
  c.height = Math.ceil((y1 - y0) * dpr);
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
  paint(g, R, seed);
  return { c, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const TAIL_BOX: [number, number, number, number] = [-1.62, -1.6, 1.62, 0.3];
const HEAD_BOX: [number, number, number, number] = [-0.25, -1.6, 0.85, -0.45];

function spritesFor(R: number, dpr: number): Sprites {
  if (sprites && sprites.R === R && sprites.dpr === dpr) return sprites;
  sprites = {
    R,
    dpr,
    tail: [0, 1, 2].map((b) => sprite(R, dpr, TAIL_BOX, paintTail, 17 + b * 31)),
    neck: [0, 1, 2].map((b) => sprite(R, dpr, HEAD_BOX, paintNeck, 5 + b * 13)),
    head: [0, 1, 2].map((b) => sprite(R, dpr, HEAD_BOX, paintHead, 7 + b * 13)),
  };
  return sprites;
}
const stamp = (g: CanvasRenderingContext2D, sp: Sprite, dx = 0, dy = 0) => g.drawImage(sp.c, sp.x + dx, sp.y + dy, sp.w, sp.h);

export type TurkeyFrame = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  R: number; // the ball's outline on screen
  zoom: number;
  op: number; // fades out flying into a song or the core
  t: number;
};

let blank = false;
export function drawTurkey(cv: HTMLCanvasElement | null, f: TurkeyFrame) {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(f.w * dpr),
    H = Math.round(f.h * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
    blank = false;
  }
  const g = cv.getContext("2d");
  if (!g) return;
  if (f.op <= 0.01) {
    if (!blank) g.clearRect(0, 0, W, H);
    blank = true;
    cv.style.opacity = "0";
    return;
  }
  blank = false;
  cv.style.opacity = f.op.toFixed(3);
  const S = spritesFor(f.R, dpr);
  const b = boil(f.t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  // centre on the ball, scaled with the camera's zoom
  g.setTransform(dpr * f.zoom, 0, 0, dpr * f.zoom, f.cx * dpr, f.cy * dpr);
  // the fan sways a little, and fans out wider every so often (a strut)
  const strut = Math.max(0, Math.sin(f.t * 0.45)) ** 6;
  g.save();
  g.rotate(Math.sin(f.t * 0.9) * 0.02);
  g.scale(1 + 0.04 * strut, 1 + 0.04 * strut);
  stamp(g, S.tail[b]);
  g.restore();
  // the head bobs, and dips forward now and then for a peck
  const u = S.R / 160;
  const peck = Math.max(0, Math.sin(f.t * 0.7 + 1)) ** 12;
  const hx = 2 * peck * u,
    hy = Math.sin(f.t * 2.4) * 1.5 * u + 3 * peck * u;
  stamp(g, S.neck[b], hx, hy);
  // the ball is the body: nothing behind it shows through
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.arc(0, 0, S.R - 1, 0, TAU);
  g.fill();
  g.globalCompositeOperation = "source-over";
  // and the head pokes up in front of its rim
  stamp(g, S.head[b], hx, hy);
}
