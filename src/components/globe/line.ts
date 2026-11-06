import type { Season } from "./scene";
import type { C, Light } from "./setting";
import { PARALLAX, PIX, SLOPE, hash, noise1, type PixLayout } from "./pixel";

// Where you are, as a simple ink drawing: thin hand-drawn black lines over
// flat fills, so the real sky and weather do the colour and the mood. The
// same layouts as the pixel version (pixel.ts), drawn with lines instead of
// blocks, in three layers that turn with the globe.
//
// Fills (?line=):
//   1  sky:   every shape is filled with the sky's own horizon colour, so
//             the drawing reads as lines on the sky and changes with it
//   2  paper: a warm sketchbook white, dimmed by the light
//   3  wash:  a light watercolour wash of the real colours under the lines
// After dark the ink turns pale, like chalk.

const mix = (a: C, b: C, t: number): C => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: C, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

type Inks = {
  ink: string;
  inkC: C;
  fill: [C, C, C]; // far, middle, near
  snow: C;
  water: C;
  wall: C;
  roof: C;
  tree: C;
  meadow: C;
  window: C;
  style: number;
  night: number;
  lit: boolean;
  snowy: boolean;
  season: Season;
};

function inksFor(L: Light, season: Season, style: number): Inks {
  const n = L.night;
  // dark ink by day and through sunset; it only turns to chalk once it's
  // properly dark
  const chalk = Math.max(0, Math.min(1, (n - 0.62) / 0.25));
  const inkC = mix([26, 24, 34], [214, 222, 246], chalk * chalk * (3 - 2 * chalk));
  const sky = L.haze;
  const dim = (c: C) => mix(c, mix(sky, [16, 20, 40], 0.4), n * 0.8);
  let fill: [C, C, C];
  let snow: C, water: C, wall: C, roof: C, tree: C, meadow: C;
  if (style === 2) {
    const paper = dim(mix([248, 244, 234], sky, 0.18));
    fill = [paper, paper, paper];
    snow = water = wall = roof = tree = meadow = paper;
    water = dim(mix([236, 240, 244], sky, 0.3));
  } else if (style === 3) {
    const wash = (c: C, k = 0.45) => dim(mix(c, sky, k));
    const grass: C = season === "autumn" || season === "winter" ? [226, 206, 150] : season === "spring" ? [190, 216, 160] : [196, 214, 150];
    fill = [wash([176, 172, 200]), wash([126, 158, 136]), wash([104, 140, 116])];
    snow = wash([252, 252, 255], 0.15);
    water = wash([150, 190, 220], 0.3);
    wall = wash([236, 150, 140], 0.25);
    roof = wash([92, 130, 150], 0.3);
    tree = wash([96, 134, 108], 0.35);
    meadow = wash(grass, 0.3);
  } else {
    const f = (k: number) => mix(sky, k > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(k));
    fill = [f(0.14), f(0.06), f(-0.03)];
    snow = f(0.4);
    water = f(0.22);
    wall = f(0.1);
    roof = f(-0.06);
    tree = f(-0.03);
    meadow = f(0.02);
  }
  const snowy = L.snow > 0.45;
  if (snowy) meadow = snow;
  return { ink: css(inkC, 0.92), inkC, fill, snow, water, wall, roof, tree, meadow, window: [255, 206, 120], style, night: n, lit: L.lights > 0.3 && n > 0.2, snowy, season };
}

// a hand-drawn line: every point nudged a little, never ruler-straight
function wob(x: number, y: number, s: number): [number, number] {
  return [x + noise1(y * 0.13 + s, 3) * 0.7, y + noise1(x * 0.11 + s, 7) * 0.7];
}

class Pen {
  constructor(
    public g: CanvasRenderingContext2D,
    public I: Inks,
  ) {}
  path(pts: [number, number][], close = false, seed = 0) {
    const g = this.g;
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [a, b] = wob(x, y, seed + i * 0.01);
      if (i) g.lineTo(a, b);
      else g.moveTo(a, b);
    });
    if (close) g.closePath();
  }
  stroke(pts: [number, number][], w = 1.4, seed = 0) {
    this.path(pts, false, seed);
    this.g.lineWidth = w;
    this.g.strokeStyle = this.I.ink;
    this.g.stroke();
  }
  shape(pts: [number, number][], fill: C | null, w = 1.4, seed = 0) {
    this.path(pts, true, seed);
    if (fill) {
      this.g.fillStyle = css(fill);
      this.g.fill();
    }
    this.g.lineWidth = w;
    this.g.strokeStyle = this.I.ink;
    this.g.stroke();
  }
  fillOnly(pts: [number, number][], fill: C) {
    this.path(pts, true);
    this.g.fillStyle = css(fill);
    this.g.fill();
  }
}

const P = PIX; // layout pixels to points

function pine(pen: Pen, x: number, base: number, h: number, w = 1.3) {
  // tiers of little roofs, narrowing up
  const X = x * P,
    B = base * P,
    Hh = h * P;
  pen.stroke(
    [
      [X, B],
      [X, B - Hh * 0.18],
    ],
    w,
  );
  const tiers = h > 20 ? 4 : 3;
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const yb = B - Hh * (0.15 + t0 * 0.7);
    const yt = yb - Hh * 0.38;
    const half = Hh * 0.26 * (1 - t0 * 0.55);
    const pts: [number, number][] = [
      [X - half, yb],
      [X, yt],
      [X + half, yb],
    ];
    pen.shape(pts, pen.I.snowy && i === tiers - 1 ? pen.I.snow : pen.I.tree, w, x + i);
    if (pen.I.snowy)
      pen.stroke(
        [
          [X - half * 0.5, yb - Hh * 0.05],
          [X + half * 0.4, yb - Hh * 0.07],
        ],
        w * 0.8,
      );
  }
}

function blob(pen: Pen, cx: number, cy: number, rx: number, ry: number, fill: C, seed: number, w = 1.3) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 7 + seed * 2);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  pen.shape(pts, fill, w, seed);
}

function cotton(pen: Pen, x: number, base: number, h: number, poplar: boolean) {
  const X = x * P,
    B = base * P,
    Hh = h * P;
  pen.stroke(
    [
      [X, B],
      [X, B - Hh * 0.4],
    ],
    1.3,
  );
  if (poplar) blob(pen, X, B - Hh * 0.6, Hh * 0.13, Hh * 0.4, pen.I.snowy ? pen.I.snow : pen.I.tree, x);
  else blob(pen, X, B - Hh * 0.65, Hh * 0.38, Hh * 0.3, pen.I.snowy ? pen.I.snow : pen.I.tree, x);
}

// one layout, drawn into the three layers (each a 2D context already moved
// to where this stretch begins)
function drawLayout(gs: CanvasRenderingContext2D[], lay: PixLayout, I: Inks, L: Light) {
  const { W, H } = lay;
  const bottom = H * P;
  const sunSide = L.sun[0] >= 0 ? 1 : -1;

  // ---- far: the range, a few hatch lines on the shaded faces, snow caps
  {
    const pen = new Pen(gs[0], I);
    const top: [number, number][] = [];
    for (let x = 0; x <= W; x++) top.push([x * P, lay.range[Math.min(W - 1, x)] * P]);
    pen.fillOnly([[0, bottom], ...top, [W * P, bottom]], I.fill[0]);
    for (const p of lay.peaks) {
      // the snow cap: from the summit down to a zigzag hem
      const cap = H * (0.05 + 0.09 * L.snowline + (I.snowy ? 0.06 : 0)) * (p.half / (W * 0.15));
      const half = cap / SLOPE;
      const hem: [number, number][] = [];
      const n = Math.max(3, Math.round(half / 2.5));
      for (let i = 0; i <= n * 2; i++) {
        const x = p.x - half + (i / (n * 2)) * half * 2;
        hem.push([x * P, (p.top + cap - (i % 2 ? 2.4 : 0) + noise1(x / 3, 41)) * P]);
      }
      const capPts: [number, number][] = [[(p.x - half) * P, (p.top + cap) * P], [p.x * P, p.top * P], [(p.x + half) * P, (p.top + cap) * P], ...hem.slice().reverse()];
      const g = gs[0];
      g.save();
      pen.path(top.concat([[W * P, bottom], [0, bottom]]), true);
      g.clip();
      pen.fillOnly(capPts, I.snow);
      pen.stroke(hem, 1.1, p.x);
      // the spine, and hatching on the shaded face
      pen.stroke(
        [
          [p.x * P, p.top * P],
          [(p.x - sunSide * cap * 0.25) * P, (p.top + cap * 0.9) * P],
          [(p.x - sunSide * cap * 0.15) * P, (p.top + cap * 1.4) * P],
        ],
        1,
        p.x + 9,
      );
      for (let i = 0; i < 6; i++) {
        const d = cap * (1.2 + i * 0.35);
        const x0 = p.x - sunSide * (d / SLOPE) * (0.35 + hash(i + p.x) * 0.4);
        const y0 = p.top + d;
        pen.stroke(
          [
            [x0 * P, y0 * P],
            [(x0 + sunSide * 3.5) * P, (y0 + 3.5) * P],
          ],
          0.9,
          i,
        );
      }
      g.restore();
    }
    pen.stroke(top, 1.5, 1);
  }

  // ---- middle: the far forest, a treeline of little points
  const treeline = (g: CanvasRenderingContext2D, edge: number[], bottomOf: (x: number) => number, fill: C, tip: number, seed: number) => {
    const pen = new Pen(g, I);
    const pts: [number, number][] = [];
    for (let x = 0; x < W; x += 3) {
      const y = edge[x];
      pts.push([x * P, y * P]);
      pts.push([(x + 1.5) * P, (y - tip - hash(x + seed) * tip * 0.8) * P]);
    }
    pts.push([W * P, edge[W - 1] * P]);
    const low: [number, number][] = [];
    for (let x = W - 1; x >= 0; x -= 4) low.push([x * P, bottomOf(x) * P]);
    pen.fillOnly([...pts, [W * P, bottomOf(W - 1) * P], ...low, [0, bottomOf(0) * P]], fill);
    pen.stroke(pts, 1.2, seed);
    // a few trunks showing under the canopy
    for (let x = 4; x < W; x += 9) {
      const y = edge[x] + 2 + hash(x + seed) * 3;
      pen.stroke(
        [
          [x * P, y * P],
          [x * P, (y + 2) * P],
        ],
        0.9,
      );
    }
  };
  treeline(gs[1], lay.ridge, (x) => lay.near[x] + 14, I.fill[1], 2.2, 3);

  // ---- near: the near forest, the meadow, water, buildings, trees
  const g = gs[2];
  const pen = new Pen(g, I);
  treeline(g, lay.near, (x) => lay.edge[x] + 2, I.fill[2], 3.4, 8);
  const edge: [number, number][] = [];
  for (let x = 0; x <= W; x++) edge.push([x * P, lay.edge[Math.min(W - 1, x)] * P]);
  pen.fillOnly([...edge, [W * P, bottom], [0, bottom]], I.meadow);
  pen.stroke(edge, 1.3, 5);
  // rows across the meadow, closer together far away
  for (let k = 1; k < 9; k++) {
    const y = lay.valley + (H - lay.valley) * (k / 9) ** 1.8;
    for (let x = 2; x < W - 4; x += 10 + Math.floor(hash(k * 13 + x) * 8)) {
      if (y < lay.edge[x] + 2) continue;
      const len = 2 + (k / 9) * 5;
      pen.stroke(
        [
          [x * P, y * P],
          [(x + len) * P, y * P],
        ],
        0.8,
        k + x,
      );
    }
  }
  // grass tufts
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 3 + W) * W,
      y = lay.valley + 4 + hash(i * 7 + 1) * (H - lay.valley - 6);
    if (y < lay.edge[Math.floor(x)] + 3) continue;
    const s = 0.6 + ((y - lay.valley) / (H - lay.valley)) * 1.4;
    pen.stroke(
      [
        [(x - s) * P, (y - s) * P],
        [x * P, y * P],
        [(x + s) * P, (y - s * 1.2) * P],
      ],
      0.8,
      i,
    );
  }
  // the river: two banks and the water between
  const rows = lay.river.map((r, i) => ({ ...r, y: lay.valley + i })).filter((r) => r.hw > 0);
  if (rows.length > 2) {
    const left = rows.map((r) => [(r.c - r.hw) * P, r.y * P] as [number, number]);
    const right = rows.map((r) => [(r.c + r.hw) * P, r.y * P] as [number, number]);
    pen.fillOnly([...left, ...right.slice().reverse()], I.water);
    pen.stroke(left, 1.3, 11);
    pen.stroke(right, 1.3, 12);
    for (let i = 6; i < rows.length; i += 7) {
      const r = rows[i];
      if (r.hw < 3) continue;
      const o = (hash(i) - 0.5) * r.hw;
      pen.stroke(
        [
          [(r.c + o - r.hw * 0.25) * P, r.y * P],
          [(r.c + o + r.hw * 0.25) * P, r.y * P],
        ],
        0.8,
        i,
      );
    }
  }
  if (lay.lake) {
    const { cx, cy, rx, ry } = lay.lake;
    const pts: [number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push([(cx + Math.cos(a) * rx) * P, (cy + Math.sin(a) * ry) * P]);
    }
    pen.shape(pts, I.snowy ? I.snow : I.water, 1.3, 20);
    // the far shore's reflection and a few ripples
    for (let k = 0; k < 5; k++) {
      const y = cy - ry * 0.55 + k * ry * 0.3;
      const half = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) * (0.75 - k * 0.1);
      for (let x = cx - half; x < cx + half - 3; x += 8 + hash(k + x) * 6)
        pen.stroke(
          [
            [x * P, y * P],
            [(x + 3 + hash(x) * 3) * P, y * P],
          ],
          0.8,
          k,
        );
    }
  }
  if (lay.dock) {
    const { x0, x1, y } = lay.dock;
    pen.shape(
      [
        [x0 * P, y * P],
        [x1 * P, y * P],
        [x1 * P, (y + 1.2) * P],
        [x0 * P, (y + 1.2) * P],
      ],
      I.wall,
      1.1,
    );
    for (let x = x0 + 1; x < x1; x += 4)
      pen.stroke(
        [
          [x * P, (y + 1.2) * P],
          [x * P, (y + 3.5) * P],
        ],
        1,
      );
  }
  if (lay.trestle !== null) {
    const ty = lay.trestle;
    const x0 = W * 0.1,
      x1 = W * 0.9;
    pen.stroke(
      [
        [x0 * P, (ty - 0.5) * P],
        [x1 * P, (ty - 0.5) * P],
      ],
      1.3,
    );
    pen.stroke(
      [
        [x0 * P, (ty + 1) * P],
        [x1 * P, (ty + 1) * P],
      ],
      1.3,
    );
    for (let x = x0; x <= x1 - 8; x += 8) {
      const yb = ty + 12;
      pen.stroke(
        [
          [x * P, (ty + 1) * P],
          [x * P, yb * P],
        ],
        1.1,
        x,
      );
      pen.stroke(
        [
          [x * P, (ty + 1) * P],
          [(x + 8) * P, yb * P],
        ],
        0.8,
        x + 1,
      );
      pen.stroke(
        [
          [(x + 8) * P, (ty + 1) * P],
          [x * P, yb * P],
        ],
        0.8,
        x + 2,
      );
    }
    pen.stroke(
      [
        [x1 * P, (ty + 1) * P],
        [x1 * P, (ty + 12) * P],
      ],
      1.1,
    );
  }
  for (const f of lay.fence) {
    pen.stroke(
      [
        [f.x0 * P, (f.y - 3) * P],
        [f.x1 * P, (f.y - 3) * P],
      ],
      1,
      f.x0,
    );
    for (let x = f.x0; x <= f.x1; x += 5)
      pen.stroke(
        [
          [x * P, (f.y - 4.2) * P],
          [x * P, f.y * P],
        ],
        1,
        x,
      );
  }
  for (const hs of lay.houses) {
    const X = hs.x * P,
      Y = hs.y * P,
      w = 7 * P,
      h = 8 * P;
    pen.shape(
      [
        [X - w, Y],
        [X + w, Y],
        [X + w, Y - h],
        [X - w, Y - h],
      ],
      I.wall,
      1.3,
      hs.x,
    );
    const [chx, chy] = hs.chimney;
    pen.shape(
      [
        [chx * P, (chy + 6) * P],
        [chx * P, chy * P],
        [(chx + 2) * P, chy * P],
        [(chx + 2) * P, (chy + 6) * P],
      ],
      I.wall,
      1.1,
    );
    pen.shape(
      [
        [X - w - 2 * P, Y - h],
        [X, Y - h - 9 * P],
        [X + w + 2 * P, Y - h],
      ],
      I.snowy ? I.snow : I.roof,
      1.3,
      hs.x + 1,
    );
    pen.shape(
      [
        [X - P * 1.4, Y],
        [X - P * 1.4, Y - P * 5],
        [X + P * 1.4, Y - P * 5],
        [X + P * 1.4, Y],
      ],
      null,
      1.1,
    );
    for (const s of [-1, 1])
      pen.shape(
        [
          [X + s * P * 3.5, Y - P * 6.5],
          [X + s * P * 5.5, Y - P * 6.5],
          [X + s * P * 5.5, Y - P * 4.5],
          [X + s * P * 3.5, Y - P * 4.5],
        ],
        I.lit ? I.window : null,
        1,
      );
  }
  if (lay.bridge !== null) {
    const y = lay.bridge;
    const r = lay.river[y - lay.valley];
    const half = r.hw + 3;
    const arch: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const dx = -half + (i / 12) * half * 2;
      arch.push([(r.c + dx) * P, (y - 3 * Math.cos((dx / half) * Math.PI * 0.5)) * P]);
    }
    pen.stroke(arch, 1.4, 31);
    pen.stroke(
      arch.map(([x, yy]) => [x, yy - 3 * P] as [number, number]),
      1,
      32,
    );
    for (let i = 0; i <= 12; i += 3) {
      const [x, yy] = arch[i];
      pen.stroke(
        [
          [x, yy],
          [x, yy - 3 * P],
        ],
        1,
      );
    }
  }
  for (const t of lay.trees) {
    if (t.kind === "pine") pine(pen, t.x, t.y, t.h, t.h > 25 ? 1.6 : 1.2);
    else cotton(pen, t.x, t.y, t.h, t.kind === "poplar");
  }
}

// ---------------------------------------------------------------------------
// the loop, and how it's drawn each frame
// ---------------------------------------------------------------------------

export type LinePano = { W: number; H: number; top: number; scale: number; layers: HTMLCanvasElement[]; lays: PixLayout[]; I: Inks };

export function paintLinePano(lays: PixLayout[], L: Light, season: Season, style: number, dpr: number): LinePano {
  const I = inksFor(L, season, style);
  const W = lays[0].W * P,
    H = lays[0].H * P;
  // only the part with something in it: from just above the tallest peak
  const top = Math.max(0, Math.min(...lays.map((l) => Math.min(...l.range))) * P - 12);
  const PW = W * lays.length;
  const scale = Math.min(1.5, dpr);
  const layers = [0, 1, 2].map(() => {
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(PW * scale);
    cv.height = Math.ceil((H - top) * scale);
    return cv;
  });
  const gs = layers.map((cv) => {
    const g = cv.getContext("2d")!;
    g.lineCap = "round";
    g.lineJoin = "round";
    return g;
  });
  lays.forEach((lay, n) => {
    for (const g of gs) g.setTransform(scale, 0, 0, scale, n * W * scale, -top * scale);
    drawLayout(gs, lay, I, L);
  });
  return { W: PW, H, top, scale, layers, lays, I };
}

export function lineOffset(pano: LinePano, yaw: number, R: number, k: number) {
  const px = -yaw * R * PARALLAX[k];
  return ((px % pano.W) + pano.W) % pano.W;
}

export function drawLinePano(g: CanvasRenderingContext2D, pano: LinePano, yaw: number, R: number) {
  g.imageSmoothingEnabled = true;
  pano.layers.forEach((cv, k) => {
    const off = lineOffset(pano, yaw, R, k);
    const h = pano.H - pano.top;
    g.drawImage(cv, -off, pano.top, pano.W, h);
    g.drawImage(cv, pano.W - off, pano.top, pano.W, h);
  });
}

// the moving things, in ink: deer wandering, a trout jumping, chimney smoke,
// a canoe, the train, a hawk by day, fireflies at night
export function liveLines(g: CanvasRenderingContext2D, lay: PixLayout, I: Inks, L: Light, t: number, ox: number, wrap: number, first: boolean) {
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = I.ink;
  const X = (x: number) => {
    const v = x * P + ox;
    return ((v % wrap) + wrap) % wrap;
  };
  const line = (pts: [number, number][], w = 1.2) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), y * P) : g.moveTo(X(x), y * P)));
    g.lineWidth = w;
    g.stroke();
  };
  const circle = (x: number, y: number, r: number, fill: string | null, w = 1) => {
    g.beginPath();
    g.arc(X(x), y * P, r * P, 0, Math.PI * 2);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    g.lineWidth = w;
    g.stroke();
  };
  const night = I.night > 0.5;
  // smoke: little curls rising and drifting downwind
  const wind = 0.4 + Math.min(1, L.wind / 8);
  for (const hs of lay.houses) {
    const [cx, cy] = hs.chimney;
    for (let k = 0; k < 5; k++) {
      const age = (t * 0.12 + k / 5 + hs.x * 0.01) % 1;
      const x = cx + 1 + wind * age * age * 14 + Math.sin(age * 5 + t * 0.3) * 1.2;
      const y = cy - 1 - age * 16;
      g.globalAlpha = (1 - age) * Math.min(1, age * 6) * 0.8;
      circle(x, y, 0.6 + age * 1.6, null, 0.9);
    }
    g.globalAlpha = 1;
  }
  // deer: a doe and a fawn crossing the meadow, stopping to graze
  const ph = ((t + 12) % 70) / 70;
  const keys = [0, 0.25, 0.35, 0.6, 0.72, 1];
  const pos = [0, 0.35, 0.35, 0.7, 0.7, 1];
  let k = 0;
  while (k < keys.length - 2 && ph > keys[k + 1]) k++;
  const f = (ph - keys[k]) / (keys[k + 1] - keys[k]);
  const grazing = pos[k] === pos[k + 1];
  const along = pos[k] + (pos[k + 1] - pos[k]) * f;
  const dx0 = -10 + (lay.W + 20) * along;
  const fillC = css(I.meadow);
  const deer = (x: number, y: number, s: number, step: number, up: boolean) => {
    const bw = 6 * s;
    g.fillStyle = fillC;
    // legs, swinging when walking
    const sw = grazing ? 0 : step * 0.8;
    for (const [lx, d] of [
      [0.5, sw],
      [1.3, -sw],
      [bw - 1.3, -sw],
      [bw - 0.5, sw],
    ] as [number, number][])
      line(
        [
          [x + lx, y + 1],
          [x + lx + d, y + 1 + 3.4 * s],
        ],
        1.1,
      );
    // body
    g.beginPath();
    g.ellipse(X(x + bw / 2), (y + 0.6) * P, (bw / 2) * P, 1.4 * s * P, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 1.2;
    g.stroke();
    // neck and head
    if (up) {
      line(
        [
          [x + bw - 0.6, y],
          [x + bw + 0.6, y - 3 * s],
          [x + bw + 2.2 * s, y - 2.4 * s],
        ],
        1.2,
      );
      line(
        [
          [x + bw + 0.6, y - 3 * s],
          [x + bw + 0.2, y - 4.4 * s],
        ],
        1,
      );
    } else
      line(
        [
          [x + bw - 0.6, y],
          [x + bw + 1.2, y + 2.6 * s],
        ],
        1.2,
      );
    line(
      [
        [x, y],
        [x - 0.8, y - 0.6],
      ],
      1,
    ); // tail
  };
  if (I.snowy) {
    g.globalAlpha = 0.5;
    for (let px = -10; px < dx0 - 2; px += 3) line([[px, lay.deerY + 4.6], [px + 0.6, lay.deerY + 4.6]], 1);
    g.globalAlpha = 1;
  }
  const step = Math.floor(t * 4) % 2 ? 1 : -1;
  deer(dx0, lay.deerY, 1, step, !grazing || Math.sin(t * 0.8) > 0.6);
  deer(dx0 - 9, lay.deerY + 2, 0.7, -step, !grazing || Math.sin(t * 0.8 + 2) > 0.3);
  // a trout jumping: an arc out of the water and two splashes
  if (lay.fish.length && L.snow < 0.9) {
    const j = Math.floor(t / 6);
    const jt = (t % 6) / 1.1;
    const [fx, fy] = lay.fish[Math.floor(hash(j) * lay.fish.length)];
    const dir = hash(j + 7) > 0.5 ? 1 : -1;
    if (jt < 1) {
      const x = fx + dir * (jt - 0.5) * 8;
      const y = fy - Math.sin(jt * Math.PI) * 9;
      const ang = Math.atan2(-Math.cos(jt * Math.PI) * 9 * Math.PI, dir * 8);
      g.save();
      g.translate(X(x), y * P);
      g.rotate(ang);
      g.beginPath();
      g.ellipse(0, 0, 2.4 * P * 0.5 * 2, 0.9 * P * 0.5 * 2, 0, 0, Math.PI * 2);
      g.fillStyle = css(I.water);
      g.fill();
      g.lineWidth = 1.1;
      g.stroke();
      g.beginPath();
      g.moveTo(-2.4 * P, 0);
      g.lineTo(-3.4 * P, -0.9 * P);
      g.lineTo(-3.4 * P, 0.9 * P);
      g.closePath();
      g.stroke();
      g.restore();
    }
    for (const [at, sx] of [
      [0, fx - dir * 4],
      [1, fx + dir * 4],
    ]) {
      const a = (jt - at) * 1.6;
      if (a > 0 && a < 1) {
        g.globalAlpha = 1 - a;
        g.beginPath();
        g.ellipse(X(sx), fy * P, (1 + a * 3) * P, (0.4 + a) * P, 0, 0, Math.PI * 2);
        g.lineWidth = 1;
        g.stroke();
        g.globalAlpha = 1;
      }
    }
  }
  // a canoe paddling back and forth on the lake
  if (lay.lake && L.snow < 0.6) {
    const { cx, cy, rx } = lay.lake;
    const x = cx + Math.sin(t * 0.06) * rx * 0.55,
      y = cy + 1;
    g.fillStyle = css(I.wall);
    g.beginPath();
    g.moveTo(X(x - 5), (y - 1) * P);
    g.quadraticCurveTo(X(x), (y + 1.6) * P, X(x + 5), (y - 1) * P);
    g.closePath();
    g.fill();
    g.lineWidth = 1.2;
    g.stroke();
    circle(x, y - 2.6, 0.6, css(I.wall), 1);
    const st = Math.sin(t * 2) > 0 ? 1 : -1;
    line(
      [
        [x - st * 1.5, y - 3.2],
        [x + st * 2.2, y + 0.5],
      ],
      1,
    );
  }
  // the train crossing the trestle
  if (lay.trestle !== null) {
    const ty = lay.trestle - 0.6;
    const run = (t % 40) / 22;
    if (run < 1) {
      const x = lay.W * 0.1 - 7 + run * (lay.W * 0.8 + 38);
      g.save();
      g.beginPath();
      g.rect(X(lay.W * 0.1) - 0.5, 0, lay.W * 0.8 * P + 1, 4000);
      if (X(lay.W * 0.1) < X(lay.W * 0.9)) g.clip();
      g.fillStyle = css(I.wall);
      const box = (x0: number, w: number, h: number) => {
        g.beginPath();
        g.rect(X(x0), (ty - h) * P, w * P, h * P);
        g.fill();
        g.lineWidth = 1.2;
        g.stroke();
      };
      for (let c = 0; c < 3; c++) {
        box(x - 8 - c * 8, 7, 3.6);
        for (let wv = 0; wv < 2; wv++) circle(x - 6.5 - c * 8 + wv * 4, ty + 0.2, 0.7, css(I.fill[2]), 1);
      }
      box(x, 7, 3);
      box(x + 0.6, 2.6, 5.2);
      box(x + 4.6, 1.2, 4.6);
      for (let wv = 0; wv < 2; wv++) circle(x + 1.5 + wv * 4, ty + 0.2, 0.8, css(I.fill[2]), 1);
      for (let s = 0; s < 4; s++) {
        const age = (t * 0.9 + s / 4) % 1;
        g.globalAlpha = (1 - age) * 0.8;
        circle(x + 5.2 - age * 14, ty - 6 - age * 7, 0.6 + age * 1.6, null, 0.9);
      }
      g.globalAlpha = 1;
      g.restore();
    }
  }
  if (!first) return;
  if (!night) {
    // a hawk, a little v gliding in circles
    const a = t * 0.3;
    const hx = lay.W / 2 + Math.cos(a) * 18,
      hy = lay.H * 0.22 + Math.sin(a) * 4;
    const flap = Math.sin(t * 3) > 0.6 ? 0.8 : -0.4;
    line(
      [
        [hx - 2.4, hy - flap],
        [hx - 1, hy - 0.2],
        [hx, hy + 0.4],
        [hx + 1, hy - 0.2],
        [hx + 2.4, hy - flap],
      ],
      1.2,
    );
  } else if (!I.snowy) {
    g.fillStyle = "rgba(255,226,120,0.95)";
    for (let i = 0; i < 10; i++) {
      if (Math.sin(t * 1.4 + i * 2.3) < 0.5) continue;
      const x = lay.W * hash(i + 50) + Math.sin(t * 0.5 + i) * 3;
      const y = lay.valley + 6 + hash(i + 60) * (lay.H - lay.valley - 10) + Math.cos(t * 0.7 + i) * 2;
      g.beginPath();
      g.arc(X(x), y * P, 1.3, 0, Math.PI * 2);
      g.fill();
    }
  }
}
