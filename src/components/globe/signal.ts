// The core: Signal. A sphere of stacked waveforms in the globe's middle,
// turning with it, and a stream to the playing song that's a twisted cable
// of waves in real 3D, with bursts of signal travelling out from the core.
// While the site can hear the song (its 30s preview; see beat.ts) each hit
// sends a bigger burst and makes the core's waves jump; a whole song on
// Spotify can't be heard, so it just flows.
//
// Its light falls on the globe: a glow through the glass, the inside of the
// rim, the tiles and the song it's playing. Strong at night and faint by
// day, warmed by a low sun, cooled by rain (with light running down the wet
// glass), spread wide by fog, whitened by snow, flickering in a storm.

import type { Weather } from "@/lib/weather";
import { pulseAt } from "./beat";
import { halloween } from "./halloween";
import { CHALK, CORAL, GREEN, INK, inkMode, inkRing, boil, css as inkCss, wobbly } from "./ink";
import type { Live, Motion } from "./GlobeApp";
import { PERSPECTIVE, TILT, camV, latLon, type Camera, type TileSim, type V3 } from "./math";

const NEON_HEX = ["#5ef2ff", "#9b8cff", "#ff5fd2", "#b4ff5e"];
// on Halloween the core takes that look's colours (halloween.ts)
let neon: V3[] | null = null;
const NEON = () => (neon ??= (halloween()?.core ?? NEON_HEX).map(hex));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const TAU = Math.PI * 2;

function hex(h: string): V3 {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as V3;
}
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (u: V3, v: V3): V3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const norm = (v: V3): V3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------------------
// The surroundings: how the time of day and the weather colour and spread
// the core's light.
// ---------------------------------------------------------------------------

type Env = { night: number; warm: number; warmC: V3; wet: number; fog: number; snow: number; storm: number; cloud: number };
function envOf(s: Motion, w: Weather | null): Env {
  const k = w?.kind;
  return {
    night: s.dk,
    warm: s.sky?.warm ?? 0,
    warmC: s.sky?.warmC ?? [1, 0.8, 0.6],
    wet: k === "rain" || k === "storm" ? 0.6 + 0.4 * (w?.intensity ?? 0.5) : k === "drizzle" ? 0.45 : 0,
    fog: k === "fog" ? 1 : k === "cloudy" ? 0.25 : 0,
    snow: k === "snow" ? 1 : 0,
    storm: k === "storm" ? 1 : 0,
    cloud: w?.cloud ?? 0,
  };
}

// one colour of the core's light, warmed by a low sun, cooled by rain,
// whitened by snow and fog
function tone(i: number, e: Env): V3 {
  const NE = NEON();
  const n = NE.length,
    x = ((i % n) + n) % n,
    j = Math.floor(x);
  let c = mix3(NE[j], NE[(j + 1) % n], x - j);
  c = mix3(c, e.warmC.map((v) => v * 255) as V3, 0.35 * e.warm);
  c = mix3(c, [150, 190, 255], 0.18 * e.wet);
  c = mix3(c, [245, 250, 255], 0.3 * e.snow + 0.15 * e.fog);
  return c;
}
const css = (c: V3, white: number, a: number) =>
  `rgba(${c.map((v) => Math.round(v + (255 - v) * white)).join(",")},${clamp01(a).toFixed(3)})`;

// what the tiles read to take on the core's light
export const coreLight = { rgb: [255, 255, 255] as V3, a: 0, play: 0, wave: 0 };

// ---------------------------------------------------------------------------
// A song landing: the core kicks and one wave of signal rings out of it to
// just inside the globe's glass.
// ---------------------------------------------------------------------------

const WAVE_TIME = 1.1, // seconds the wave takes to reach the glass
  KICK_LIFE = 1.2; // seconds a landing's effects last
type Kick = { t: number };
let kicks: Kick[] = [];
const seen = new WeakSet<object>();
let flareNow = 0; // how hard the core is kicking right now
let kickAges: number[] = [];

function trackKicks(sim: TileSim) {
  for (const r of sim.ripples)
    if (!seen.has(r)) {
      seen.add(r);
      // songs landing together share one wave, so it stays a single clean ring
      if (!kicks.length || r.t - kicks[kicks.length - 1].t > 0.6) kicks.push({ t: r.t });
    }
  kicks = kicks.filter((q) => sim.t - q.t < KICK_LIFE);
  kickAges = kicks.map((q) => sim.t - q.t);
  // a sharp hit that rings down
  flareNow = kickAges.reduce((f, a) => f + Math.min(1, a / 0.05) * Math.exp(-a / 0.32), 0);
}
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

function fit(cv: HTMLCanvasElement, w: number, h: number, zoom = 1) {
  const dpr = Math.min(2, window.devicePixelRatio || 1) * zoom;
  const W = Math.round(w * dpr),
    H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  return dpr;
}

// a soft glow under a thin bright line
function glowLine(ctx: CanvasRenderingContext2D, pts: [number, number][], color: (w: number, a: number) => string, w: number, a: number, glow: number) {
  if (pts.length < 2) return;
  for (const [k, wk, ak] of [
    [0, 5, 0.12 * glow],
    [1, 2.2, 0.3 * glow],
    [2, 1, 1],
  ] as const) {
    ctx.strokeStyle = color(k === 2 ? 0.45 : 0, a * ak);
    ctx.lineWidth = w * wk;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}

// split a ring into the runs on the near or far side of the sphere
function runs(pts: [number, number, number][], front: boolean) {
  const out: [number, number][][] = [[]];
  for (const [x, y, z] of pts) {
    if (z > 0 === front) out[out.length - 1].push([x, y]);
    else if (out[out.length - 1].length) out.push([]);
  }
  return out;
}

const flicker = (e: Env, t: number) => (e.storm ? 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3) : 1);

// the core's waves: a few harmonics, each ring on its own rhythm
const wave = (th: number, i: number, t: number) =>
  0.55 * Math.sin(th * 3 + t * 1.3 + i) * Math.sin(t * 0.7 + i * 0.7) + 0.35 * Math.sin(th * 7 - t * 2.1 + i * 1.3) + 0.22 * Math.sin(th * 13 + t * 3.1 - i);

// The core's rings: slices of a sphere of radius Rc, each pushed in and out
// by its waveform, seen through the camera. x, y in pixels; z for near or far.
export function corePoints(n: number, Rc: number, cam: Camera, t: number, amp: number, steps = 140) {
  const rings: [number, number, number][][] = [];
  for (let i = 0; i < n; i++) {
    const lat = -Math.PI / 2 + (Math.PI * (i + 0.5)) / n;
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= steps; k++) {
      const th = (k / steps) * TAU;
      const r = 1 + amp * wave(th, i * (13 / n), t) * Math.cos(lat);
      const v = camV([Math.cos(lat) * Math.sin(th) * r, -Math.sin(lat), Math.cos(lat) * Math.cos(th) * r], cam);
      pts.push([v[0] * Rc, v[1] * Rc, v[2]]);
    }
    rings.push(pts);
  }
  return rings;
}
export const coreColor = (i: number, white: number, a: number) => css(tone(i, CALM), white, a);
const CALM: Env = { night: 0, warm: 0, warmC: [1, 1, 1], wet: 0, fog: 0, snow: 0, storm: 0, cloud: 0 };
export { runs as nearFar };

// The core, on its own canvas in the globe's middle so the tiles in front
// cover it and the ones behind don't.
let coreRes = 1; // the core canvas's sharpness, as a multiple of the screen's
export function drawSignalCore(s: Motion, cv: HTMLCanvasElement | null, { L }: Live, weather: Weather | null) {
  if (!cv) return;
  const e = envOf(s, weather);
  const Rc = 50 * L.s,
    size = Rc * 3.2;
  // flying into it, the inside view takes over (CoreInside.tsx) before this
  // canvas is blown up past its sharpness
  const op = s.lens === null ? Math.max(0, Math.min(1, 1 - (s.zoom - 1.35) / 0.45)) : 1;
  const opS = op.toFixed(3);
  if (cv.style.opacity !== opS) cv.style.opacity = opS;
  if (op <= 0) return; // gone: nothing to draw until you fly back out
  // the globe scales the core up as you zoom in; draw it at that size so it
  // stays sharp. Sized for where the camera is headed, once, as a move
  // starts: growing it a step at a time on the way in had the phone throw
  // away and reallocate the canvas several times mid-zoom, a hitch each time.
  // (diving into a core it's gone by 1.8x, so it never needs more than 2)
  const goal = Math.max(s.zoom, s.zoomTarget ?? 0);
  const want = Math.min(s.lens === null ? 2 : 4, Math.max(1, Math.ceil(goal * 2) / 2));
  coreRes = s.zoomTarget !== null ? Math.max(coreRes, want) : want;
  const dpr = fit(cv, size, size, coreRes);
  const px = `${size}px`,
    at = `${-size / 2}px`;
  if (cv.style.width !== px) cv.style.width = cv.style.height = px;
  if (cv.style.left !== at) cv.style.left = cv.style.top = at;
  // undo the globe's turn so the canvas always faces you; the rings turn instead
  cv.style.transform = `rotateY(${(-s.yaw).toFixed(4)}rad) rotateZ(${(-TILT).toFixed(4)}rad) rotateX(${(-s.pitch).toFixed(4)}rad) rotateZ(${(-s.cam.roll).toFixed(4)}rad)`;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);
  // the drawn look: the same rings, as plain ink lines that boil a little
  if (inkMode()) {
    const nightI = e.night > 0.6;
    const t = s.mt,
      lvl = s.beamLvl * s.beamA,
      fl = Math.min(1.5, flareNow);
    const rings = corePoints(13, Rc, s.cam, Math.floor(t * 4) / 4, 0.13 * (1 + 0.8 * lvl + 1.6 * fl));
    const b = boil(t);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const front of [false, true])
      rings.forEach((pts, i) => {
        const c = inkRing(i, nightI);
        for (const run of runs(pts, front)) {
          ctx.beginPath();
          run.forEach(([x, y], j) => {
            const o = (hash(j * 3.1 + i * 17 + b * 101) - 0.5) * 0.5;
            if (j) ctx.lineTo(x + o, y - o);
            else ctx.moveTo(x + o, y - o);
          });
          ctx.strokeStyle = `rgba(${c.join(",")},${front ? 0.95 : 0.28})`;
          ctx.lineWidth = front ? 1.3 * (1 + 0.5 * fl) : 0.9;
          ctx.stroke();
        }
      });
    return;
  }
  // glowing light against the dark; crisp coloured lines against a bright sky
  const night = e.night > 0.5;
  ctx.globalCompositeOperation = night ? "lighter" : "source-over";
  ctx.lineJoin = "round";
  const t = s.mt,
    lvl = s.beamLvl * s.beamA,
    flick = flicker(e, t),
    fl = Math.min(1.5, flareNow);
  // the inner body of light, blooming in fog
  const bodyR = Rc * (1.15 + 0.35 * e.fog);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, bodyR);
  g.addColorStop(0, css(tone(t * 0.1, e), 0.5, (night ? 0.22 : 0.14) * (1 + 0.6 * lvl + 2.5 * fl) * flick));
  g.addColorStop(1, css(tone(t * 0.1, e), 0, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, bodyR, 0, TAU);
  ctx.fill();
  // rings are slices of a sphere in the globe's own frame, so they tumble
  // with it, each pushed in and out by its waveform; a hit makes them jump
  const rings = corePoints(13, Rc, s.cam, t, 0.13 * (1 + 0.8 * lvl + 1.6 * fl));
  const glow = (night ? 1 : 0.55) * (1 + 0.8 * e.fog + 0.4 * e.wet);
  for (const front of [false, true])
    rings.forEach((pts, i) => {
      const c = tone(i * 0.28 + t * 0.08, e);
      for (const run of runs(pts, front))
        glowLine(ctx, run, (w, a) => css(c, Math.min(1, w + 0.25 * fl), a), (front ? 1.1 : 0.7) * (1 + 0.7 * fl), (front ? 0.9 : 0.3) * flick * (1 - 0.25 * e.fog) * (1 + 0.5 * fl), glow);
    });
  ctx.globalCompositeOperation = "source-over";
}

// The core's light on the globe, then the stream, on the canvas just behind
// the tiles, so the song covers the stream's end.
export function drawSignalStream(s: Motion, cv: HTMLCanvasElement | null, sim: TileSim, { half, Rb, L, beam }: Live, weather: Weather | null, dt: number) {
  if (!cv) return;
  trackKicks(sim);
  // fades in when a song starts, out when it's paused or stopped
  const on = beam !== null && !beam.paused && s.lens === null && !s.coreOn;
  if (beam) s.beamK = beam.k;
  s.beamA += ((on ? 1 : 0) - s.beamA) * Math.min(1, dt * (on ? 2.5 : 4));
  // the song's hits while the site can hear it; each new one sends a burst
  // out along the stream
  const ct = beam?.beat ? beam.clipTime() : null;
  const hit = beam?.beat && ct !== null ? pulseAt(beam.beat, ct) : 0;
  const swell = hit > s.beamLvl + 0.25 && hit > 0.45;
  if (swell) s.beamSwells.push({ u: 0, a: hit });
  s.beamLvl += (hit - s.beamLvl) * Math.min(1, dt * (hit > s.beamLvl ? 40 : 9));
  for (const w of s.beamSwells) w.u += dt * 1.2;
  // the drawn look: while it plays the core sends out rings of signal, one on
  // each hit it can hear, or in time with the stream's own pulses when it
  // can't hear the song
  if (s.beamA > 0.5 && on) {
    const beat = !!beam?.beat;
    const n = Math.floor(s.mt * 0.55 - 0.05);
    if ((beat ? swell : n !== lastBeatN) && (!pulses.length || s.mt - pulses[pulses.length - 1].t > 0.28))
      pulses.push({ t: s.mt, a: beat ? Math.max(0.6, hit) : 0.8, n: pulseN++ });
    lastBeatN = n;
  }
  pulses = pulses.filter((q) => s.mt - q.t < PULSE_TIME);
  s.beamSwells = s.beamSwells.filter((w) => w.u < 1.1).slice(-4);

  const dpr = fit(cv, L.w, L.h);
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  coreLight.a = 0;
  coreLight.play = 0;
  coreLight.wave = 0;
  if (!s.cam || s.coreOn) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const e = envOf(s, weather);
  const t = s.mt;
  const night = e.night > 0.5;
  const flick = flicker(e, t);
  const project = (p: V3): [number, number, number] => {
    const z = p[2] * s.zoom,
      kz = (s.zoom * PERSPECTIVE) / Math.max(1, PERSPECTIVE - z);
    return [L.cx + p[0] * kz, L.cy + p[1] * kz, p[2]];
  };
  const quiet = s.lens !== null ? 0.35 : 1;
  const R0 = Rb * s.zoom;
  if (inkMode()) {
    drawInkStream(ctx, s, sim, { half, Rb, L }, project, R0, quiet, night);
    return;
  }
  const lightC = tone(t * 0.1 + 0.5, e);
  // how far the light carries: strong at night, faint in daylight (a bit more
  // under cloud), wide and soft in fog, a little brighter off wet glass
  const strength = (0.05 + 0.24 * e.night + 0.05 * e.cloud) * (1 + 0.6 * e.fog + 0.3 * e.wet) * flick * quiet;

  // a pool of the core's light filling the glass
  {
    const r = R0 * (0.62 + 0.45 * e.fog);
    const g = ctx.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, r);
    g.addColorStop(0, css(lightC, 0.3, strength * 0.9));
    g.addColorStop(0.45, css(lightC, 0.1, strength * 0.35));
    g.addColorStop(1, css(lightC, 0, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(L.cx, L.cy, Math.min(r, R0), 0, TAU);
    ctx.fill();
  }
  // the inside of the glass catches it at the rim; a low sun warms the side it's on
  {
    const ga = strength * 1.1;
    ctx.lineWidth = 6 * L.s;
    ctx.strokeStyle = css(lightC, 0.2, ga * 0.35);
    ctx.beginPath();
    ctx.arc(L.cx, L.cy, R0 - 3 * L.s, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.2 * L.s;
    ctx.strokeStyle = css(lightC, 0.5, ga);
    ctx.stroke();
    if (e.warm > 0.05 && s.sun) {
      const side = Math.sin(s.sun.az) > 0 ? 1 : -1; // you face north: east is right
      const warm = e.warmC.map((v) => v * 255) as V3;
      const gg = ctx.createLinearGradient(L.cx - side * R0, L.cy, L.cx + side * R0, L.cy);
      gg.addColorStop(0, css(warm, 0.2, 0));
      gg.addColorStop(1, css(warm, 0.2, 0.45 * e.warm));
      ctx.strokeStyle = gg;
      ctx.lineWidth = 2.2 * L.s;
      ctx.beginPath();
      ctx.arc(L.cx, L.cy, R0 - 1.5 * L.s, 0, TAU);
      ctx.stroke();
    }
  }
  // wet glass: the core's light runs down the inside of the lower globe in streaks
  if (e.wet > 0.01) {
    for (let i = 0; i < 9; i++) {
      const x = L.cx + (i - 4) * R0 * 0.11 + Math.sin(i * 3.7) * 4 * L.s;
      const top = L.cy + R0 * 0.25,
        len = R0 * (0.35 + 0.25 * hash(i)) * Math.sqrt(1 - ((x - L.cx) / R0) ** 2);
      const run = (t * (0.15 + 0.1 * hash(i + 4)) + hash(i + 2)) % 1;
      const g = ctx.createLinearGradient(x, top, x, top + len);
      g.addColorStop(0, css(lightC, 0.3, 0));
      g.addColorStop(clamp01(run), css(lightC, 0.4, e.wet * (0.1 + 0.3 * e.night) * quiet));
      g.addColorStop(1, css(lightC, 0.3, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = (1 + hash(i + 1)) * L.s;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + Math.sin(i) * 3 * L.s, top + len);
      ctx.stroke();
    }
  }
  coreLight.rgb = lightC;
  coreLight.a = strength * 0.55 * (1 + 1.2 * Math.min(1.5, flareNow));

  // each landing: one clean wave of signal rings out of the core, all the
  // way round, and spreads to just inside the glass, lighting the songs as
  // it passes under them
  let wash = 0;
  if (kickAges.length) {
    const r0 = 50 * L.s * s.zoom,
      r1 = R0 * 0.94;
    ctx.globalCompositeOperation = night ? "lighter" : "source-over";
    for (const age of kickAges) {
      const u = age / WAVE_TIME;
      if (u >= 1) continue;
      const rf = r0 + (r1 - r0) * easeOut(u);
      const fade = Math.min(1, u / 0.06) * Math.pow(1 - u, 1.3) * quiet * flick;
      wash = Math.max(wash, fade * Math.exp(-(((rf / r1 - 0.9) / 0.18) ** 2)));
      // a soft band of light just behind the front
      const band = Math.max(4 * L.s, rf * 0.22);
      const g = ctx.createRadialGradient(L.cx, L.cy, Math.max(0, rf - band), L.cx, L.cy, rf);
      g.addColorStop(0, css(lightC, 0.3, 0));
      g.addColorStop(1, css(lightC, 0.3, (night ? 0.16 : 0.1) * fade));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(L.cx, L.cy, rf, 0, TAU);
      ctx.fill();
      // the front itself: a ring of waveform with two fainter echoes behind it
      let grad: CanvasGradient | string = css(lightC, 0.4, 1);
      if (typeof ctx.createConicGradient === "function") {
        grad = ctx.createConicGradient(t * 0.4, L.cx, L.cy);
        for (let i = 0; i <= 4; i++) grad.addColorStop(i / 4, css(tone(i + t * 0.1, e), 0.35, 1));
      }
      ctx.strokeStyle = grad;
      for (let echo = 0; echo < 3; echo++) {
        const r = rf - echo * (7 + 10 * u) * L.s;
        if (r <= r0 * 0.8) break;
        const amp = (2.5 + 5 * (1 - u)) * L.s * (1 - echo * 0.3);
        const ph = age * 9 + echo * 0.9;
        ctx.beginPath();
        for (let i = 0; i <= 240; i++) {
          const th = (i / 240) * TAU;
          const rr = r + amp * Math.sin(th * 36 + ph) * (0.6 + 0.4 * Math.sin(th * 4 - ph * 0.5));
          const x = L.cx + Math.cos(th) * rr,
            y = L.cy + Math.sin(th) * rr;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        const al = fade * (echo ? 0.45 / echo : 1);
        ctx.globalAlpha = clamp01(al * 0.3);
        ctx.lineWidth = (6 - 2 * echo) * L.s;
        ctx.stroke();
        ctx.globalAlpha = clamp01(al * (night ? 0.95 : 0.8));
        ctx.lineWidth = (echo ? 1 : 1.8) * L.s;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
  }
  coreLight.wave = 0.4 * wash;

  if (s.beamA < 0.01 || s.beamK < 0) return;
  const A = s.beamA * quiet,
    lvl = s.beamLvl;
  const { lat, lon } = latLon(sim.pos(s.beamK));
  const v = camV([Math.cos(lat) * Math.sin(lon), -Math.sin(lat), Math.cos(lat) * Math.cos(lon)], s.cam);
  // two directions across the stream, so its waves twist round it in depth
  const a = norm(Math.abs(v[2]) < 0.95 ? cross(v, [0, 0, 1]) : cross(v, [0, 1, 0]));
  const b = cross(v, a);
  // u runs from the song (0) to the core (1); it sways a little as it flows
  const bow = Rb * 0.07 * Math.sin(t * 0.5);
  const axis = (u: number): V3 => {
    const r = Rb * (1 - u) + half * 0.1,
      k = Math.sin(Math.PI * u) * bow;
    return [v[0] * r + a[0] * k, v[1] * r + a[1] * k, v[2] * r + a[2] * k];
  };
  // the song lights up where the stream reaches it
  const [tx, ty] = project(axis(0));
  const hr = half * 1.6;
  const hg = ctx.createRadialGradient(tx, ty, 0, tx, ty, hr);
  hg.addColorStop(0, css(lightC, 0.4, (0.1 + 0.3 * e.night) * (1 + 0.6 * lvl) * A * flick));
  hg.addColorStop(1, css(lightC, 0, 0));
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(tx, ty, hr, 0, TAU);
  ctx.fill();
  coreLight.play = (0.08 + 0.22 * e.night) * (1 + 0.5 * lvl) * A;

  ctx.globalCompositeOperation = night ? "lighter" : "source-over";
  ctx.lineJoin = "round";
  const M = 220;
  // three strands of one wave, a third of a turn apart, wound into a cable;
  // bursts of signal travel out from the core to the song
  for (let j = 0; j < 3; j++) {
    const seg: { x: number; y: number; d: number; e: number }[] = [];
    for (let i = 0; i <= M; i++) {
      const u = i / M;
      let env = Math.pow(0.5 + 0.5 * Math.sin(TAU * (u * 2.2 + t * 0.55)), 3);
      for (const w of s.beamSwells) env += 1.2 * w.a * Math.exp(-(((u - (1 - w.u)) / 0.08) ** 2));
      const amp = (2.2 + 12 * env) * L.s * Math.sqrt(Math.sin(Math.PI * u)) * (0.75 + 0.25 * Math.sin(Math.PI * u));
      const ph = TAU * u * 9 + t * 5.5 + (j * TAU) / 3;
      const c = Math.cos(ph),
        sn = Math.sin(ph);
      const p = axis(u);
      const [x, y] = project([p[0] + (a[0] * c + b[0] * sn) * amp, p[1] + (a[1] * c + b[1] * sn) * amp, p[2] + (a[2] * c + b[2] * sn) * amp]);
      // which side of the cable this point is on, toward you or away
      seg.push({ x, y, d: a[2] * c + b[2] * sn, e: Math.min(1.6, env) });
    }
    for (const front of [false, true])
      for (let i = 1; i <= M; i++) {
        const p0 = seg[i - 1],
          p1 = seg[i];
        if (p1.d > 0 !== front) continue;
        const depth = 0.5 + 0.5 * p1.d;
        const al = A * flick * (0.18 + 0.82 * depth) * (0.45 + 0.55 * p1.e) * (1 - 0.2 * e.fog);
        const w = (0.8 + 1.6 * depth) * L.s;
        const c = tone(j * 0.9 + i / M + t * 0.06, e);
        ctx.strokeStyle = css(c, 0, al * 0.22 * (night ? 1 : 0.6) * (1 + e.fog));
        ctx.lineWidth = w * 4;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.strokeStyle = css(c, 0.35 * depth, al);
        ctx.lineWidth = w;
        ctx.stroke();
      }
  }
  // a fine carrier line down the middle
  const mid: [number, number][] = [];
  for (let i = 0; i <= 80; i++) {
    const [x, y] = project(axis(i / 80));
    mid.push([x, y]);
  }
  glowLine(ctx, mid, (w, al) => css(tone(2.5 + t * 0.05, e), 0.6, al), 0.5 * L.s, A * 0.35, night ? 1 : 0.6);
  ctx.globalCompositeOperation = "source-over";
}

// ---------------------------------------------------------------------------
// The drawn look (ink.ts): no glow, just boiling ink lines. The stream is a
// cable of three twisted strands (ink, coral, green) with beads of signal
// running out along it to the song, and the core sends rings of drawn
// waveform out to the glass while a song plays, and a bold one when a song
// lands.
// ---------------------------------------------------------------------------

const PULSE_TIME = 1.5;
let pulses: { t: number; a: number; n: number }[] = [];
let pulseN = 0;
let lastBeatN = 0;

// a ring of drawn waveform round the core, broken in a couple of places the
// way a quick pen line skips
function inkWaveRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, amp: number, ph: number, seed: number, width: number, color: string) {
  const gaps = [hash(seed) * TAU, hash(seed + 1) * TAU];
  const gapW = 0.18 + 0.2 * hash(seed + 2);
  const inGap = (th: number) => gaps.some((g) => Math.abs(((th - g + 3 * Math.PI) % TAU) - Math.PI) < gapW / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  let run: [number, number][] = [];
  const flush = () => {
    if (run.length > 1) wobbly(ctx, run, seed, 0.9);
    run = [];
  };
  const n = Math.max(90, Math.min(260, Math.round(r * 1.2)));
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * TAU;
    if (inGap(th)) {
      flush();
      continue;
    }
    const rr = r + amp * Math.sin(th * 18 + ph) * (0.6 + 0.4 * Math.sin(th * 3 - ph * 0.4));
    run.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
  }
  flush();
}

function drawInkStream(
  ctx: CanvasRenderingContext2D,
  s: Motion,
  sim: TileSim,
  { half, Rb, L }: Pick<Live, "half" | "Rb" | "L">,
  project: (p: V3) => [number, number, number],
  R0: number,
  quiet: number,
  night: boolean,
) {
  const t = s.mt;
  const b = boil(t);
  const ink = night ? CHALK : INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const r0 = 50 * L.s * s.zoom * 1.05,
    r1 = R0 * 0.93;

  // rings of signal while it plays: each one leaves the core and spreads to
  // just inside the glass, thinning as it goes
  for (const q of pulses) {
    const u = (t - q.t) / PULSE_TIME;
    if (u < 0 || u >= 1) continue;
    const r = r0 + (r1 - r0) * easeOut(u);
    const fade = Math.min(1, u / 0.05) * Math.pow(1 - u, 1.4) * quiet * s.beamA;
    const c = q.n % 3 === 1 ? CORAL : q.n % 3 === 2 ? GREEN : ink;
    inkWaveRing(ctx, L.cx, L.cy, r, (1.5 + 4 * (1 - u)) * L.s * q.a, (t - q.t) * 7, q.n * 7 + b, (0.8 + 1.6 * (1 - u)) * L.s, inkCss(c, fade * 0.9));
  }

  // a song landing: one bold ring with a coral echo behind it
  for (const age of kickAges) {
    const u = age / WAVE_TIME;
    if (u >= 1) continue;
    const rf = r0 + (r1 - r0) * easeOut(u);
    const fade = Math.min(1, u / 0.06) * Math.pow(1 - u, 1.3) * quiet;
    inkWaveRing(ctx, L.cx, L.cy, rf, (2.5 + 5 * (1 - u)) * L.s, age * 9, 40 + b, 2.2 * L.s, inkCss(ink, fade));
    const re = rf - (8 + 10 * u) * L.s;
    if (re > r0) inkWaveRing(ctx, L.cx, L.cy, re, (2 + 3 * (1 - u)) * L.s, age * 9 + 0.9, 43 + b, 1.4 * L.s, inkCss(CORAL, fade * 0.8));
  }
  // the songs don't take on a glow in the drawn look
  coreLight.a = 0;
  coreLight.play = 0;
  coreLight.wave = 0;

  if (s.beamA < 0.01 || s.beamK < 0) return;
  const A = s.beamA * quiet;
  const { lat, lon } = latLon(sim.pos(s.beamK));
  const v = camV([Math.cos(lat) * Math.sin(lon), -Math.sin(lat), Math.cos(lat) * Math.cos(lon)], s.cam!);
  const a = norm(Math.abs(v[2]) < 0.95 ? cross(v, [0, 0, 1]) : cross(v, [0, 1, 0]));
  const bb = cross(v, a);
  const bow = Rb * 0.07 * Math.sin(t * 0.5);
  const axis = (u: number): V3 => {
    const r = Rb * (1 - u) + half * 0.1,
      k = Math.sin(Math.PI * u) * bow;
    return [v[0] * r + a[0] * k, v[1] * r + a[1] * k, v[2] * r + a[2] * k];
  };
  // where the pulses are along the stream (u: song 0, core 1); they leave
  // the core and run out to the song
  const env = (u: number) => {
    let e = Math.pow(0.5 + 0.5 * Math.sin(TAU * (u * 2.2 + t * 0.55)), 3);
    for (const w of s.beamSwells) e += 1.2 * w.a * Math.exp(-(((u - (1 - w.u)) / 0.08) ** 2));
    return e;
  };

  // three strands, a third of a turn apart, wound into one cable; each split
  // where it turns toward you or away, the far side thin and faint
  const M = 160;
  const strandC = [ink, CORAL, GREEN];
  for (const front of [false, true])
    for (let j = 0; j < 3; j++) {
      let run: [number, number][] = [];
      const flush = () => {
        if (run.length > 1) {
          ctx.strokeStyle = inkCss(strandC[j], A * (front ? 0.95 : 0.35));
          ctx.lineWidth = (front ? (j ? 1.6 : 2) : 1) * L.s;
          wobbly(ctx, run, j * 11 + b + (front ? 0 : 5), 0.8 * L.s);
        }
        run = [];
      };
      for (let i = 0; i <= M; i++) {
        const u = i / M;
        const e = env(u);
        const amp = (2 + 10 * Math.min(1.6, e)) * L.s * Math.sqrt(Math.sin(Math.PI * u)) * (0.75 + 0.25 * Math.sin(Math.PI * u));
        // the twist moves on twos, like a drawn cycle
        const ph = TAU * u * 7 + (Math.floor(t * 12) / 12) * 5.5 + (j * TAU) / 3;
        const c = Math.cos(ph),
          sn = Math.sin(ph);
        const d = a[2] * c + bb[2] * sn;
        const p = axis(u);
        const [x, y] = project([p[0] + (a[0] * c + bb[0] * sn) * amp, p[1] + (a[1] * c + bb[1] * sn) * amp, p[2] + (a[2] * c + bb[2] * sn) * amp]);
        if (d > 0 === front) run.push([x, y]);
        else {
          if (run.length) run.push([x, y]);
          flush();
        }
      }
      flush();
    }

  // a bead of signal round the cable at each pulse, running out to the song
  const beads: { u: number; k: number }[] = [];
  for (let k = -3; k <= 3; k++) {
    const u = (k + 0.25 - ((t * 0.55) % 1)) / 2.2;
    if (u > 0.06 && u < 0.97) beads.push({ u, k: 0.8 });
  }
  for (const w of s.beamSwells) if (1 - w.u > 0.06 && 1 - w.u < 0.97) beads.push({ u: 1 - w.u, k: 0.8 + w.a });
  beads.forEach(({ u, k }, i) => {
    const [x, y] = project(axis(u));
    const r = (5 + 6 * k) * L.s * (0.6 + 0.4 * Math.sin(Math.PI * u));
    const pts: [number, number][] = [];
    for (let q = 0; q <= 24; q++) {
      const th = (q / 24) * TAU + 0.3;
      pts.push([x + Math.cos(th) * r, y + Math.sin(th) * r * 0.8]);
    }
    ctx.strokeStyle = inkCss(i % 2 ? CORAL : ink, A * 0.9 * Math.sin(Math.PI * u) ** 0.5);
    ctx.lineWidth = 1.5 * L.s;
    wobbly(ctx, pts, i * 3 + b, 0.9 * L.s);
  });

  // little strokes round the song where the stream reaches it, jumping with
  // the music
  const [tx, ty] = project(axis(0));
  const lvl = s.beamLvl;
  const rr = half * (1.25 + 0.15 * lvl);
  ctx.strokeStyle = inkCss(ink, A * 0.8);
  ctx.lineWidth = 1.8 * L.s;
  for (let i = 0; i < 8; i++) {
    const f = (i / 8) * TAU + b * 0.4 + 0.2;
    const l = (5 + 5 * lvl + 3 * hash(i + b * 9)) * L.s;
    ctx.beginPath();
    ctx.moveTo(tx + Math.cos(f) * rr, ty + Math.sin(f) * rr);
    ctx.lineTo(tx + Math.cos(f) * (rr + l), ty + Math.sin(f) * (rr + l));
    ctx.stroke();
  }
}
