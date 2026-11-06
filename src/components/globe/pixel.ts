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
const R: Record<string, Ramp> = {
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

export type PixLayout = {
  W: number;
  H: number;
  range: number[]; // top of the far range per column
  peaks: { x: number; top: number; half: number }[];
  ridge: number[]; // the far forested ridge's top edge
  near: number[]; // the near forested ridge's top edge
  edge: number[]; // where the meadow starts, per column
  valley: number; // the meadow's highest point
  river: { c: number; hw: number }[]; // the river's centre and half-width per row (from valley down)
  trees: { x: number; y: number; h: number; depth: number; kind: "pine" | "cotton" }[];
  barn: { x: number; y: number };
  cabin: { x: number; y: number; chimney: [number, number] };
  fence: { x0: number; x1: number; y: number };
};

export function pixLayout(w: number, h: number, seed: number): PixLayout {
  const W = Math.ceil(w / PIX),
    H = Math.ceil(h / PIX);
  // the Bridgers: a row of sharp peaks, the biggest at the edges so they
  // frame the globe; each peak a clean triangle with a little roughness
  const peaks: PixLayout["peaks"] = [
    { x: 0.02, top: 0.27, half: 0.3 },
    { x: 0.25, top: 0.42, half: 0.18 },
    { x: 0.5, top: 0.47, half: 0.14 },
    { x: 0.72, top: 0.4, half: 0.16 },
    { x: 0.97, top: 0.3, half: 0.28 },
  ].map((p) => ({ x: p.x * W, top: p.top * H, half: p.half * W }));
  const range: number[] = [];
  for (let x = 0; x < W; x++) {
    let y = H;
    for (const p of peaks) y = Math.min(y, p.top + Math.abs(x - p.x) * SLOPE);
    range.push(Math.round(y + fbm(x / 7, seed + 5, 3) * 3));
  }
  // two forested ridges in front of the range, rolling, lower in the middle
  const ridge: number[] = [],
    near: number[] = [],
    edge: number[] = [];
  for (let x = 0; x < W; x++) {
    const u = x / W - 0.5;
    ridge.push(Math.round(H * (0.62 + 0.035 * Math.cos(u * 5.2)) + fbm(x / 22, seed + 9) * H * 0.035));
    near.push(Math.round(H * (0.7 - 0.05 * u * u * 4) + fbm(x / 30 + 4, seed + 13) * H * 0.03 - u * H * 0.025));
    edge.push(Math.round(H * (0.775 - 0.02 * Math.cos(u * 3.4)) + fbm(x / 18, seed + 21) * H * 0.012));
  }
  const valley = Math.min(...edge);
  // the river: from a sliver in the far valley to a wide bend at your feet
  const river: PixLayout["river"] = [];
  for (let y = valley; y < H; y++) {
    const t = (y - valley) / (H - valley);
    const c = W * (0.56 + 0.18 * Math.sin(t * 4.2 + 0.6) * (0.4 + t) - 0.12 * t);
    river.push({ c, hw: 0.8 + t * t * W * 0.09 });
  }
  const trees: PixLayout["trees"] = [];
  // a ragged line of pines where the forest meets the meadow
  for (let x = 1; x < W; x += 3 + Math.floor(hash(x * 5 + seed) * 4)) trees.push({ x, y: edge[x] + 1, h: 5 + Math.floor(hash(x * 9 + seed) * 5), depth: 0.6, kind: "pine" });
  // cottonwoods along the river
  for (let i = 0; i < river.length; i += 2) {
    const r = river[i];
    for (const side of [-1, 1])
      if (hash(i * 7 + side + seed) < 0.12 && i > 6) {
        const t = i / river.length;
        trees.push({ x: Math.round(r.c + side * (r.hw + 5 + hash(i + side) * 10)), y: valley + i, h: Math.round(3 + t * 10), depth: 0.3 - t * 0.2, kind: "cotton" });
      }
  }
  // big pines at the edges
  for (const [x, hh] of [
    [3, 46],
    [12, 34],
    [W - 4, 50],
    [W - 14, 30],
  ])
    trees.push({ x, y: H + 2, h: hh, depth: 0.02, kind: "pine" });
  trees.sort((a, b) => a.y - b.y);
  return {
    W,
    H,
    range,
    peaks,
    ridge,
    near,
    edge,
    valley,
    river,
    trees,
    barn: { x: Math.round(W * 0.2), y: Math.round(H * 0.875) },
    cabin: { x: Math.round(W * 0.8), y: Math.round(H * 0.85), chimney: [Math.round(W * 0.8) + 3, Math.round(H * 0.85) - 11] },
    fence: { x0: Math.round(W * 0.06), x1: Math.round(W * 0.42), y: Math.round(H * 0.905) },
  };
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

export function paintPixels(g: CanvasRenderingContext2D, lay: PixLayout, w: number, h: number, L: Light, season: Season) {
  const { W, H } = lay;
  const S = shadeFor(L, season);
  const b = new Buf(W, H);
  const snowy = L.snow > 0.45;
  const sunX = L.sun[0];

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
    for (let y = y0; y < lay.ridge[x] + 2; y++) {
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
      for (let x = (row % 2) * 2 + Math.floor(hash(row + seed) * 3); x < W; x += 4 + Math.floor(hash(x * 3 + row * 11 + seed) * 2)) {
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
  forest(lay.ridge, (x) => lay.near[x] + 3, 0.5, R.forest, 3);
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
        const u = x + (y - lay.valley) * (x < r.c ? 0.9 : -0.9);
        const patch = Math.floor(u / 22 + fbm(y / 40, 3) * 1.2 + (y - lay.valley) / 26);
        const pv = [0.1, -0.06, 0.03, -0.12][((patch % 4) + 4) % 4];
        const bank = Math.abs(dx) - r.hw < 1.5;
        const rim = y - lay.edge[x] < 2;
        const v = field + pv + (bank ? -0.28 : 0) + (rim ? -0.2 : 0);
        b.set(x, y, col(S, grass, v, x, y, 0.22 - t * 0.22));
      }
    }
  }
  for (const t of lay.trees) if (t.depth > 0.5) pine(b, S, t.x, t.y, t.h, t.depth, snowy);
  // the fence, the barn, the cabin
  const f = lay.fence;
  for (let x = f.x0; x < f.x1; x++) {
    b.set(x, f.y - 3, col(S, R.wood, 0.7, x, f.y - 3, 0.1));
    if (x % 5 === 0) for (let y = f.y - 4; y < f.y; y++) b.set(x, y, col(S, R.wood, 0.5, x, y, 0.1));
  }
  const { x: bx, y: by } = lay.barn;
  for (let y = by - 9; y < by; y++)
    for (let x = bx - 8; x <= bx + 8; x++) {
      const side = x > bx + 4;
      const v = light(S, side ? [1, 0, 0.3] : [0, 0.1, 1]);
      const door = Math.abs(x - bx + 1) <= 2 && y > by - 6;
      const trim = (Math.abs(x - bx + 1) === 2 && y > by - 6) || (door && (x - bx + 1 + (y - by)) % 3 === 0);
      b.set(x, y, trim ? col(S, R.white, v, x, y, 0.1) : door ? col(S, R.barn, v - 0.35, x, y, 0.1) : col(S, R.barn, v, x, y, 0.1));
    }
  for (let i = 0; i < 7; i++)
    for (let x = bx - 9 + i; x <= bx + 9 - i; x++) {
      const y = by - 10 - i;
      const v = light(S, [x < bx ? -0.6 : 0.6, 0.7, 0.4]);
      b.set(x, y, snowy ? col(S, R.snow, v, x, y, 0.1) : col(S, R.roof, v, x, y, 0.1));
    }
  const { x: cx, y: cy } = lay.cabin;
  for (let y = cy - 6; y < cy; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const win = (x === cx - 3 || x === cx - 2 || x === cx + 2 || x === cx + 3) && (y === cy - 4 || y === cy - 3);
      const on = win && L.lights > 0.3 && L.night > 0.2;
      b.set(x, y, on ? [255, 196, 110] : win ? col(S, R.roof, 0.2, x, y, 0.1) : col(S, R.wood, light(S, [0, 0.1, 1]) * 0.8 + ((y & 1) ? 0 : -0.15), x, y, 0.1));
    }
  for (let i = 0; i < 6; i++)
    for (let x = cx - 8 + i; x <= cx + 8 - i; x++) {
      const y = cy - 7 - i;
      b.set(x, y, snowy ? col(S, R.snow, light(S, [x < cx ? -0.6 : 0.6, 0.7, 0.4]), x, y, 0.1) : col(S, R.roof, light(S, [x < cx ? -0.6 : 0.6, 0.7, 0.4]) - 0.2, x, y, 0.1));
    }
  const [chx, chy] = lay.cabin.chimney;
  for (let y = chy; y < chy + 5; y++) for (let x = chx; x < chx + 2; x++) b.set(x, y, col(S, R.rock, 0.6, x, y, 0.1));
  // trees in front: cottonwoods by the river, then the big edge pines
  const cotton = season === "autumn" ? R.cottonGold : snowy ? R.wood : R.cottonGreen;
  for (const t of lay.trees) {
    if (t.depth > 0.5) continue;
    if (t.kind === "cotton") cottonwood(b, S, t.x, t.y, t.h, t.depth, cotton);
    else pine(b, S, t.x, t.y, t.h, t.depth, snowy);
  }
  void sunX;

  // onto the canvas, blown up with hard edges
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  cv.getContext("2d")!.putImageData(new ImageData(b.d, W, H), 0, 0);
  g.imageSmoothingEnabled = false;
  g.drawImage(cv, 0, 0, W * PIX, H * PIX);
}

// the moving bits, snapped to the pixel grid: the river glinting, smoke from
// the cabin, a hawk circling by day, the barn light and fireflies at night
export function livePixels(g: CanvasRenderingContext2D, lay: PixLayout, L: Light, t: number) {
  const P = PIX;
  const dot = (x: number, y: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x) * P, Math.round(y) * P, P, P);
  };
  // glints drifting down the river
  for (let i = 0; i < 26; i++) {
    const row = Math.floor(((hash(i) + t * 0.04 * (0.5 + hash(i + 9))) % 1) * lay.river.length);
    const r = lay.river[row];
    if (!r || r.hw < 1.5) continue;
    const x = r.c + (hash(i * 3) - 0.5) * r.hw * 1.4;
    const on = Math.sin(t * 3 + i * 2.1) > 0.3;
    if (on) dot(x, lay.valley + row, L.night > 0.5 ? "rgba(200,215,255,0.55)" : "rgba(255,255,255,0.85)");
  }
  // smoke: square puffs rising and drifting downwind
  const [cx, cy] = lay.cabin.chimney;
  const wind = 0.4 + Math.min(1, L.wind / 8);
  for (let k = 0; k < 7; k++) {
    const age = (t * 0.12 + k / 7) % 1;
    const x = cx + wind * age * age * 16 + Math.sin(age * 5 + t * 0.3) * 1.2;
    const y = cy - 1 - age * 18;
    const a = (1 - age) * Math.min(1, age * 6) * 0.5;
    const s = age < 0.4 ? 1 : 2;
    g.fillStyle = L.night > 0.5 ? `rgba(150,160,190,${a})` : `rgba(235,235,240,${a})`;
    g.fillRect(Math.round(x) * P, Math.round(y) * P, s * P, s * P);
  }
  if (L.night < 0.4) {
    // a hawk circling over the valley
    const a = t * 0.3;
    const hx = lay.W * 0.4 + Math.cos(a) * 12,
      hy = lay.H * 0.66 + Math.sin(a) * 3;
    const flap = Math.sin(t * 3) > 0.6 ? -1 : 0;
    const c = "rgba(30,26,34,0.9)";
    dot(hx, hy, c);
    dot(hx - 1, hy + flap, c);
    dot(hx + 1, hy + flap, c);
    dot(hx - 2, hy + 1 + flap, c);
    dot(hx + 2, hy + 1 + flap, c);
  } else {
    // fireflies in summer, a porch light blinking at the barn otherwise
    for (let i = 0; i < 8; i++) {
      const x = lay.W * hash(i + 50) + Math.sin(t * 0.5 + i) * 3;
      const y = lay.valley + 6 + hash(i + 60) * (lay.H - lay.valley - 10) + Math.cos(t * 0.7 + i) * 2;
      if (Math.sin(t * 1.4 + i * 2.3) > 0.5) dot(x, y, "rgba(255,226,120,0.9)");
    }
    dot(lay.barn.x - 1, lay.barn.y - 8, `rgba(255,210,130,${0.7 + 0.3 * Math.sin(t * 2)})`);
  }
}
