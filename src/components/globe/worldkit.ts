import type { Season } from "./scene";
import type { C, Light } from "./setting";
import { Pen, css, mix, type Inks } from "./line";

// Shared bits for the drawn worlds (world.ts, mountain.ts): shapes, a few
// trees and buildings, and the colours the seasons bring.

export type Pt = [number, number];
export type Kit = {
  pens: Pen[]; // one per layer: far, middle, near
  I: Inks;
  L: Light;
  w: number; // one scene's width, points
  h: number;
  PW: number; // the whole loop
  season: Season;
};

export const TAU = Math.PI * 2;
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// a gentle wave that loops exactly once round the panorama, so a line drawn
// with it meets itself at the join
export function loopWave(x: number, PW: number, seed: number) {
  let s = 0;
  for (let k = 1; k <= 4; k++) s += Math.sin((TAU * k * (x + seed * 97)) / PW + seed * k * 1.7) / (k * 1.4);
  return s;
}

export const curve = (f: (x: number) => number, x0: number, x1: number, step = 6): Pt[] => {
  const pts: Pt[] = [];
  for (let x = x0; x < x1; x += step) pts.push([x, f(x)]);
  pts.push([x1, f(x1)]);
  return pts;
};

export const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 28, a0 = 0, a1 = TAU): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

// a leafy tree: trunk and a lumpy round crown (bare branches in winter)
// a broadleaf tree's crown through the year: fresh green in spring, deep
// green in summer, a mix of gold, orange, red and rust in autumn (each tree
// its own, picked by seed), bare in winter (callers skip the crown)
const AUTUMN: C[] = [
  [238, 178, 52],
  [228, 128, 48],
  [204, 76, 52],
  [244, 204, 76],
  [176, 112, 60],
];
export function foliage(I: Inks, seed: number, far = 0.04, summer: C = [100, 164, 80]): C {
  const s = I.season;
  const c: C =
    s === "autumn"
      ? AUTUMN[Math.floor(hash(seed * 3.7 + 1.3) * AUTUMN.length)]
      : s === "spring"
        ? mix([150, 204, 104], summer, 0.25)
        : s === "winter"
          ? [150, 128, 104]
          : summer;
  return I.paint(c, far);
}

export function leafy(pen: Pen, x: number, base: number, size: number, leaf: C, bare: boolean) {
  // autumn colours every crown, whatever green the caller had in mind
  if (pen.I.season === "autumn") leaf = foliage(pen.I, x);
  bare = bare || pen.I.season === "winter";
  pen.stroke(
    [
      [x, base],
      [x, base - size * 0.55],
    ],
    1.3,
  );
  if (bare) {
    for (const [dx, dy] of [
      [-0.35, -0.95],
      [0.3, -1],
      [-0.15, -1.15],
      [0.45, -0.8],
    ])
      pen.stroke(
        [
          [x, base - size * 0.45],
          [x + dx * size * 0.6, base + dy * size],
        ],
        1,
      );
    return;
  }
  const pts: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    // soft lumps, a bit flatter underneath
    const r = (1 + 0.07 * Math.abs(Math.sin(a * 3.5 + x))) * (Math.sin(a) > 0 ? 0.92 : 1);
    pts.push([x + Math.cos(a) * size * 0.5 * r, base - size * 0.95 + Math.sin(a) * size * 0.42 * r]);
  }
  pen.shape(pts, leaf, 1.3, x);
  if (pen.I.season === "spring") bloom(pen, x, base - size * 0.95, size * 0.5, size * 0.42);
}

// spring: little pink blossoms dotted over a crown
export function bloom(pen: Pen, cx: number, cy: number, rx: number, ry: number) {
  const n = Math.max(5, Math.round((rx * ry) / 45));
  for (let i = 0; i < n; i++) {
    const a = hash(i * 7 + cx) * TAU,
      r = Math.sqrt(hash(i * 13 + cx * 0.3)) * 0.8;
    const bx = cx + Math.cos(a) * rx * r,
      by = cy + Math.sin(a) * ry * r;
    const d = 1.1 + hash(i * 3 + cx) * 0.9;
    pen.fillOnly(ellipse(bx, by, d, d, 8), i % 4 ? [247, 168, 196] : [255, 236, 242]);
  }
}

// ---------------------------------------------------------------------------
// the coast
// ---------------------------------------------------------------------------

export function windows(
  pen: Pen,
  I: Inks,
  x: number,
  y: number,
  bw: number,
  bh: number,
  cols: number,
  rows: number,
  seed: number,
  glass: C,
) {
  const gx = bw / cols,
    gy = bh / rows;
  const ww = Math.max(2, gx * 0.5),
    wh = Math.max(2.5, gy * 0.55);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const lit = I.lit && hash(seed * 13.7 + r * 7.1 + c * 3.3) > 0.42;
      pen.shape(
        rect(x + gx * c + (gx - ww) / 2, y + gy * r + (gy - wh) / 2, ww, wh),
        lit ? I.window : glass,
        0.7,
        seed + r + c * 0.1,
      );
    }
}

// a little street lamp: post, arm and lantern
export function lamp(pen: Pen, I: Inks, x: number, base: number, ht: number) {
  pen.stroke(
    [
      [x, base],
      [x, base - ht],
    ],
    1.3,
    x,
  );
  pen.shape(rect(x - 2.5, base - ht - 5, 5, 5), I.lit ? I.window : I.paint([236, 232, 214], 0.04), 1, x + 1);
  pen.stroke(
    [
      [x - 3.5, base - ht - 5],
      [x, base - ht - 8],
      [x + 3.5, base - ht - 5],
    ],
    1,
    x + 2,
  );
}

export function house(
  pen: Pen,
  I: Inks,
  x: number,
  base: number,
  bw: number,
  ht: number,
  wall: C,
  roof: C,
  garage: boolean,
  seed: number,
) {
  const glass: C = I.paint([200, 224, 240], 0.04);
  pen.shape(rect(x, base - ht, bw, ht), wall, 1.3, seed);
  pen.shape(
    [
      [x - 4, base - ht],
      [x + bw / 2, base - ht - ht * 0.75],
      [x + bw + 4, base - ht],
    ],
    roof,
    1.3,
    seed + 1,
  );
  // a round window up in the gable
  pen.shape(ellipse(x + bw / 2, base - ht - ht * 0.3, 3, 3, 10), I.lit ? I.window : glass, 0.9, seed + 2);
  const dx = x + bw * 0.42;
  pen.shape(rect(dx, base - ht * 0.55, bw * 0.14, ht * 0.55), I.paint([120, 90, 70], 0.04), 1.1, seed + 3);
  pen.shape(ellipse(dx + bw * 0.11, base - ht * 0.28, 0.9, 0.9, 6), I.paint([240, 210, 120], 0.04), 0.6, seed + 4);
  for (const f of [0.1, 0.66]) {
    const wx = x + bw * f,
      wy = base - ht * 0.75;
    const lit = I.lit && hash(seed * 3 + f) > 0.35;
    pen.shape(rect(wx, wy, bw * 0.22, ht * 0.38), lit ? I.window : glass, 1, seed + f);
    pen.stroke(
      [
        [wx + bw * 0.11, wy],
        [wx + bw * 0.11, wy + ht * 0.38],
      ],
      0.6,
      seed + f + 1,
    );
    // shutters
    for (const s of [-3, bw * 0.22])
      pen.shape(rect(wx + s, wy, 3, ht * 0.38), mix(roof, [255, 255, 255], 0.15), 0.7, seed + s);
  }
  if (garage) {
    const gx = x + bw,
      gw = bw * 0.5,
      gh = ht * 0.72;
    pen.shape(rect(gx, base - gh, gw, gh), wall, 1.3, seed + 6);
    pen.shape(
      [
        [gx, base - gh],
        [gx + gw / 2, base - gh - gh * 0.4],
        [gx + gw + 3, base - gh],
      ],
      roof,
      1.2,
      seed + 7,
    );
    pen.shape(
      rect(gx + gw * 0.12, base - gh * 0.75, gw * 0.76, gh * 0.75),
      I.paint([236, 236, 230], 0.04),
      1,
      seed + 8,
    );
    for (let r = 1; r < 4; r++)
      pen.stroke(
        [
          [gx + gw * 0.12, base - gh * 0.75 + (gh * 0.75 * r) / 4],
          [gx + gw * 0.88, base - gh * 0.75 + (gh * 0.75 * r) / 4],
        ],
        0.6,
        seed + r,
      );
  }
}

export function fir(pen: Pen, I: Inks, x: number, base: number, ht: number, seed: number, far = 0.04) {
  const dark: C = I.snowy ? I.paint([90, 120, 110], far) : I.paint([60, 120, 90], far);
  pen.stroke(
    [
      [x, base],
      [x, base - ht * 0.2],
    ],
    1.1,
    seed,
  );
  for (let i = 0; i < 3; i++) {
    const tb = base - ht * (0.15 + i * 0.25),
      tt = tb - ht * 0.42,
      tw = ht * (0.3 - i * 0.07);
    const pts: Pt[] = [
      [x - tw, tb],
      [x - tw * 0.55, tb - ht * 0.06],
      [x - tw * 0.7, tb - ht * 0.03],
      [x, tt],
      [x + tw * 0.7, tb - ht * 0.03],
      [x + tw * 0.55, tb - ht * 0.06],
      [x + tw, tb],
    ];
    pen.shape(pts, dark, 1.1, seed + i);
    if (I.snowy)
      pen.fillOnly(
        [
          [x - tw * 0.3, tt + ht * 0.12],
          [x, tt],
          [x + tw * 0.3, tt + ht * 0.12],
        ],
        I.snow,
      );
  }
}

// hides whatever is drawn next behind things standing on the near layers:
// each obstacle is a stretch [x0, x1] of the loop, from yTop down, on the
// layer it stands on. Call inside g.save() / g.restore().
export function behind(
  g: CanvasRenderingContext2D,
  X: (x: number, layer: number) => number,
  PW: number,
  obstacles: [number, number, number, number][], // x0, x1, yTop, layer
) {
  g.beginPath();
  g.rect(-1e4, -1e4, 2e4, 2e4);
  for (const [a, b, top, layer] of obstacles) {
    const sx = X(a, layer);
    // wound the other way round, so overlapping obstacles stay holes
    for (const ox of [sx, sx - PW]) {
      g.moveTo(ox, top);
      g.lineTo(ox, 1e4);
      g.lineTo(ox + b - a, 1e4);
      g.lineTo(ox + b - a, top);
      g.closePath();
    }
  }
  g.clip("nonzero");
}

// a rowboat or a small fishing boat seen side on, floating at y
export function hull(pen: Pen, x: number, y: number, len: number, c: C, seed: number) {
  pen.shape(
    [
      [x - len / 2, y - len * 0.16],
      [x + len / 2 + 2, y - len * 0.2],
      [x + len * 0.4, y],
      [x - len * 0.42, y],
    ],
    c,
    1.2,
    seed,
  );
}
