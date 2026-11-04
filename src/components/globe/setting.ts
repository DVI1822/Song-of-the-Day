import type { Weather } from "@/lib/weather";
import type { SettingKind } from "@/lib/setting";
import type { Season } from "./scene";
import { skyBands } from "./sky";
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
};

type C = [number, number, number];
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

type Light = {
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
// the city
// ---------------------------------------------------------------------------

type Building = {
  x: number;
  w: number;
  top: number;
  depth: number;
  base: C;
  glass: boolean;
  roof: "flat" | "spire" | "antenna" | "step" | "tank" | "crown";
  seed: number;
  win: [number, number, number, number]; // window w, h, step x, step y
  beacon: boolean;
};
type Car = { lane: number; speed: number; off: number; col: C };
type CityLayout = { kind: "city"; b: Building[]; road: number; cars: Car[]; beacons: [number, number][]; tv: [number, number, number][] };

const CONCRETE: C[] = [
  [156, 152, 146],
  [176, 170, 160],
  [128, 132, 138],
  [150, 112, 92],
  [196, 188, 172],
  [112, 118, 128],
];
const GLASS: C[] = [
  [86, 116, 148],
  [70, 96, 126],
  [98, 132, 150],
  [120, 140, 160],
];

function cityLayout(w: number, h: number, seed: number): CityLayout {
  const r = rng(seed);
  const b: Building[] = [];
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const row = (depth: number, minW: number, maxW: number, topA: number, topB: number, win: Building["win"], landmarks: [number, number, number][] = []) => {
    let x = -r() * maxW;
    while (x < w + 10) {
      const bw = minW + r() * (maxW - minW);
      const glass = r() < 0.45;
      const top = h * (topA + (topB - topA) * Math.pow(r(), 1.3));
      const rr = r();
      b.push({
        x,
        w: bw,
        top,
        depth,
        base: glass ? pick(GLASS) : pick(CONCRETE),
        glass,
        roof: rr < 0.12 ? "antenna" : rr < 0.24 ? "step" : rr < 0.36 && depth < 0.6 ? "tank" : "flat",
        seed: Math.floor(r() * 1e6),
        win,
        beacon: false,
      });
      x += bw + (r() < 0.25 ? r() * minW * 0.6 : -r() * 2);
    }
    // the tall ones that frame the globe
    for (const [fx, ftop, fw] of landmarks)
      b.push({
        x: w * fx - fw / 2,
        w: fw,
        top: h * ftop,
        depth,
        base: pick(GLASS),
        glass: true,
        roof: r() < 0.5 ? "spire" : "crown",
        seed: Math.floor(r() * 1e6),
        win,
        beacon: true,
      });
  };
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  const edge = Math.min(0.11, 46 / w);
  row(0.95, 12 * s, 30 * s, 0.56, 0.7, [1.4, 1.6, 4, 4.5], [
    [edge * 0.9, 0.27, 26 * s],
    [1 - edge * 1.1, 0.33, 22 * s],
    [0.3, 0.52, 18 * s],
    [0.74, 0.5, 20 * s],
  ]);
  row(0.55, 24 * s, 52 * s, 0.67, 0.8, [2.4, 3, 6, 7], [
    [edge * 0.55, 0.47, 34 * s],
    [1 - edge * 0.5, 0.52, 30 * s],
  ]);
  row(0.18, 40 * s, 80 * s, 0.79, 0.88, [4, 5, 9, 11]);
  // nearer rows draw over further ones
  b.sort((a, c) => c.depth - a.depth);
  const beacons: [number, number][] = [];
  for (const q of b)
    if (q.beacon || q.roof === "antenna") beacons.push([q.x + q.w / 2, q.top - (q.roof === "spire" ? q.w * 1.6 : q.roof === "antenna" ? q.w * 0.6 : 0)]);
  const cars: Car[] = [];
  for (let i = 0; i < 16; i++)
    cars.push({
      lane: i % 2,
      speed: (24 + r() * 26) * s,
      off: r(),
      col: pick([
        [200, 60, 50],
        [230, 230, 230],
        [40, 44, 52],
        [70, 110, 170],
        [190, 190, 196],
        [230, 190, 60],
      ] as C[]),
    });
  // a few windows that flicker like TVs
  const tv: [number, number, number][] = [];
  for (const q of b)
    if (q.depth < 0.6 && r() < 0.35) {
      const [ww, wh, sx, sy] = q.win;
      const cols = Math.max(1, Math.floor((q.w - 6) / sx));
      const rows = Math.max(1, Math.floor((h - q.top - 8) / sy));
      const cx = Math.floor(r() * cols),
        cy = Math.floor(r() * Math.min(rows, 8));
      tv.push([q.x + 4 + cx * sx + ww / 2, q.top + 6 + cy * sy + wh / 2, ww]);
    }
  return { kind: "city", b, road: h * 0.905, cars, beacons, tv };
}

const WARM_WIN: C[] = [
  [255, 214, 150],
  [255, 226, 170],
  [255, 238, 205],
  [255, 200, 120],
  [210, 228, 255],
];

function paintCity(g: CanvasRenderingContext2D, lay: CityLayout, w: number, h: number, L: Light) {
  // the city's own glow in the air at night
  if (L.night > 0.05) {
    const glow = g.createLinearGradient(0, h * 0.45, 0, h);
    glow.addColorStop(0, css([255, 160, 90], 0));
    glow.addColorStop(1, css(mix([255, 150, 80], [255, 190, 150], L.overcast), 0.28 * L.night * (0.6 + 0.6 * L.overcast)));
    g.fillStyle = glow;
    g.fillRect(0, h * 0.45, w, h * 0.55);
  }
  let lastDepth = -1;
  for (const q of lay.b) {
    if (q.depth !== lastDepth) {
      // a veil of haze between the rows
      if (lastDepth > 0) {
        const vg = g.createLinearGradient(0, h * 0.5, 0, h);
        vg.addColorStop(0, css(L.haze, 0));
        vg.addColorStop(1, css(L.haze, 0.18 * L.hazeK));
        g.fillStyle = vg;
        g.fillRect(0, h * 0.5, w, h * 0.5);
      }
      lastDepth = q.depth;
    }
    building(g, q, h, w, L);
  }
  // the elevated road and its railing
  const y = lay.road;
  const deck = air(lit([70, 72, 78], N_FRONT, L), 0.05, L);
  g.fillStyle = css(deck);
  g.fillRect(0, y, w, 6);
  g.fillStyle = css(mix(deck, [0, 0, 0], 0.25));
  g.fillRect(0, y + 6, w, 2);
  for (let x = 30; x < w; x += 70) g.fillRect(x, y + 8, 7, h - y);
  g.fillStyle = css(air(lit([120, 122, 128], N_UP, L), 0.05, L));
  g.fillRect(0, y - 2, w, 2.5);
  g.fillStyle = css(mix(deck, [0, 0, 0], 0.35));
  for (let x = 6; x < w; x += 14) g.fillRect(x, y - 6, 1.2, 4);
  g.fillRect(0, y - 6, w, 1);
  if (L.snow > 0.3) {
    g.fillStyle = css(lit([240, 244, 250], N_UP, L), L.snow);
    g.fillRect(0, y - 7, w, 1.5);
  }
  // street lamps along it, lit after dusk
  for (let x = 20; x < w; x += 58) {
    g.fillStyle = css(mix(deck, [0, 0, 0], 0.4));
    g.fillRect(x, y - 20, 1.3, 18);
    g.fillRect(x - 4, y - 20, 5, 1.3);
    if (L.lights > 0.3) {
      const lg = g.createRadialGradient(x - 4, y - 18, 0, x - 4, y - 18, 16);
      lg.addColorStop(0, `rgba(255,205,140,${0.55 * L.night})`);
      lg.addColorStop(1, "rgba(255,205,140,0)");
      g.fillStyle = lg;
      g.fillRect(x - 20, y - 34, 32, 32);
      g.fillStyle = `rgba(255,228,180,${L.night})`;
      g.fillRect(x - 5, y - 19, 3, 1.6);
    }
  }
}

function building(g: CanvasRenderingContext2D, q: Building, h: number, w: number, L: Light) {
  const { x, w: bw, top, depth } = q;
  const side = Math.max(2, bw * (depth < 0.3 ? 0.16 : 0.12));
  // you see the side facing the middle of the screen
  const right = x + bw / 2 < w / 2;
  const front = air(lit(q.base, N_FRONT, L, q.glass ? 0.15 : 0), depth, L);
  const sideC = air(lit(q.base, right ? N_RIGHT : N_LEFT, L, q.glass ? 0.1 : 0), depth, L);
  // body
  if (q.glass) {
    const gr = g.createLinearGradient(0, top, 0, h);
    gr.addColorStop(0, css(mix(front, L.haze, 0.25 * (1 - L.night))));
    gr.addColorStop(1, css(mix(front, [0, 0, 0], 0.18)));
    g.fillStyle = gr;
  } else g.fillStyle = css(front);
  g.fillRect(x, top, bw, h - top);
  g.fillStyle = css(sideC);
  if (right) g.fillRect(x + bw, top + side * 0.35, side, h - top);
  else g.fillRect(x - side, top + side * 0.35, side, h - top);
  // the roof's edge catching the sky
  const roofC = air(lit(mix(q.base, [210, 210, 210], 0.3), N_UP, L), depth, L);
  g.fillStyle = css(roofC);
  g.fillRect(x, top - 1, bw, 1.6);
  if (L.snow > 0.25) {
    g.fillStyle = css(air(lit([245, 248, 252], N_UP, L), depth, L), Math.min(1, L.snow * 1.2));
    g.fillRect(x - 0.5, top - 2.2, bw + 1, 2.2);
  }
  // roof things
  g.fillStyle = css(front);
  const cx = x + bw / 2;
  if (q.roof === "spire") {
    g.beginPath();
    g.moveTo(x + bw * 0.2, top);
    g.lineTo(cx, top - bw * 1.6);
    g.lineTo(x + bw * 0.8, top);
    g.fill();
    g.fillRect(cx - 0.6, top - bw * 1.6 - 6, 1.2, 6);
  } else if (q.roof === "crown") {
    g.fillRect(x + bw * 0.12, top - bw * 0.35, bw * 0.76, bw * 0.35);
    g.fillRect(x + bw * 0.28, top - bw * 0.65, bw * 0.44, bw * 0.3);
    g.fillRect(cx - 0.6, top - bw * 0.65 - 10, 1.2, 10);
  } else if (q.roof === "antenna") {
    g.fillRect(cx - 0.7, top - bw * 0.6, 1.4, bw * 0.6);
  } else if (q.roof === "step") {
    g.fillRect(x + bw * 0.15, top - bw * 0.18, bw * 0.7, bw * 0.18);
  } else if (q.roof === "tank") {
    const tw = Math.min(9, bw * 0.22);
    const tx = x + bw * (0.2 + 0.5 * hash(q.seed));
    g.fillStyle = css(air(lit([120, 92, 70], N_FRONT, L), depth, L));
    g.fillRect(tx, top - tw * 1.4, tw, tw);
    g.beginPath();
    g.moveTo(tx - 0.5, top - tw * 1.4);
    g.lineTo(tx + tw / 2, top - tw * 1.85);
    g.lineTo(tx + tw + 0.5, top - tw * 1.4);
    g.fill();
    g.fillRect(tx + 1, top - tw * 0.4, 1, tw * 0.4);
    g.fillRect(tx + tw - 2, top - tw * 0.4, 1, tw * 0.4);
  }
  // windows
  const [ww, wh, sx, sy] = q.win;
  const cols = Math.max(1, Math.floor((bw - 4) / sx));
  const pad = (bw - cols * sx) / 2 + (sx - ww) / 2;
  const rows = Math.floor((h - top - 6) / sy);
  const dayWin = 1 - L.night;
  const sky = mix(L.haze, [255, 255, 255], 0.2);
  for (let j = 0; j < rows; j++) {
    const wy = top + 5 + j * sy;
    if (wy > h) break;
    for (let i = 0; i < cols; i++) {
      const wx = x + pad + i * sx;
      const n = q.seed + j * 131 + i * 7;
      const on = hash(n) < L.lights * (0.55 + 0.35 * hash(q.seed + j * 3));
      if (on) {
        const c = WARM_WIN[Math.floor(hash(n + 5) * WARM_WIN.length)];
        const a = (0.55 + 0.45 * hash(n + 9)) * Math.max(0.15, L.night) * (1 - depth * 0.35);
        g.fillStyle = css(c, a);
        g.fillRect(wx, wy, ww, wh);
      } else if (dayWin > 0.05 && depth < 0.9) {
        // glass by day: the sky in the upper floors, darker lower down
        const reflect = q.glass ? 0.35 + 0.25 * hash(n + 3) : 0.12;
        g.fillStyle = hash(n + 1) < reflect ? css(air(sky, depth, L), 0.35 * dayWin) : css([20, 28, 40], 0.22 * dayWin * (1 - depth * 0.6));
        g.fillRect(wx, wy, ww, wh);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// the mountains
// ---------------------------------------------------------------------------

type Chalet = { x: number; y: number; w: number; h: number; roof: C; wall: C; chimney: [number, number] | null; seed: number };
type Pine = { x: number; y: number; s: number; depth: number; tone: number };
type MtnLayout = {
  kind: "mountain";
  far: [number, number][];
  far2: [number, number][];
  ridge: [number, number][];
  meadow: [number, number][];
  pines: Pine[];
  chalets: Chalet[];
  church: { x: number; y: number; s: number };
  cable: [[number, number], [number, number]];
  cabins: [number, number][]; // lit cabin windows up the slope
};

function ridgeLine(w: number, n: number, f: (x: number) => number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = -10 + ((w + 20) * i) / n;
    pts.push([x, f(x)]);
  }
  return pts;
}

function mountainLayout(w: number, h: number, seed: number): MtnLayout {
  const r = rng(seed);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  const peak = (x: number, px: number, py: number, spread: number) => {
    const d = Math.abs(x - px) / spread;
    return py + (h * 0.9 - py) * Math.min(1, Math.pow(d, 0.9));
  };
  // the far range: big peaks either side of the globe, a lower saddle below it
  const peaksFar: [number, number, number][] = [
    [w * 0.04, h * 0.28, w * 0.5],
    [w * 0.97, h * 0.33, w * 0.48],
    [w * 0.55, h * 0.52, w * 0.4],
  ];
  const far = ridgeLine(w, Math.round(90 * s), (x) => Math.min(...peaksFar.map(([px, py, sp]) => peak(x, px, py, sp))) + fbm(x / 22, seed) * 12 * s + fbm(x / 6, seed + 3, 2) * 3);
  const peaksFar2: [number, number, number][] = [
    [w * 0.25, h * 0.47, w * 0.35],
    [w * 0.78, h * 0.5, w * 0.32],
  ];
  const far2 = ridgeLine(w, Math.round(80 * s), (x) => Math.min(...peaksFar2.map(([px, py, sp]) => peak(x, px, py, sp)), h * 0.66) + fbm(x / 18, seed + 9) * 10 * s + fbm(x / 5, seed + 13, 2) * 2.5);
  const ridge = ridgeLine(w, 60, (x) => h * 0.7 + fbm(x / 90, seed + 21) * h * 0.06 + Math.cos((x / w) * Math.PI * 2) * h * 0.02);
  const meadow = ridgeLine(w, 40, (x) => h * 0.85 + fbm(x / 120, seed + 31) * h * 0.025 - Math.sin((x / w) * Math.PI) * h * 0.01);
  const yAt = (pts: [number, number][], x: number) => {
    for (let i = 1; i < pts.length; i++)
      if (pts[i][0] >= x) {
        const [x0, y0] = pts[i - 1],
          [x1, y1] = pts[i];
        return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
    return pts[pts.length - 1][1];
  };
  // trees: thick along the forested ridge, a few on the meadow, big ones at the edges
  const pines: Pine[] = [];
  for (let x = -6; x < w + 6; x += (2.6 + r() * 2.4) * s) {
    const y = yAt(ridge, x) + r() * 4 * s;
    pines.push({ x, y, s: (5 + r() * 4) * s, depth: 0.55, tone: r() });
    if (r() < 0.6) pines.push({ x: x + r() * 3, y: y + (6 + r() * 26) * s, s: (5 + r() * 4) * s, depth: 0.5, tone: r() });
  }
  for (let i = 0; i < 9; i++) {
    const x = r() < 0.5 ? r() * w * 0.22 : w - r() * w * 0.22;
    pines.push({ x, y: yAt(meadow, x) + r() * 10, s: (9 + r() * 6) * s, depth: 0.2, tone: r() });
  }
  pines.push({ x: -4 * s, y: h * 0.99, s: 34 * s, depth: 0.02, tone: 0.3 });
  pines.push({ x: 18 * s, y: h * 1.01, s: 26 * s, depth: 0.02, tone: 0.7 });
  pines.push({ x: w + 2 * s, y: h * 1.0, s: 32 * s, depth: 0.02, tone: 0.5 });
  pines.sort((a, b) => a.y - b.y);
  // the village
  const chalets: Chalet[] = [];
  const spots = [0.08, 0.17, 0.27, 0.36, 0.63, 0.71, 0.86, 0.94, 0.45, 0.54];
  spots.forEach((fx, i) => {
    const cw = (16 + r() * 10) * s;
    const x = w * fx + (r() - 0.5) * 10;
    const y = yAt(meadow, x) + (4 + r() * 14) * s * (i > 7 ? 1.6 : 1);
    chalets.push({
      x,
      y,
      w: cw,
      h: cw * (0.5 + r() * 0.25),
      roof: r() < 0.5 ? [86, 58, 46] : [70, 74, 82],
      wall: r() < 0.55 ? [150, 102, 64] : [226, 218, 204],
      chimney: r() < 0.8 ? [x + cw * (0.15 + r() * 0.2) * (r() < 0.5 ? 1 : -1), 0] : null,
      seed: Math.floor(r() * 1e6),
    });
  });
  chalets.sort((a, b) => a.y - b.y);
  const cx = w * 0.79;
  const church = { x: cx, y: yAt(meadow, cx) + 2 * s, s };
  const cable: [[number, number], [number, number]] = [
    [w * 0.9, yAt(meadow, w * 0.9) - 4 * s],
    [w * 0.12, yAt(ridge, w * 0.12) - 10 * s],
  ];
  const cabins: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const x = w * (0.05 + 0.9 * r());
    cabins.push([x, yAt(ridge, x) + (10 + r() * 30) * s]);
  }
  return { kind: "mountain", far, far2, ridge, meadow, pines, chalets, church, cable, cabins };
}

// a range of peaks, faceted: each stretch of ridge throws a face down the
// slope, bright or dark by which way it faces the sun
function range(g: CanvasRenderingContext2D, pts: [number, number][], h: number, depth: number, rock: C, L: Light, snowFrac: number, seed: number) {
  const top = Math.min(...pts.map((p) => p[1]));
  const outline = () => {
    g.beginPath();
    g.moveTo(pts[0][0], h);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(pts[pts.length - 1][0], h);
    g.closePath();
  };
  const facets = (base: C, alpenK: number) => {
    // the body, lit from the front
    const body = g.createLinearGradient(0, top, 0, h);
    body.addColorStop(0, css(air(lit(base, N_FRONT, L), depth, L)));
    body.addColorStop(1, css(air(lit(mix(base, [40, 50, 60], 0.4), N_FRONT, L), depth + 0.15, L)));
    g.fillStyle = body;
    g.fillRect(-10, top - 2, g.canvas.width + 20, h - top + 2);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i];
      const dx = x1 - x0,
        dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      // the slope's normal, tilted toward you
      const n: [number, number, number] = [dy / len, -dx / len, 0.55];
      const nl = Math.hypot(n[0], n[1], n[2]);
      n[0] /= nl;
      n[1] /= nl;
      n[2] /= nl;
      let c = lit(base, n, L);
      if (alpenK > 0) c = mix(c, [255, 150, 160], alpenK * L.alpen * 0.5 * Math.max(0, n[0] * Math.sign(L.sun[0]) + 0.4));
      c = air(c, depth, L);
      const drop = (40 + 60 * hash(i + seed)) * (1 + (h - Math.max(y0, y1)) / h);
      const mx = (x0 + x1) / 2 + (hash(i * 3 + seed) - 0.5) * 14;
      const gr = g.createLinearGradient(0, Math.min(y0, y1), 0, Math.max(y0, y1) + drop);
      gr.addColorStop(0, css(c, 0.95));
      gr.addColorStop(1, css(c, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineTo(mx + (dy > 0 ? 6 : -6), Math.max(y0, y1) + drop);
      g.closePath();
      g.fill();
    }
  };
  g.save();
  outline();
  g.clip();
  facets(rock, 0.4);
  if (snowFrac > 0) {
    // snow above a ragged snowline
    const line = top + (h * 0.62 - top) * snowFrac;
    g.save();
    g.beginPath();
    g.moveTo(-10, -10);
    g.lineTo(g.canvas.width + 10, -10);
    for (let x = g.canvas.width + 10; x >= -10; x -= 3) g.lineTo(x, line + fbm(x / 14, seed + 50) * 26 + fbm(x / 4, seed + 60, 2) * 6);
    g.closePath();
    g.clip();
    facets([236, 240, 248], 1);
    g.restore();
  }
  g.restore();
}

function pine(g: CanvasRenderingContext2D, p: Pine, L: Light, season: Season) {
  const { x, y, s, depth, tone } = p;
  const larch = season === "autumn" && tone > 0.82;
  const base: C = larch ? [196, 132, 40] : mix([34, 72, 52], [52, 86, 58], tone);
  const dark = air(lit(mix(base, [0, 0, 0], 0.2), L.sun[0] > 0 ? N_LEFT : N_RIGHT, L), depth, L);
  const light = air(lit(base, L.sun[0] > 0 ? N_RIGHT : N_LEFT, L), depth, L);
  const ht = s * 2.6;
  const tiers = s > 12 ? 5 : 3;
  for (let i = 0; i < tiers; i++) {
    const ty = y - ht + (ht * i) / tiers;
    const bw = s * (0.35 + (0.65 * (i + 1)) / tiers);
    const bh = (ht / tiers) * 1.6;
    // the half toward the sun is lighter
    g.fillStyle = css(dark);
    g.beginPath();
    g.moveTo(x, ty);
    g.lineTo(x - bw / 2, ty + bh);
    g.lineTo(x + bw / 2, ty + bh);
    g.fill();
    g.fillStyle = css(light);
    g.beginPath();
    g.moveTo(x, ty);
    const sd = L.sun[0] > 0 ? 1 : -1;
    g.lineTo(x + (sd * bw) / 2, ty + bh);
    g.lineTo(x + sd * bw * 0.05, ty + bh);
    g.fill();
    if (L.snow > 0.2) {
      g.fillStyle = css(air(lit([240, 244, 250], N_UP, L), depth, L), Math.min(1, L.snow * 1.1));
      g.beginPath();
      g.moveTo(x, ty);
      g.lineTo(x - bw * 0.28, ty + bh * 0.45);
      g.lineTo(x + bw * 0.28, ty + bh * 0.45);
      g.fill();
    }
  }
  if (s > 12) {
    g.fillStyle = css(air(lit([70, 50, 36], N_FRONT, L), depth, L));
    g.fillRect(x - s * 0.06, y + ht * 0.05, s * 0.12, s * 0.5);
  }
}

function chalet(g: CanvasRenderingContext2D, c: Chalet, L: Light) {
  const { x, y, w, h } = c;
  const depth = 0.12;
  const left = x - w / 2,
    top = y - h;
  const wall = air(lit(c.wall, N_FRONT, L), depth, L);
  g.fillStyle = css(wall);
  g.fillRect(left, top, w, h);
  // the gable end faces you: a wide, low roof with deep eaves
  const ridgeY = top - w * 0.34;
  const roofN = (sd: number): [number, number, number] => [sd * 0.6, 0.75, 0.3];
  for (const sd of [-1, 1]) {
    g.fillStyle = css(air(lit(L.snow > 0.3 ? mix(c.roof, [240, 244, 250], L.snow) : c.roof, roofN(sd), L), depth, L));
    g.beginPath();
    g.moveTo(x, ridgeY);
    g.lineTo(x + sd * (w / 2 + w * 0.14), top + w * 0.05);
    g.lineTo(x + sd * (w / 2 + w * 0.14), top + w * 0.1);
    g.lineTo(x, ridgeY + w * 0.07);
    g.fill();
  }
  // gable wood
  g.fillStyle = css(air(lit([120, 80, 50], N_FRONT, L), depth, L));
  g.beginPath();
  g.moveTo(x, ridgeY + w * 0.07);
  g.lineTo(left, top + 0.5);
  g.lineTo(left + w, top + 0.5);
  g.fill();
  // a balcony rail
  g.fillStyle = css(mix(wall, [40, 26, 18], 0.55));
  g.fillRect(left - 1, top + h * 0.42, w + 2, 1.2);
  // windows: dark glass by day, firelight at night (the flicker is drawn live)
  const on = hash(c.seed) < 0.35 + 0.65 * L.lights;
  const wc = on && L.night > 0.2 ? css([255, 196, 110], 0.5 + 0.5 * L.night) : css(air([40, 50, 64], depth, L), 0.9);
  g.fillStyle = wc;
  const ws = Math.max(2, w * 0.14);
  g.fillRect(x - ws * 1.6, top + h * 0.52, ws, ws * 1.1);
  g.fillRect(x + ws * 0.6, top + h * 0.52, ws, ws * 1.1);
  g.fillRect(x - ws / 2, top + h * 0.12, ws, ws);
  if (on && L.night > 0.2) {
    const gl = g.createRadialGradient(x, y - h * 0.3, 0, x, y - h * 0.3, w);
    gl.addColorStop(0, `rgba(255,180,90,${0.22 * L.night})`);
    gl.addColorStop(1, "rgba(255,180,90,0)");
    g.fillStyle = gl;
    g.fillRect(x - w, y - h * 0.3 - w, w * 2, w * 2);
  }
  if (c.chimney) {
    const chx = c.chimney[0];
    const chy = ridgeY + Math.abs(chx - x) * 0.68 * (w * 0.34) / (w / 2 + w * 0.14) * 1.4;
    g.fillStyle = css(air(lit([110, 100, 96], N_FRONT, L), depth, L));
    g.fillRect(chx - 1.6, chy - 6, 3.2, 7);
    c.chimney[1] = chy - 6;
  }
}

function churchDraw(g: CanvasRenderingContext2D, ch: MtnLayout["church"], L: Light) {
  const { x, y, s } = ch;
  const depth = 0.14;
  const wall = air(lit([232, 226, 214], N_FRONT, L), depth, L);
  const shade = air(lit([232, 226, 214], L.sun[0] > 0 ? N_LEFT : N_RIGHT, L), depth, L);
  const roof = air(lit([70, 76, 86], N_UP, L), depth, L);
  // nave
  g.fillStyle = css(wall);
  g.fillRect(x - 14 * s, y - 14 * s, 22 * s, 14 * s);
  g.fillStyle = css(roof);
  g.beginPath();
  g.moveTo(x - 16 * s, y - 13 * s);
  g.lineTo(x - 3 * s, y - 24 * s);
  g.lineTo(x + 10 * s, y - 13 * s);
  g.fill();
  // tower and onion-ish spire
  g.fillStyle = css(wall);
  g.fillRect(x + 6 * s, y - 34 * s, 8 * s, 34 * s);
  g.fillStyle = css(shade);
  g.fillRect(x + 12 * s, y - 34 * s, 2 * s, 34 * s);
  g.fillStyle = css(roof);
  g.beginPath();
  g.moveTo(x + 5 * s, y - 34 * s);
  g.quadraticCurveTo(x + 10 * s, y - 42 * s, x + 10 * s, y - 52 * s);
  g.quadraticCurveTo(x + 10 * s, y - 42 * s, x + 15 * s, y - 34 * s);
  g.fill();
  // clock face, lit at night
  g.fillStyle = L.night > 0.3 ? `rgba(255,236,190,${0.9 * L.night})` : css(mix(wall, [0, 0, 0], 0.25));
  g.beginPath();
  g.arc(x + 10 * s, y - 27 * s, 2.2 * s, 0, TAU);
  g.fill();
  g.fillStyle = L.night > 0.3 && L.lights > 0.2 ? `rgba(255,196,110,${0.8 * L.night})` : css(air([40, 50, 64], depth, L));
  g.fillRect(x - 10 * s, y - 9 * s, 2.5 * s, 5 * s);
  g.fillRect(x - 4 * s, y - 9 * s, 2.5 * s, 5 * s);
}

function paintMountain(g: CanvasRenderingContext2D, lay: MtnLayout, w: number, h: number, L: Light, season: Season) {
  range(g, lay.far, h, 0.92, [128, 124, 132], L, L.snowline, 1);
  range(g, lay.far2, h, 0.7, [110, 106, 108], L, Math.max(0, L.snowline - 0.35) * 0.9, 2);
  // the forested ridge
  const top = Math.min(...lay.ridge.map((p) => p[1]));
  const ridgeBase: C = L.snow > 0.5 ? [150, 160, 166] : season === "autumn" ? [70, 78, 52] : [42, 74, 54];
  const gr = g.createLinearGradient(0, top, 0, h);
  gr.addColorStop(0, css(air(lit(ridgeBase, N_FRONT, L), 0.55, L)));
  gr.addColorStop(1, css(air(lit(mix(ridgeBase, [0, 0, 0], 0.3), N_FRONT, L), 0.45, L)));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-10, h);
  for (const [x, y] of lay.ridge) g.lineTo(x, y + 4);
  g.lineTo(w + 10, h);
  g.fill();
  // the gondola's cable
  const [[ax, ay], [bx, by]] = lay.cable;
  g.strokeStyle = css(air([30, 30, 34], 0.35, L), 0.7);
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(ax, ay);
  g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 14, bx, by);
  g.stroke();
  for (const p of lay.pines) if (p.depth > 0.3) pine(g, p, L, season);
  // lit cabins up the slope
  if (L.night > 0.3)
    for (const [x, y] of lay.cabins) {
      g.fillStyle = `rgba(255,200,120,${0.85 * L.night * L.lights})`;
      g.fillRect(x, y, 1.6, 1.4);
    }
  // the meadow
  const mtop = Math.min(...lay.meadow.map((p) => p[1]));
  const grass: C = L.snow > 0.35 ? [236, 240, 246] : season === "autumn" ? [118, 128, 66] : season === "winter" ? [128, 132, 104] : [96, 146, 70];
  const mg = g.createLinearGradient(0, mtop, 0, h);
  mg.addColorStop(0, css(air(lit(grass, [0, 0.7, 0.7], L), 0.25, L)));
  mg.addColorStop(1, css(air(lit(mix(grass, [0, 0, 0], 0.25), [0, 0.7, 0.7], L), 0.1, L)));
  g.fillStyle = mg;
  g.beginPath();
  g.moveTo(-10, h);
  for (const [x, y] of lay.meadow) g.lineTo(x, y);
  g.lineTo(w + 10, h);
  g.fill();
  // a winding path through the village
  g.strokeStyle = css(air(lit(L.snow > 0.35 ? [200, 200, 206] : [176, 150, 112], [0, 0.8, 0.6], L), 0.15, L), 0.8);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-5, h * 0.95);
  g.bezierCurveTo(w * 0.3, h * 0.88, w * 0.5, h * 0.97, w * 0.8, h * 0.9);
  g.quadraticCurveTo(w * 0.95, h * 0.87, w + 5, h * 0.89);
  g.stroke();
  for (const p of lay.pines) if (p.depth > 0.1 && p.depth <= 0.3) pine(g, p, L, season);
  for (const c of lay.chalets) chalet(g, c, L);
  churchDraw(g, lay.church, L);
  for (const p of lay.pines) if (p.depth <= 0.1) pine(g, p, L, season);
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

export class SettingScene {
  private still: CanvasRenderingContext2D;
  private live: CanvasRenderingContext2D;
  private kind: "city" | "mountain" | null = null;
  private lay: CityLayout | MtnLayout | null = null;
  private size = "";
  private key = "";
  private L: Light | null = null;
  private t = 0;
  private acc = 0;
  private season: Season = "autumn";
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
    const k = kind === "city" || kind === "mountain" ? kind : null;
    if (k === this.kind) return;
    this.kind = k;
    this.lay = null;
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
      this.season = f.season;
      this.L = lightFor(f, wx);
      const g = this.still;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, f.w, f.h);
      if (this.lay.kind === "city") paintCity(g, this.lay, f.w, f.h, this.L);
      else paintMountain(g, this.lay, f.w, f.h, this.L, f.season);
      // the air thickens round the globe so the songs stay easy to read
      const r = f.R * 1.3;
      const aura = g.createRadialGradient(f.cx, f.cy, f.R * 0.3, f.cx, f.cy, r);
      aura.addColorStop(0, css(this.L.haze, 0.5));
      aura.addColorStop(0.72, css(this.L.haze, 0.38));
      aura.addColorStop(1, css(this.L.haze, 0));
      g.fillStyle = aura;
      g.fillRect(f.cx - r, f.cy - r, r * 2, r * 2);
    }
    // the moving things, at up to 30 a second
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    const g = this.live;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, f.w, f.h);
    if (this.lay.kind === "city") this.liveCity(g, this.lay, f);
    else this.liveMountain(g, this.lay, f);
  }

  private liveCity(g: CanvasRenderingContext2D, lay: CityLayout, f: SettingFrame) {
    const L = this.L!;
    const t = this.t;
    const { w, h } = f;
    // cars on the elevated road: headlights one way, tail lights the other
    const y = lay.road;
    for (const c of lay.cars) {
      const span = w + 60;
      const p = (c.off * span + t * c.speed) % span;
      const dir = c.lane ? -1 : 1;
      const x = dir > 0 ? p - 30 : w + 30 - p;
      const ly = y - 3.2 - c.lane * 1.4;
      if (L.night < 0.5) {
        g.fillStyle = css(lit(c.col, N_FRONT, L));
        g.fillRect(x - 4, ly - 1.8, 8, 3);
        g.fillStyle = css(lit(mix(c.col, [0, 0, 0], 0.3), N_UP, L));
        g.fillRect(x - 2.4, ly - 3.2, 4.8, 1.6);
      }
      if (L.night > 0.15) {
        const a = Math.min(1, L.night * 1.4);
        const head = dir > 0;
        const col = head ? `rgba(255,244,214,${a})` : `rgba(255,60,50,${a})`;
        const tip = x + dir * 4;
        const gl = g.createRadialGradient(tip, ly, 0, tip, ly, head ? 10 : 6);
        gl.addColorStop(0, head ? `rgba(255,236,190,${0.45 * a})` : `rgba(255,40,30,${0.4 * a})`);
        gl.addColorStop(1, "rgba(255,200,150,0)");
        g.fillStyle = gl;
        g.fillRect(tip - 10, ly - 10, 20, 20);
        g.fillStyle = col;
        g.fillRect(tip - 1, ly - 0.7, 2, 1.4);
      }
    }
    // red lights on the towers, slowly blinking (by day too, faintly)
    const blink = 0.5 + 0.5 * Math.sin(t * 2.4);
    for (const [bx, by] of lay.beacons) {
      const a = blink * (0.35 + 0.65 * L.night);
      const gl = g.createRadialGradient(bx, by, 0, bx, by, 7);
      gl.addColorStop(0, `rgba(255,50,40,${0.7 * a})`);
      gl.addColorStop(1, "rgba(255,50,40,0)");
      g.fillStyle = gl;
      g.fillRect(bx - 7, by - 7, 14, 14);
      g.fillStyle = `rgba(255,90,80,${a})`;
      g.fillRect(bx - 0.9, by - 0.9, 1.8, 1.8);
    }
    if (L.night > 0.3) {
      // the odd window glowing blue with a TV
      for (let i = 0; i < lay.tv.length; i++) {
        const [x, yy, s] = lay.tv[i];
        if (hash(i + 400) > L.lights) continue;
        const fl = 0.5 + 0.5 * Math.sin(t * (5 + i) + Math.sin(t * 13 + i * 3) * 2);
        g.fillStyle = `rgba(150,190,255,${(0.35 + 0.5 * fl) * L.night})`;
        g.fillRect(x - s / 2, yy - s * 0.6, s, s * 1.2);
      }
      // a plane crossing, now and then
      const cyc = 46;
      const q = (t % cyc) / cyc;
      if (q < 0.55) {
        const p = q / 0.55;
        const px = w + 20 - p * (w + 40);
        const py = h * 0.17 + p * h * 0.05;
        const strobe = (t * 1.1) % 1 < 0.08 ? 1 : 0;
        g.fillStyle = `rgba(255,255,255,${0.9 * strobe})`;
        g.fillRect(px - 1, py - 1, 2, 2);
        g.fillStyle = `rgba(255,70,70,${0.6 + 0.4 * Math.sin(t * 6)})`;
        g.fillRect(px - 5, py, 1.3, 1.3);
        g.fillStyle = "rgba(90,255,140,0.8)";
        g.fillRect(px + 4, py, 1.3, 1.3);
      }
    }
  }

  private liveMountain(g: CanvasRenderingContext2D, lay: MtnLayout, f: SettingFrame) {
    const L = this.L!;
    const t = this.t;
    const s = Math.max(0.8, Math.min(1.6, f.w / 390));
    // the gondola, up and back
    const [[ax, ay], [bx, by]] = lay.cable;
    const cyc = 70;
    const ph = (t % cyc) / cyc;
    const u = ph < 0.5 ? smooth(0, 1, ph * 2) : 1 - smooth(0, 1, (ph - 0.5) * 2);
    const gx = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * ((ax + bx) / 2) + u * u * bx;
    const gy = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * ((ay + by) / 2 + 14) + u * u * by;
    const sway = Math.sin(t * 1.3) * 0.08;
    g.save();
    g.translate(gx, gy);
    g.rotate(sway);
    g.strokeStyle = css(air([30, 30, 34], 0.3, L));
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 5 * s);
    g.stroke();
    g.fillStyle = css(air(lit([200, 50, 46], N_FRONT, L), 0.3, L));
    g.fillRect(-3.5 * s, 5 * s, 7 * s, 6 * s);
    g.fillStyle = L.night > 0.3 ? `rgba(255,220,160,${0.9 * L.night})` : css(air(lit([150, 180, 200], N_FRONT, L), 0.3, L));
    g.fillRect(-2.6 * s, 6 * s, 5.2 * s, 2.2 * s);
    g.restore();
    // chimney smoke curling off downwind
    const wind = Math.max(-1, Math.min(1, (L.wind - 2) / 6)) * 0.6 + 0.35;
    const smokeC = mix(lit([200, 200, 205], N_FRONT, L), L.haze, 0.3);
    for (let ci = 0; ci < lay.chalets.length; ci++) {
      const c = lay.chalets[ci];
      if (!c.chimney || !c.chimney[1]) continue;
      const [x0, y0] = c.chimney;
      const N = 9;
      for (let k = 0; k < N; k++) {
        const age = (t * 0.12 + k / N + hash(ci) ) % 1;
        const rise = age * 46 * s;
        const x = x0 + wind * age * age * 38 * s + Math.sin(age * 5 + ci + t * 0.4) * 3 * s * age;
        const yy = y0 - rise;
        const r = (1.6 + age * 9) * s;
        const a = (1 - age) * age * 4 * 0.16 * (1 - 0.5 * L.night);
        const gr = g.createRadialGradient(x, yy, 0, x, yy, r);
        gr.addColorStop(0, css(smokeC, a));
        gr.addColorStop(1, css(smokeC, 0));
        g.fillStyle = gr;
        g.fillRect(x - r, yy - r, r * 2, r * 2);
      }
    }
    // firelight flickering in the windows after dark
    if (L.night > 0.25) {
      for (let ci = 0; ci < lay.chalets.length; ci++) {
        const c = lay.chalets[ci];
        if (hash(c.seed) >= 0.35 + 0.65 * L.lights) continue;
        const fl = 0.5 + 0.5 * Math.sin(t * 7 + ci * 2) * Math.sin(t * 3.1 + ci);
        const ws = Math.max(2, c.w * 0.14);
        g.fillStyle = `rgba(255,150,60,${0.35 * fl * L.night})`;
        g.fillRect(c.x - ws * 1.6, c.y - c.h + c.h * 0.52, ws, ws * 1.1);
        g.fillRect(c.x + ws * 0.6, c.y - c.h + c.h * 0.52, ws, ws * 1.1);
      }
    } else {
      // a bird of prey circling over the valley by day
      const a = t * 0.25;
      const ex = f.w * 0.82 + Math.cos(a) * 26 * s;
      const ey = f.h * 0.6 + Math.sin(a) * 8 * s;
      const flap = Math.sin(t * 2) * 0.4;
      g.strokeStyle = css(air([40, 34, 30], 0.5, L), 0.85);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(ex - 6 * s, ey - 1 - flap * 2);
      g.quadraticCurveTo(ex - 2 * s, ey - 2, ex, ey);
      g.quadraticCurveTo(ex + 2 * s, ey - 2, ex + 6 * s, ey - 1 - flap * 2);
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
