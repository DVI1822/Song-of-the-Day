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
// the city
// ---------------------------------------------------------------------------

type Prop = "none" | "tank" | "antenna" | "ac" | "sign" | "dome";
type Block = { x: number; w: number; top: number; depth: number; prop: Prop; seed: number; cols: number; signHue: number; col: C };
type CityLayout = { kind: "city"; b: Block[]; rail: number; beacons: [number, number][]; poles: number[] };

function cityLayout(w: number, h: number, seed: number): CityLayout {
  const r = rng(seed);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  const b: Block[] = [];
  const row = (depth: number, minW: number, maxW: number, topA: number, topB: number, props: Prop[]) => {
    let x = -r() * maxW * 0.5;
    while (x < w + 4) {
      const bw = Math.round(minW + r() * (maxW - minW));
      b.push({
        x: Math.round(x),
        w: bw,
        top: Math.round(h * (topA + (topB - topA) * r())),
        depth,
        prop: props[Math.floor(r() * props.length)],
        seed: Math.floor(r() * 1e6),
        cols: bw > 44 * s ? 3 : 2,
        signHue: r(),
        col: BRIGHT[Math.floor(r() * BRIGHT.length)],
      });
      x += bw + (r() < 0.3 ? 4 * s : 0);
    }
  };
  row(1, 30 * s, 56 * s, 0.6, 0.71, ["none", "antenna", "none", "dome"]);
  // two tall ones either side of the globe
  const edge = Math.min(0.1, 40 / w);
  b.push({ x: Math.round(w * edge - 18 * s), w: Math.round(36 * s), top: Math.round(h * 0.36), depth: 0.75, prop: "antenna", seed: 11, cols: 2, signHue: 0, col: BRIGHT[1] });
  b.push({ x: Math.round(w * (1 - edge) - 16 * s), w: Math.round(32 * s), top: Math.round(h * 0.42), depth: 0.75, prop: "antenna", seed: 12, cols: 2, signHue: 0, col: BRIGHT[3] });
  row(0.55, 40 * s, 70 * s, 0.68, 0.79, ["tank", "ac", "none", "sign", "tank", "antenna"]);
  row(0.2, 50 * s, 86 * s, 0.8, 0.88, ["ac", "tank", "none", "sign"]);
  b.sort((a, c) => c.depth - a.depth);
  const beacons: [number, number][] = [];
  for (const q of b) if (q.prop === "antenna" && q.depth >= 0.75) beacons.push([q.x + q.w / 2, q.top - q.w * 0.75]);
  return { kind: "city", b, rail: Math.round(h * 0.9), beacons, poles: [Math.round(w * 0.06), Math.round(w * 0.94)] };
}

function paintCity(g: CanvasRenderingContext2D, lay: CityLayout, w: number, h: number, L: Light) {
  const P = palette(L);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  // a warm glow over the city after dark
  if (L.night > 0.05) {
    const gl = g.createLinearGradient(0, h * 0.5, 0, h);
    gl.addColorStop(0, css([255, 150, 120], 0));
    gl.addColorStop(1, css([255, 140, 120], 0.22 * L.night));
    g.fillStyle = gl;
    g.fillRect(0, h * 0.5, w, h * 0.5);
  }
  for (const q of lay.b) block(g, q, h, w, L, P, s);
  // the elevated railway: a flat deck on simple arches
  const y = lay.rail;
  const deck = tone(P, 0.08, L);
  g.fillStyle = css(deck);
  g.fillRect(0, y, w, 7 * s);
  g.fillStyle = css(shadeOf(deck, 0.25));
  const span = 46 * s;
  for (let x = -span / 2; x < w + span; x += span) {
    g.beginPath();
    g.moveTo(x - span / 2, y + 7 * s);
    g.lineTo(x - span / 2, h);
    g.lineTo(x - span / 2 + 6 * s, h);
    g.lineTo(x - span / 2 + 6 * s, y + 18 * s);
    g.quadraticCurveTo(x + 3 * s, y + 7 * s, x + span / 2, y + 18 * s);
    g.lineTo(x + span / 2, y + 7 * s);
    g.fill();
  }
  g.fillStyle = css(sunny(P, mix(deck, P.sky, 0.25)));
  g.fillRect(0, y - 1, w, 1.5 * s);
  if (L.snow > 0.3) {
    g.fillStyle = css(mix(P.sky, [255, 255, 255], 0.6), L.snow);
    g.fillRect(0, y - 2.5 * s, w, 2 * s);
  }
  // telephone poles with sagging wires at the edges
  const pc = tone(P, 0, L);
  g.strokeStyle = css(pc, 0.8);
  g.lineWidth = 1;
  const [pa, pb] = lay.poles;
  const ptop = h * 0.74;
  g.fillStyle = css(pc);
  for (const px of [pa, pb]) {
    g.fillRect(px - 2 * s, ptop, 4 * s, h - ptop);
    g.fillRect(px - 9 * s, ptop + 6 * s, 18 * s, 2.5 * s);
  }
  for (const dy of [6, 10]) {
    g.beginPath();
    g.moveTo(pa - 8 * s, ptop + dy * s);
    g.quadraticCurveTo(w / 2, ptop + dy * s + 40 * s, pb + 8 * s, ptop + dy * s);
    g.stroke();
  }
  for (const [px, dir] of [[pa, -1], [pb, 1]] as [number, number][]) {
    g.beginPath();
    g.moveTo(px + 8 * s * dir, ptop + 6 * s);
    g.quadraticCurveTo(px + dir * 20 * s, ptop + 14 * s, px + dir * 40 * s, ptop - 4 * s);
    g.stroke();
  }
  grain(g, w, h, 0.05);
}

function block(g: CanvasRenderingContext2D, q: Block, h: number, w: number, L: Light, P: Pal, s: number) {
  const { x, w: bw, top, depth } = q;
  const c = paint(P, q.col, depth, L);
  g.fillStyle = css(c);
  g.fillRect(x, top, bw, h - top);
  // the sunny side: one soft lighter strip
  if (P.sunK > 0.05) {
    const right = L.sun[0] > 0;
    const sw = Math.round(bw * 0.28);
    g.fillStyle = css(sunny(P, c, 1.4));
    g.fillRect(right ? x + bw - sw : x, top, sw, h - top);
  }
  // a thin lighter cap on the roof
  g.fillStyle = css(sunny(P, mix(c, P.sky, 0.18)));
  g.fillRect(x, top, bw, Math.max(1, 1.5 * s));
  if (L.snow > 0.3) {
    g.fillStyle = css(mix(P.sky, [255, 255, 255], 0.65), Math.min(1, L.snow));
    rrect(g, x - 1, top - 2.5 * s, bw + 2, 3 * s, 1.5 * s);
    g.fill();
  }
  const cx = x + bw / 2;
  g.fillStyle = css(c);
  switch (q.prop) {
    case "antenna":
      g.fillRect(cx - 1, top - bw * 0.75, 2, bw * 0.75);
      g.fillRect(cx - bw * 0.15, top - bw * 0.25, bw * 0.3, bw * 0.25);
      break;
    case "dome":
      g.beginPath();
      g.arc(cx, top, bw * 0.28, Math.PI, 0);
      g.fill();
      break;
    case "ac":
      g.fillRect(x + bw * 0.15, top - 5 * s, 9 * s, 5 * s);
      g.fillRect(x + bw * 0.55, top - 4 * s, 7 * s, 4 * s);
      break;
    case "tank": {
      const tw = 10 * s,
        tx = x + bw * (0.18 + 0.4 * hash(q.seed));
      g.fillRect(tx + 1.5 * s, top - 6 * s, 1.5 * s, 6 * s);
      g.fillRect(tx + tw - 3 * s, top - 6 * s, 1.5 * s, 6 * s);
      rrect(g, tx, top - 16 * s, tw, 11 * s, 2 * s);
      g.fill();
      g.beginPath();
      g.moveTo(tx - 1 * s, top - 15 * s);
      g.lineTo(tx + tw / 2, top - 21 * s);
      g.lineTo(tx + tw + 1 * s, top - 15 * s);
      g.fill();
      break;
    }
    case "sign": {
      // a rooftop sign frame; its neon is drawn live after dark
      g.fillRect(x + bw * 0.2, top - 4 * s, 1.5 * s, 4 * s);
      g.fillRect(x + bw * 0.75, top - 4 * s, 1.5 * s, 4 * s);
      rrect(g, x + bw * 0.12, top - 15 * s, bw * 0.76, 11 * s, 2 * s);
      g.fill();
      break;
    }
  }
  // windows: a loose grid of soft rounded panes, only some lit
  if (depth > 0.9 && L.night < 0.3) return;
  const pw = depth > 0.9 ? 3 * s : depth > 0.4 ? 5 * s : 7 * s;
  const ph = pw * 1.25;
  const gapX = (bw - q.cols * pw) / (q.cols + 1);
  const gapY = ph * 1.3;
  const rows = Math.floor((h - top - 10 * s) / (ph + gapY));
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < q.cols; i++) {
      const n = q.seed + j * 31 + i * 7;
      const wx = x + gapX + i * (pw + gapX),
        wy = top + 8 * s + j * (ph + gapY);
      const on = hash(n) < L.lights * 0.75;
      if (on && L.night > 0.15) {
        const a = Math.min(1, L.night * 1.3) * (0.75 + 0.25 * hash(n + 1));
        if (depth < 0.9) {
          const gl = g.createRadialGradient(wx + pw / 2, wy + ph / 2, 0, wx + pw / 2, wy + ph / 2, pw * 2);
          gl.addColorStop(0, css(P.win, 0.22 * a));
          gl.addColorStop(1, css(P.win, 0));
          g.fillStyle = gl;
          g.fillRect(wx - pw * 1.5, wy - pw * 1.5, pw * 4, pw * 4);
        }
        g.fillStyle = css(hash(n + 2) < 0.15 ? [255, 228, 190] : P.win, a);
      } else if (hash(n + 3) < 0.7) g.fillStyle = css(mix(c, L.night > 0.5 ? [0, 0, 0] : P.sky, 0.14));
      else continue;
      rrect(g, wx, wy, pw, ph, pw * 0.3);
      g.fill();
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

function paintMountain(g: CanvasRenderingContext2D, lay: MtnLayout, w: number, h: number, L: Light, season: Season) {
  const P = palette(L);
  const s = Math.max(0.8, Math.min(1.6, w / 390));
  const snowC = mix(mix(P.sky, [255, 255, 255], 0.55), P.sunTint, 0.25 * P.sunK + 0.3 * L.alpen);
  // each layer its own colour: blue-violet peaks, then the hills by season
  const hillsBy: Record<Season, C[]> = {
    spring: [[96, 184, 150], [82, 162, 112], [60, 132, 92]],
    summer: [[86, 176, 140], [70, 152, 100], [48, 122, 82]],
    autumn: [[224, 150, 92], [206, 112, 78], [150, 84, 70]],
    winter: [[120, 150, 150], [96, 128, 120], [72, 104, 96]],
  };
  const snowHills: C[] = [[214, 226, 242], [226, 234, 246], [238, 242, 250]];
  const cols: C[] = [[150, 156, 222], [118, 132, 206], ...(L.snow >= 0.5 ? snowHills : hillsBy[season])];
  for (const r of lay.ridges) {
    const c = paint(P, cols[r.k], r.depth, L);
    g.fillStyle = css(c);
    g.beginPath();
    g.moveTo(-10, h);
    for (const [x, y] of r.pts) g.lineTo(x, y);
    g.lineTo(w + 10, h);
    g.fill();
    if (r.depth >= 0.7) {
      // the sunny face of each peak: from the summit straight down
      if (P.sunK > 0.05) {
        g.save();
        g.clip();
        g.fillStyle = css(sunny(P, c, 1.5));
        const right = L.sun[0] > 0;
        for (let i = 1; i < r.pts.length - 1; i++) {
          const [x, y] = r.pts[i];
          if (y <= r.pts[i - 1][1] && y <= r.pts[i + 1][1] && y < h * 0.62) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + (right ? 1 : -1) * w * 0.5, h * 0.85);
            g.lineTo(x + (right ? 1 : -1) * w * 0.12, h * 0.85);
            g.closePath();
            g.fill();
          }
        }
        g.restore();
      }
      // snowcaps: a flat cap with a scalloped lower edge
      const capH = h * (0.06 + 0.1 * L.snowline) * r.snow;
      if (capH > 2) {
        g.save();
        g.beginPath();
        g.moveTo(-10, h);
        for (const [x, y] of r.pts) g.lineTo(x, y);
        g.lineTo(w + 10, h);
        g.clip();
        const top = Math.min(...r.pts.map((p) => p[1]));
        g.fillStyle = css(snowC);
        g.beginPath();
        g.moveTo(-10, top - 5);
        for (let x = -10; x <= w + 10; x += 6 * s) {
          const peakY = Math.min(...r.pts.filter((p) => Math.abs(p[0] - x) < w * 0.6).map((p) => p[1] + Math.abs(p[0] - x) * 0));
          void peakY;
          g.lineTo(x, top + capH * (r.depth === 1 ? 1.6 : 1) + Math.sin(x / (5 * s)) * 3 * s + fbm(x / 30, 77) * 10 * s);
        }
        g.lineTo(w + 10, top - 5);
        g.fill();
        g.restore();
      }
    }
    // trees stand on the hill's edge, the same colour as it
    if (r.trees.length) {
      g.fillStyle = css(c);
      for (const [x, y, ts] of r.trees) fir(g, x, y, ts);
      if (L.snow > 0.3) {
        g.fillStyle = css(snowC, Math.min(1, L.snow));
        for (const [x, y, ts] of r.trees) {
          g.beginPath();
          g.moveTo(x, y - ts * 2.4);
          g.lineTo(x + ts * 0.2, y - ts * 1.9);
          g.lineTo(x - ts * 0.2, y - ts * 1.9);
          g.fill();
        }
      }
    }
    // the gondola's cable runs between the last two hills
    if (r === lay.ridges[3]) {
      const [[ax, ay], [bx, by]] = lay.cable;
      g.strokeStyle = css(tone(P, 0.1, L), 0.7);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 16 * s, bx, by);
      g.stroke();
    }
  }
  // cabins on the nearest hill
  const near = tone(P, 0.05, L);
  for (const c of lay.cabins) {
    const { x, y, w: cw } = c;
    const wall = paint(P, BRIGHT[Math.floor(hash(c.seed + 1) * BRIGHT.length)], 0.05, L);
    g.fillStyle = css(wall);
    g.fillRect(x - cw / 2, y - cw * 0.55, cw, cw * 0.55);
    // roof
    g.fillStyle = css(L.snow > 0.3 ? snowC : paint(P, hash(c.seed + 2) < 0.5 ? [196, 72, 62] : [92, 70, 110], 0.05, L));
    g.beginPath();
    g.moveTo(x - cw * 0.68, y - cw * 0.5);
    g.lineTo(x, y - cw * 1.0);
    g.lineTo(x + cw * 0.68, y - cw * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = css(wall);
    g.fillRect(c.chimney[0] - 2 * s, c.chimney[1], 4 * s, cw * 0.3);
    // windows
    const lit = hash(c.seed) < 0.3 + 0.7 * L.lights && L.night > 0.15;
    g.fillStyle = lit ? css(P.win, Math.min(1, L.night * 1.3)) : css(mix(wall, P.sky, 0.25));
    const ws = cw * 0.2;
    rrect(g, x - cw * 0.32, y - cw * 0.38, ws, ws * 1.1, 1);
    g.fill();
    rrect(g, x + cw * 0.12, y - cw * 0.38, ws, ws * 1.1, 1);
    g.fill();
    if (lit) {
      const gl = g.createRadialGradient(x, y - cw * 0.3, 0, x, y - cw * 0.3, cw * 1.2);
      gl.addColorStop(0, css(P.win, 0.25 * L.night));
      gl.addColorStop(1, css(P.win, 0));
      g.fillStyle = gl;
      g.fillRect(x - cw * 1.2, y - cw * 1.5, cw * 2.4, cw * 2.4);
    }
  }
  g.fillStyle = css(paint(P, L.snow >= 0.5 ? [60, 100, 96] : [36, 96, 74], 0, L));
  for (const [x, y, fs] of lay.firs) fir(g, x, y, fs);
  grain(g, w, h, 0.05);
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
      this.L = lightFor(f, wx);
      this.P = palette(this.L);
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
    const L = this.L!,
      P = this.P!;
    const t = this.t;
    const { w, h } = f;
    const s = Math.max(0.8, Math.min(1.6, w / 390));
    // a little train crossing the viaduct now and then
    const cyc = 26;
    const q = (t % cyc) / cyc;
    if (q < 0.6) {
      const p = q / 0.6;
      const carW = 34 * s,
        n = 4,
        len = n * (carW + 3 * s);
      const x0 = -len + p * (w + len * 2) - len * 0.5;
      const y = lay.rail - 13 * s;
      const body = mix(tone(P, 0.02, L), [210, 120, 100], 0.35 * (1 - L.night * 0.6));
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * (carW + 3 * s);
        if (cx > w || cx + carW < 0) continue;
        g.fillStyle = css(body);
        rrect(g, cx, y, carW, 12 * s, 3 * s);
        g.fill();
        g.fillStyle = css(sunny(P, mix(body, P.sky, 0.25)));
        g.fillRect(cx + 2 * s, y + 8 * s, carW - 4 * s, 1.5 * s);
        for (let k = 0; k < 4; k++) {
          g.fillStyle = L.night > 0.2 ? css(P.win, Math.min(1, L.night * 1.4)) : css(mix(body, P.sky, 0.45));
          rrect(g, cx + 3 * s + k * 8 * s, y + 2.5 * s, 5.5 * s, 4 * s, 1.2 * s);
          g.fill();
        }
      }
    }
    // red lights blinking on the tall ones
    const blink = 0.5 + 0.5 * Math.sin(t * 2.2);
    for (const [bx, by] of lay.beacons) {
      const a = blink * (0.4 + 0.6 * L.night);
      const gl = g.createRadialGradient(bx, by, 0, bx, by, 6 * s);
      gl.addColorStop(0, `rgba(255,90,80,${0.6 * a})`);
      gl.addColorStop(1, "rgba(255,90,80,0)");
      g.fillStyle = gl;
      g.fillRect(bx - 6 * s, by - 6 * s, 12 * s, 12 * s);
      g.fillStyle = `rgba(255,120,110,${a})`;
      g.beginPath();
      g.arc(bx, by, 1.3 * s, 0, TAU);
      g.fill();
    }
    // neon on the rooftop signs after dusk, with the odd flicker
    if (L.night > 0.2)
      for (const b of lay.b) {
        if (b.prop !== "sign") continue;
        const fl = hash(Math.floor(t * 6) + b.seed) < 0.04 ? 0.3 : 1;
        const col: C = b.signHue < 0.5 ? [255, 110, 170] : [110, 230, 220];
        const x = b.x + b.w * 0.12,
          y = b.top - 15 * s,
          ww = b.w * 0.76,
          hh = 11 * s;
        g.save();
        g.shadowColor = css(col, 0.9);
        g.shadowBlur = 8 * s;
        g.strokeStyle = css(col, Math.min(1, L.night * 1.3) * fl);
        g.lineWidth = 1.4 * s;
        rrect(g, x + 2 * s, y + 2 * s, ww - 4 * s, hh - 4 * s, 2 * s);
        g.stroke();
        // a squiggle of "lettering"
        g.beginPath();
        for (let k = 0; k <= 10; k++) {
          const xx = x + 5 * s + ((ww - 10 * s) * k) / 10;
          const yy = y + hh / 2 + Math.sin(k * 1.7 + b.seed) * 1.6 * s;
          if (k === 0) g.moveTo(xx, yy);
          else g.lineTo(xx, yy);
        }
        g.stroke();
        g.restore();
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
