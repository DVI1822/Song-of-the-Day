import type { Weather } from "@/lib/weather";
import type { SettingKind } from "@/lib/setting";
import type { Season } from "./scene";
import { skyBands } from "./sky";
import { drawLinePano, lineOffset, liveLines, paintLinePano, type LinePano } from "./line";
import { liveWorld, paintWorldPano, type WorldKind, type WorldPano } from "./world";
import { PIX, drawPano, livePixels, paintPano, panoOffset, pixLayout, type Comp, type Pano, type PixLayout } from "./pixel";

// ?pix=1|2|3 picks a pixel style while we try them out
// the stretches the loop is made of, in order; ?scene= shows just one
function pixComps(): Comp[] {
  const all: Comp[] = ["hill", "lake", "train", "stage"];
  if (typeof window === "undefined") return all;
  const q = new URLSearchParams(window.location.search).get("scene") as Comp | null;
  return q && all.includes(q) ? [q] : all;
}
// ?art=pixel brings back the pixel version; ?line=1|2|3|4 picks the line fill
function artMode(): "line" | "pixel" {
  if (typeof window === "undefined") return "line";
  return new URLSearchParams(window.location.search).get("art") === "pixel" ? "pixel" : "line";
}
function lineStyle() {
  if (typeof window === "undefined") return 4;
  const q = Number(new URLSearchParams(window.location.search).get("line"));
  return q >= 1 && q <= 4 ? q : 4;
}
function pixStyle() {
  if (typeof window === "undefined") return 2;
  const q = Number(new URLSearchParams(window.location.search).get("pix"));
  return q >= 1 && q <= 3 ? q : 2;
}
import type { V3 } from "./math";

// Where you are, alive behind the Globe (lib/setting.ts picks which).
//
//   city      A skyline in three depths, haze between them. The glass takes
//             the sky by day; at dusk the windows come on a few at a time,
//             thinning out after midnight. Red lights blink on the towers,
//             cars stream along an elevated road, a plane crosses at night.
//   mountain  Snowy peaks in the distance, a forested ridge, and a village
//             at the bottom: chalets with smoke curling from the chimneys,
//             firelight in the windows at night, a church, a gondola going
//             up and back.
//
// Everything is lit by the real sun: which side of a building or a peak is
// bright, golden hour, alpenglow at sunset, the cold blue after dark. Cloud
// and fog flatten the light and swallow the far layers; snow settles on the
// roofs and the trees; the snowline drops in winter.
//
// Two canvases: one painted only when the light changes (every few seconds
// at most), and one for the few things that move, at up to 30 frames a second.

export type SettingFrame = {
  show: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  R: number;
  dk: number;
  day: number;
  warm: number;
  warmC: V3;
  el: number; // the sun's height, radians
  az: number; // from north, clockwise, radians
  season: Season;
  hour: number;
  temp: number | null;
  yaw?: number; // how far the globe has turned; the pixel world turns with it
};

export type C = [number, number, number];
const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: C, b: C, t: number): C => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: C, a = 1) => `rgba(${Math.round(Math.max(0, Math.min(255, c[0])))},${Math.round(Math.max(0, Math.min(255, c[1])))},${Math.round(Math.max(0, Math.min(255, c[2])))},${a.toFixed(3)})`;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// smooth 1D noise, -1..1
function noise1(x: number, seed: number) {
  const i = Math.floor(x),
    f = x - i;
  const a = hash(i + seed * 101) * 2 - 1,
    b = hash(i + 1 + seed * 101) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
const fbm = (x: number, seed: number, oct = 4) => {
  let s = 0,
    amp = 0.5,
    fr = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * noise1(x * fr, seed + i * 17);
    amp *= 0.5;
    fr *= 2.03;
  }
  return s;
};

// ---------------------------------------------------------------------------
// the light
// ---------------------------------------------------------------------------

export type Light = {
  sun: [number, number, number]; // toward the sun: x right (east), y up, z toward you (south)
  sunC: C; // 0..1, already scaled by how much gets through
  amb: C; // 0..1
  haze: C; // 0..255, the air's colour at the horizon
  hazeK: number; // how thick the air is, 0..1
  night: number; // 0..1
  lights: number; // 0..1 how many windows are on
  snow: number; // 0..1 how much lies on roofs and branches
  snowline: number; // 0..1 how far down the peaks the snow comes
  overcast: number;
  wind: number;
  alpen: number; // 0..1 the pink on the peaks at sunrise and sunset
  moonC: C; // 0..1, a soft cold light from high on the left after dark
  warmC: C;
};

function lightFor(f: SettingFrame, wx: Weather | null): Light {
  const elDeg = (f.el * 180) / Math.PI;
  const [, mid, low] = skyBands(elDeg, f.az);
  const space = smooth(-3, -11, elDeg);
  const k = wx?.kind ?? "clear";
  const overcast =
    k === "clear" ? 0 : k === "partly" ? Math.max(0, (wx!.cloud - 0.35) * 0.8) : k === "cloudy" ? 0.7 : k === "fog" ? 0.85 : k === "storm" ? 1 : 0.85;
  const fog = k === "fog" ? 1 : k === "drizzle" || k === "rain" ? 0.35 : k === "snow" ? 0.45 : k === "storm" ? 0.5 : 0;
  const night = clamp01(f.dk);
  let haze: C = mix(mix(low as C, mid as C, 0.25), [12, 18, 40], space * 0.85);
  haze = mix(haze, mix([196, 203, 210], [24, 29, 40], night), overcast * 0.75);
  const sunOn = smooth(-2, 4, elDeg) * (1 - 0.8 * overcast);
  const warmC = f.warmC as C;
  const sunC: C = mix([1, 0.97, 0.92], warmC, f.warm).map((v) => v * sunOn * 0.95) as C;
  const day = clamp01(f.day);
  // night: a cold moonlit blue, brighter with snow on the ground
  const amb: C = mix(k === "snow" ? [0.2, 0.23, 0.34] : [0.12, 0.14, 0.24], mix([0.5, 0.56, 0.66], [0.62, 0.64, 0.68], overcast), day);
  const sun: [number, number, number] = [Math.sin(f.az) * Math.cos(f.el), Math.sin(f.el), -Math.cos(f.az) * Math.cos(f.el)];
  // windows: on through dusk, thinning out after midnight, back on before dawn
  const late = f.hour < 5 ? smooth(0.5, 3, f.hour) * (1 - smooth(4, 5.5, f.hour)) : 0;
  const lights = smooth(0.2, 0.75, night) * (1 - 0.6 * late) + 0.08 * (1 - night);
  const wintry = f.season === "winter" ? 1 : f.season === "autumn" || f.season === "spring" ? 0.35 : 0;
  const cold = f.temp === null ? 0 : smooth(3, -3, f.temp);
  const snow = Math.max(k === "snow" ? 1 : 0, f.season === "winter" ? 0.55 * Math.max(cold, 0.4) : 0, cold * 0.4);
  const snowline = 0.25 + 0.4 * wintry + 0.2 * cold;
  const alpen = smooth(-4, 0, elDeg) * (1 - smooth(4, 11, elDeg)) * (1 - overcast);
  return {
    sun,
    sunC,
    amb,
    haze,
    hazeK: clamp01((0.45 + 0.3 * overcast + 0.45 * fog) * (1 - 0.35 * night)),
    night,
    lights,
    snow,
    snowline,
    overcast,
    wind: wx?.wind ?? 2,
    alpen,
    warmC,
    moonC: [0.2, 0.25, 0.4].map((v) => v * night * (1 - 0.6 * overcast)) as C,
  };
}

// a surface's colour (0..255) under this light, n its normal (unit-ish)
const MOON: [number, number, number] = [-0.55, 0.62, 0.56];
function lit(base: C, n: [number, number, number], L: Light, gloss = 0): C {
  const d = Math.max(0, n[0] * L.sun[0] + n[1] * L.sun[1] + n[2] * L.sun[2]);
  const m = Math.max(0, n[0] * MOON[0] + n[1] * MOON[1] + n[2] * MOON[2]);
  return [0, 1, 2].map((i) => base[i] * (L.amb[i] + L.sunC[i] * d * 1.05 + L.moonC[i] * m) + gloss * 255 * L.sunC[i] * d * d) as C;
}
// then the air between you and it (depth 0 near, 1 far)
const air = (c: C, depth: number, L: Light) => mix(c, L.haze, clamp01(depth * L.hazeK));

const N_FRONT: [number, number, number] = [0, 0.15, 1];
const N_UP: [number, number, number] = [0, 1, 0.2];
const N_RIGHT: [number, number, number] = [1, 0.05, 0.25];
const N_LEFT: [number, number, number] = [-1, 0.05, 0.25];
// ---------------------------------------------------------------------------
// the look: lofi. Flat shapes, a few soft tones per scene, warm light.
// ---------------------------------------------------------------------------

// The palette for this light: the darkest "ink" (nearest things), the sky at
// the horizon (the farthest things fade into it), the light on the sunny
// side, and the colour of a lit window.
type Pal = { ink: C; sky: C; sunTint: C; sunK: number; win: C };

function palette(L: Light): Pal {
  const day: C = mix([70, 84, 122], [96, 102, 120], L.overcast);
  const dusk: C = [92, 60, 104];
  const night: C = mix([44, 34, 92], [30, 32, 46], L.overcast);
  let ink = mix(day, dusk, Math.max(L.alpen, (1 - L.night) * L.sunC[0] > 0 ? 0 : 0) + L.alpen * 0.8);
  ink = mix(ink, night, L.night);
  const sunK = clamp01(Math.max(L.sunC[0], L.sunC[1]) * 1.1);
  return { ink, sky: L.haze, sunTint: mix([255, 246, 228], mix(L.warmC.map((v) => v * 255) as C, [255, 170, 120], 0.3), clamp01(L.alpen * 1.5)), sunK, win: [255, 196, 118] };
}
// a layer's flat colour at depth d (0 near .. 1 far)
const tone = (P: Pal, d: number, L: Light) => mix(P.ink, P.sky, clamp01(Math.pow(d, 1.15) * (0.72 + 0.25 * L.hazeK)));
// a bold flat colour, sunk into the night and faded with distance
const paint = (P: Pal, col: C, d: number, L: Light) =>
  mix(mix(col, P.ink, 0.05 + 0.5 * L.night + 0.25 * L.overcast), P.sky, clamp01(Math.pow(d, 1.3) * (0.45 + 0.25 * L.hazeK)));

// the city's colours: cheerful, a little chalky
const BRIGHT: C[] = [
  [236, 94, 84], // coral
  [32, 160, 150], // teal
  [242, 178, 52], // mustard
  [124, 92, 200], // purple
  [58, 128, 214], // blue
  [72, 180, 120], // green
  [246, 140, 70], // orange
  [214, 72, 130], // pink
  [244, 226, 190], // cream
];
const sunny = (P: Pal, c: C, k = 1) => mix(c, P.sunTint, 0.16 * P.sunK * k);
const shadeOf = (c: C, k = 0.12) => mix(c, [10, 10, 30], k);

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

let grainTile: HTMLCanvasElement | null = null;
// a little film grain over the scene, only where something is drawn
function grain(g: CanvasRenderingContext2D, w: number, h: number, a: number) {
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 160;
    const t = grainTile.getContext("2d")!;
    const im = t.createImageData(160, 160);
    const r = rng(5);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = r() < 0.5 ? 0 : 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = Math.round(r() * 255);
    }
    t.putImageData(im, 0, 0);
  }
  g.save();
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = a;
  g.fillStyle = g.createPattern(grainTile, "repeat")!;
  g.fillRect(0, 0, w, h);
  g.restore();
}

// ---------------------------------------------------------------------------
// city pop: crisp white walls with cool blue shadows, orange trim, dark
// glass, deep green trees; at dusk the walls go periwinkle and the windows
// glow orange
// ---------------------------------------------------------------------------

type Pop = {
  wall: C; // a sunlit wall
  shade: C; // a wall in shadow
  glass: C;
  glint: C; // the sky in the glass
  lamp: C; // a lit window
  trim: C; // orange
  leaf: [C, C, C]; // dark, middle, lit
  sky: C;
};

function pop(L: Light): Pop {
  const n = L.night;
  const deep = smooth(0.55, 1, n);
  let wall = mix([248, 244, 236], mix([255, 222, 184], [255, 196, 170], L.alpen), clamp01(L.alpen * 1.2 + (1 - n) * L.sunC[2] * 0));
  wall = mix(wall, mix([128, 142, 220], [62, 72, 148], deep), smooth(0.15, 0.7, n));
  let shade = mix([120, 142, 216], [52, 62, 134], smooth(0.1, 0.9, n));
  // cloud flattens it all: greyer walls, softer shadows
  wall = mix(wall, mix([206, 210, 218], [70, 76, 100], n), L.overcast * 0.6);
  shade = mix(shade, mix([160, 168, 186], [44, 50, 72], n), L.overcast * 0.5);
  const leaf: [C, C, C] = [
    mix([18, 60, 44], [12, 22, 50], n),
    mix([36, 98, 60], [22, 40, 84], n),
    mix(mix([92, 156, 84], [150, 170, 90], L.alpen), [40, 66, 120], n),
  ];
  return {
    wall,
    shade,
    glass: mix([30, 42, 92], [20, 24, 60], n),
    glint: mix([110, 150, 226], [50, 60, 120], n),
    lamp: [250, 158, 70],
    trim: mix([232, 94, 50], [170, 64, 52], deep),
    leaf: leaf.map((c) => mix(c, [120, 130, 140], L.overcast * 0.25)) as [C, C, C],
    sky: L.haze,
  };
}
const far = (c: C, d: number, L: Light, Q: Pop) => mix(c, Q.sky, clamp01(Math.pow(d, 1.3) * (0.48 + 0.2 * L.hazeK)));

// a round, leafy tree: a dark crown, a lighter middle and dappled light on
// the sunny side
function roundTree(g: CanvasRenderingContext2D, x: number, y: number, s: number, Q: Pop, sunX: number, seed: number) {
  const r = rng(seed);
  g.fillStyle = css(mix(Q.leaf[0], [40, 28, 24], 0.5));
  g.beginPath();
  g.moveTo(x - s * 0.06, y);
  g.lineTo(x - s * 0.03, y - s * 1.1);
  g.lineTo(x + s * 0.03, y - s * 1.1);
  g.lineTo(x + s * 0.07, y);
  g.fill();
  const cy = y - s * 1.35;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU,
      d = Math.sqrt(r()) * s * 0.55;
    blobs.push([x + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * 0.7, s * (0.22 + r() * 0.16)]);
  }
  for (const [k, off] of [
    [0, 0],
    [1, 0.08],
    [2, 0.18],
  ] as [number, number][]) {
    g.fillStyle = css(Q.leaf[k]);
    for (const [bx, by, br] of blobs) {
      if (k > 0 && (bx - x) * sunX < -s * 0.05 * k) continue;
      if (k === 2 && by > cy) continue;
      g.beginPath();
      g.arc(bx + sunX * off * s * 0.5, by - off * s * 0.4, br * (1 - off * 1.4), 0, TAU);
      g.fill();
    }
  }
  // dapples
  g.fillStyle = css(mix(Q.leaf[2], [255, 255, 230], 0.15));
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU,
      d = Math.sqrt(r()) * s * 0.6;
    const dx = x + Math.cos(a) * d + sunX * s * 0.15,
      dy = cy + Math.sin(a) * d * 0.6 - s * 0.1;
    if ((dx - x) * sunX < 0) continue;
    g.fillRect(dx, dy, s * 0.04, s * 0.04);
  }
}

function palm(g: CanvasRenderingContext2D, x: number, y: number, s: number, Q: Pop, lean: number) {
  g.strokeStyle = css(mix(Q.leaf[0], [60, 44, 34], 0.5));
  g.lineWidth = s * 0.06;
  g.lineCap = "round";
  const tx = x + lean * s * 0.5,
    ty = y - s * 2.2;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + lean * s * 0.05, y - s * 1.2, tx, ty);
  g.stroke();
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + ((i - 4) / 4) * 1.9 + lean * 0.2;
    const len = s * (0.8 + 0.25 * Math.cos(i * 1.7));
    const ex = tx + Math.cos(a) * len,
      ey = ty + Math.sin(a) * len * 0.55 + len * 0.35 * Math.abs(Math.cos(a));
    g.strokeStyle = css(i % 2 ? Q.leaf[1] : Q.leaf[0]);
    g.lineWidth = s * 0.09;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.5 - s * 0.15, ex, ey);
    g.stroke();
  }
}

// ---------------------------------------------------------------------------
// the city
// ---------------------------------------------------------------------------

type Win = "ribbon" | "tall" | "curtain";
type Block = { x: number; w: number; top: number; depth: number; win: Win; trim: boolean; balcony: boolean; roof: "none" | "pent" | "antenna" | "pool"; seed: number; fh: number };
type CityLayout = { kind: "city"; b: Block[]; beacons: [number, number][]; trees: [number, number, number, "round" | "palm", number][]; hedge: number };

function cityLayout(w: number, h: number, seed: number): CityLayout {
  const r = rng(seed);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  const b: Block[] = [];
  const pickWin = (): Win => {
    const v = r();
    return v < 0.45 ? "ribbon" : v < 0.85 ? "tall" : "curtain";
  };
  const row = (depth: number, minW: number, maxW: number, topA: number, topB: number, fh: number) => {
    let x = -r() * maxW * 0.5;
    while (x < w + 4) {
      const bw = Math.round(minW + r() * (maxW - minW));
      const rr = r();
      b.push({
        x: Math.round(x),
        w: bw,
        top: Math.round(h * (topA + (topB - topA) * r())),
        depth,
        win: pickWin(),
        trim: r() < 0.45,
        balcony: r() < 0.35,
        roof: rr < 0.18 ? "pent" : rr < 0.3 ? "antenna" : rr < 0.36 && depth < 0.4 ? "pool" : "none",
        seed: Math.floor(r() * 1e6),
        fh,
      });
      x += bw + (r() < 0.35 ? (3 + r() * 8) * s : 0);
    }
  };
  row(1, 24 * s, 48 * s, 0.6, 0.72, 5 * s);
  const edge = Math.min(0.1, 40 / w);
  for (const [fx, top, bw] of [
    [edge, 0.34, 34],
    [1 - edge, 0.4, 30],
  ] as [number, number, number][])
    b.push({ x: Math.round(w * fx - (bw * s) / 2), w: Math.round(bw * s), top: Math.round(h * top), depth: 0.75, win: "curtain", trim: true, balcony: false, roof: "antenna", seed: Math.floor(r() * 1e6), fh: 8 * s });
  row(0.55, 38 * s, 66 * s, 0.67, 0.78, 10 * s);
  row(0.22, 56 * s, 92 * s, 0.79, 0.87, 15 * s);
  b.sort((a, c) => c.depth - a.depth);
  const beacons: [number, number][] = [];
  for (const q of b) if (q.roof === "antenna" && q.depth >= 0.5) beacons.push([q.x + q.w / 2, q.top - q.w * 0.6]);
  const trees: CityLayout["trees"] = [
    [w * 0.02, h * 1.0, 62 * s, "round", 1],
    [w * 0.22, h * 1.0, 44 * s, "palm", -0.3],
    [w * 0.8, h * 1.0, 48 * s, "palm", 0.35],
    [w * 0.99, h * 1.0, 58 * s, "round", 2],
  ];
  return { kind: "city", b, beacons, trees, hedge: h * 0.965 };
}

function paintCity(g: CanvasRenderingContext2D, lay: CityLayout, w: number, h: number, L: Light) {
  const Q = pop(L);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  for (const q of lay.b) block(g, q, h, w, L, Q, s);
  // a band of clipped hedges and bushes along the bottom
  const sunX = L.sun[0] >= 0 ? 1 : -1;
  const r = rng(3);
  for (let x = -10; x < w + 20; x += (16 + r() * 18) * s) {
    const br = (10 + r() * 12) * s;
    const y = lay.hedge + r() * 6 * s;
    const blue = r() < 0.3;
    const base = blue ? mix([70, 92, 196], [30, 40, 100], L.night) : Q.leaf[1];
    g.fillStyle = css(blue ? mix(base, [0, 0, 20], 0.25) : Q.leaf[0]);
    g.beginPath();
    g.ellipse(x, y, br * 1.3, br, 0, 0, TAU);
    g.fill();
    g.fillStyle = css(base);
    g.beginPath();
    g.ellipse(x + sunX * br * 0.2, y - br * 0.15, br * 1.0, br * 0.75, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = css(Q.leaf[0]);
  g.fillRect(0, lay.hedge + 12 * s, w, h);
  for (const [x, y, ts, kind, k] of lay.trees) {
    if (kind === "palm") palm(g, x, y, ts, Q, k);
    else roundTree(g, x, y, ts, Q, sunX, 40 + k);
  }
  grain(g, w, h, 0.045);
}

function block(g: CanvasRenderingContext2D, q: Block, h: number, w: number, L: Light, Q: Pop, s: number) {
  const { x, w: bw, top, depth, fh } = q;
  const sunX = L.sun[0];
  // the front faces you (south), lit while the sun is up; the side you can
  // see is toward the middle of the screen, lit if the sun is on that side
  const sideRight = x + bw / 2 < w / 2;
  const sideLit = sunX * (sideRight ? 1 : -1) > 0.25;
  const frontLit = L.sun[2] > -0.35;
  const wall = far(frontLit ? Q.wall : mix(Q.wall, Q.shade, 0.55), depth, L, Q);
  const side = far(sideLit ? Q.wall : Q.shade, depth, L, Q);
  const sw = Math.max(2, Math.round(bw * (depth > 0.9 ? 0.14 : 0.2)));
  g.fillStyle = css(side);
  g.fillRect(sideRight ? x + bw : x - sw, top + 1, sw, h - top);
  g.fillStyle = css(wall);
  g.fillRect(x, top, bw, h - top);
  // roof edge: orange, or a white lip
  const cap = far(q.trim ? Q.trim : mix(Q.wall, [255, 255, 255], 0.4), depth, L, Q);
  g.fillStyle = css(cap);
  g.fillRect(x - 1, top - 1.5 * s, bw + 2, 2.4 * s);
  if (L.snow > 0.3) {
    g.fillStyle = css(mix([255, 255, 255], Q.sky, 0.2), L.snow);
    g.fillRect(x - 1, top - 3 * s, bw + 2, 2 * s);
  }
  const cx = x + bw / 2;
  if (q.roof === "pent") {
    g.fillStyle = css(wall);
    g.fillRect(x + bw * 0.3, top - fh * 1.3, bw * 0.55, fh * 1.3);
    g.fillStyle = css(far(Q.glass, depth, L, Q));
    g.fillRect(x + bw * 0.36, top - fh, bw * 0.43, fh * 0.6);
  } else if (q.roof === "antenna") {
    g.fillStyle = css(far(mix(Q.shade, [40, 40, 60], 0.4), depth, L, Q));
    g.fillRect(cx - 0.8, top - bw * 0.6, 1.6, bw * 0.6);
  } else if (q.roof === "pool") {
    g.fillStyle = css(mix([40, 110, 230], [20, 40, 120], L.night));
    g.fillRect(x + bw * 0.15, top - 2 * s, bw * 0.5, 2 * s);
  }
  // windows, floor by floor
  const margin = Math.max(2, bw * 0.1);
  const floors = Math.floor((h - top - fh * 0.8) / fh);
  const glass = far(Q.glass, depth, L, Q);
  const glint = far(Q.glint, depth, L, Q);
  const frame = far(mix(Q.glass, [0, 0, 0], 0.5), depth, L, Q);
  const lamp = far(Q.lamp, depth * 0.6, L, Q);
  const on = (n: number) => L.night > 0.15 && hash(n) < L.lights * 0.42;
  if (depth > 0.9) {
    // the far row: little lit squares after dark, nothing by day
    if (L.night < 0.25) return;
    for (let j = 0; j < floors; j++)
      for (let i = 0; i < 3; i++) if (on(q.seed + j * 13 + i)) {
        g.fillStyle = css(lamp, L.night);
        g.fillRect(x + margin + i * ((bw - 2 * margin) / 3), top + fh * (0.8 + j), 2 * s, 1.6 * s);
      }
    return;
  }
  for (let j = 0; j < floors; j++) {
    const fy = top + fh * (0.7 + j);
    if (q.win === "ribbon") {
      // one long band of glass per floor, split by thin black mullions
      const wy = fy + fh * 0.18,
        wh = fh * 0.5;
      const segs = Math.max(2, Math.round((bw - 2 * margin) / (7 * s)));
      const sw2 = (bw - 2 * margin) / segs;
      for (let i = 0; i < segs; i++) {
        const lit = on(q.seed + j * 31 + Math.floor(i / 2));
        g.fillStyle = css(lit ? lamp : glass);
        g.fillRect(x + margin + i * sw2, wy, sw2, wh);
        if (!lit && L.night < 0.5 && (i + j) % 5 === 0) {
          g.fillStyle = css(glint, 0.55 * (1 - L.night));
          g.fillRect(x + margin + i * sw2, wy, sw2 * 0.6, wh * 0.3);
        }
      }
      g.fillStyle = css(frame);
      for (let i = 0; i <= segs; i++) g.fillRect(x + margin + i * sw2 - 0.4, wy, 0.8, wh);
      if (q.balcony && j % 2 === 0) {
        g.fillStyle = css(far(q.trim ? Q.trim : Q.wall, depth, L, Q));
        g.fillRect(x - 1, wy + wh + fh * 0.12, bw + 2, Math.max(1, fh * 0.12));
      }
    } else if (q.win === "tall") {
      // tall windows in black frames
      const n = bw > 50 * s ? 4 : 3;
      const ww = (bw - 2 * margin) / (n * 1.7);
      for (let i = 0; i < n; i++) {
        const wx = x + margin + i * ww * 1.7 + ww * 0.35;
        const lit = on(q.seed + j * 17 + i);
        g.fillStyle = css(frame);
        g.fillRect(wx - 0.8, fy, ww + 1.6, fh * 0.75);
        g.fillStyle = css(lit ? lamp : glass);
        g.fillRect(wx, fy + 0.8, ww, fh * 0.75 - 1.6);
        if (lit) {
          g.fillStyle = css(mix(lamp, [140, 60, 30], 0.3));
          g.fillRect(wx, fy + fh * 0.5, ww, fh * 0.2);
        } else if (L.night < 0.5) {
          g.fillStyle = css(glint, 0.5 * (1 - L.night));
          g.fillRect(wx, fy + 0.8, ww * 0.35, fh * 0.6);
        }
      }
    } else {
      // all glass, with a grid
      const segs = Math.max(2, Math.round(bw / (6 * s)));
      const sw2 = bw / segs;
      for (let i = 0; i < segs; i++) {
        const lit = on(q.seed + j * 7 + i);
        const refl = !lit && L.night < 0.6 && hash(q.seed + i * 3 + Math.floor(j / 3)) < 0.3;
        g.fillStyle = css(lit ? lamp : refl ? mix(glass, glint, 0.6) : glass);
        g.fillRect(x + i * sw2, fy, sw2, fh);
      }
      g.fillStyle = css(frame, 0.8);
      g.fillRect(x, fy, bw, 0.7);
    }
  }
  if (q.win === "curtain") {
    g.fillStyle = css(frame, 0.8);
    const segs = Math.max(2, Math.round(bw / (6 * s)));
    for (let i = 1; i < segs; i++) g.fillRect(x + (i * bw) / segs - 0.35, top + fh * 0.7, 0.7, h);
  }
}

// ---------------------------------------------------------------------------
// the mountains
// ---------------------------------------------------------------------------

type Cabin = { x: number; y: number; w: number; chimney: [number, number]; seed: number };
type Ridge = { pts: [number, number][]; depth: number; trees: [number, number, number][]; snow: number; k: number };
type MtnLayout = { kind: "mountain"; ridges: Ridge[]; cabins: Cabin[]; cable: [[number, number], [number, number]]; firs: [number, number, number][] };

function mountainLayout(w: number, h: number, seed: number): MtnLayout {
  const r = rng(seed);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  const line = (n: number, f: (x: number) => number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = -10 + ((w + 20) * i) / n;
      pts.push([x, f(x)]);
    }
    return pts;
  };
  // a mountain as a clean triangle-ish shape with a slightly lumpy edge
  const peak = (x: number, px: number, py: number, half: number, base: number) => py + (base - py) * Math.min(1, Math.abs(x - px) / half);
  const ridges: Ridge[] = [];
  ridges.push({
    pts: line(60, (x) => Math.min(peak(x, w * 0.08, h * 0.3, w * 0.48, h * 0.8), peak(x, w * 0.95, h * 0.36, w * 0.42, h * 0.8), peak(x, w * 0.56, h * 0.54, w * 0.35, h * 0.8)) + fbm(x / 40, seed) * 5 * s),
    depth: 1,
    trees: [],
    snow: 1,
    k: 0,
  });
  ridges.push({
    pts: line(50, (x) => Math.min(peak(x, w * 0.3, h * 0.5, w * 0.3, h * 0.82), peak(x, w * 0.8, h * 0.54, w * 0.3, h * 0.82), h * 0.68) + fbm(x / 50, seed + 4) * 6 * s),
    depth: 0.72,
    trees: [],
    snow: 0.4,
    k: 1,
  });
  const yAt = (pts: [number, number][], x: number) => {
    for (let i = 1; i < pts.length; i++)
      if (pts[i][0] >= x) {
        const [x0, y0] = pts[i - 1],
          [x1, y1] = pts[i];
        return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
    return pts[pts.length - 1][1];
  };
  // forested hills, nearer and nearer, with trees standing on their edges
  const hills: [number, number, number, number][] = [
    [0.5, 0.7, 0.04, 0.45],
    [0.3, 0.78, 0.035, 0.6],
    [0.12, 0.87, 0.03, 0.8],
  ];
  hills.forEach(([depth, base, amp, freq], k) => {
    const pts = line(40, (x) => h * base + Math.sin((x / w) * Math.PI * 2 * freq + k * 2) * h * amp + fbm(x / 70, seed + 10 + k) * 8 * s);
    const trees: [number, number, number][] = [];
    for (let x = -4; x < w + 4; x += (5 + r() * 9) * s * (1 + (0.5 - depth))) if (r() < 0.75) trees.push([x, yAt(pts, x) + 2, (7 + r() * 7) * s * (1.6 - depth)]);
    ridges.push({ pts, depth, trees, snow: 0, k: k + 2 });
  });
  const near = ridges[ridges.length - 1].pts;
  const cabins: Cabin[] = [];
  for (const fx of [0.16, 0.3, 0.62, 0.78, 0.88]) {
    const cw = (20 + r() * 8) * s;
    const x = w * fx;
    const y = yAt(near, x) + (6 + r() * 6) * s;
    cabins.push({ x, y, w: cw, chimney: [x + cw * 0.22, y - cw * 0.95], seed: Math.floor(r() * 1e6) });
  }
  const mid = ridges[3].pts;
  const cable: [[number, number], [number, number]] = [
    [w * 0.9, yAt(near, w * 0.9) - 4 * s],
    [w * 0.1, yAt(mid, w * 0.1) - 6 * s],
  ];
  const firs: [number, number, number][] = [
    [-2 * s, h * 1.0, 46 * s],
    [22 * s, h * 1.02, 34 * s],
    [w + 4 * s, h * 1.0, 44 * s],
  ];
  return { kind: "mountain", ridges, cabins, cable, firs };
}

function fir(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  // a simple stacked-triangle pine
  g.beginPath();
  g.moveTo(x, y - s * 2.4);
  g.lineTo(x + s * 0.45, y - s * 1.3);
  g.lineTo(x + s * 0.3, y - s * 1.3);
  g.lineTo(x + s * 0.65, y - s * 0.35);
  g.lineTo(x + s * 0.12, y - s * 0.35);
  g.lineTo(x + s * 0.12, y);
  g.lineTo(x - s * 0.12, y);
  g.lineTo(x - s * 0.12, y - s * 0.35);
  g.lineTo(x - s * 0.65, y - s * 0.35);
  g.lineTo(x - s * 0.3, y - s * 1.3);
  g.lineTo(x - s * 0.45, y - s * 1.3);
  g.closePath();
  g.fill();
}

// a fir with a lit half toward the sun
function litFir(g: CanvasRenderingContext2D, x: number, y: number, s: number, dark: C, lit: C, sunX: number) {
  g.fillStyle = css(dark);
  fir(g, x, y, s);
  g.save();
  g.beginPath();
  g.rect(sunX > 0 ? x + s * 0.04 : x - s, y - s * 2.6, s * 0.96, s * 2.6);
  g.clip();
  g.fillStyle = css(lit);
  fir(g, x, y, s);
  g.restore();
}

function paintMountain(g: CanvasRenderingContext2D, lay: MtnLayout, w: number, h: number, L: Light, season: Season) {
  const Q = pop(L);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  const sunX = L.sun[0] >= 0 ? 1 : -1;
  const up = L.night < 0.6 && L.overcast < 0.8;
  const snowLit = mix(Q.wall, [255, 255, 255], 0.3);
  const snowShade = mix(Q.shade, [255, 255, 255], 0.25);
  // the hills by season, in the city-pop greens (and oranges in autumn)
  const greens: Record<Season, C> = { spring: [40, 112, 66], summer: [32, 100, 58], autumn: [44, 100, 58], winter: [52, 92, 80] };
  for (const r of lay.ridges) {
    const outline = () => {
      g.beginPath();
      g.moveTo(-10, h);
      for (const [x, y] of r.pts) g.lineTo(x, y);
      g.lineTo(w + 10, h);
      g.closePath();
    };
    if (r.depth >= 0.7) {
      // peaks: pale rock, snow above the line, and a crisp blue shadow down
      // the side away from the sun
      const rock = far(mix(Q.shade, Q.wall, 0.5), r.depth * 0.4, L, Q);
      g.save();
      outline();
      g.fillStyle = css(rock);
      g.fill();
      g.clip();
      const top = Math.min(...r.pts.map((p) => p[1]));
      const capH = h * (0.07 + 0.12 * L.snowline) * r.snow * (r.depth === 1 ? 1.5 : 1);
      if (capH > 2) {
        g.fillStyle = css(far(snowLit, r.depth * 0.3, L, Q));
        g.beginPath();
        g.moveTo(-10, top - 5);
        for (let x = -10; x <= w + 10; x += 5 * s) g.lineTo(x, top + capH + Math.abs(Math.sin(x / (7 * s))) * 6 * s + fbm(x / 30, 77) * 12 * s);
        g.lineTo(w + 10, top - 5);
        g.fill();
      }
      g.fillStyle = css(far(Q.shade, r.depth * 0.35, L, Q), up ? 0.9 : 0.55);
      for (let i = 1; i < r.pts.length - 1; i++) {
        const [x, y] = r.pts[i];
        if (y <= r.pts[i - 1][1] && y <= r.pts[i + 1][1] && y < h * 0.62) {
          // the shadow side runs from the summit down and away from the sun
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - sunX * w * 0.6, h * 0.9);
          g.lineTo(x + sunX * w * 0.04, h * 0.9);
          g.closePath();
          g.fill();
        }
      }
      // a touch of blue on the snow in shadow
      void snowShade;
      g.restore();
      continue;
    }
    // hills: deep green, with firs standing on their edge
    const base = L.snow >= 0.5 ? mix(snowLit, Q.shade, 0.25) : mix(greens[season], [14, 24, 52], L.night * 0.8);
    const hill = far(base, r.depth, L, Q);
    g.fillStyle = css(hill);
    outline();
    g.fill();
    const dark = far(L.snow >= 0.5 ? mix(Q.leaf[0], [255, 255, 255], 0.1) : Q.leaf[0], r.depth, L, Q);
    const lit = far(L.snow >= 0.5 ? mix(Q.leaf[1], [255, 255, 255], 0.35) : season === "autumn" ? mix(Q.leaf[1], [214, 120, 50], 0.35) : Q.leaf[1], r.depth, L, Q);
    for (const [x, y, ts] of r.trees) litFir(g, x, y, ts, dark, up ? lit : dark, sunX);
    if (r === lay.ridges[3]) {
      const [[ax, ay], [bx, by]] = lay.cable;
      g.strokeStyle = css(far([20, 24, 40], 0.2, L, Q), 0.7);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 16 * s, bx, by);
      g.stroke();
    }
  }
  // white villas with terracotta roofs
  for (const c of lay.cabins) {
    const { x, y, w: cw } = c;
    const sideW = cw * 0.35;
    g.fillStyle = css(Q.shade);
    g.fillRect(sunX > 0 ? x - cw / 2 - sideW : x + cw / 2, y - cw * 0.55, sideW, cw * 0.55);
    g.fillStyle = css(Q.wall);
    g.fillRect(x - cw / 2, y - cw * 0.55, cw, cw * 0.55);
    g.fillStyle = css(L.snow > 0.3 ? snowLit : Q.trim);
    g.beginPath();
    g.moveTo(x - cw * 0.62, y - cw * 0.52);
    g.lineTo(x, y - cw * 0.95);
    g.lineTo(x + cw * 0.62, y - cw * 0.52);
    g.closePath();
    g.fill();
    g.fillStyle = css(Q.wall);
    g.fillRect(c.chimney[0] - 2 * s, c.chimney[1], 4 * s, cw * 0.3);
    const lit = hash(c.seed) < 0.3 + 0.7 * L.lights && L.night > 0.15;
    const frame = mix(Q.glass, [0, 0, 0], 0.5);
    for (const ox of [-0.32, 0.1]) {
      g.fillStyle = css(frame);
      g.fillRect(x + cw * ox - 0.8, y - cw * 0.42 - 0.8, cw * 0.22 + 1.6, cw * 0.26 + 1.6);
      g.fillStyle = css(lit ? Q.lamp : Q.glass);
      g.fillRect(x + cw * ox, y - cw * 0.42, cw * 0.22, cw * 0.26);
    }
  }
  const dark = L.snow >= 0.5 ? mix(Q.leaf[0], [255, 255, 255], 0.1) : Q.leaf[0];
  for (const [x, y, fs] of lay.firs) litFir(g, x, y, fs, dark, up ? Q.leaf[1] : dark, sunX);
  grain(g, w, h, 0.045);
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

export class SettingScene {
  private still: CanvasRenderingContext2D;
  private live: CanvasRenderingContext2D;
  private kind: "city" | "mountain" | "coast" | "country" | null = null;
  private wpano: WorldPano | null = null;
  private lay: CityLayout | MtnLayout | null = null;
  private pix: PixLayout[] | null = null;
  private pano: Pano | null = null;
  private lpano: LinePano | null = null;
  private art = artMode();
  private panoKey = "";
  private size = "";
  private key = "";
  private L: Light | null = null;
  private P: Pal | null = null;
  private t = 0;
  private acc = 0;
  private dpr = 1;
  private lastShow = -1;

  constructor(
    private stillCv: HTMLCanvasElement,
    private liveCv: HTMLCanvasElement,
  ) {
    this.still = stillCv.getContext("2d")!;
    this.live = liveCv.getContext("2d")!;
  }

  set(kind: SettingKind | null) {
    const k = kind === "city" || kind === "mountain" || kind === "coast" || kind === "country" ? kind : null;
    if (k === this.kind) return;
    this.kind = k;
    this.lay = null;
    this.lpano = null;
    this.wpano = null;
    this.key = "";
    if (!k) {
      this.still.setTransform(1, 0, 0, 1, 0, 0);
      this.still.clearRect(0, 0, this.stillCv.width, this.stillCv.height);
      this.live.setTransform(1, 0, 0, 1, 0, 0);
      this.live.clearRect(0, 0, this.liveCv.width, this.liveCv.height);
    }
  }

  step(dt: number, wx: Weather | null, f: SettingFrame) {
    if (!this.kind) return;
    this.t += dt;
    const show = f.show < 0.02 ? 0 : f.show;
    if (Math.abs(show - this.lastShow) > 0.005) {
      this.lastShow = show;
      const o = show.toFixed(3);
      this.stillCv.style.opacity = o;
      this.liveCv.style.opacity = o;
    }
    if (show === 0) return;
    const size = `${f.w}x${f.h}`;
    if (size !== this.size || !this.lay) {
      this.size = size;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const cv of [this.stillCv, this.liveCv]) {
        cv.width = Math.round(f.w * this.dpr);
        cv.height = Math.round(f.h * this.dpr);
      }
      this.lay = this.kind === "city" ? cityLayout(f.w, f.h, 7) : mountainLayout(f.w, f.h, 11);
      this.pix = this.kind === "mountain" ? pixComps().map((c, i) => pixLayout(f.w, f.h, 11 + i * 7, pixStyle(), c)) : null;
      this.key = "";
    }
    // repaint the still layer only when the light has really changed
    const elDeg = (f.el * 180) / Math.PI;
    const key = [
      Math.round(elDeg * 2),
      Math.round(f.az * 10),
      Math.round(f.dk * 30),
      wx?.kind ?? "",
      Math.round((wx?.cloud ?? 0) * 5),
      f.season,
      Math.round(f.hour * 4),
      Math.round(f.temp ?? 99),
    ].join("|");
    if (key !== this.key) {
      this.key = key;
      this.L = lightFor(f, wx);
      this.P = palette(this.L);
      const g = this.still;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, f.w, f.h);
      const wk = this.world();
      if (wk) this.lpano = this.wpano = paintWorldPano(wk, f.w, f.h, this.L, f.season, lineStyle(), this.dpr);
      else if (this.lay.kind === "city") paintCity(g, this.lay, f.w, f.h, this.L);
      else if (this.pix && this.art === "line") this.lpano = paintLinePano(this.pix, this.L, f.season, lineStyle(), this.dpr);
      else if (this.pix) this.pano = paintPano(this.pix, this.L, f.season);
      if (process.env.NODE_ENV !== "production") (window as unknown as { __pano?: LinePano | null }).__pano = this.lpano;
      if (!this.pix && !wk) this.aura(g, f);
      this.panoKey = "";
    }
    // the pixel world turns with the globe: redrawn whenever a layer has
    // moved by a whole pixel
    const lp = this.lpano;
    const pk = lp
      ? [0, 1, 2].map((k) => lineOffset(lp, f.yaw ?? 0, f.R, k).toFixed(1)).join(",") + `|${f.cx},${f.cy},${f.R}`
      : this.pano
        ? [0, 1, 2].map((k) => panoOffset(this.pano!, f.yaw ?? 0, f.R, k)).join(",") + `|${f.cx},${f.cy},${f.R}`
        : "";
    if (lp && (this.pix || this.wpano) && pk !== this.panoKey) {
      this.panoKey = pk;
      const g = this.still;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, f.w, f.h);
      drawLinePano(g, lp, f.yaw ?? 0, f.R);
      this.aura(g, f);
    } else if (this.pix && this.pano && pk !== this.panoKey) {
      this.panoKey = pk;
      const g = this.still;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, f.w, f.h);
      drawPano(g, this.pano, f.yaw ?? 0, f.R);
      this.aura(g, f);
    }
    this.frame(dt, f);
  }

  // the line-drawn worlds beyond Montana
  private world(): WorldKind | null {
    return this.kind === "coast" ? "coast" : this.kind === "country" ? "farm" : null;
  }

  private aura(g: CanvasRenderingContext2D, f: SettingFrame) {
    if (this.L) {
      // the air thickens round the globe so the songs stay easy to read
      const r = f.R * 1.3;
      const aura = g.createRadialGradient(f.cx, f.cy, f.R * 0.3, f.cx, f.cy, r);
      aura.addColorStop(0, css(this.L.haze, 0.5));
      aura.addColorStop(0.72, css(this.L.haze, 0.38));
      aura.addColorStop(1, css(this.L.haze, 0));
      g.fillStyle = aura;
      g.fillRect(f.cx - r, f.cy - r, r * 2, r * 2);
    }
  }

  private frame(dt: number, f: SettingFrame) {
    if (!this.lay) return;
    // the moving things, at up to 30 a second
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    const g = this.live;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, f.w, f.h);
    const wp = this.wpano;
    if (wp) liveWorld(g, wp, [0, 1, 2].map((k) => lineOffset(wp, f.yaw ?? 0, f.R, k)), this.t);
    else if (this.lay.kind === "city") this.liveCity(g, this.lay, f);
    else if (this.pix && this.lpano) {
      const lp = this.lpano;
      const off = lineOffset(lp, f.yaw ?? 0, f.R, 2);
      this.pix.forEach((lay, i) => liveLines(g, lay, lp.I, this.L!, this.t + i * 23, i * lay.W * PIX - off, lp.W, i === 0));
    } else if (this.pix && this.pano) {
      const off = panoOffset(this.pano, f.yaw ?? 0, f.R, 2);
      this.pix.forEach((lay, i) => livePixels(g, lay, this.L!, this.t + i * 23, i * lay.W - off, this.pano!.W, i === 0));
    }
  }

  private liveCity(g: CanvasRenderingContext2D, lay: CityLayout, f: SettingFrame) {
    const L = this.L!;
    const t = this.t;
    const { w, h } = f;
    const s = Math.max(0.8, Math.min(1.6, w / 390));
    // red lights blinking on the tall ones
    const blink = 0.5 + 0.5 * Math.sin(t * 2.2);
    for (const [bx, by] of lay.beacons) {
      const a = blink * (0.35 + 0.65 * L.night);
      g.fillStyle = `rgba(255,80,60,${a})`;
      g.beginPath();
      g.arc(bx, by, 1.4 * s, 0, TAU);
      g.fill();
    }
    // birds by day, a plane crossing at night
    if (L.night < 0.4) {
      for (let i = 0; i < 3; i++) {
        const cyc = 30 + i * 7;
        const p = ((t + i * 11) % cyc) / cyc;
        const x = -20 + p * (w + 40),
          y = h * (0.2 + 0.05 * i) + Math.sin(t * 0.8 + i) * 6;
        const flap = Math.sin(t * 6 + i * 2) * 2.4 * s;
        g.strokeStyle = "rgba(20,30,60,0.75)";
        g.lineWidth = 1.2 * s;
        g.beginPath();
        g.moveTo(x - 4 * s, y - flap);
        g.quadraticCurveTo(x - 1.5 * s, y - 1.5 * s, x, y);
        g.quadraticCurveTo(x + 1.5 * s, y - 1.5 * s, x + 4 * s, y - flap);
        g.stroke();
      }
    } else {
      const cyc = 46;
      const q = (t % cyc) / cyc;
      if (q < 0.55) {
        const p = q / 0.55;
        const px = w + 20 - p * (w + 40),
          py = h * 0.17 + p * h * 0.05;
        g.fillStyle = `rgba(255,255,255,${(t * 1.1) % 1 < 0.08 ? 0.9 : 0})`;
        g.fillRect(px - 1, py - 1, 2, 2);
        g.fillStyle = `rgba(255,70,70,${0.6 + 0.4 * Math.sin(t * 6)})`;
        g.fillRect(px - 5, py, 1.3, 1.3);
      }
    }
  }

  private liveMountain(g: CanvasRenderingContext2D, lay: MtnLayout, f: SettingFrame) {
    const L = this.L!,
      P = this.P!;
    const t = this.t;
    const s = Math.max(0.8, Math.min(1.6, f.w / 390));
    // the gondola, up and back
    const [[ax, ay], [bx, by]] = lay.cable;
    const ph = (t % 70) / 70;
    const u = ph < 0.5 ? smooth(0, 1, ph * 2) : 1 - smooth(0, 1, (ph - 0.5) * 2);
    const gx = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * ((ax + bx) / 2) + u * u * bx;
    const gy = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * ((ay + by) / 2 + 16 * s) + u * u * by;
    g.save();
    g.translate(gx, gy);
    g.rotate(Math.sin(t * 1.3) * 0.07);
    const cab = mix(tone(P, 0.1, L), [220, 100, 90], 0.45 * (1 - 0.5 * L.night));
    g.fillStyle = css(tone(P, 0.1, L));
    g.fillRect(-0.6, 0, 1.2, 5 * s);
    g.fillStyle = css(cab);
    rrect(g, -5 * s, 5 * s, 10 * s, 8 * s, 2 * s);
    g.fill();
    g.fillStyle = L.night > 0.25 ? css(P.win, L.night) : css(mix(cab, P.sky, 0.5));
    rrect(g, -3.5 * s, 6.5 * s, 7 * s, 3 * s, 1 * s);
    g.fill();
    g.restore();
    // chimney smoke: soft round puffs drifting downwind
    const wind = Math.max(-1, Math.min(1, (L.wind - 2) / 6)) * 0.6 + 0.35;
    const smoke = mix(P.sky, [255, 255, 255], 0.35 * (1 - L.night));
    lay.cabins.forEach((c, ci) => {
      const [x0, y0] = c.chimney;
      for (let k = 0; k < 7; k++) {
        const age = (t * 0.1 + k / 7 + hash(ci)) % 1;
        const x = x0 + wind * age * age * 36 * s + Math.sin(age * 4 + ci) * 2 * s;
        const y = y0 - age * 40 * s;
        const r = (2 + age * 6) * s;
        g.fillStyle = css(smoke, (1 - age) * Math.min(1, age * 5) * 0.32);
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
    });
    // fireflies on summer nights; a bird gliding by day
    if (L.night > 0.5) {
      for (let i = 0; i < 10; i++) {
        const x = f.w * hash(i + 70) + Math.sin(t * 0.4 + i) * 12 * s;
        const y = f.h * (0.84 + 0.12 * hash(i + 80)) + Math.cos(t * 0.6 + i * 2) * 6 * s;
        const a = Math.max(0, Math.sin(t * 1.5 + i * 1.9)) * L.lights;
        g.fillStyle = css([255, 230, 140], a * 0.9);
        g.beginPath();
        g.arc(x, y, 1.2 * s, 0, TAU);
        g.fill();
      }
    } else {
      const a = t * 0.22;
      const ex = f.w * 0.8 + Math.cos(a) * 24 * s,
        ey = f.h * 0.6 + Math.sin(a) * 7 * s;
      const flap = Math.sin(t * 2) * 0.4;
      g.strokeStyle = css(tone(P, 0.3, L));
      g.lineWidth = 1.4 * s;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(ex - 6 * s, ey - 1 - flap * 2);
      g.quadraticCurveTo(ex - 2 * s, ey - 3, ex, ey);
      g.quadraticCurveTo(ex + 2 * s, ey - 3, ex + 6 * s, ey - 1 - flap * 2);
      g.stroke();
    }
  }
}


// ---------------------------------------------------------------------------
// finding it
// ---------------------------------------------------------------------------

const CACHE = "sotd-setting";
const WEEK = 7 * 24 * 3600_000;

// The kind of place at (lat, lon), from the server, remembered for a week.
export async function settingFor(lat: number, lon: number): Promise<SettingKind | null> {
  const at = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? "null") as { at: string; kind: SettingKind | null; t: number } | null;
    if (c && c.at === at && Date.now() - c.t < WEEK) return c.kind;
  } catch {}
  try {
    const r = await fetch(`/api/setting?lat=${lat.toFixed(1)}&lon=${lon.toFixed(1)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { kind?: SettingKind };
    const kind = j.kind ?? null;
    if (kind)
      try {
        localStorage.setItem(CACHE, JSON.stringify({ at, kind, t: Date.now() }));
      } catch {}
    return kind;
  } catch {
    return null;
  }
}
