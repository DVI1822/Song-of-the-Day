"use client";

import type { Weather } from "@/lib/weather";
import type { Post } from "@/lib/types";
import { sunAt } from "./math";

// Your song as an Instagram Story, drawn on the phone: the globe of your past
// songs turning under one of four skies, your song floating in front, and the
// link to join you. Recorded as a short video where the browser can (iPhone
// Safari and recent Chrome make MP4s), otherwise kept as a picture. It's
// silent: Instagram mutes or takes down Stories with recorded music.

export const BRAND = { name: "Song of the Day", domain: "mysong.day" };

export type StorySky = "sunny" | "rain" | "golden" | "night";
export const SKIES: { k: StorySky; label: string }[] = [
  { k: "sunny", label: "Sunny" },
  { k: "golden", label: "Golden hour" },
  { k: "rain", label: "Rain" },
  { k: "night", label: "Night" },
];

// The sky that matches right now: wet weather is rain, then the sun decides.
export function skyNow(weather: Weather | null, geo: { lat: number; lon: number }, date = new Date()): StorySky {
  if (weather && ["rain", "drizzle", "storm", "snow"].includes(weather.kind)) return "rain";
  const el = (sunAt(date, geo.lat, geo.lon).el * 180) / Math.PI;
  return el < -4 ? "night" : el < 14 ? "golden" : "sunny";
}

const W = 1080,
  H = 1920;
const CX = 540,
  CY = 860,
  R = 430;
const C = 360,
  COVER_X = 520,
  COVER_Y = 1060; // your song, in front and below the core
export const SECONDS = 8;
const TURN = 45; // seconds for the globe to turn once, as in the app

type Look = {
  sky: [number, string][];
  ink: string;
  sub: string;
  light: boolean; // a bright sky: dark text, white glass
  sun?: [number, number, string];
};
const LOOKS: Record<StorySky, Look> = {
  sunny: { sky: [[0, "#2f7fd6"], [0.5, "#7db8ef"], [1, "#d4ebfb"]], ink: "#14325a", sub: "rgba(20,50,90,0.7)", light: true, sun: [900, 260, "255,250,225"] },
  golden: { sky: [[0, "#35579e"], [0.45, "#d98d72"], [0.8, "#f8b766"], [1, "#ffd889"]], ink: "#3b1f12", sub: "rgba(59,31,18,0.72)", light: true, sun: [980, 1320, "255,215,140"] },
  rain: { sky: [[0, "#3f4a59"], [0.5, "#6d7a8a"], [1, "#9aa6b3"]], ink: "#ffffff", sub: "rgba(235,242,250,0.8)", light: false },
  night: { sky: [[0, "#030714"], [0.45, "#0a1634"], [0.8, "#14305a"], [1, "#24507c"]], ink: "#ffffff", sub: "rgba(230,240,255,0.8)", light: false },
};

// the light magma, for someone whose core has no colours yet
const MAGMA = ["#7FD1B9", "#B7EBA4", "#F3F0A0", "#FFE2C4", "#FFFDF5"];

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
type Ctx = CanvasRenderingContext2D;
const linear = (x: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};
const radial = (x: Ctx, cx: number, cy: number, r: number, stops: [number, string][]) => {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
};

// A cover, straight from Spotify's image server, or through the site's own
// resizer when the browser won't let a canvas read it.
function loadImage(url: string, size: number): Promise<HTMLImageElement> {
  const load = (src: string, cors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  return load(url, true).catch(() => load(`/_next/image?url=${encodeURIComponent(url)}&w=${size}&q=85`, false));
}

// ---------------------------------------------------------------- the scene

function cloud(x: Ctx, cx: number, cy: number, s: number, col: string, blur: number) {
  x.save();
  x.filter = `blur(${blur}px)`;
  x.fillStyle = col;
  for (const [dx, dy, r] of [[0, 0, 1], [-0.9, 0.25, 0.7], [0.9, 0.25, 0.75], [-0.4, -0.35, 0.75], [0.45, -0.3, 0.65], [0, 0.35, 0.9]]) {
    x.beginPath();
    x.arc(cx + dx * s, cy + dy * s, r * s, 0, 7);
    x.fill();
  }
  x.restore();
}

function stars(x: Ctx, n: number, seed: number, h: number, a = 0.9) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const s = r() < 0.93 ? 0.6 + r() * 1.8 : 2 + r() * 2.5;
    x.fillStyle = `rgba(255,255,255,${((0.2 + r() * 0.8) * a).toFixed(2)})`;
    x.beginPath();
    x.arc(r() * W, r() * h, s, 0, 7);
    x.fill();
  }
}

// The sky, painted once.
function paintSky(sky: StorySky) {
  const c = canvas(W, H),
    x = c.getContext("2d")!,
    L = LOOKS[sky],
    r = rng(sky.length * 17);
  x.fillStyle = linear(x, 0, 0, 0, H, L.sky);
  x.fillRect(0, 0, W, H);
  if (L.sun) {
    const [sx, sy, rgb] = L.sun;
    x.fillStyle = radial(x, sx, sy, 700, [[0, `rgba(${rgb},0.9)`], [0.12, `rgba(${rgb},0.45)`], [1, "rgba(255,255,255,0)"]]);
    x.fillRect(0, 0, W, H);
  }
  if (sky === "golden") {
    x.save();
    x.filter = "blur(16px)";
    for (let i = 0; i < 10; i++) {
      x.fillStyle = `rgba(255,${(190 + r() * 40) | 0},${(170 + r() * 30) | 0},${(0.25 + r() * 0.3).toFixed(2)})`;
      x.beginPath();
      x.ellipse(r() * W, 300 + r() * 1300, 200 + r() * 260, 12 + r() * 18, -0.05, 0, 7);
      x.fill();
    }
    x.restore();
  }
  if (sky === "rain") for (let i = 0; i < 9; i++) cloud(x, r() * W, 80 + r() * 300, 120 + r() * 90, "rgba(55,64,78,0.75)", 30);
  if (sky === "night") {
    x.save();
    x.filter = "blur(70px)";
    x.globalAlpha = 0.35;
    x.fillStyle = "#5a4aa0";
    x.beginPath();
    x.ellipse(260, 300, 500, 120, -0.5, 0, 7);
    x.fill();
    x.fillStyle = "#2f6f8f";
    x.beginPath();
    x.ellipse(820, 520, 420, 90, -0.5, 0, 7);
    x.fill();
    x.restore();
    stars(x, 260, 21, H * 0.9);
  }
  // the glass sphere
  x.fillStyle = radial(x, CX, CY, R * 1.5, [[0.6, sky === "golden" ? "rgba(255,190,150,0.16)" : "rgba(150,230,220,0.18)"], [1, "rgba(150,230,220,0)"]]);
  x.fillRect(0, 0, W, H);
  x.fillStyle = radial(x, CX - R * 0.3, CY - R * 0.35, R * 1.1, [[0, "rgba(255,255,255,0.14)"], [0.6, "rgba(150,200,240,0.05)"], [1, "rgba(10,20,60,0.25)"]]);
  x.beginPath();
  x.arc(CX, CY, R, 0, 7);
  x.fill();
  return c;
}

// Puffy clouds for a sunny sky, drawn once and drifted across.
function paintClouds() {
  return [
    [180, 420, 90],
    [860, 600, 70],
    [300, 1520, 110],
    [900, 1420, 80],
  ].map(([cx, cy, s]) => {
    const c = canvas(s * 4, s * 3.4),
      x = c.getContext("2d")!;
    cloud(x, s * 2, s * 1.5, s, "rgba(255,255,255,0.9)", 14);
    cloud(x, s * 2.2, s * 1.95, s * 0.8, "rgba(180,205,235,0.5)", 20);
    return { c, x: cx - s * 2, y: cy - s * 1.5 };
  });
}

// A gooey core: blurred blobs cut sharp into molten shapes, then glossed.
function paintCore(r: number, colors: string[]) {
  const pal = [0, 1, 2, 3, 4].map((i) => colors[i % colors.length]);
  const c = canvas(r * 2 + 80, r * 2 + 80),
    x = c.getContext("2d")!,
    cx = r + 40,
    cy = r + 40,
    R = rng(3);
  const goo = (col: string, n: number, size: number) => {
    const g = canvas(c.width, c.height),
      q = g.getContext("2d", { willReadFrequently: true })!;
    q.filter = `blur(${r * 0.14}px)`;
    q.fillStyle = "#fff";
    for (let i = 0; i < n; i++) {
      const a = R() * 7,
        d = Math.sqrt(R()) * r * 0.95;
      q.beginPath();
      q.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * size * (0.5 + R()), 0, 7);
      q.fill();
    }
    const img = q.getImageData(0, 0, g.width, g.height),
      d = img.data,
      [cr, cg, cb] = [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16));
    for (let i = 0; i < d.length; i += 4) {
      const a = Math.min(1, Math.max(0, (d[i + 3] - 110) / 30));
      d[i] = cr;
      d[i + 1] = cg;
      d[i + 2] = cb;
      d[i + 3] = a * 255;
    }
    q.putImageData(img, 0, 0);
    return g;
  };
  x.save();
  x.beginPath();
  x.arc(cx, cy, r, 0, 7);
  x.clip();
  x.fillStyle = radial(x, cx - r * 0.2, cy - r * 0.3, r * 1.3, [[0, pal[3]], [0.55, pal[2]], [1, pal[1]]]);
  x.fillRect(0, 0, c.width, c.height);
  for (const [col, n, size] of [[pal[1], 9, 0.3], [pal[0], 7, 0.26], [pal[2], 8, 0.2], [pal[4], 6, 0.14]] as const) x.drawImage(goo(col, n, size), 0, 0);
  x.fillStyle = radial(x, cx, cy, r, [[0.5, "rgba(0,0,0,0)"], [1, "rgba(30,0,40,0.4)"]]);
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = radial(x, cx - r * 0.35, cy - r * 0.42, r * 0.5, [[0, "rgba(255,255,255,0.85)"], [0.35, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0)"]]);
  x.fillRect(0, 0, c.width, c.height);
  x.restore();
  return c;
}

// Spots for tiles round the sphere, seen from slightly above, on Earth's tilt.
type Tile = { corners: [number, number][]; z: number; i: number };
function tilesAt(n: number, size: number, spin: number): Tile[] {
  const t = (-23.4 * Math.PI) / 180,
    tx = 0.3;
  const P = (X: number, Y: number, Z: number): [number, number, number] => {
    const rx = X * Math.cos(t) - Y * Math.sin(t),
      ry = X * Math.sin(t) + Y * Math.cos(t);
    return [CX + rx * R, CY + (ry * Math.cos(tx) - Z * Math.sin(tx)) * R, ry * Math.sin(tx) + Z * Math.cos(tx)];
  };
  const p = (la: number, lo: number) => P(Math.cos(la) * Math.sin(lo), -Math.sin(la), Math.cos(la) * Math.cos(lo));
  const out: Tile[] = [];
  for (let i = 0; i < n; i++) {
    const lat = Math.asin(1 - ((i + 0.5) * 2) / n) * 0.92,
      lon = i * 2.39996 + spin,
      d = size / R / 2,
      e = d / Math.cos(lat);
    const a = p(lat + d, lon - e),
      b = p(lat + d, lon + e),
      c = p(lat - d, lon - e);
    out.push({ corners: [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]], z: p(lat, lon)[2], i });
  }
  return out.sort((a, b) => a.z - b.z);
}

function drawTile(x: Ctx, img: CanvasImageSource | null, [a, b, d]: [number, number][], alpha: number, back: boolean, light: boolean) {
  const s = 100;
  x.save();
  x.globalAlpha = alpha;
  x.setTransform((b[0] - a[0]) / s, (b[1] - a[1]) / s, (d[0] - a[0]) / s, (d[1] - a[1]) / s, a[0], a[1]);
  if (back) {
    x.translate(s, 0);
    x.scale(-1, 1);
  }
  x.beginPath();
  x.roundRect(0, 0, s, s, s * 0.26);
  if (img) {
    x.clip();
    x.drawImage(img, 0, 0, s, s);
  } else {
    // an empty spot: faint glass
    x.fillStyle = light ? "rgba(255,255,255,0.18)" : "rgba(217,255,248,0.06)";
    x.fill();
    x.lineWidth = 3;
    x.strokeStyle = light ? "rgba(255,255,255,0.6)" : "rgba(217,255,248,0.35)";
    x.stroke();
  }
  x.restore();
}

// Square covers at tile size, so each frame only scales them a little.
function tileImage(img: HTMLImageElement) {
  const c = canvas(200, 200);
  c.getContext("2d")!.drawImage(img, 0, 0, 200, 200);
  return c;
}

// The emblem: a speaker whose waves become a globe's lines.
const EMBLEM = [
  ["M6 41.8 H14.4 L25.4 32.5 V67.5 L14.4 58.2 H6 Z", 3, true],
  ["M38.52 40.86 A12.5 12.5 0 0 1 38.52 59.14", 4.6],
  ["M30 12 A24.32 38 0 0 1 30 88", 4.6],
  ["M54.32 50 H68", 3.22],
  ["M51.06 69 H62.91", 3.22],
  ["M51.06 31 H62.91", 3.22],
  ["M30 12 A38 38 0 0 1 30 88", 4.6],
] as const;
function emblem(x: Ctx, left: number, top: number, size: number, colors: string[]) {
  x.save();
  x.translate(left, top);
  x.scale(size / 100, size / 100);
  x.translate(12.5, 0);
  const g = linear(x, 8, 0, 68, 0, [[0, colors[0]], [0.5, colors[1]], [1, colors[2]]]);
  x.strokeStyle = x.fillStyle = g;
  x.lineCap = x.lineJoin = "round";
  for (const [d, w, fill] of EMBLEM) {
    const p = new Path2D(d);
    x.lineWidth = w;
    if (fill) x.fill(p);
    x.stroke(p);
  }
  x.restore();
}

// Text that fits: shrinks to the width, then trims.
function fitText(x: Ctx, s: string, size: number, font: (px: number) => string, max: number) {
  let px = size;
  x.font = font(px);
  while (x.measureText(s).width > max && px > size * 0.6) x.font = font((px -= 2));
  let out = s;
  while (x.measureText(out).width > max && out.length > 1) out = out.slice(0, -2) + "…";
  return out;
}

// The words, painted once on top.
function paintText(sky: StorySky, post: Post, name: string, fonts: { display: string; body: string }) {
  const c = canvas(W, H),
    x = c.getContext("2d")!,
    L = LOOKS[sky];
  const display = (px: number) => `600 ${px}px ${fonts.display}`,
    body = (w: number) => (px: number) => `${w} ${px}px ${fonts.body}`;
  x.textBaseline = "alphabetic";
  x.textAlign = "left";

  // the wordmark
  x.font = display(46);
  const tw = x.measureText(BRAND.name).width,
    em = 70,
    left = (W - (em + 16 + tw)) / 2;
  emblem(x, left, 168, em, L.light ? ["#3fbf7a", "#2fa7a2", "#3d86d8"] : ["#a8f0c0", "#94e0dc", "#9cd2ff"]);
  x.fillStyle = L.ink;
  x.fillText(BRAND.name, left + em + 16, 219);
  x.textAlign = "center";
  x.font = body(400)(30);
  x.fillStyle = L.sub;
  const date = new Date(`${post.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  x.fillText(date, W / 2, 292);

  // the song
  x.font = body(400)(30);
  x.letterSpacing = "5px";
  x.fillText(`${name.split(" ")[0]}'s song today`.toUpperCase(), W / 2, 1490);
  x.letterSpacing = "0px";
  x.fillStyle = L.ink;
  x.fillText(fitText(x, post.title, 70, display, 900), W / 2, 1576);
  x.fillStyle = L.sub;
  x.fillText(fitText(x, post.artist, 38, body(400), 860), W / 2, 1634);

  // join me
  const label = `Join me on ${BRAND.domain}`;
  x.font = body(600)(38);
  const pw = x.measureText(label).width + 88,
    py = 1690;
  x.beginPath();
  x.roundRect((W - pw) / 2, py, pw, 92, 46);
  x.fillStyle = L.light ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.14)";
  x.fill();
  x.lineWidth = 2;
  x.strokeStyle = L.light ? "rgba(255,255,255,0.85)" : "rgba(220,255,250,0.45)";
  x.stroke();
  x.fillStyle = L.ink;
  x.fillText(label, W / 2, py + 59);
  return c;
}

// Your cover with its shadow (and raindrops, in the rain), drawn once.
function paintCover(img: HTMLImageElement | null, sky: StorySky) {
  const pad = 140,
    c = canvas(C + pad * 2, C + pad * 2),
    x = c.getContext("2d")!,
    rr = C * 0.03;
  x.save();
  x.shadowColor = LOOKS[sky].light ? "rgba(30,40,80,0.35)" : "rgba(0,0,10,0.6)";
  x.shadowBlur = 90;
  x.shadowOffsetY = 40;
  x.beginPath();
  x.roundRect(pad, pad, C, C, rr);
  x.fillStyle = "#1B2E4A";
  x.fill();
  x.restore();
  x.save();
  x.beginPath();
  x.roundRect(pad, pad, C, C, rr);
  x.clip();
  if (img) x.drawImage(img, pad, pad, C, C);
  if (sky === "rain") {
    const r = rng(9);
    x.fillStyle = "rgba(200,220,255,0.08)";
    x.fillRect(pad, pad, C, C);
    for (let i = 0; i < 46; i++) {
      const dx = pad + r() * C,
        dy = pad + r() * C,
        s = 2 + r() * 6;
      x.fillStyle = "rgba(0,0,20,0.25)";
      x.beginPath();
      x.ellipse(dx + 1, dy + 2, s, s * 1.15, 0, 0, 7);
      x.fill();
      x.fillStyle = "rgba(255,255,255,0.35)";
      x.beginPath();
      x.ellipse(dx, dy, s, s * 1.15, 0, 0, 7);
      x.fill();
      x.fillStyle = "rgba(255,255,255,0.9)";
      x.beginPath();
      x.arc(dx - s * 0.35, dy - s * 0.4, s * 0.3, 0, 7);
      x.fill();
    }
  }
  x.restore();
  return { c, pad };
}

export type StoryInput = {
  post: Post;
  name: string;
  songs: Post[]; // yours, newest first; their covers go round the globe
  colors: string[] | null; // your core's colours
  sky: StorySky;
};

// Everything that doesn't change between frames, ready to draw any moment.
export async function prepare(input: StoryInput) {
  const { post, songs, sky } = input;
  const css = getComputedStyle(document.body);
  const fonts = {
    display: css.getPropertyValue("--font-fredoka").trim() || "sans-serif",
    body: css.getPropertyValue("--font-outfit").trim() || "sans-serif",
  };
  await Promise.all([document.fonts.load(`600 70px ${fonts.display}`), document.fonts.load(`400 30px ${fonts.body}`), document.fonts.load(`600 38px ${fonts.body}`)]).catch(() => {});

  const hero = post.artwork_url ? await loadImage(post.artwork_url, 640).catch(() => null) : null;
  const urls = [...new Set(songs.filter((s) => s.id !== post.id && s.artwork_url).map((s) => s.artwork_url!))].slice(0, 40);
  const past = (await Promise.all(urls.map((u) => loadImage(u, 256).then(tileImage, () => null)))).filter((c) => c !== null);
  if (hero) past.unshift(tileImage(hero));

  const N = 60;
  // a few songs go round once among empty glass spots; plenty fill the globe
  const art = Array.from({ length: N }, (_, i) => (past.length >= 8 ? past[i % past.length] : (past[Math.floor(i / 7)] ?? null)));
  return {
    sky,
    light: LOOKS[sky].light,
    bg: paintSky(sky),
    clouds: sky === "sunny" ? paintClouds() : [],
    core: paintCore(150, input.colors?.length ? input.colors : MAGMA),
    cover: paintCover(hero, sky),
    text: paintText(sky, post, input.name, fonts),
    art,
    twinkle: Array.from({ length: 40 }, (_, i) => {
      const r = rng(i + 100);
      return { x: r() * W, y: r() * H * 0.85, s: 1.4 + r() * 1.8, p: r() * 7 };
    }),
    rain: Array.from({ length: 300 }, (_, i) => {
      const r = rng(i + 500);
      return { x: r() * W * 1.2 - 100, y: r() * H, l: 30 + r() * 50, a: 0.15 + r() * 0.35, w: 1 + r() * 1.6, v: 1500 + r() * 700 };
    }),
  };
}
export type Prepared = Awaited<ReturnType<typeof prepare>>;

// One frame, t seconds in.
export function drawFrame(x: Ctx, s: Prepared, t: number) {
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.drawImage(s.bg, 0, 0);
  for (const [i, c] of s.clouds.entries()) x.drawImage(c.c, c.x + t * (8 + i * 3), c.y);
  if (s.sky === "night")
    for (const st of s.twinkle) {
      x.fillStyle = `rgba(255,255,255,${(0.35 + 0.5 * Math.abs(Math.sin(t * 1.3 + st.p))).toFixed(2)})`;
      x.beginPath();
      x.arc(st.x, st.y, st.s, 0, 7);
      x.fill();
    }

  // tiles behind, the core, tiles in front
  const tiles = tilesAt(s.art.length, 104, 0.7 + (t / TURN) * Math.PI * 2);
  let cored = false;
  for (const tile of tiles) {
    if (!cored && tile.z > -0.05) {
      x.save();
      x.translate(CX, CY);
      x.rotate(t * 0.12);
      const k = 1 + Math.sin(t * 1.6) * 0.015;
      x.scale(k, k);
      x.drawImage(s.core, -s.core.width / 2, -s.core.height / 2);
      x.restore();
      cored = true;
    }
    const a = tile.z < 0 ? 0.22 + (tile.z + 1) * 0.15 : 0.65 + tile.z * 0.35;
    drawTile(x, s.art[tile.i], tile.corners, a, tile.z < 0, s.light);
  }
  if (s.sky === "golden") {
    x.save();
    x.beginPath();
    x.arc(CX, CY, R, 0, 7);
    x.clip();
    x.fillStyle = radial(x, CX + R * 0.9, CY + R * 0.4, R * 1.2, [[0, "rgba(255,170,110,0.35)"], [1, "rgba(255,170,110,0)"]]);
    x.fillRect(0, 0, W, H);
    x.restore();
  }
  x.strokeStyle = s.light ? "rgba(255,255,255,0.75)" : "rgba(210,255,248,0.4)";
  x.lineWidth = 2.5;
  x.beginPath();
  x.arc(CX, CY, R, 0, 7);
  x.stroke();

  // your song, bobbing on the water
  const bob = Math.sin(t * 1.4) * 7,
    rock = Math.sin(t * 1.1 + 1) * 0.012;
  x.save();
  x.translate(COVER_X + C / 2, COVER_Y + C / 2 + bob);
  x.rotate(rock);
  x.drawImage(s.cover.c, -C / 2 - s.cover.pad, -C / 2 - s.cover.pad);
  x.restore();

  if (s.sky === "rain") {
    x.lineCap = "round";
    for (const d of s.rain) {
      const fall = (d.y + t * d.v) % (H + 200),
        y = fall - 100,
        dx = d.x - fall * 0.22;
      x.strokeStyle = `rgba(220,232,250,${d.a.toFixed(2)})`;
      x.lineWidth = d.w;
      x.beginPath();
      x.moveTo(dx, y);
      x.lineTo(dx - d.l * 0.22, y + d.l);
      x.stroke();
    }
  }
  x.drawImage(s.text, 0, 0);
}

// The best video the browser can record that Instagram will take.
export function videoType() {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return null;
  return ["video/mp4;codecs=avc1.42E01F", "video/mp4;codecs=avc1", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export const W_STORY = W,
  H_STORY = H;
