import type { Season } from "./scene";
import type { C, Light } from "./setting";

// Where you are, in pixel art. The scene is painted into a small buffer (one
// "pixel" is a few screen points) with a handful of shades per material,
// mixed with an ordered dither, then blown up with hard edges.
//
// Prototype: Bozeman. The Bridgers in the back, forested foothills, the
// valley with the river winding toward you, a ranch with a red barn, and big
// pines at the edges. Lit by the real sun: which face of a peak is bright,
// gold at sunset, blue after dark, snow in winter, cottonwoods gold along
// the river in autumn.

export const PIX = 3; // screen points per pixel
const SLOPE = 0.95; // how steep the peaks are, pixels down per pixel across

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const dith = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mix = (a: C, b: C, t: number): C => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function noise1(x: number, seed: number) {
  const i = Math.floor(x),
    f = x - i;
  const a = hash(i + seed * 101) * 2 - 1,
    b = hash(i + 1 + seed * 101) * 2 - 1;
  return a + (b - a) * f * f * (3 - 2 * f);
}
const fbm = (x: number, seed: number, oct = 4) => {
  let s = 0,
    a = 0.5,
    f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise1(x * f, seed + i * 17);
    a *= 0.5;
    f *= 2.03;
  }
  return s;
};

// four shades per material, dark to light, as seen at midday
type Ramp = [C, C, C, C];
const NATURAL: Record<string, Ramp> = {
  rock: [[58, 60, 92], [92, 92, 124], [136, 134, 160], [182, 178, 196]],
  snow: [[140, 160, 206], [186, 202, 232], [224, 232, 246], [250, 252, 255]],
  forest: [[14, 38, 38], [24, 60, 48], [40, 88, 56], [70, 120, 66]],
  pine: [[10, 30, 32], [20, 52, 44], [34, 80, 52], [62, 112, 62]],
  grassSummer: [[62, 100, 48], [92, 132, 58], [130, 164, 76], [176, 196, 104]],
  grassAutumn: [[112, 92, 52], [152, 122, 62], [196, 160, 84], [224, 196, 120]],
  grassSpring: [[58, 110, 56], [86, 146, 66], [124, 180, 82], [170, 210, 110]],
  cottonGold: [[132, 96, 22], [184, 140, 30], [226, 184, 58], [248, 222, 120]],
  cottonGreen: [[36, 70, 40], [54, 98, 48], [82, 130, 60], [120, 162, 80]],
  barn: [[96, 26, 28], [140, 40, 36], [180, 60, 46], [210, 92, 68]],
  roof: [[50, 50, 62], [76, 78, 90], [106, 108, 120], [140, 142, 152]],
  wood: [[46, 32, 26], [70, 48, 34], [96, 68, 44], [126, 92, 58]],
  white: [[150, 150, 170], [196, 196, 206], [228, 226, 226], [250, 248, 244]],
};
// the same materials in soft storybook pastels
const PASTEL: Record<string, Ramp> = {
  ...NATURAL,
  rock: [[112, 100, 150], [150, 136, 182], [190, 172, 206], [222, 206, 228]],
  snow: [[176, 184, 222], [208, 214, 238], [234, 236, 248], [252, 250, 255]],
  forest: [[52, 92, 96], [72, 118, 112], [100, 146, 126], [140, 176, 146]],
  pine: [[40, 78, 84], [58, 104, 100], [84, 132, 116], [122, 164, 134]],
  grassSummer: [[150, 176, 130], [180, 202, 146], [210, 222, 164], [236, 238, 190]],
  grassAutumn: [[196, 150, 112], [222, 182, 132], [240, 208, 156], [250, 228, 186]],
  grassSpring: [[150, 190, 140], [176, 212, 156], [204, 228, 176], [230, 242, 200]],
  cottonGold: [[200, 140, 84], [226, 172, 98], [244, 202, 124], [252, 228, 164]],
  cottonGreen: [[96, 140, 112], [120, 166, 126], [150, 190, 142], [186, 214, 166]],
  barn: [[176, 92, 100], [212, 124, 128], [238, 160, 156], [250, 196, 186]],
  roof: [[56, 110, 120], [78, 140, 146], [108, 170, 170], [150, 200, 194]],
  wood: [[108, 74, 66], [140, 100, 84], [170, 128, 104], [200, 160, 132]],
  white: [[200, 190, 196], [228, 220, 218], [244, 238, 230], [255, 252, 244]],
};
let R = NATURAL;

// ---------------------------------------------------------------------------
// the light, per paint
// ---------------------------------------------------------------------------

type Shade = {
  L: Light;
  tint: C; // multiplies every colour: white at noon, gold low down, blue at night
  ambV: number; // how bright shadowed faces are, 0..1
  season: Season;
};

function shadeFor(L: Light, season: Season): Shade {
  const n = L.night;
  let tint: C = mix([1, 1, 1], [1.08, 0.86, 0.74], clamp01(L.alpen * 1.3));
  tint = mix(tint, [0.36, 0.42, 0.72], n);
  tint = mix(tint, mix([0.9, 0.92, 0.96], [0.3, 0.34, 0.5], n), L.overcast * 0.5);
  const ambV = 0.18 + 0.22 * (1 - n) + 0.15 * L.overcast;
  return { L, tint, ambV, season };
}

// how lit a face with normal n is, 0..~1.3
function light(S: Shade, n: [number, number, number]) {
  const L = S.L;
  const d = Math.max(0, n[0] * L.sun[0] + n[1] * L.sun[1] + n[2] * L.sun[2]);
  const sun = (L.sunC[0] + L.sunC[1] + L.sunC[2]) / 3;
  const m = Math.max(0, -0.55 * n[0] + 0.62 * n[1] + 0.56 * n[2]) * (L.moonC[2] * 1.4);
  return S.ambV + sun * d * 1.1 + m;
}

// the colour a pixel gets: a shade from the ramp (dithered), tinted by the
// time of day, faded by the air between
function col(S: Shade, ramp: Ramp, v: number, x: number, y: number, depth: number): C {
  const i = Math.max(0, Math.min(3, Math.floor(v * 3.2 + dith(x, y) * 0.35)));
  const c = ramp[i];
  const t: C = [c[0] * S.tint[0], c[1] * S.tint[1], c[2] * S.tint[2]];
  // the air comes in bands, not smoothly, so it stays pixel-crisp
  const a = clamp01(depth * S.L.hazeK);
  const step = Math.round((a + dith(x + 1, y + 2) * 0.12) * 6) / 6;
  return mix(t, S.L.haze, step);
}

// ---------------------------------------------------------------------------
// the layout
// ---------------------------------------------------------------------------

export type Comp = "hill" | "lake" | "train" | "stage";
type Tree = { x: number; y: number; h: number; depth: number; kind: "pine" | "cotton" | "poplar" };

export type PixLayout = {
  W: number;
  H: number;
  comp: Comp;
  style: number; // 1 natural, 2 pastel, 3 pastel with trees in rows
  range: number[]; // top of the far range per column
  peaks: { x: number; top: number; half: number }[];
  ridge: number[]; // the far forested ridge's top edge
  near: number[]; // the near forested ridge's top edge
  edge: number[]; // where the meadow starts, per column (a hill is just a raised edge)
  valley: number; // the meadow's highest point
  river: { c: number; hw: number }[]; // the river's centre and half-width per row from valley down (hw < 0: no water)
  lake: { cx: number; cy: number; rx: number; ry: number } | null;
  dock: { x0: number; x1: number; y: number } | null;
  trestle: number | null; // the railway deck's row
  trees: Tree[];
  houses: { x: number; y: number; chimney: [number, number] }[];
  fence: { x0: number; x1: number; y: number }[];
  bridge: number | null; // the footbridge's row
  deerY: number; // the row the deer walk along
  fish: [number, number][]; // places a trout might jump
};

// The scene sits low: the peaks rise only a little above the globe's
// bottom half, so most of the screen stays sky.
//   hill:  one cabin up on a knoll at the left, the river sweeping out to
//          the right, a single big peak off-centre
//   lake:  a still lake mirroring the peaks, a dock and a canoe
//   train: a railway trestle across the valley, a little train crossing it
//   stage: the mirrored, dead-centre version
export function pixLayout(w: number, h: number, seed: number, style = 2, comp: Comp = "hill"): PixLayout {
  const W = Math.ceil(w / PIX),
    H = Math.ceil(h / PIX);
  const mid = (W - 1) / 2;
  const sym = comp === "stage";
  const P = (x: number, top: number, half: number) => ({ x: x * (W - 1), top: top * H, half: half * W });
  const peaks =
    comp === "hill"
      ? [P(0.08, 0.6, 0.18), P(0.34, 0.63, 0.14), P(0.68, 0.5, 0.24), P(1.02, 0.59, 0.2)]
      : comp === "lake"
        ? [P(-0.02, 0.58, 0.2), P(0.3, 0.52, 0.2), P(0.58, 0.55, 0.18), P(0.86, 0.6, 0.16), P(1.04, 0.57, 0.2)]
        : comp === "train"
          ? [P(0.12, 0.62, 0.18), P(0.47, 0.49, 0.22), P(0.8, 0.6, 0.18)]
          : [P(0, 0.56, 0.3), P(0.24, 0.6, 0.17), P(0.5, 0.52, 0.2), P(0.76, 0.6, 0.17), P(1, 0.56, 0.3)];
  const range: number[] = [],
    ridge: number[] = [],
    near: number[] = [],
    edge: number[] = [];
  const knoll = (x: number) => {
    // the hill the cabin sits on, left of centre
    const d = (x / W - 0.2) / 0.3;
    return Math.abs(d) < 1 ? Math.cos(d * Math.PI * 0.5) ** 1.6 : 0;
  };
  for (let x = 0; x < W; x++) {
    let y = H;
    for (const p of peaks) y = Math.min(y, p.top + Math.abs(x - p.x) * SLOPE);
    const d = sym ? Math.abs(x - mid) : x,
      u = (sym ? Math.abs(x - mid) : x - mid) / W;
    range.push(Math.round(y + fbm(d / 7, seed + 5, 3) * 2.5));
    ridge.push(Math.round(H * (0.71 - 0.02 * Math.cos(u * 10)) + fbm(d / 22, seed + 9) * H * 0.02));
    near.push(Math.round(H * (0.76 - 0.03 * u * u * 4) + fbm(d / 30 + 4, seed + 13) * H * 0.012));
    let e = H * (0.8 - 0.012 * Math.cos(u * 6.8));
    if (comp === "hill") e -= knoll(x) * H * 0.075;
    if (comp === "lake") e = H * 0.785;
    edge.push(Math.round(e));
  }
  // ease every skyline to the same height at both ends, so layouts placed
  // side by side join up without a seam
  const B = 16;
  for (let x = 0; x < W; x++) {
    const d = Math.min(x, W - 1 - x);
    if (d >= B) continue;
    const k = (d / B) * (d / B) * (3 - (2 * d) / B);
    const to = (arr: number[], v: number) => (arr[x] = Math.round(v + (arr[x] - v) * k));
    to(range, H * 0.66);
    to(ridge, H * 0.71);
    to(near, H * 0.76);
    to(edge, H * 0.8);
  }
  const valley = Math.min(...edge);
  const river: PixLayout["river"] = [];
  for (let y = valley; y < H; y++) {
    const t = (y - Math.round(H * 0.8)) / (H - H * 0.8);
    if (t < 0) {
      river.push({ c: mid, hw: -1 });
      continue;
    }
    let c = mid,
      hw = 0.8 + t * t * W * 0.1;
    if (comp === "hill") c = W * (0.46 + 0.42 * t ** 1.4) + Math.sin(t * 7) * 3; // out to the right
    if (comp === "train") c = W * (0.62 - 0.4 * t ** 1.2) + Math.sin(t * 6 + 1) * 4; // out to the left
    if (comp === "lake") hw = -1;
    if (comp === "hill" || comp === "train") hw = 0.8 + t * t * W * 0.08;
    river.push({ c, hw });
  }
  const trees: Tree[] = [];
  const add = (x: number, t: Omit<Tree, "x">) => trees.push({ ...t, x: Math.round(x) });
  const pair = (x: number, t: Omit<Tree, "x">) => {
    add(mid - x, t);
    add(mid + x, t);
  };
  const rowY = (x: number) => edge[Math.max(0, Math.min(W - 1, Math.round(x)))] + 1;
  // the forest edge: a ragged line, or one perfectly spaced row in style 3
  if (sym) {
    for (let x = 2; x < mid - 2; x += style === 3 ? 7 : 3 + Math.floor(hash(x * 5 + seed) * 4)) pair(x, { y: rowY(mid - x), h: style === 3 ? 8 : 5 + Math.floor(hash(x * 9 + seed) * 5), depth: 0.6, kind: "pine" });
  } else if (comp !== "hill") {
    for (let x = 1; x < W; x += style === 3 ? 7 : 3 + Math.floor(hash(x * 5 + seed) * 4)) add(x, { y: rowY(x), h: style === 3 ? 8 : 5 + Math.floor(hash(x * 9 + seed) * 5), depth: 0.6, kind: "pine" });
  } else {
    for (let x = W * 0.45; x < W; x += 3 + Math.floor(hash(x * 5 + seed) * 4)) add(x, { y: rowY(x), h: 5 + Math.floor(hash(x * 9 + seed) * 5), depth: 0.6, kind: "pine" });
  }
  // trees along the water
  const rv = river.map((r, i) => ({ ...r, y: valley + i })).filter((r) => r.hw > 0);
  for (let i = 4; i < rv.length; i += style === 3 ? 7 : 2) {
    const r = rv[i];
    const t = i / rv.length;
    for (const side of [-1, 1])
      if (style === 3 || hash(i * 7 + side + seed) < 0.12) {
        const kind = style === 3 ? "poplar" : "cotton";
        add(r.c + side * (r.hw + 6 + (style === 3 ? t * W * 0.06 : hash(i + side) * 10)), { y: r.y, h: Math.round((style === 3 ? 6 : 3) + t * (style === 3 ? 14 : 10)), depth: 0.3 - t * 0.2, kind });
      }
  }
  // big pines framing the edges (only on one side for the hill)
  if (sym) {
    pair(mid - 3, { y: H + 2, h: 44, depth: 0.02, kind: "pine" });
    pair(mid - 12, { y: H + 2, h: 30, depth: 0.02, kind: "pine" });
  } else if (comp === "hill") {
    add(W - 4, { y: H + 2, h: 46, depth: 0.02, kind: "pine" });
    add(W - 13, { y: H + 2, h: 30, depth: 0.02, kind: "pine" });
    // a few pines dotted down the knoll
    for (const [fx, hh] of [
      [0.04, 12],
      [0.09, 9],
      [0.33, 8],
      [0.39, 11],
    ])
      add(fx * W, { y: rowY(fx * W) + 3, h: hh, depth: 0.25, kind: "pine" });
  } else {
    add(3, { y: H + 2, h: 42, depth: 0.02, kind: "pine" });
    add(W - 5, { y: H + 2, h: 36, depth: 0.02, kind: "pine" });
  }
  trees.sort((a, b) => a.y - b.y);

  const house = (x: number, y: number, chimneySide = 1) => ({ x: Math.round(x), y: Math.round(y), chimney: [Math.round(x) + chimneySide * 4 - (chimneySide < 0 ? 1 : 0), Math.round(y) - 13] as [number, number] });
  let houses: PixLayout["houses"] = [];
  let fence: PixLayout["fence"] = [];
  let bridge: number | null = null,
    lake: PixLayout["lake"] = null,
    dock: PixLayout["dock"] = null,
    trestle: number | null = null,
    deerY = Math.round(H * 0.86);
  const fish: [number, number][] = [];
  for (const r of rv.slice(Math.floor(rv.length * 0.55))) if (r.hw > 2.5) fish.push([r.c, r.y]);
  if (comp === "hill") {
    const hx = W * 0.2;
    houses = [house(hx, edge[Math.round(hx)] + 2, -1)];
    fence = [{ x0: Math.round(W * 0.05), x1: Math.round(W * 0.36), y: Math.round(edge[Math.round(W * 0.2)] + 8) }];
    deerY = Math.round(H * 0.875);
  } else if (comp === "lake") {
    lake = { cx: mid, cy: H * 0.835, rx: W * 0.44, ry: H * 0.042 };
    dock = { x0: Math.round(W * 0.66), x1: Math.round(W * 0.86), y: Math.round(H * 0.82) };
    houses = [house(W * 0.87, H * 0.8)];
    for (let i = 0; i < 8; i++) fish.push([mid + (hash(i + 3) - 0.5) * W * 0.6, H * 0.835 + (hash(i + 8) - 0.5) * H * 0.04]);
    deerY = Math.round(H * 0.905);
  } else if (comp === "train") {
    trestle = Math.round(H * 0.835);
    houses = [house(W * 0.16, H * 0.95)];
    fence = [{ x0: Math.round(W * 0.6), x1: Math.round(W * 0.96), y: Math.round(H * 0.93) }];
    deerY = Math.round(H * 0.875);
  } else {
    const hx = W * 0.3,
      hy = H * 0.885;
    houses = [house(mid - hx, hy, -1), house(mid + hx, hy)];
    fence = [
      { x0: Math.round(mid - W * 0.46), x1: Math.round(mid - W * 0.1), y: Math.round(H * 0.925) },
      { x0: Math.round(mid + W * 0.1), x1: Math.round(mid + W * 0.46), y: Math.round(H * 0.925) },
    ];
    bridge = Math.round(H * 0.96);
  }
  return { W, H, comp, style, range, peaks, ridge, near, edge, valley, river, lake, dock, trestle, trees, houses, fence, bridge, deerY, fish };
}

// ---------------------------------------------------------------------------
// painting
// ---------------------------------------------------------------------------

class Buf {
  d: Uint8ClampedArray<ArrayBuffer>;
  constructor(
    public W: number,
    public H: number,
  ) {
    this.d = new Uint8ClampedArray(W * H * 4);
  }
  set(x: number, y: number, c: C) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const i = (y * this.W + x) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = 255;
  }
}

function pine(b: Buf, S: Shade, x: number, base: number, h: number, depth: number, snowy: boolean) {
  const sunX = S.L.sun[0] >= 0 ? 1 : -1;
  const top = base - h;
  // trunk
  for (let y = base - Math.max(1, Math.round(h * 0.15)); y < base; y++) b.set(x, y, col(S, R.wood, 0.5, x, y, depth));
  for (let y = top; y < base - Math.round(h * 0.12); y++) {
    const t = (y - top) / (h * 0.88);
    // tiers: the width saws back in every few rows
    const tier = (t * 4) % 1;
    const half = Math.max(0, Math.round((0.15 + t * 0.85) * h * 0.24 * (0.55 + 0.45 * tier)));
    for (let dx = -half; dx <= half; dx++) {
      const lit = dx * sunX > 0 ? 0.35 : dx * sunX < 0 ? -0.15 : 0.1;
      const edge = Math.abs(dx) === half ? -0.1 : 0;
      const v = light(S, [0, 0.4, 0.9]) * 0.7 + lit + edge;
      const onTop = snowy && (tier < 0.3 || y === top);
      b.set(x + dx, y, onTop && dx * sunX >= -1 ? col(S, R.snow, v + 0.2, x + dx, y, depth) : col(S, R.pine, v, x + dx, y, depth));
    }
  }
}

function cottonwood(b: Buf, S: Shade, x: number, base: number, h: number, depth: number, ramp: Ramp) {
  const sunX = S.L.sun[0] >= 0 ? 1 : -1;
  for (let y = base - Math.round(h * 0.35); y < base; y++) b.set(x, y, col(S, R.wood, 0.4, x, y, depth));
  const cy = base - h * 0.65,
    r = h * 0.42;
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let dx = -Math.ceil(r * 1.1); dx <= r * 1.1; dx++) {
      const nx = dx / (r * 1.1),
        ny = (y - cy) / r;
      const d = nx * nx + ny * ny;
      if (d > 1 - hash(dx * 13 + y * 7 + x) * 0.25) continue;
      const v = light(S, [nx, -ny + 0.3, 0.7]) * 0.8 + (nx * sunX > 0.2 ? 0.25 : 0) - (ny > 0.4 ? 0.2 : 0);
      b.set(x + dx, y, col(S, ramp, v, x + dx, y, depth));
    }
}

function poplar(b: Buf, S: Shade, x: number, base: number, h: number, depth: number, ramp: Ramp) {
  const sunX = S.L.sun[0] >= 0 ? 1 : -1;
  for (let y = base - 2; y < base; y++) b.set(x, y, col(S, R.wood, 0.4, x, y, depth));
  const top = base - h;
  for (let y = top; y < base - 2; y++) {
    const t = (y - top) / (h - 2);
    const half = Math.round(Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.95) * h * 0.16);
    for (let dx = -half; dx <= half; dx++) {
      const v = light(S, [0, 0.4, 0.9]) * 0.75 + (dx * sunX > 0 ? 0.25 : dx * sunX < 0 ? -0.12 : 0.05);
      b.set(x + dx, y, col(S, ramp, v, x + dx, y, depth));
    }
  }
}

// paints one layout into three layers, far (the range), middle (the far
// forest) and near (everything else), so they can slide past each other
function paintLayers(lay: PixLayout, L: Light, season: Season): [Buf, Buf, Buf] {
  const { W, H } = lay;
  R = lay.style >= 2 ? PASTEL : NATURAL;
  const S = shadeFor(L, season);
  const far = new Buf(W, H),
    midB = new Buf(W, H),
    nearB = new Buf(W, H);
  let b = far;
  const snowy = L.snow > 0.45;

  // the far range: each peak has a sunny face and a shaded face split down a
  // slightly crooked spine, faint striations running down each face, and a
  // snow cap with a sawtooth hem (deeper in winter)
  const sunSide = L.sun[0] >= 0 ? 1 : -1;
  const capK = 0.05 + 0.09 * L.snowline + (snowy ? 0.08 : 0);
  for (let x = 0; x < W; x++) {
    const y0 = lay.range[x];
    let best = lay.peaks[0],
      bestY = Infinity;
    for (const p of lay.peaks) {
      const yy = p.top + Math.abs(x - p.x) * SLOPE;
      if (yy < bestY) {
        bestY = yy;
        best = p;
      }
    }
    for (let y = y0; y < lay.ridge[x] + 16; y++) {
      const dy = y - best.top;
      const spine = best.x + dy * 0.12 * (best.x < W / 2 ? 1 : -1) + noise1(dy / 6, best.x) * 1.2;
      const face = x < spine ? -1 : 1;
      const lit = face === sunSide;
      // run along the face's slope so streaks follow the fall line
      const along = (x - best.x) * face * 0.8 - dy;
      const streak = noise1(along / 3.2, 31 + best.x) > 0.45;
      const sub = noise1(along / 9, 77 + best.x) > 0.2; // a secondary rib
      let v = lit ? light(S, [face * 0.75, 0.5, 0.45]) : Math.min(0.5, light(S, [face * 0.75, 0.5, 0.45]) * 0.6);
      v += (streak ? -0.14 : 0) + (sub && lit ? 0.08 : 0);
      const cap = H * capK * (best.half / (W * 0.15));
      const zig = Math.abs((((x + Math.floor(best.x)) % 8) + 8) % 8 - 4) * 1.1; // little teeth
      const hem = cap + noise1(x / 5, 41) * 3 - zig;
      const isSnow = dy < hem || (streak && dy < hem + cap * 0.7 && !sub);
      const depth = 0.55 - Math.min(1, dy / (H * 0.3)) * 0.15;
      b.set(x, y, col(S, isSnow ? R.snow : R.rock, v + (isSnow ? 0.25 : 0), x, y, depth));
    }
  }

  // a forested ridge: a fill with small tree shapes stamped across it in
  // staggered rows (lit on the sun's side), and pointed tips along the top
  const forest = (top: number[], bottom: (x: number) => number, depth: number, ramp: Ramp, seed: number) => {
    const base = light(S, [0, 0.55, 0.8]) * 0.62;
    for (let x = 0; x < W; x++) for (let y = top[x]; y < bottom(x); y++) b.set(x, y, col(S, snowy ? R.snow : ramp, base - 0.18 - (snowy ? 0.1 : 0), x, y, depth));
    for (let row = 0; ; row++) {
      const yy = Math.min(...top) + row * 3;
      if (yy > H) break;
      const mid = Math.floor((W - 1) / 2);
      const xs: number[] = [];
      for (let x = (row % 2) * 2 + Math.floor(hash(row + seed) * 3); x <= mid; x += 4 + Math.floor(hash(x * 3 + row * 11 + seed) * 2)) xs.push(x, W - 1 - x);
      for (const x of xs) {
        const ty = row === 0 ? top[x] : yy;
        if (ty < top[x] || ty > bottom(x) + 1) continue;
        const th = 3 + Math.floor(hash(x + row * 7 + seed) * 3);
        for (let k = 0; k < th; k++) {
          const half = Math.floor(k / 2);
          for (let dx = -half; dx <= half; dx++) {
            const side = dx * sunSide > 0 ? 0.16 : dx * sunSide < 0 ? -0.1 : 0.05;
            const sn = snowy && k < 2;
            b.set(x + dx, ty - th + k + 1, col(S, sn ? R.snow : ramp, base + side + (sn ? 0.2 : 0), x + dx, ty - th + k, depth));
          }
        }
      }
    }
  };
  b = midB;
  forest(lay.ridge, (x) => lay.near[x] + 14, 0.5, R.forest, 3);
  b = nearB;
  forest(lay.near, (x) => lay.edge[x] + 2, 0.28, R.pine, 8);

  // the valley floor: broad fields in flat colours, the river through it
  const grass = snowy ? R.snow : season === "autumn" ? R.grassAutumn : season === "spring" ? R.grassSpring : season === "winter" ? R.grassAutumn : R.grassSummer;
  const field = light(S, [0, 1, 0.3]) * 0.6;
  for (let y = lay.valley; y < H; y++) {
    const r = lay.river[y - lay.valley];
    const t = (y - lay.valley) / (H - lay.valley);
    for (let x = 0; x < W; x++) {
      if (y < lay.edge[x]) continue;
      const dx = x - r.c;
      if (Math.abs(dx) <= r.hw) {
        // water: the sky, darker at the banks, a bright streak down the middle
        const k = Math.abs(dx) / Math.max(1, r.hw);
        const sky = L.haze;
        let c: C = mix(mix(sky, [255, 255, 255], 0.18), mix(sky, [20, 40, 70], 0.45), k * k + (dith(x, y) + 0.5) * 0.15);
        c = [c[0] * S.tint[0] * 0.9 + 10, c[1] * S.tint[1] * 0.95 + 10, c[2] * S.tint[2] + 10];
        b.set(x, y, c);
      } else {
        // fields: big patches split by a few gently sloped lines
        let pv: number;
        if (lay.style >= 2) {
          // tidy mown stripes, wider as they come toward you
          const band = Math.floor(Math.sqrt(t) * 9);
          pv = band % 2 ? 0.16 : -0.08;
        } else {
          const u = Math.abs(x - r.c) - (y - lay.valley) * 0.9;
          const patch = Math.floor(u / 22 + fbm(y / 40, 3) * 1.2 + (y - lay.valley) / 26);
          pv = [0.1, -0.06, 0.03, -0.12][((patch % 4) + 4) % 4];
        }
        const bank = r.hw > 0 && Math.abs(dx) - r.hw < 1.5;
        const rim = y - lay.edge[x] < 2;
        // a hill's flanks: brighter on the side facing the sun
        const sl = lay.edge[Math.min(W - 1, x + 2)] - lay.edge[Math.max(0, x - 2)];
        const flank = y - lay.edge[x] < 18 ? Math.max(-0.16, Math.min(0.16, sl * sunSide * 0.05)) : 0;
        const v = field + pv + flank + (bank ? -0.28 : 0) + (rim ? -0.2 : 0);
        b.set(x, y, col(S, grass, v, x, y, 0.22 - t * 0.22));
      }
    }
  }
  for (const t of lay.trees) if (t.depth > 0.5) pine(b, S, t.x, t.y, t.h, t.depth, snowy);
  // the lake: a mirror of everything above it, broken by faint ripples
  if (lay.lake) {
    const { cx, cy, rx, ry } = lay.lake;
    const top = Math.round(cy - ry);
    // what the lake sees: all three layers as they stand
    const src = new Uint8ClampedArray(far.d);
    for (const l of [midB, nearB])
      for (let i = 0; i < src.length; i += 4)
        if (l.d[i + 3]) {
          src[i] = l.d[i];
          src[i + 1] = l.d[i + 1];
          src[i + 2] = l.d[i + 2];
        }
    for (let y = top - 2; y <= cy + ry + 2; y++)
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (e > 1.25) continue;
        if (e > 1) {
          b.set(x, y, col(S, snowy ? R.snow : R.wood, light(S, [0, 1, 0.3]) * 0.6 + 0.1, x, y, 0.15)); // the shore
          continue;
        }
        const ox = Math.round(Math.sin(y * 1.9) * (y - top) * 0.08);
        const sy = Math.max(0, 2 * top - y);
        const sx = Math.max(0, Math.min(W - 1, x + ox));
        const i = (sy * W + sx) * 4;
        let c: C = [src[i], src[i + 1], src[i + 2]];
        c = mix(c, L.haze, 0.22 + (y - top) / (ry * 2) * 0.25);
        c = [c[0] * 0.86, c[1] * 0.9, c[2] * 0.98];
        if (((y - top) % 3 === 1 && dith(x, y) > 0.2) || snowy) c = mix(c, snowy ? [230, 236, 248] : [255, 255, 255], snowy ? 0.75 : 0.25);
        b.set(x, y, c);
      }
  }
  if (lay.dock) {
    const { x0, x1, y } = lay.dock;
    for (let x = x0; x <= x1; x++) {
      b.set(x, y, col(S, R.wood, 0.85, x, y, 0.05));
      b.set(x, y + 1, col(S, R.wood, 0.3, x, y + 1, 0.05));
      if ((x - x0) % 5 === 0) for (let k = 2; k < 5; k++) b.set(x, y + k, col(S, R.wood, 0.2, x, y + k, 0.05));
    }
  }
  // the railway trestle: a deck on criss-crossed legs, spanning the valley
  if (lay.trestle !== null) {
    const ty = lay.trestle;
    for (let x = Math.round(W * 0.1); x < W * 0.9; x++) {
      const ground = Math.min(H - 1, ty + 12);
      b.set(x, ty - 1, col(S, R.roof, 0.9, x, ty - 1, 0.15));
      b.set(x, ty, col(S, R.wood, 0.75, x, ty, 0.15));
      b.set(x, ty + 1, col(S, R.wood, 0.3, x, ty + 1, 0.15));
      const k = x % 12;
      for (let y = ty + 2; y < ground; y++) {
        const d = (y - ty - 2) * 1.5;
        if (k === 0 || (d % 12 | 0) === k || (d % 12 | 0) === 11 - k) b.set(x, y, col(S, R.wood, k === 0 ? 0.45 : 0.25, x, y, 0.15));
      }
    }
  }
  // the fences, the cabins, the footbridge
  for (const f of lay.fence)
    for (let x = f.x0; x < f.x1; x++) {
      b.set(x, f.y - 3, col(S, R.white, 0.6, x, f.y - 3, 0.1));
      if ((x - f.x0) % 4 === 0) for (let y = f.y - 4; y < f.y; y++) b.set(x, y, col(S, R.white, 0.45, x, y, 0.1));
    }
  const lit = L.lights > 0.3 && L.night > 0.2;
  for (const hs of lay.houses) {
    const { x: cx, y: cy } = hs;
    const front = light(S, [0, 0.1, 1]);
    for (let y = cy - 8; y < cy; y++)
      for (let x = cx - 7; x <= cx + 7; x++) {
        const dx = x - cx;
        const door = Math.abs(dx) <= 1 && y >= cy - 5;
        const win = (Math.abs(dx) === 4 || Math.abs(dx) === 5) && (y === cy - 6 || y === cy - 5);
        const trim = Math.abs(dx) === 7 || y === cy - 1;
        b.set(x, y, win ? (lit ? [255, 200, 120] : col(S, R.roof, 0.15, x, y, 0.1)) : door ? col(S, R.wood, front - 0.3, x, y, 0.1) : trim ? col(S, R.white, front, x, y, 0.1) : col(S, R.barn, front + ((y & 1) ? 0 : -0.08), x, y, 0.1));
      }
    // a steep roof, its two halves lit by the sun's side
    for (let i = 0; i < 9; i++)
      for (let x = cx - 9 + i; x <= cx + 9 - i; x++) {
        const y = cy - 9 - i;
        const v = light(S, [x < cx ? -0.6 : 0.6, 0.7, 0.4]);
        b.set(x, y, snowy ? col(S, R.snow, v, x, y, 0.1) : col(S, R.roof, v - (x === cx - 9 + i || x === cx + 9 - i ? 0.25 : 0), x, y, 0.1));
      }
    const [chx, chy] = hs.chimney;
    for (let y = chy; y < chy + 5; y++) for (let x = chx; x < chx + 2; x++) b.set(x, y, col(S, R.white, 0.5, x, y, 0.1));
  }
  if (lay.bridge !== null) {
    const y = lay.bridge;
    const r = lay.river[y - lay.valley];
    const half = Math.ceil(r.hw) + 3;
    for (let dx = -half; dx <= half; dx++) {
      const arch = Math.round(3 * Math.cos((dx / half) * Math.PI * 0.5));
      const x = Math.round(r.c + dx);
      b.set(x, y - arch, col(S, R.wood, 0.75, x, y - arch, 0.05));
      b.set(x, y - arch + 1, col(S, R.wood, 0.35, x, y - arch + 1, 0.05));
      if (dx % 3 === 0) for (let k = 1; k <= 3; k++) b.set(x, y - arch - k, col(S, R.white, 0.55, x, y - arch - k, 0.05));
      b.set(x, y - arch - 3, col(S, R.white, 0.7, x, y - arch - 3, 0.05));
    }
  }
  // trees in front: cottonwoods by the river, then the big edge pines
  const cotton = season === "autumn" ? R.cottonGold : snowy ? R.wood : R.cottonGreen;
  for (const t of lay.trees) {
    if (t.depth > 0.5) continue;
    if (t.kind === "cotton") cottonwood(b, S, t.x, t.y, t.h, t.depth, cotton);
    else if (t.kind === "poplar") poplar(b, S, t.x, t.y, t.h, t.depth, cotton);
    else pine(b, S, t.x, t.y, t.h, t.depth, snowy);
  }

  return [far, midB, nearB];
}

// The world as one long loop: each layout side by side, painted into three
// strips that wrap around. The globe's turn slides them past.
export type Pano = { W: number; H: number; layers: HTMLCanvasElement[]; lays: PixLayout[] };

export function paintPano(lays: PixLayout[], L: Light, season: Season): Pano {
  const { W, H } = lays[0];
  const PW = W * lays.length;
  const datas = [0, 1, 2].map(() => new Uint8ClampedArray(PW * H * 4) as Uint8ClampedArray<ArrayBuffer>);
  lays.forEach((lay, n) => {
    const bufs = paintLayers(lay, L, season);
    bufs.forEach((bf, k) => {
      for (let y = 0; y < H; y++) datas[k].set(bf.d.subarray(y * W * 4, (y + 1) * W * 4), (y * PW + n * W) * 4);
    });
  });
  const layers = datas.map((d) => {
    const cv = document.createElement("canvas");
    cv.width = PW;
    cv.height = H;
    cv.getContext("2d")!.putImageData(new ImageData(d, PW, H), 0, 0);
    return cv;
  });
  return { W: PW, H, layers, lays };
}

// how far each layer slides per radian the globe turns, as a share of the
// globe's own radius: the meadow keeps pace with the globe's face, the
// forest behind a little slower, the peaks slower still
export const PARALLAX = [0.3, 0.6, 1];

export function drawPano(g: CanvasRenderingContext2D, pano: Pano, yaw: number, R: number) {
  g.imageSmoothingEnabled = false;
  pano.layers.forEach((cv, k) => {
    const off = panoOffset(pano, yaw, R, k);
    g.drawImage(cv, -off * PIX, 0, pano.W * PIX, pano.H * PIX);
    g.drawImage(cv, (pano.W - off) * PIX, 0, pano.W * PIX, pano.H * PIX);
  });
}

// the layer's scroll, in pixels, snapped so it stays crisp
export function panoOffset(pano: Pano, yaw: number, R: number, k: number) {
  const px = (-yaw * R * PARALLAX[k]) / PIX;
  return (((Math.round(px) % pano.W) + pano.W) % pano.W) as number;
}

// the moving bits, snapped to the pixel grid: the river glinting, smoke from
// both chimneys, deer wandering across the meadow (leaving tracks in snow),
// a trout jumping, a hawk circling by day, fireflies at night
export function livePixels(g: CanvasRenderingContext2D, lay: PixLayout, L: Light, t: number, ox = 0, wrap = 0, first = true) {
  const P = PIX;
  // x in the layout, to x on screen: shifted along the loop and wrapped
  const sx = (x: number) => {
    const X = Math.round(x) + ox;
    return wrap ? ((X % wrap) + wrap) % wrap : X;
  };
  const rect = (x: number, y: number, s: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(sx(x) * P, Math.round(y) * P, s * P, s * P);
  };
  const dot = (x: number, y: number, c: string) => rect(x, y, 1, c);
  const night = L.night > 0.5;
  // glints drifting down the river
  for (let i = 0; i < 26; i++) {
    const row = Math.floor(((hash(i) + t * 0.04 * (0.5 + hash(i + 9))) % 1) * lay.river.length);
    const r = lay.river[row];
    if (!r || r.hw < 1.5) continue;
    const x = r.c + (hash(i * 3) - 0.5) * r.hw * 1.4;
    if (Math.sin(t * 3 + i * 2.1) > 0.3) dot(x, lay.valley + row, night ? "rgba(200,215,255,0.55)" : "rgba(255,255,255,0.85)");
  }
  // smoke: square puffs rising and drifting downwind, from both chimneys
  const wind = 0.4 + Math.min(1, L.wind / 8);
  for (const hs of lay.houses) {
    const [cx, cy] = hs.chimney;
    for (let k = 0; k < 7; k++) {
      const age = (t * 0.12 + k / 7 + hs.x * 0.01) % 1;
      const x = cx + wind * age * age * 14 + Math.sin(age * 5 + t * 0.3) * 1.2;
      const y = cy - 1 - age * 18;
      const a = (1 - age) * Math.min(1, age * 6) * 0.5;
      const s = age < 0.4 ? 1 : 2;
      rect(x, y, s, night ? `rgba(150,160,190,${a})` : `rgba(240,238,244,${a})`);
    }
  }
  // deer: a doe and a fawn walk across the meadow, stopping now and then to
  // graze; in snow they leave a line of hoofprints
  const snowy = L.snow > 0.45;
  const cycle = 70;
  const ph = ((t + 12) % cycle) / cycle;
  // walk, graze, walk, graze, walk: position along the way, and grazing?
  const keys = [0, 0.25, 0.35, 0.6, 0.72, 1];
  const pos = [0, 0.35, 0.35, 0.7, 0.7, 1];
  let k = 0;
  while (k < keys.length - 2 && ph > keys[k + 1]) k++;
  const f = (ph - keys[k]) / (keys[k + 1] - keys[k]);
  const grazing = pos[k] === pos[k + 1];
  const along = pos[k] + (pos[k + 1] - pos[k]) * f;
  const dy0 = lay.deerY;
  const x0 = -10,
    x1 = lay.W + 10;
  const brown = night ? "rgba(70,62,78,0.95)" : "rgba(146,98,62,1)";
  const light2 = night ? "rgba(110,100,120,0.95)" : "rgba(196,150,104,1)";
  const deer = (x: number, y: number, s: number, step: number, head: boolean) => {
    // facing right; s = 1 grown, 0.7 fawn
    const bw = Math.round(6 * s),
      lh = Math.round(3 * s);
    for (let i = 0; i < bw; i++) {
      dot(x + i, y, brown);
      dot(x + i, y + 1, i === 0 ? brown : light2);
    }
    dot(x - 1, y, "rgba(250,248,240,1)"); // white tail
    const legs = [0, 1, bw - 2, bw - 1];
    legs.forEach((lx, j) => {
      const swing = (j % 2 ? step : -step) * (grazing ? 0 : 1);
      for (let q = 0; q < lh; q++) dot(x + lx + (q === lh - 1 ? swing : 0), y + 2 + q, brown);
    });
    if (head) {
      dot(x + bw, y - 1, brown);
      dot(x + bw, y - 2, brown);
      dot(x + bw + 1, y - 3, brown);
      dot(x + bw + 2, y - 3, brown);
      dot(x + bw, y - 4, brown); // ear
    } else {
      dot(x + bw, y + 1, brown);
      dot(x + bw + 1, y + 2, brown);
      dot(x + bw + 1, y + 3, brown);
    }
  };
  const dxAt = x0 + (x1 - x0) * along;
  if (snowy)
    for (let px = x0; px < dxAt - 2; px += 3) {
      dot(px, dy0 + 5, "rgba(120,130,170,0.5)");
      dot(px - 6, dy0 + 6, "rgba(120,130,170,0.4)");
    }
  const step = Math.floor(t * 4) % 2 ? 1 : 0;
  deer(dxAt, dy0, 1, step, !grazing || Math.sin(t * 0.8) > 0.6);
  deer(dxAt - 9, dy0 + 2, 0.7, 1 - step, !grazing || Math.sin(t * 0.8 + 2) > 0.3);
  // a trout jumping: every few seconds an arc out of the water and a splash
  if (lay.fish.length && L.snow < 0.9) {
    const every = 6;
    const j = Math.floor(t / every);
    const jt = (t % every) / 1.1; // 0..1 while in the air
    const [fx, fy] = lay.fish[Math.floor(hash(j) * lay.fish.length)];
    const dir = hash(j + 7) > 0.5 ? 1 : -1;
    const fish = night ? "rgba(170,180,210,0.9)" : "rgba(214,150,140,1)";
    if (jt < 1) {
      const x = fx + dir * (jt - 0.5) * 8;
      const y = fy - Math.sin(jt * Math.PI) * 9;
      const tilt = jt < 0.5 ? -1 : 1;
      dot(x, y, fish);
      dot(x + dir, y, fish);
      dot(x - dir, y - tilt, fish);
      dot(x - dir * 2, y - tilt, "rgba(250,250,250,0.9)");
    }
    for (const [at, sx] of [
      [0, fx - dir * 4],
      [1, fx + dir * 4],
    ]) {
      const a = (jt - at) * 1.6;
      if (a > 0 && a < 1) {
        const rr = 1 + a * 3;
        const c = `rgba(255,255,255,${0.9 * (1 - a)})`;
        dot(sx - rr, fy, c);
        dot(sx + rr, fy, c);
        if (a < 0.4) dot(sx, fy - 1 - a * 4, c);
      }
    }
  }
  // the lake: sparkles, and a canoe paddling slowly back and forth
  if (lay.lake) {
    const { cx, cy, rx, ry } = lay.lake;
    for (let i = 0; i < 14; i++) {
      if (Math.sin(t * 2.2 + i * 1.7) < 0.4) continue;
      dot(cx + (hash(i + 20) - 0.5) * rx * 1.6, cy + (hash(i + 30) - 0.5) * ry * 1.4, night ? "rgba(200,215,255,0.5)" : "rgba(255,255,255,0.8)");
    }
    if (L.snow < 0.6) {
      const k = Math.sin(t * 0.06);
      const x = cx + k * rx * 0.55,
        y = cy + 1;
      const hull = night ? "rgba(120,80,90,1)" : "rgba(220,110,96,1)";
      for (let i = -3; i <= 3; i++) dot(x + i, y, hull);
      dot(x - 4, y - 1, hull);
      dot(x + 4, y - 1, hull);
      dot(x, y - 1, night ? "rgba(60,60,80,1)" : "rgba(60,70,110,1)"); // the paddler
      dot(x, y - 2, night ? "rgba(90,80,90,1)" : "rgba(240,200,170,1)");
      const stroke = Math.sin(t * 2) > 0;
      dot(x + (stroke ? 1 : -1), y - 1 + (stroke ? 1 : 0), "rgba(150,110,80,1)");
      for (let i = 1; i < 4; i++) dot(x - Math.sign(Math.cos(t * 0.06)) * (4 + i * 2), y + 1, `rgba(255,255,255,${0.35 - i * 0.08})`);
    }
  }
  // the train: a little engine and three cars crossing the trestle every
  // forty seconds, puffing
  if (lay.trestle !== null) {
    const ty = lay.trestle - 2;
    const run = (t % 40) / 22; // on screen for the first 22 seconds
    // only on the trestle itself
    const tdot = (x: number, y: number, c: string) => {
      if (x >= lay.W * 0.1 && x < lay.W * 0.9) dot(x, y, c);
    };
    if (run < 1) {
      const x = lay.W * 0.1 - 7 + run * (lay.W * 0.8 + 38);
      const eng = night ? "rgba(60,60,80,1)" : "rgba(52,70,96,1)";
      const car = night ? "rgba(120,70,80,1)" : "rgba(214,112,100,1)";
      const win = night ? "rgba(255,210,130,1)" : "rgba(250,240,220,1)";
      for (let c = 0; c < 3; c++) {
        const x0 = x - 8 - c * 8;
        for (let i = 0; i < 7; i++) for (let k = 0; k < 4; k++) tdot(x0 + i, ty - k, car);
        for (let i = 1; i < 6; i += 2) tdot(x0 + i, ty - 2, win);
      }
      for (let i = 0; i < 7; i++) for (let k = 0; k < 3; k++) tdot(x + i, ty - k, eng);
      for (let k = 3; k < 6; k++) tdot(x + 1, ty - k, eng);
      tdot(x + 2, ty - 5, eng);
      tdot(x + 5, ty - 3, eng);
      tdot(x + 5, ty - 4, eng);
      tdot(x + 7, ty - 1, night ? "rgba(255,230,160,1)" : "rgba(250,220,120,1)");
      for (let k = 0; k < 6; k++) {
        const age = (t * 0.9 + k / 6) % 1;
        const a = (1 - age) * 0.6;
        const sx2 = x + 5 - age * 14,
          sy = ty - 6 - age * 7;
        rect(sx2, sy, age < 0.4 ? 1 : 2, night ? `rgba(160,170,200,${a})` : `rgba(250,250,255,${a})`);
      }
    }
  }
  if (!first) {
    // the hawk and the fireflies belong to the first stretch only
  } else if (!night) {
    // a hawk circling high over the valley
    const a = t * 0.3;
    const hx = lay.W / 2 + Math.cos(a) * 18,
      hy = lay.H * 0.2 + Math.sin(a) * 4;
    const flap = Math.sin(t * 3) > 0.6 ? -1 : 0;
    const c = "rgba(40,34,44,0.9)";
    dot(hx, hy, c);
    dot(hx - 1, hy + flap, c);
    dot(hx + 1, hy + flap, c);
    dot(hx - 2, hy + 1 + flap, c);
    dot(hx + 2, hy + 1 + flap, c);
  } else if (!snowy) {
    for (let i = 0; i < 10; i++) {
      const x = lay.W * hash(i + 50) + Math.sin(t * 0.5 + i) * 3;
      const y = lay.valley + 6 + hash(i + 60) * (lay.H - lay.valley - 10) + Math.cos(t * 0.7 + i) * 2;
      if (Math.sin(t * 1.4 + i * 2.3) > 0.5) dot(x, y, "rgba(255,226,120,0.9)");
    }
  }
}
