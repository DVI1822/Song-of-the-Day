"use client";

import { useEffect, useState } from "react";
import { streak, todayIn } from "@/lib/day";
import type { Post } from "@/lib/types";
import { hash } from "./math";

// Everyone's core grows from their music: its colours come from the covers of
// their last 14 songs, its style from how those covers feel together (dark and
// warm is lava, dark and cool a nebula, neon electric, pale hazy, earthy matte,
// bright glossy), its drops from their streak, and a few stars or a warm sheen
// from when they usually post. Someone with no songs yet keeps the original
// light magma.

export type CoreStyle = "lava" | "nebula" | "electric" | "glossy" | "matte" | "hazy";

export type CoreLook = {
  style: CoreStyle;
  colors: string[]; // drifted through, newest song first
  base: string; // the body's colour
  drops: number;
  speed: number;
  wobble: number;
  stars: boolean; // posts late at night
  sheen: boolean; // posts early in the morning
};

type RGB = [number, number, number];

const toHex = ([r, g, b]: RGB) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const fromHex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

function hsl([R, G, B]: RGB) {
  const r = R / 255,
    g = G / 255,
    b = B / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

// The cover's two strongest colours: pixels grouped by hue and lightness,
// weighted towards the more colourful groups.
function dominant(px: Uint8ClampedArray): string[] {
  const groups = new Map<number, { n: number; w: number; sum: RGB }>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const c: RGB = [px[i], px[i + 1], px[i + 2]];
    const { h, s, l } = hsl(c);
    const key = s < 0.15 ? 100 + Math.min(2, Math.floor(l * 3)) : Math.floor(h / 30) * 3 + Math.min(2, Math.floor(l * 3));
    const g = groups.get(key) ?? { n: 0, w: 0, sum: [0, 0, 0] as RGB };
    g.n++;
    g.w += 0.35 + s;
    for (let j = 0; j < 3; j++) g.sum[j] += c[j];
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.w - a.w)
    .slice(0, 2)
    .map((g) => toHex(g.sum.map((v) => v / g.n) as RGB));
}

// Painted covers (no artwork) use the same palettes the tiles paint them with.
const PAINTED = ["#7F8FC4", "#2F6F7E", "#4E7A4A", "#B57C9B", "#6B4C8C", "#E08A6B", "#536A73", "#C9782E"];
const painted = (seed: string) => {
  const i = hash(seed) % PAINTED.length;
  return [PAINTED[i], PAINTED[(i + 3) % PAINTED.length]];
};

const KEY = "sotd-cover-colors";
let memo: Record<string, string[]> | null = null;
const cache = () => {
  if (!memo) {
    try {
      memo = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {}
    memo ??= {};
  }
  return memo!;
};
const remember = (url: string, colors: string[]) => {
  const c = cache();
  c[url] = colors;
  const keys = Object.keys(c);
  for (const k of keys.slice(0, Math.max(0, keys.length - 300))) delete c[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
};

function readImage(src: string, cors: boolean): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 16;
        const ctx = cv.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 16, 16);
        const out = dominant(ctx.getImageData(0, 0, 16, 16).data);
        if (out.length) resolve(out);
        else reject();
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

// A cover's colours. Read straight from Spotify's image server; if the browser
// won't let us read it, through the site's own image resizer; failing both,
// from the title like a painted cover.
async function coverColors(post: Post): Promise<string[]> {
  const url = post.artwork_url;
  if (!url) return painted(post.title);
  const known = cache()[url];
  if (known) return known;
  try {
    const small = `/_next/image?url=${encodeURIComponent(url)}&w=32&q=60`;
    const c = await readImage(url, true).catch(() => readImage(small, false));
    if (!url.startsWith("data:")) remember(url, c);
    return c;
  } catch {
    return painted(post.title);
  }
}

function hourOf(t: string, timeZone: string) {
  return Number(new Date(t).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone })) % 24;
}

export function lookFrom(covers: string[][], posts: Post[], timeZone: string): CoreLook | null {
  if (!covers.length) return null;
  const main = covers.map((c) => hsl(fromHex(c[0])));
  const all = covers.flat().map((c) => hsl(fromHex(c)));
  type HSL = { h: number; s: number; l: number };
  const avg = (f: (x: HSL) => number, xs = main) => xs.reduce((a, x) => a + f(x), 0) / xs.length;
  const light = avg((x) => x.l),
    sat = avg((x) => x.s),
    // share of warm colours (reds, oranges, golds) among the colourful ones
    colourful = all.filter((x) => x.s > 0.25),
    warm = colourful.length ? colourful.filter((x) => x.h < 65 || x.h > 330).length / colourful.length : 0.5,
    neon = all.filter((x) => x.s > 0.8 && x.l > 0.45 && x.l < 0.75).length / all.length,
    night = all.filter((x) => x.l < 0.2).length / all.length;
  // how far the hues swing from song to song
  const hx = avg((x) => Math.cos((x.h * Math.PI) / 180) * x.s),
    hy = avg((x) => Math.sin((x.h * Math.PI) / 180) * x.s);
  const swing = 1 - Math.min(1, Math.hypot(hx, hy) / Math.max(0.05, sat));

  const style: CoreStyle =
    neon > 0.3 && night > 0.3
      ? "electric"
      : light < 0.32
        ? warm > 0.5
          ? "lava"
          : "nebula"
        : light > 0.72 && sat < 0.55
          ? "hazy"
          : sat < 0.6 && warm > 0.6
            ? "matte"
            : "glossy";

  const colors = covers.flat();
  const byLight = [...colors].sort((a, b) => hsl(fromHex(a)).l - hsl(fromHex(b)).l);
  const base = style === "lava" || style === "nebula" || style === "electric" ? byLight[0] : covers[0][0];
  // the swirls: the brighter half, so dark cores still glow
  const glowing =
    style === "lava" || style === "nebula" || style === "electric" ? byLight.slice(Math.floor(byLight.length / 2)) : colors;

  const tz = timeZone;
  const days = posts.map((p) => p.day);
  const s = streak(days, todayIn(tz));
  const hours = posts.slice(0, 30).map((p) => hourOf(p.created_at, tz));
  const late = hours.filter((h) => h >= 21 || h < 4).length / hours.length;
  const early = hours.filter((h) => h >= 5 && h < 10).length / hours.length;
  // how fast it moves and how much it wobbles
  const base0 = {
    lava: [0.55, 9],
    nebula: [0.35, 7],
    electric: [1.5, 14],
    glossy: [0.95, 11],
    matte: [0.4, 6],
    hazy: [0.3, 6],
  }[style];
  const restless = swing > 0.6 && sat > 0.35;

  return {
    style,
    colors: glowing,
    base,
    drops: Math.min(6, 1 + Math.floor(s / 9)),
    speed: restless ? Math.max(base0[0], 1.5) : base0[0],
    wobble: restless ? Math.max(base0[1], 15) : base0[1],
    stars: late >= 0.5,
    sheen: early >= 0.5,
  };
}

// The look for someone's core from their songs (newest first).
export function useCoreLook(posts: Post[] | null | undefined, timeZone: string) {
  const recent = (posts ?? []).slice(0, 14);
  const ids = recent.map((p) => p.id).join(",") + ":" + (posts?.length ?? 0);
  const [look, setLook] = useState<{ ids: string; look: CoreLook | null } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(recent.map(coverColors)).then(
      (covers) => live && setLook({ ids, look: lookFrom(covers, posts ?? [], timeZone) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, timeZone]);
  return look?.ids === ids ? look.look : null;
}

// A colour at some opacity.
export function alpha(hex: string, a: number) {
  const [r, g, b] = fromHex(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// Drift through a list of colours over time; `white` lightens towards white.
export function drift(colors: string[], t: number, white = 0, a = 1) {
  const n = colors.length,
    x = ((t % n) + n) % n,
    i = Math.floor(x);
  const A = fromHex(colors[i]),
    B = fromHex(colors[(i + 1) % n]);
  const c = A.map((v, j) => {
    const m = v + (B[j] - v) * (x - i);
    return Math.round(m + (255 - m) * white);
  });
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}
