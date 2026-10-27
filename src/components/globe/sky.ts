import type { Weather } from "@/lib/weather";
import type { V3 } from "./math";

// The sky behind the Globe through the day, from where the real sun is: deep
// blue twilight, a rosy sunrise, golden hour, a bright blue day, an orange
// and pink sunset, then space. Each stop is a top, middle and horizon colour,
// keyed to the sun's height in degrees; mornings run a little cooler and
// pinker, evenings warmer and more orange.

type Stop = [number, string, string, string];

const MORNING: Stop[] = [
  [-10, "#0B1330", "#18224A", "#2A3262"],
  [-5, "#25356F", "#5B5F96", "#B58A9E"],
  [-1, "#3A5697", "#8A88B0", "#F4C7B4"],
  [3, "#40609F", "#9A98BC", "#FEE2C0"],
  [8, "#4170B4", "#A9B2CF", "#FCE7C6"],
  [18, "#4F88CF", "#9CC3E6", "#EAF1EE"],
  [32, "#6AA6E2", "#8DBFE8", "#D6ECFA"],
];
const EVENING: Stop[] = [
  [-10, "#0B1330", "#1B2150", "#2E2C5E"],
  [-5, "#283672", "#6A5A92", "#D07C82"],
  [-1, "#34508F", "#9A7899", "#F59A6C"],
  [3, "#38589C", "#8F7D8E", "#FCB86E"],
  [8, "#3D66AA", "#A39AAE", "#FED687"],
  [18, "#4F88CF", "#A4C3E0", "#F3E6CB"],
  [32, "#6AA6E2", "#8DBFE8", "#D6ECFA"],
];

const hex = (h: string): V3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: V3, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export type SkyLook = {
  bg: string; // the day layer's background
  space: number; // 0..1 how much of the starry night shows over it
  light: boolean; // the top of the sky is dark enough for light lettering
  warm: number; // 0..1 how golden the low sun makes the light (clouds, the glass)
  warmC: V3; // that light's colour, 0..1
};

// el: the sun's height in degrees. az: from north, clockwise, radians.
export function skyAt(el: number, az: number): SkyLook {
  const rising = az < Math.PI;
  const stops = rising ? MORNING : EVENING;
  let i = 0;
  while (i < stops.length - 2 && el > stops[i + 1][0]) i++;
  const [e0, ...c0] = stops[i],
    [e1, ...c1] = stops[i + 1];
  const t = smooth(e0, e1, el);
  const [top, mid, low] = [0, 1, 2].map((j) => mix(hex(c0[j]), hex(c1[j]), t));

  // the low sun's glow, soft, on whichever side it's on (you face north:
  // east is to the right); no disc, just the warmth spreading up the sky
  const warm = smooth(-7, -1, el) * (1 - smooth(9, 20, el));
  const warmC: V3 = rising ? [1, 0.8, 0.7] : [1, 0.72, 0.45];
  const gx = 50 + 46 * Math.sin(az);
  const glow = warm > 0.01 ? `radial-gradient(ellipse 85% 45% at ${gx.toFixed(1)}% 100%, ${css(mix(warmC.map((v) => v * 255) as V3, [255, 245, 225], 0.35), 0.55 * warm)}, ${css([255, 220, 180], 0)} 100%), ` : "";
  const bg = `${glow}linear-gradient(180deg, ${css(top)} 0%, ${css(mid)} 48%, ${css(low)} 100%)`;

  const space = smooth(-3, -11, el);
  const lum = (0.2126 * top[0] + 0.7152 * top[1] + 0.0722 * top[2]) / 255;
  return { bg, space, light: space > 0.5 || lum < 0.42, warm, warmC };
}

// The weather's own sky, laid over the time of day: soft grey-blue for cloud,
// pale haze for fog, cool white for snow, slate for rain and near-black slate
// for a thunderstorm. A low sun still warms through all but the heaviest.
const WX_DAY: Record<string, [string, string, string, number, boolean]> = {
  cloudy: ["#8F9DAA", "#B5C0CA", "#D9DFE4", 0.85, false],
  fog: ["#8896A2", "#B9C4CA", "#DADEE1", 0.9, false],
  drizzle: ["#6F7E8E", "#A3AFBB", "#C9D1D8", 0.85, false],
  rain: ["#3D4857", "#6B7887", "#99A5B2", 0.9, true],
  snow: ["#BCC7D5", "#D3DCE5", "#EDF2F7", 0.85, false],
  storm: ["#212637", "#3A4458", "#3A4355", 0.95, true],
};
const WX_NIGHT: Record<string, [string, string, string]> = {
  cloudy: ["#1B2130", "#141A26", "#0E121B"],
  fog: ["#262D3A", "#222936", "#1C222D"],
  drizzle: ["#1B2130", "#121722", "#0B0F18"],
  rain: ["#151A26", "#10141E", "#0A0D14"],
  snow: ["#283141", "#222A38", "#1A202B"],
  storm: ["#10141E", "#0B0E16", "#07090F"],
};

export function weatherSky(wx: Weather | null, night: number, warm: number) {
  if (!wx || wx.kind === "clear") return null;
  const kind = wx.kind === "partly" ? (wx.cloud > 0.6 ? "cloudy" : null) : wx.kind;
  if (!kind) return null;
  const [t, m, b, op, light] = WX_DAY[kind];
  const n = WX_NIGHT[kind];
  const col = (d: string, nt: string) => css(mix(hex(d), hex(nt), night));
  const amount = (wx.kind === "partly" ? (wx.cloud - 0.6) * 2.5 : 1) * op * (1 - (kind === "storm" ? 0.1 : 0.4) * warm);
  return {
    bg: `linear-gradient(180deg, ${col(t, n[0])} 0%, ${col(m, n[1])} 45%, ${col(b, n[2])} 100%)`,
    opacity: Math.max(0, Math.min(1, amount)),
    light: night > 0.5 || light,
  };
}
