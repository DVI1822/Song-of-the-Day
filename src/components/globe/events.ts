// Little moments in the drawn places behind the Globe: every so often
// something happens. A balloon drifts over, a whale spouts, a pickup rattles
// down the farm road, a shooting star, now and then a UFO. Which ones can
// happen depends on the place, the time of day, the season and the weather,
// so it keeps surprising you. All in the same ink line style (line.ts).
//
// ?event=name plays one over and over (to preview it); ?events=busy makes
// them come one after another.

import type { Inks } from "./line";
import type { C, Light } from "./setting";
import type { Season } from "./scene";

export type Place = "mountain" | "coast" | "farm" | "city" | "suburb" | "desert" | "woods";
export type Ctx = {
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
  s: number; // size, 1 on a 390-wide phone
  I: Inks;
  L: Light;
  place: Place;
  season: Season;
  weather: string;
  hour: number;
  t: number;
};
type Run = {
  def: Def;
  t0: number;
  dur: number;
  seed: number;
  dir: 1 | -1;
  y: number;
};
type Def = {
  name: string;
  places?: Place[];
  when: (c: Ctx) => boolean;
  weight: number;
  dur: [number, number];
  draw: (c: Ctx, p: number, r: Run, age: number) => void;
};

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const css = (c: C, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const ease = (p: number) => p * p * (3 - 2 * p);
// fades in over the first bit and out over the last
const fade = (p: number, k = 0.08) => clamp01(Math.min(p / k, (1 - p) / k));

// ------------------------------------------------------------ the pen
function pen(c: Ctx, w = 1.3, a = 1) {
  c.g.strokeStyle = c.I.ink;
  c.g.globalAlpha = a;
  c.g.lineWidth = w * c.s;
  c.g.lineCap = "round";
  c.g.lineJoin = "round";
}
function path(c: Ctx, pts: [number, number][], close = false) {
  const g = c.g;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (close) g.closePath();
}
function shape(c: Ctx, pts: [number, number][], fill: C | null, w = 1.3) {
  path(c, pts, true);
  if (fill) {
    c.g.fillStyle = css(fill);
    c.g.fill();
  }
  c.g.lineWidth = w * c.s;
  c.g.stroke();
}
function line(c: Ctx, pts: [number, number][], w = 1.3) {
  path(c, pts);
  c.g.lineWidth = w * c.s;
  c.g.stroke();
}
function circle(c: Ctx, x: number, y: number, r: number, fill: C | null, w = 1.2) {
  c.g.beginPath();
  c.g.arc(x, y, r, 0, TAU);
  if (fill) {
    c.g.fillStyle = css(fill);
    c.g.fill();
  }
  if (w > 0) {
    c.g.lineWidth = w * c.s;
    c.g.stroke();
  }
}
function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: C | null, w = 1.2, rot = 0) {
  c.g.beginPath();
  c.g.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) {
    c.g.fillStyle = css(fill);
    c.g.fill();
  }
  if (w > 0) {
    c.g.lineWidth = w * c.s;
    c.g.stroke();
  }
}
// the hand-lettering face (layout.tsx loads it as --font-hand)
let handFace: string | null = null;
function hand(px: number) {
  if (handFace === null && typeof document !== "undefined")
    handFace = getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim();
  return `700 ${px}px ${handFace ? handFace + ", " : ""}"Comic Sans MS", cursive`;
}
// a colour in this place's light
const col = (c: Ctx, rgb: C, far = 0.06) => c.I.paint(rgb, far);
// draw facing left or right
function facing(c: Ctx, x: number, y: number, dir: number, fn: () => void) {
  c.g.save();
  c.g.translate(x, y);
  c.g.scale(dir * c.s, c.s);
  fn();
  c.g.restore();
}
// inside facing(): line widths are already scaled
function pf(c: Ctx, w = 1.3) {
  c.g.lineWidth = w;
}
function shp(c: Ctx, pts: [number, number][], fill: C | null, w = 1.3) {
  path(c, pts, true);
  if (fill) {
    c.g.fillStyle = css(fill);
    c.g.fill();
  }
  pf(c, w);
  c.g.stroke();
}
function ln(c: Ctx, pts: [number, number][], w = 1.3) {
  path(c, pts);
  pf(c, w);
  c.g.stroke();
}
function circ(c: Ctx, x: number, y: number, r: number, fill: C | null, w = 1.2) {
  c.g.beginPath();
  c.g.arc(x, y, r, 0, TAU);
  if (fill) {
    c.g.fillStyle = css(fill);
    c.g.fill();
  }
  if (w > 0) {
    pf(c, w);
    c.g.stroke();
  }
}
function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: C | null, w = 1.2, rot = 0) {
  c.g.beginPath();
  c.g.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) {
    c.g.fillStyle = css(fill);
    c.g.fill();
  }
  if (w > 0) {
    pf(c, w);
    c.g.stroke();
  }
}

// where things cross the screen: from just off one side to just off the other
const across = (c: Ctx, p: number, dir: number, pad = 60) =>
  dir > 0 ? -pad + p * (c.w + 2 * pad) : c.w + pad - p * (c.w + 2 * pad);

// ------------------------------------------------------------ the conditions
const day = (c: Ctx) => c.L.night < 0.35;
const night = (c: Ctx) => c.L.night > 0.7;
const dusk = (c: Ctx) => c.L.night > 0.25 && c.L.night < 0.75;
const dry = (c: Ctx) => !["rain", "storm", "drizzle", "snow", "fog"].includes(c.weather);
const clear = (c: Ctx) => c.weather === "clear" || c.weather === "partly";
const calm = (c: Ctx) => c.L.wind < 9;
const snowy = (c: Ctx) => c.I.snowy;
const warmSeason = (c: Ctx) => c.season === "spring" || c.season === "summer";

// the ground lines in each place, as fractions of the screen's height
const GROUND: Record<
  Place,
  {
    horizon: number;
    near: number;
    road?: number;
    sea?: [number, number];
    sand?: [number, number];
  }
> = {
  mountain: { horizon: 0.72, near: 0.9 },
  coast: { horizon: 0.745, near: 0.93, sea: [0.76, 0.805], sand: [0.84, 0.95] },
  farm: { horizon: 0.718, near: 0.94, road: 0.886 },
  city: { horizon: 0.745, near: 0.82, road: 0.872 },
  suburb: { horizon: 0.735, near: 0.842, road: 0.882 },
  desert: { horizon: 0.73, near: 0.835, road: 0.885 },
  woods: { horizon: 0.725, near: 0.86 },
};

// ------------------------------------------------------------ the moments
const BANNERS = [
  "play it loud",
  "song of the day",
  "♪ ♪ ♪",
  "hi mom",
  "turn it up",
  "TopTrack",
  "on repeat",
  "what's yours today?",
  "dance break",
  "track 1, side A",
];

const DEFS: Def[] = [
  // -------------------------------------------------------------- the sky
  {
    name: "balloon",
    when: (c) => day(c) && calm(c) && dry(c),
    weight: 3,
    dur: [40, 60],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 40),
        y = c.h * (0.12 + 0.08 * r.y) + Math.sin(c.t * 0.5 + r.seed) * 6 * c.s;
      const stripes: C[][] = [
        [
          [255, 94, 87],
          [255, 236, 200],
        ],
        [
          [90, 160, 230],
          [255, 220, 90],
        ],
        [
          [120, 200, 120],
          [255, 253, 246],
        ],
      ];
      const [a, b] = stripes[Math.floor(r.seed * 3) % 3];
      facing(c, x, y, 1, () => {
        pen(c, 1.3, fade(p, 0.05));
        // the envelope, in segments
        const segs = 6;
        for (let i = 0; i < segs; i++) {
          const u0 = -1 + (2 * i) / segs,
            u1 = -1 + (2 * (i + 1)) / segs;
          const pts: [number, number][] = [];
          for (let k = 0; k <= 10; k++) {
            const v = -Math.PI / 2 + (k / 10) * Math.PI * 0.85;
            pts.push([Math.sin(Math.asin(u0)) * 14 * Math.cos(v) * 1, 15 * Math.sin(v) - 2]);
          }
          for (let k = 10; k >= 0; k--) {
            const v = -Math.PI / 2 + (k / 10) * Math.PI * 0.85;
            pts.push([u1 * 14 * Math.cos(v), 15 * Math.sin(v) - 2]);
          }
          shp(c, pts, i % 2 ? a : b, 0.9);
        }
        ell(c, 0, -2, 14, 15, null, 1.3);
        // ropes and basket, the burner glowing now and then
        ln(
          c,
          [
            [-6, 11],
            [-3.5, 19],
          ],
          0.8,
        );
        ln(
          c,
          [
            [6, 11],
            [3.5, 19],
          ],
          0.8,
        );
        shp(
          c,
          [
            [-4, 19],
            [4, 19],
            [3.4, 24],
            [-3.4, 24],
          ],
          col(c, [170, 120, 70]),
          1,
        );
        if (Math.sin(c.t * 1.7 + r.seed * 9) > 0.7) {
          c.g.fillStyle = "rgba(255,170,60,0.9)";
          c.g.beginPath();
          c.g.moveTo(-1.5, 17);
          c.g.quadraticCurveTo(0, 11, 1.5, 17);
          c.g.fill();
        }
      });
    },
  },
  {
    name: "banner-plane",
    when: (c) => day(c) && c.weather !== "storm" && c.weather !== "fog",
    weight: 3,
    dur: [16, 22],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 220),
        y = c.h * (0.14 + 0.06 * r.y) + Math.sin(c.t * 1.3) * 2 * c.s;
      const msg = BANNERS[Math.floor(r.seed * BANNERS.length)];
      const d = r.dir;
      pen(c, 1.2);
      // the plane
      facing(c, x, y, d, () => {
        shp(
          c,
          [
            [-10, 0],
            [8, -1.5],
            [11, 0],
            [8, 1.8],
            [-10, 1.5],
          ],
          col(c, [255, 253, 246]),
          1.1,
        );
        shp(
          c,
          [
            [-1, 0],
            [3, -6],
            [5, -6],
            [3, 0],
          ],
          col(c, [255, 94, 87]),
          1,
        );
        shp(
          c,
          [
            [-10, 0],
            [-12, -4],
            [-9, -4],
            [-7, 0],
          ],
          col(c, [255, 94, 87]),
          1,
        );
        const prop = Math.sin(c.t * 40) * 3;
        ln(
          c,
          [
            [11.5, -prop],
            [11.5, prop],
          ],
          1,
        );
      });
      // the rope and the banner, rippling
      const bx = x - d * 22 * c.s;
      line(
        c,
        [
          [x - d * 10 * c.s, y],
          [bx, y],
        ],
        0.8,
      );
      c.g.font = hand(12 * c.s);
      const tw = c.g.measureText(msg).width + 14 * c.s;
      const bh = 13 * c.s;
      const x0 = d > 0 ? bx - tw : bx;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 12; i++)
        pts.push([x0 + (tw * i) / 12, y - bh / 2 + Math.sin(c.t * 5 + i * 0.7) * 1.4 * c.s]);
      for (let i = 12; i >= 0; i--)
        pts.push([x0 + (tw * i) / 12, y + bh / 2 + Math.sin(c.t * 5 + i * 0.7) * 1.4 * c.s]);
      shape(c, pts, col(c, [255, 250, 232]), 1);
      c.g.fillStyle = c.I.ink;
      c.g.textAlign = "center";
      c.g.textBaseline = "middle";
      c.g.fillText(msg, x0 + tw / 2, y + 0.5 * c.s + Math.sin(c.t * 5 + 6 * 0.7) * 1.2 * c.s);
    },
  },
  {
    name: "geese",
    when: (c) => day(c) && (c.season === "autumn" || c.season === "spring" || hashDay(c) > 0.5),
    weight: 3,
    dur: [18, 26],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 80),
        y = c.h * (0.1 + 0.1 * r.y);
      pen(c, 1.2, fade(p));
      const n = 7;
      for (let i = 0; i < n; i++) {
        const k = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        const bx = x - r.dir * Math.abs(k) * 11 * c.s,
          by = y + k * 7 * c.s;
        const f = Math.sin(c.t * 5 + i * 0.9) * 3 * c.s;
        line(
          c,
          [
            [bx - 5 * c.s, by - f],
            [bx, by],
            [bx + 5 * c.s, by - f],
          ],
          1.2,
        );
      }
    },
  },
  {
    name: "hawk",
    places: ["mountain", "farm", "desert"],
    when: (c) => day(c),
    weight: 2,
    dur: [20, 30],
    draw(c, p, r) {
      const cx = c.w * (0.2 + 0.6 * r.y) + (p - 0.5) * c.w * 0.4 * r.dir,
        cy = c.h * 0.17;
      const a = c.t * 0.7 * r.dir;
      const x = cx + Math.cos(a) * 34 * c.s,
        y = cy + Math.sin(a) * 9 * c.s;
      pen(c, 1.3, fade(p));
      const tilt = Math.sin(a) * 2 * c.s;
      line(
        c,
        [
          [x - 9 * c.s, y - 2 * c.s + tilt],
          [x - 3 * c.s, y - 1 * c.s],
          [x, y],
          [x + 3 * c.s, y - 1 * c.s],
          [x + 9 * c.s, y - 2 * c.s - tilt],
        ],
        1.4,
      );
    },
  },
  {
    name: "helicopter",
    when: (c) => day(c) && c.weather !== "storm",
    weight: 1.2,
    dur: [14, 20],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 40),
        y = c.h * (0.16 + 0.05 * r.y) + Math.sin(c.t * 0.9) * 3 * c.s;
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        ell(c, 2, 0, 7, 4.5, col(c, [255, 94, 87]), 1.1);
        ell(c, 4.5, -1, 2.5, 2, col(c, [190, 225, 245]), 0.9);
        ln(
          c,
          [
            [-4, 0],
            [-16, -1],
          ],
          1.3,
        );
        ln(
          c,
          [
            [-16, -4],
            [-16, 2],
          ],
          1,
        );
        ln(
          c,
          [
            [-2, 5],
            [7, 5],
          ],
          1,
        );
        const b = Math.cos(c.t * 30) * 13;
        ln(
          c,
          [
            [2 - b, -6],
            [2 + b, -6],
          ],
          1.1,
        );
        ln(
          c,
          [
            [2, -4.5],
            [2, -6],
          ],
          1,
        );
      });
    },
  },
  {
    name: "blimp",
    when: (c) => day(c) && calm(c),
    weight: 0.8,
    dur: [45, 60],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 60),
        y = c.h * (0.11 + 0.05 * r.y);
      pen(c, 1.3, fade(p, 0.05));
      facing(c, x, y, r.dir, () => {
        ell(c, 0, 0, 26, 9, col(c, [235, 238, 244]), 1.3);
        shp(
          c,
          [
            [-22, -3],
            [-31, -9],
            [-29, 0],
            [-31, 8],
            [-22, 3],
          ],
          col(c, [255, 94, 87]),
          1.1,
        );
        shp(
          c,
          [
            [-5, 8],
            [7, 8],
            [6, 12],
            [-4, 12],
          ],
          col(c, [70, 82, 104]),
          1,
        );
        c.g.font = hand(9);
        c.g.fillStyle = c.I.ink;
        c.g.textAlign = "center";
        c.g.textBaseline = "middle";
        c.g.save();
        c.g.scale(r.dir, 1);
        c.g.fillText("TopTrack", 0, 0.5, 34);
        c.g.restore();
      });
    },
  },
  {
    name: "paper-plane",
    when: (c) => day(c) && dry(c),
    weight: 1,
    dur: [12, 16],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        loop = Math.sin(p * TAU * 1.5);
      const y = c.h * (0.22 + 0.06 * r.y) + loop * 18 * c.s + Math.sin(p * 20) * 2 * c.s;
      const ang = Math.cos(p * TAU * 1.5) * 0.5;
      pen(c, 1);
      c.g.save();
      c.g.translate(x, y);
      c.g.rotate(-ang * r.dir);
      c.g.scale(r.dir * c.s, c.s);
      shp(
        c,
        [
          [7, 0],
          [-6, -4],
          [-3, 0],
          [-6, 3.5],
        ],
        [255, 255, 255],
        1,
      );
      ln(
        c,
        [
          [7, 0],
          [-3, 0],
        ],
        0.8,
      );
      c.g.restore();
    },
  },
  {
    name: "skywriting",
    when: (c) => day(c) && clear(c) && calm(c),
    weight: 0.7,
    dur: [16, 20],
    draw(c, p, r) {
      // a little plane draws a heart, then it slowly puffs away
      const cx = c.w * (0.25 + 0.5 * r.y),
        cy = c.h * 0.13,
        S = 22 * c.s;
      const heart = (u: number): [number, number] => {
        const a = u * TAU;
        return [
          cx + (S * 16 * Math.pow(Math.sin(a), 3)) / 16,
          cy - (S * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))) / 16,
        ];
      };
      const drawn = clamp01(p / 0.55);
      const gone = clamp01((p - 0.55) / 0.45);
      c.g.fillStyle = `rgba(255,255,255,${0.85 * (1 - gone)})`;
      for (let i = 0; i < 90 * drawn; i++) {
        const [hx, hy] = heart(i / 90);
        c.g.beginPath();
        c.g.arc(hx + Math.sin(i) * gone * 4 * c.s, hy - gone * 4 * c.s, (2.2 + gone * 3 + hash(i) * 1.2) * c.s, 0, TAU);
        c.g.fill();
      }
      if (drawn < 1) {
        const [px, py] = heart(drawn);
        pen(c, 1.1);
        circle(c, px, py, 2.2 * c.s, col(c, [255, 94, 87]), 1);
      }
    },
  },
  {
    name: "butterflies",
    when: (c) => day(c) && warmSeason(c) && dry(c),
    weight: 2,
    dur: [14, 20],
    draw(c, p, r) {
      const G = GROUND[c.place];
      for (let i = 0; i < 2; i++) {
        const x = across(c, p, r.dir, 20) + i * 18 * c.s + Math.sin(c.t * 1.3 + i * 3) * 14 * c.s;
        const y = c.h * (G.near - 0.06) + Math.sin(c.t * 2.1 + i) * 10 * c.s - i * 8 * c.s;
        const f = Math.abs(Math.sin(c.t * 12 + i * 2));
        pen(c, 0.8);
        const colr: C = i ? [255, 210, 80] : [255, 140, 120];
        ellipse(c, x - 2.5 * f * c.s, y, 2.6 * f * c.s + 0.4, 3 * c.s, col(c, colr), 0.7);
        ellipse(c, x + 2.5 * f * c.s, y, 2.6 * f * c.s + 0.4, 3 * c.s, col(c, colr), 0.7);
      }
    },
  },
  {
    name: "leaves",
    when: (c) => c.season === "autumn" && !night(c),
    weight: 2.5,
    dur: [12, 18],
    draw(c, p, r) {
      for (let i = 0; i < 9; i++) {
        const q = (p * 1.6 + hash(i + r.seed) * 0.8) % 1.4;
        if (q > 1) continue;
        const x = r.dir > 0 ? -20 + (q + hash(i * 3)) * c.w * 0.9 : c.w + 20 - (q + hash(i * 3)) * c.w * 0.9;
        const y = c.h * (0.45 + q * 0.5) + Math.sin(c.t * 2 + i) * 8 * c.s;
        c.g.save();
        c.g.translate(x, y);
        c.g.rotate(c.t * 2 + i);
        c.g.scale(c.s, c.s);
        pen(c, 0.7);
        ell(c, 0, 0, 3.4, 1.8, col(c, i % 3 ? [232, 150, 50] : [210, 80, 50]), 0.7);
        c.g.restore();
      }
    },
  },
  {
    name: "bats",
    when: (c) => dusk(c) && c.season !== "winter",
    weight: 2,
    dur: [10, 14],
    draw(c, p, r) {
      pen(c, 1);
      for (let i = 0; i < 4; i++) {
        const x = across(c, (p + i * 0.05) % 1, r.dir, 30) + Math.sin(c.t * 3 + i * 2) * 20 * c.s;
        const y = c.h * (0.2 + 0.05 * i) + Math.sin(c.t * 5 + i) * 10 * c.s;
        const f = Math.sin(c.t * 18 + i) * 2.5 * c.s;
        c.g.fillStyle = c.I.ink;
        c.g.beginPath();
        c.g.moveTo(x - 6 * c.s, y - f);
        c.g.quadraticCurveTo(x - 3 * c.s, y + 1 * c.s, x, y - 1 * c.s);
        c.g.quadraticCurveTo(x + 3 * c.s, y + 1 * c.s, x + 6 * c.s, y - f);
        c.g.quadraticCurveTo(x, y + 3 * c.s, x - 6 * c.s, y - f);
        c.g.fill();
      }
    },
  },
  {
    name: "shooting-star",
    when: (c) => night(c) && clear(c),
    weight: 4,
    dur: [1.6, 2.4],
    draw(c, p, r) {
      const x0 = c.w * (0.1 + 0.8 * r.y),
        y0 = c.h * (0.06 + 0.12 * r.seed);
      const len = 120 * c.s,
        e = ease(p);
      const x = x0 + r.dir * e * len,
        y = y0 + e * len * 0.45;
      const gr = c.g.createLinearGradient(x, y, x - r.dir * 50 * c.s, y - 22 * c.s);
      gr.addColorStop(0, `rgba(255,255,240,${0.95 * (1 - p)})`);
      gr.addColorStop(1, "rgba(255,255,240,0)");
      c.g.strokeStyle = gr;
      c.g.lineWidth = 1.6 * c.s;
      c.g.beginPath();
      c.g.moveTo(x, y);
      c.g.lineTo(x - r.dir * 50 * c.s, y - 22 * c.s);
      c.g.stroke();
    },
  },
  {
    name: "satellite",
    when: (c) => night(c) && clear(c),
    weight: 1.5,
    dur: [24, 30],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 10),
        y = c.h * (0.05 + 0.1 * r.y) + p * c.h * 0.04;
      c.g.fillStyle = `rgba(255,255,255,${0.85 * fade(p)})`;
      c.g.beginPath();
      c.g.arc(x, y, 1.3 * c.s, 0, TAU);
      c.g.fill();
    },
  },
  {
    name: "comet",
    when: (c) => night(c) && clear(c),
    weight: 0.4,
    dur: [40, 50],
    draw(c, p, r) {
      const a = fade(p, 0.2);
      const x = c.w * (0.2 + 0.6 * r.y) + p * 30 * c.s * r.dir,
        y = c.h * (0.15 + 0.05 * r.seed);
      // a few fine streaks for the tail, the way you'd draw one with a pen
      c.g.lineCap = "round";
      for (let k = 0; k < 4; k++) {
        const len = (60 + k * 12) * c.s,
          sp = (k - 1.5) * 3.2 * c.s;
        const ex = x - r.dir * len,
          ey = y - len * 0.3 + sp;
        const gr = c.g.createLinearGradient(x, y, ex, ey);
        gr.addColorStop(0, `rgba(220,240,255,${(0.75 - k * 0.12) * a})`);
        gr.addColorStop(1, "rgba(220,240,255,0)");
        c.g.strokeStyle = gr;
        c.g.lineWidth = (1.6 - k * 0.25) * c.s;
        c.g.beginPath();
        c.g.moveTo(x, y);
        c.g.quadraticCurveTo(x - r.dir * len * 0.5, y - len * 0.12 + sp * 0.4, ex, ey);
        c.g.stroke();
      }
      c.g.fillStyle = `rgba(255,255,255,${a})`;
      c.g.beginPath();
      c.g.arc(x, y, 2.2 * c.s, 0, TAU);
      c.g.fill();
    },
  },
  {
    name: "ufo",
    when: (c) => night(c),
    weight: 0.35,
    dur: [11, 13],
    draw(c, p, r) {
      // drifts in, hovers with its beam down on the ground, then zips off
      const tx = c.w * (0.2 + 0.6 * r.y);
      let x: number, y: number;
      const hy = c.h * 0.6;
      if (p < 0.25) {
        const q = ease(p / 0.25);
        x = r.dir > 0 ? -40 + (tx + 40) * q : c.w + 40 - (c.w + 40 - tx) * q;
        y = c.h * 0.1 + (hy - c.h * 0.1) * q;
      } else if (p < 0.8) {
        x = tx + Math.sin(c.t * 2) * 3 * c.s;
        y = hy + Math.sin(c.t * 3) * 2 * c.s;
      } else {
        const q = Math.pow((p - 0.8) / 0.2, 2);
        x = tx + r.dir * q * c.w;
        y = hy - q * c.h * 0.6;
      }
      if (p > 0.3 && p < 0.78) {
        const a = 0.25 * fade((p - 0.3) / 0.48, 0.15);
        const gy = c.h * (GROUND[c.place].near - 0.02);
        c.g.fillStyle = `rgba(180,255,190,${a})`;
        c.g.beginPath();
        c.g.moveTo(x - 6 * c.s, y + 3 * c.s);
        c.g.lineTo(x + 6 * c.s, y + 3 * c.s);
        c.g.lineTo(x + 26 * c.s, gy);
        c.g.lineTo(x - 26 * c.s, gy);
        c.g.fill();
      }
      pen(c, 1.2);
      facing(c, x, y, 1, () => {
        ell(c, 0, -3, 6, 5, [190, 240, 220], 1);
        ell(c, 0, 0, 15, 4, [200, 205, 220], 1.2);
        for (let i = 0; i < 5; i++) {
          const on = Math.sin(c.t * 8 + i) > 0;
          circ(c, -10 + i * 5, 1, 1.1, on ? [255, 230, 120] : [120, 130, 150], 0);
        }
      });
    },
  },
  {
    name: "aurora",
    places: ["mountain"],
    when: (c) => night(c) && clear(c),
    weight: 1.2,
    dur: [40, 60],
    draw(c, p) {
      // curtains drawn as fine hatching hanging from a wavy top line
      const a = fade(p, 0.25);
      c.g.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const top = c.h * (0.13 + k * 0.03);
        const colr = k === 1 ? "190,140,255" : "130,255,180";
        const yAt = (x: number) =>
          top +
          (Math.sin(x / (60 * c.s) + c.t * 0.3 + k * 2) * 0.5 + Math.sin(x / (23 * c.s) - c.t * 0.5 + k) * 0.3) *
            14 *
            c.s;
        c.g.lineWidth = 1.1 * c.s;
        for (let x = -2; x < c.w + 4; x += 4 * c.s) {
          const y = yAt(x);
          const len = c.h * (0.05 + 0.05 * (0.5 + 0.5 * Math.sin(x / (31 * c.s) + c.t * 0.7 + k * 4)));
          const al = (0.2 + 0.14 * Math.sin(x / (17 * c.s) + c.t * 1.3)) * a;
          const gr = c.g.createLinearGradient(0, y, 0, y + len);
          gr.addColorStop(0, `rgba(${colr},${al})`);
          gr.addColorStop(1, `rgba(${colr},0)`);
          c.g.strokeStyle = gr;
          c.g.beginPath();
          c.g.moveTo(x, y);
          c.g.lineTo(x + 2 * c.s, y + len);
          c.g.stroke();
        }
        c.g.strokeStyle = `rgba(${colr},${0.55 * a})`;
        c.g.lineWidth = 1.3 * c.s;
        c.g.beginPath();
        for (let x = -2; x < c.w + 4; x += 6) x < 0 ? c.g.moveTo(x, yAt(x)) : c.g.lineTo(x, yAt(x));
        c.g.stroke();
      }
    },
  },
  {
    name: "fireworks",
    when: (c) => night(c) && dry(c) && (c.place !== "mountain" || hashDay(c) > 0.5),
    weight: 0.8,
    dur: [8, 10],
    draw(c, p, r) {
      for (let k = 0; k < 4; k++) {
        const q = (p * 4 - k * 0.8) / 1.6;
        if (q < 0 || q > 1) continue;
        const x = c.w * (0.15 + 0.7 * hash(r.seed * 10 + k)),
          y = c.h * (0.08 + 0.12 * hash(r.seed * 20 + k));
        const colr: C = (
          [
            [255, 94, 87],
            [255, 220, 90],
            [120, 220, 255],
            [170, 255, 140],
          ] as C[]
        )[k % 4];
        if (q < 0.3) {
          const gy = c.h * GROUND[c.place].horizon;
          c.g.fillStyle = "rgba(255,240,200,0.9)";
          c.g.beginPath();
          c.g.arc(x, gy + (y - gy) * (q / 0.3), 1.2 * c.s, 0, TAU);
          c.g.fill();
        } else {
          const e = (q - 0.3) / 0.7;
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * TAU;
            const rr = 26 * c.s * ease(e);
            c.g.strokeStyle = css(colr, 1 - e);
            c.g.lineWidth = 1.4 * c.s;
            c.g.beginPath();
            c.g.moveTo(x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6 + e * 6 * c.s);
            c.g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr + e * 8 * c.s);
            c.g.stroke();
          }
        }
      }
    },
  },
  {
    name: "lanterns",
    when: (c) => night(c) && calm(c) && dry(c),
    weight: 0.8,
    dur: [25, 30],
    draw(c, p, r) {
      for (let i = 0; i < 6; i++) {
        const q = clamp01(p * 1.3 - i * 0.05);
        const x = c.w * (0.15 + 0.7 * hash(r.seed * 7 + i)) + r.dir * q * 40 * c.s + Math.sin(c.t + i) * 4 * c.s;
        const y = c.h * (0.75 - q * 0.68);
        const a = fade(q, 0.12) * (0.75 + 0.25 * Math.sin(c.t * 6 + i * 3));
        const gr = c.g.createRadialGradient(x, y, 0, x, y, 9 * c.s);
        gr.addColorStop(0, `rgba(255,190,90,${0.5 * a})`);
        gr.addColorStop(1, "rgba(255,190,90,0)");
        c.g.fillStyle = gr;
        c.g.fillRect(x - 9 * c.s, y - 9 * c.s, 18 * c.s, 18 * c.s);
        c.g.fillStyle = `rgba(255,214,140,${a})`;
        c.g.fillRect(x - 2 * c.s, y - 3 * c.s, 4 * c.s, 5 * c.s);
      }
    },
  },

  // -------------------------------------------------------------- the mountains
  {
    name: "bear",
    places: ["mountain", "woods"],
    when: (c) => !night(c) && c.season !== "winter",
    weight: 2,
    dur: [26, 34],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * GROUND[c.place].near;
      const st = Math.sin(c.t * 4);
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        const fur = col(c, [110, 74, 50]);
        ln(
          c,
          [
            [-8, -6],
            [-9 + st * 2, 0],
          ],
          2.4,
        );
        ln(
          c,
          [
            [6, -6],
            [7 - st * 2, 0],
          ],
          2.4,
        );
        shp(
          c,
          [
            [-12, -8],
            [-10, -16],
            [-2, -18],
            [6, -16],
            [10, -12],
            [12, -8],
            [8, -5],
            [-10, -5],
          ],
          fur,
          1.2,
        );
        shp(
          c,
          [
            [9, -13],
            [16, -14],
            [19, -11],
            [16, -9],
            [10, -9],
          ],
          fur,
          1.1,
        );
        circ(c, 11, -15, 1.5, fur, 1);
        circ(c, 18.5, -11.3, 0.8, c.I.inkC, 0);
        ln(
          c,
          [
            [-6, -6],
            [-6 - st * 2, 0],
          ],
          2.4,
        );
        ln(
          c,
          [
            [4, -6],
            [4 + st * 2, 0],
          ],
          2.4,
        );
      });
    },
  },
  {
    name: "moose",
    places: ["mountain", "woods"],
    when: (c) => !night(c),
    weight: 1.5,
    dur: [30, 38],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * (GROUND[c.place].near - 0.012);
      const st = Math.sin(c.t * 3);
      pen(c, 1.1);
      facing(c, x, y, r.dir, () => {
        const fur = col(c, [90, 64, 46]);
        for (const [lx, ph] of [
          [-9, 1],
          [-6, -1],
          [6, -1],
          [9, 1],
        ] as [number, number][])
          ln(
            c,
            [
              [lx, -12],
              [lx + st * 2 * ph, 0],
            ],
            1.4,
          );
        shp(
          c,
          [
            [-12, -12],
            [-11, -21],
            [2, -23],
            [10, -21],
            [12, -13],
            [-10, -11],
          ],
          fur,
          1.1,
        );
        shp(
          c,
          [
            [10, -20],
            [15, -23],
            [21, -18],
            [19, -15],
            [13, -16],
          ],
          fur,
          1,
        );
        ln(
          c,
          [
            [14, -15],
            [14, -11],
          ],
          1.1,
        );
        const antler = col(c, [214, 190, 150]);
        shp(
          c,
          [
            [13, -23],
            [7, -26],
            [5, -31],
            [8, -29],
            [9, -32],
            [11, -28],
            [14, -25],
          ],
          antler,
          0.9,
        );
        shp(
          c,
          [
            [16, -23],
            [20, -27],
            [21, -32],
            [22, -28],
            [25, -30],
            [23, -25],
            [18, -22],
          ],
          antler,
          0.9,
        );
      });
    },
  },
  {
    name: "skier",
    places: ["mountain"],
    when: (c) => snowy(c) && !night(c),
    weight: 3,
    dur: [9, 12],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 20),
        y = c.h * (0.86 + p * 0.08) + Math.sin(p * TAU * 3) * 3 * c.s;
      const carve = Math.cos(p * TAU * 3) * 0.3;
      pen(c, 1.2);
      // a trail of snow puffs behind
      for (let i = 1; i < 8; i++) {
        const q = p - i * 0.012;
        if (q < 0) break;
        circle(
          c,
          across(c, q, r.dir, 20),
          c.h * (0.86 + q * 0.08) + Math.sin(q * TAU * 3) * 3 * c.s + 3 * c.s,
          (1 + i * 0.5) * c.s,
          [255, 255, 255],
          0,
        );
      }
      c.g.save();
      c.g.translate(x, y);
      c.g.rotate(carve * r.dir);
      c.g.scale(r.dir * c.s, c.s);
      ln(
        c,
        [
          [-8, 2],
          [8, 2],
        ],
        1.4,
      );
      shp(
        c,
        [
          [-2, -10],
          [2, -10],
          [3, -3],
          [-3, -3],
        ],
        col(c, [255, 94, 87]),
        1,
      );
      ln(
        c,
        [
          [-2, -3],
          [-3, 2],
        ],
        1.4,
      );
      ln(
        c,
        [
          [2, -3],
          [3, 2],
        ],
        1.4,
      );
      circ(c, 0, -13, 2.5, col(c, [90, 160, 230]), 1);
      ln(
        c,
        [
          [-2, -8],
          [-7, -2],
        ],
        1,
      );
      ln(
        c,
        [
          [2, -8],
          [6, -1],
        ],
        1,
      );
      c.g.restore();
    },
  },
  {
    name: "hiker",
    places: ["mountain", "woods"],
    when: (c) => day(c) && !snowy(c),
    weight: 2,
    dur: [28, 36],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * GROUND[c.place].near;
      const st = Math.sin(c.t * 5);
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        ln(
          c,
          [
            [0, -9],
            [-st * 3, 0],
          ],
          1.4,
        );
        ln(
          c,
          [
            [0, -9],
            [st * 3, 0],
          ],
          1.4,
        );
        shp(
          c,
          [
            [-2.5, -17],
            [2.5, -17],
            [2, -9],
            [-2, -9],
          ],
          col(c, [90, 160, 230]),
          1,
        );
        shp(
          c,
          [
            [-6.5, -17],
            [-2.5, -17],
            [-2.5, -10],
            [-6, -10],
          ],
          col(c, [255, 160, 60]),
          1,
        );
        circ(c, 0.5, -20, 2.6, col(c, [240, 200, 170]), 1);
        ln(
          c,
          [
            [2, -15],
            [6, -8],
            [7, 0],
          ],
          1,
        );
      });
      // and a dog running rings round them
      const dx = x + (Math.sin(c.t * 1.6) * 16 + 14 * r.dir) * c.s;
      const bounce = Math.abs(Math.sin(c.t * 9)) * 2;
      facing(c, dx, y - bounce * c.s, Math.cos(c.t * 1.6) * r.dir > 0 ? 1 : -1, () => {
        shp(
          c,
          [
            [-5, -6],
            [4, -6],
            [5, -3],
            [-5, -3],
          ],
          col(c, [230, 190, 120]),
          1,
        );
        circ(c, 6, -7, 2.2, col(c, [230, 190, 120]), 1);
        ln(
          c,
          [
            [-4, -3],
            [-5, 0],
          ],
          1,
        );
        ln(
          c,
          [
            [3, -3],
            [4, 0],
          ],
          1,
        );
        ln(
          c,
          [
            [-5, -5],
            [-8, -8 + Math.sin(c.t * 20) * 1.5],
          ],
          1,
        );
      });
    },
  },
  {
    name: "fox",
    places: ["mountain", "farm", "woods"],
    when: (c) => !day(c) || hashDay(c) > 0.4,
    weight: 1.8,
    dur: [10, 14],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * (GROUND[c.place].near - 0.008);
      const st = Math.sin(c.t * 10);
      pen(c, 1.1);
      facing(c, x, y, r.dir, () => {
        const fur = col(c, [232, 120, 50]);
        ln(
          c,
          [
            [-5, -5],
            [-5 + st * 2.5, 0],
          ],
          1.2,
        );
        ln(
          c,
          [
            [4, -5],
            [4 - st * 2.5, 0],
          ],
          1.2,
        );
        shp(
          c,
          [
            [-7, -9],
            [5, -9],
            [7, -6],
            [-7, -5],
          ],
          fur,
          1,
        );
        shp(
          c,
          [
            [-7, -8],
            [-15, -10],
            [-18, -6],
            [-12, -5],
          ],
          fur,
          1,
        );
        ln(
          c,
          [
            [-17, -8],
            [-18, -6],
          ],
          1.6,
        );
        shp(
          c,
          [
            [5, -9],
            [6, -13],
            [8, -11],
            [10, -12],
            [10, -9],
            [13, -7],
            [7, -6],
          ],
          fur,
          1,
        );
        if (night(c)) circ(c, 9.5, -9, 0.8, [255, 240, 150], 0);
      });
    },
  },
  {
    name: "rabbit",
    places: ["mountain", "farm", "woods"],
    when: (c) => !night(c),
    weight: 2,
    dur: [8, 12],
    draw(c, p, r) {
      const hop = Math.abs(Math.sin(c.t * 5));
      const x = across(c, p, r.dir, 20),
        y = c.h * (GROUND[c.place].near + 0.005) - hop * 7 * c.s;
      pen(c, 1);
      facing(c, x, y, r.dir, () => {
        const fur = snowy(c) ? ([255, 255, 255] as C) : col(c, [180, 160, 140]);
        ell(c, 0, -4, 5, 3.6, fur, 1);
        circ(c, 4.5, -7, 2.4, fur, 1);
        ell(c, 4, -11.5, 0.9, 3, fur, 0.9, -0.2);
        ell(c, 5.8, -11, 0.9, 3, fur, 0.9, 0.2);
        circ(c, -5, -4.5, 1.4, [255, 255, 255], 0.8);
      });
    },
  },
  {
    name: "eagle",
    places: ["mountain", "coast", "woods"],
    when: (c) => day(c),
    weight: 1.2,
    dur: [9, 12],
    draw(c, p, r) {
      // glides down in a long swoop and back up
      const x = across(c, p, r.dir, 30),
        y = c.h * (0.2 + 0.25 * Math.sin(p * Math.PI));
      const f = Math.sin(c.t * 3) * 2;
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-14, -2 - f],
            [-4, -1],
            [0, 0],
            [4, -1],
            [14, -2 - f],
            [4, 1],
            [-4, 1],
          ],
          col(c, [92, 64, 44]),
          1,
        );
        circ(c, 3, -0.5, 1.8, [255, 255, 255], 0.9);
        shp(
          c,
          [
            [-3, 0],
            [-8, 2],
            [-3, 2],
          ],
          [255, 255, 255],
          0.9,
        );
      });
    },
  },

  // -------------------------------------------------------------- the coast
  {
    name: "whale",
    places: ["coast"],
    when: (c) => !night(c) && c.weather !== "storm",
    weight: 2.5,
    dur: [12, 15],
    draw(c, p, r) {
      const G = GROUND.coast;
      const x = c.w * (0.15 + 0.7 * r.y),
        y = c.h * (G.sea![0] + 0.012);
      pen(c, 1.2);
      // a spout, then the back rolling, then the tail
      if (p < 0.35) {
        const q = p / 0.35;
        c.g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - q)})`;
        for (let i = -2; i <= 2; i++)
          line(
            c,
            [
              [x, y],
              [x + i * 4 * c.s * q, y - (14 + 4 * (2 - Math.abs(i))) * c.s * ease(Math.min(1, q * 2))],
            ],
            1.4,
          );
        pen(c, 1.2);
        shape(
          c,
          [
            [x - 12 * c.s, y + 1],
            [x - 4 * c.s, y - 3 * c.s],
            [x + 6 * c.s, y - 2 * c.s],
            [x + 10 * c.s, y + 1],
          ],
          col(c, [70, 92, 120]),
          1.1,
        );
      } else if (p < 0.65) {
        const q = (p - 0.35) / 0.3;
        const bx = x + r.dir * q * 14 * c.s;
        const hh = Math.sin(q * Math.PI) * 5 * c.s;
        shape(
          c,
          [
            [bx - 14 * c.s, y + 1],
            [bx - 4 * c.s, y - hh],
            [bx + 8 * c.s, y - hh * 0.6],
            [bx + 12 * c.s, y + 1],
          ],
          col(c, [70, 92, 120]),
          1.1,
        );
      } else {
        const q = (p - 0.65) / 0.35;
        const tx = x + r.dir * 18 * c.s;
        const rise = Math.sin(Math.min(1, q * 1.2) * Math.PI) * 14 * c.s;
        if (rise > 0.5) {
          shape(
            c,
            [
              [tx - 2 * c.s, y + 1],
              [tx - 1.5 * c.s, y - rise + 4 * c.s],
              [tx - 9 * c.s, y - rise],
              [tx, y - rise + 2.5 * c.s],
              [tx + 9 * c.s, y - rise],
              [tx + 1.5 * c.s, y - rise + 4 * c.s],
              [tx + 2 * c.s, y + 1],
            ],
            col(c, [70, 92, 120]),
            1.1,
          );
        }
        c.g.strokeStyle = "rgba(255,255,255,0.8)";
        line(
          c,
          [
            [tx - 10 * c.s, y + 2 * c.s],
            [tx + 10 * c.s, y + 2 * c.s],
          ],
          1,
        );
      }
    },
  },
  {
    name: "dolphins",
    places: ["coast"],
    when: (c) => !night(c),
    weight: 2.5,
    dur: [9, 12],
    draw(c, p, r) {
      const G = GROUND.coast;
      for (let i = 0; i < 3; i++) {
        const q = (p * 3.2 - i * 0.25) % 1;
        if (q < 0 || p * 3.2 - i * 0.25 < 0) continue;
        const base = across(c, clamp01(p + i * 0.04), r.dir, 20);
        const x = base + r.dir * (q - 0.5) * 26 * c.s,
          y = c.h * (G.sea![0] + 0.025) - Math.sin(q * Math.PI) * 13 * c.s;
        const ang = Math.cos(q * Math.PI) * 0.9;
        pen(c, 1.1);
        c.g.save();
        c.g.translate(x, y);
        c.g.rotate(-ang * r.dir);
        c.g.scale(r.dir * c.s, c.s);
        shp(
          c,
          [
            [-9, 0],
            [-3, -3],
            [5, -2.5],
            [10, 0],
            [5, 1.5],
            [-3, 2],
          ],
          col(c, [120, 140, 170]),
          1,
        );
        shp(
          c,
          [
            [-1, -3],
            [1, -7],
            [3, -2.5],
          ],
          col(c, [120, 140, 170]),
          0.9,
        );
        shp(
          c,
          [
            [-9, 0],
            [-13, -3],
            [-12, 0],
            [-13, 3],
          ],
          col(c, [120, 140, 170]),
          0.9,
        );
        c.g.restore();
      }
    },
  },
  {
    name: "surfer",
    places: ["coast"],
    when: (c) => day(c) && c.weather !== "storm",
    weight: 2,
    dur: [10, 14],
    draw(c, p, r) {
      const G = GROUND.coast;
      const x = across(c, p, r.dir, 30),
        y = c.h * (G.sea![1] - 0.004) + Math.sin(c.t * 2.2) * 2 * c.s;
      pen(c, 1.2);
      // the wave curling behind them
      c.g.strokeStyle = "rgba(255,255,255,0.95)";
      line(
        c,
        [
          [x - r.dir * 30 * c.s, y + 3 * c.s],
          [x - r.dir * 14 * c.s, y - 6 * c.s],
          [x - r.dir * 8 * c.s, y - 8 * c.s],
          [x - r.dir * 5 * c.s, y - 5 * c.s],
        ],
        1.6,
      );
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-9, 2],
            [8, 1],
            [10, 2],
            [8, 3.5],
            [-9, 3.5],
          ],
          col(c, [255, 220, 90]),
          1,
        );
        ln(
          c,
          [
            [-3, 1.5],
            [-1, -5],
          ],
          1.3,
        );
        ln(
          c,
          [
            [3, 1.5],
            [1, -5],
          ],
          1.3,
        );
        shp(
          c,
          [
            [-2, -5],
            [2, -5],
            [1.5, -11],
            [-1.5, -11],
          ],
          col(c, [255, 94, 87]),
          1,
        );
        ln(
          c,
          [
            [-1, -10],
            [-7, -9],
          ],
          1.1,
        );
        ln(
          c,
          [
            [1, -10],
            [7, -12],
          ],
          1.1,
        );
        circ(c, 0, -13.5, 2.3, col(c, [210, 160, 120]), 1);
      });
    },
  },
  {
    name: "crab",
    places: ["coast"],
    when: (c) => !snowy(c),
    weight: 2,
    dur: [12, 16],
    draw(c, p, r) {
      const G = GROUND.coast;
      const x = across(c, p, r.dir, 20) + Math.sin(c.t * 1.3) * 4 * c.s,
        y = c.h * (G.sand![0] + 0.03);
      const st = Math.sin(c.t * 14) * 1.2;
      pen(c, 1);
      facing(c, x, y, 1, () => {
        for (let i = -1; i <= 1; i++) {
          ln(
            c,
            [
              [-4, -3 + i],
              [-8, -1 + i + st],
            ],
            0.9,
          );
          ln(
            c,
            [
              [4, -3 + i],
              [8, -1 + i - st],
            ],
            0.9,
          );
        }
        ell(c, 0, -4, 5, 3, col(c, [232, 92, 64]), 1);
        circ(c, -6, -8, 1.8, col(c, [232, 92, 64]), 0.9);
        circ(c, 6, -8, 1.8, col(c, [232, 92, 64]), 0.9);
        ln(
          c,
          [
            [-1.5, -6.5],
            [-1.5, -9],
          ],
          0.8,
        );
        ln(
          c,
          [
            [1.5, -6.5],
            [1.5, -9],
          ],
          0.8,
        );
      });
    },
  },
  {
    name: "ship",
    places: ["coast"],
    when: (c) => c.weather !== "fog",
    weight: 2,
    dur: [50, 70],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 40),
        y = c.h * GROUND.coast.horizon;
      pen(c, 1, 0.75);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-22, -3],
            [20, -3],
            [16, 2],
            [-20, 2],
          ],
          col(c, [70, 82, 104], 0.3),
          0.9,
        );
        const box: C[] = [
          [255, 94, 87],
          [90, 160, 230],
          [255, 220, 90],
          [120, 200, 120],
        ];
        for (let i = 0; i < 6; i++)
          shp(
            c,
            [
              [-16 + i * 5, -3],
              [-12 + i * 5, -3],
              [-12 + i * 5, -6],
              [-16 + i * 5, -6],
            ],
            col(c, box[i % 4], 0.3),
            0.6,
          );
        shp(
          c,
          [
            [13, -3],
            [18, -3],
            [18, -9],
            [13, -9],
          ],
          col(c, [255, 253, 246], 0.3),
          0.8,
        );
        if (c.I.lit) circ(c, 15.5, -7, 0.8, [255, 210, 120], 0);
      });
      c.g.globalAlpha = 1;
    },
  },
  {
    name: "jet-ski",
    places: ["coast"],
    when: (c) => day(c) && warmSeason(c),
    weight: 1,
    dur: [7, 9],
    draw(c, p, r) {
      const G = GROUND.coast;
      const x = across(c, p, r.dir, 30),
        y = c.h * (G.sea![0] + 0.03) + Math.sin(c.t * 9) * 1.2 * c.s;
      pen(c, 1.1);
      c.g.strokeStyle = "rgba(255,255,255,0.9)";
      line(
        c,
        [
          [x - r.dir * 8 * c.s, y + 1 * c.s],
          [x - r.dir * 40 * c.s, y + 2 * c.s],
        ],
        1.4,
      );
      line(
        c,
        [
          [x - r.dir * 10 * c.s, y - 1 * c.s],
          [x - r.dir * 16 * c.s, y - 6 * c.s],
        ],
        1,
      );
      pen(c, 1.1);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-7, 0],
            [6, -1],
            [9, 1],
            [-7, 2],
          ],
          col(c, [255, 220, 90]),
          1,
        );
        ln(
          c,
          [
            [-1, -1],
            [1, -8],
          ],
          1.3,
        );
        circ(c, 1, -10, 2, col(c, [210, 160, 120]), 0.9);
        ln(
          c,
          [
            [1, -7],
            [5, -4],
          ],
          1,
        );
      });
    },
  },
  {
    name: "beach-dog",
    places: ["coast"],
    when: (c) => !night(c) && !snowy(c),
    weight: 1.8,
    dur: [10, 13],
    draw(c, p, r) {
      const G = GROUND.coast;
      const x = across(c, p, r.dir, 30),
        y = c.h * (G.sand![0] + 0.05);
      const run = c.t * 14;
      const bounce = Math.abs(Math.sin(run)) * 2.5;
      // a frisbee just ahead of it
      const fx = x + r.dir * (26 + Math.sin(c.t) * 4) * c.s,
        fy = y - (18 + Math.sin(p * Math.PI) * 10) * c.s;
      pen(c, 1);
      ellipse(c, fx, fy, 5 * c.s, 1.6 * c.s, col(c, [255, 94, 87]), 1);
      facing(c, x, y - bounce * c.s, r.dir, () => {
        const fur = col(c, [150, 100, 64]);
        ln(
          c,
          [
            [-5, -4],
            [-7 + Math.sin(run) * 3, 0],
          ],
          1.3,
        );
        ln(
          c,
          [
            [4, -4],
            [6 - Math.sin(run) * 3, 0],
          ],
          1.3,
        );
        shp(
          c,
          [
            [-7, -9],
            [5, -9],
            [7, -5],
            [-6, -4],
          ],
          fur,
          1,
        );
        shp(
          c,
          [
            [5, -9],
            [7, -13],
            [12, -12],
            [12, -9],
            [7, -7],
          ],
          fur,
          1,
        );
        ln(
          c,
          [
            [7, -12],
            [6, -9],
          ],
          1.2,
        );
        ln(
          c,
          [
            [-7, -8],
            [-11, -11],
          ],
          1.2,
        );
      });
    },
  },

  // -------------------------------------------------------------- the farm
  {
    name: "pickup",
    places: ["farm"],
    when: () => true,
    weight: 3,
    dur: [9, 12],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 40),
        y = c.h * GROUND.farm.road! + Math.sin(c.t * 18) * 0.5 * c.s;
      pen(c, 1.2);
      const paint: C = (
        [
          [90, 160, 230],
          [255, 94, 87],
          [120, 200, 120],
          [255, 220, 90],
        ] as C[]
      )[Math.floor(r.seed * 4)];
      // a cloud of road dust behind it
      for (let i = 0; i < 5; i++) {
        c.g.fillStyle = `rgba(210,195,160,${0.35 - i * 0.06})`;
        c.g.beginPath();
        c.g.arc(x - r.dir * (18 + i * 7) * c.s, y - (3 + i) * c.s, (3 + i * 1.5) * c.s, 0, TAU);
        c.g.fill();
      }
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-16, -3],
            [-16, -9],
            [0, -9],
            [3, -15],
            [11, -15],
            [15, -9],
            [17, -8],
            [17, -3],
          ],
          col(c, paint),
          1.2,
        );
        shp(
          c,
          [
            [4, -14],
            [10, -14],
            [13, -9.5],
            [2, -9.5],
          ],
          col(c, [200, 230, 250]),
          0.9,
        );
        if (c.I.lit) {
          c.g.fillStyle = "rgba(255,240,180,0.35)";
          c.g.beginPath();
          c.g.moveTo(17, -6);
          c.g.lineTo(40, -10);
          c.g.lineTo(40, 0);
          c.g.fill();
        }
        const spin = c.t * 12;
        for (const wx of [-10, 10]) {
          circ(c, wx, -2, 3.2, c.I.inkC, 0);
          ln(
            c,
            [
              [wx + Math.cos(spin) * 1.5, -2 + Math.sin(spin) * 1.5],
              [wx - Math.cos(spin) * 1.5, -2 - Math.sin(spin) * 1.5],
            ],
            0.8,
          );
        }
      });
      c.g.strokeStyle = c.I.ink;
    },
  },
  {
    name: "combine",
    places: ["farm"],
    when: (c) => day(c) && (c.season === "autumn" || c.season === "summer"),
    weight: 2,
    dur: [26, 32],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 50),
        y = c.h * 0.86;
      pen(c, 1.2);
      // chaff blowing out the back
      for (let i = 0; i < 8; i++) {
        const q = (c.t * 1.5 + i / 8) % 1;
        c.g.fillStyle = `rgba(230,200,110,${0.7 * (1 - q)})`;
        c.g.fillRect(
          x - r.dir * (16 + q * 22) * c.s,
          y - (16 - q * 6 + Math.sin(i * 3) * 3) * c.s,
          1.6 * c.s,
          1.6 * c.s,
        );
      }
      facing(c, x, y, r.dir, () => {
        const g1 = col(c, [120, 200, 120]);
        shp(
          c,
          [
            [-14, -4],
            [-14, -16],
            [4, -16],
            [6, -22],
            [12, -22],
            [12, -4],
          ],
          g1,
          1.2,
        );
        shp(
          c,
          [
            [6, -21],
            [11, -21],
            [11, -16],
            [6, -16],
          ],
          col(c, [200, 230, 250]),
          0.9,
        );
        shp(
          c,
          [
            [12, -10],
            [22, -10],
            [24, -3],
            [12, -3],
          ],
          col(c, [255, 220, 90]),
          1,
        );
        const sp = c.t * 5;
        for (let i = 0; i < 4; i++)
          ln(
            c,
            [
              [18, -6.5],
              [18 + Math.cos(sp + (i * Math.PI) / 2) * 3.4, -6.5 + Math.sin(sp + (i * Math.PI) / 2) * 3.4],
            ],
            0.8,
          );
        ln(
          c,
          [
            [-14, -14],
            [-20, -18],
          ],
          1.6,
        );
        circ(c, -8, -3, 4, c.I.inkC, 0);
        circ(c, 7, -2.5, 2.8, c.I.inkC, 0);
      });
    },
  },
  {
    name: "crop-duster",
    places: ["farm"],
    when: (c) => day(c) && warmSeason(c) && calm(c),
    weight: 1.5,
    dur: [8, 10],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 40),
        y = c.h * (0.66 + 0.08 * Math.sin(p * Math.PI));
      for (let i = 0; i < 10; i++) {
        const q = p - i * 0.012;
        if (q < 0) break;
        c.g.fillStyle = `rgba(255,255,255,${0.4 - i * 0.035})`;
        c.g.beginPath();
        c.g.arc(
          across(c, q, r.dir, 40),
          c.h * (0.66 + 0.08 * Math.sin(q * Math.PI)) + (4 + i * 1.6) * c.s,
          (2 + i * 0.8) * c.s,
          0,
          TAU,
        );
        c.g.fill();
      }
      pen(c, 1.1);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-10, 0],
            [8, -1.5],
            [11, 0],
            [8, 2],
            [-10, 1.5],
          ],
          col(c, [255, 220, 90]),
          1,
        );
        shp(
          c,
          [
            [-2, -4],
            [4, -4],
            [4, -2.5],
            [-2, -2.5],
          ],
          col(c, [255, 220, 90]),
          0.9,
        );
        shp(
          c,
          [
            [-2, 3],
            [4, 3],
            [4, 4.5],
            [-2, 4.5],
          ],
          col(c, [255, 220, 90]),
          0.9,
        );
        ln(
          c,
          [
            [1, -2.5],
            [1, 3],
          ],
          0.8,
        );
        shp(
          c,
          [
            [-10, 0],
            [-12, -4],
            [-9, -4],
            [-7, 0],
          ],
          col(c, [255, 94, 87]),
          0.9,
        );
        const prop = Math.sin(c.t * 40) * 3;
        ln(
          c,
          [
            [11.5, -prop],
            [11.5, prop],
          ],
          1,
        );
      });
    },
  },
  {
    name: "horse",
    places: ["farm"],
    when: (c) => !night(c),
    weight: 2,
    dur: [9, 12],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * 0.855;
      const g = c.t * 9;
      const bob = Math.sin(g * 2) * 1.2;
      pen(c, 1.1);
      facing(c, x, y + bob * c.s, r.dir, () => {
        const coat: C = col(c, r.seed > 0.5 ? [120, 80, 54] : [240, 236, 228]);
        ln(
          c,
          [
            [-8, -10],
            [-11 + Math.sin(g) * 5, 0],
          ],
          1.4,
        );
        ln(
          c,
          [
            [-6, -10],
            [-4 - Math.sin(g) * 5, 0],
          ],
          1.4,
        );
        ln(
          c,
          [
            [6, -10],
            [3 + Math.sin(g + 1) * 5, 0],
          ],
          1.4,
        );
        ln(
          c,
          [
            [8, -10],
            [11 - Math.sin(g + 1) * 5, 0],
          ],
          1.4,
        );
        shp(
          c,
          [
            [-11, -11],
            [-9, -17],
            [8, -17],
            [11, -12],
            [8, -9],
            [-9, -9],
          ],
          coat,
          1.1,
        );
        shp(
          c,
          [
            [7, -16],
            [12, -23],
            [17, -21],
            [16, -18],
            [12, -17],
            [10, -12],
          ],
          coat,
          1,
        );
        ln(
          c,
          [
            [7, -16],
            [11, -23],
          ],
          1.6,
        );
        ln(
          c,
          [
            [-11, -15],
            [-16, -12 + Math.sin(g) * 2],
          ],
          1.6,
        );
      });
    },
  },
  {
    name: "school-bus",
    places: ["farm", "suburb"],
    when: (c) => day(c) && ((c.hour > 7 && c.hour < 9) || (c.hour > 14.5 && c.hour < 16.5)),
    weight: 4,
    dur: [12, 15],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 50),
        y = c.h * GROUND[c.place].road! + Math.sin(c.t * 14) * 0.5 * c.s;
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-24, -3],
            [-24, -16],
            [14, -16],
            [16, -12],
            [22, -10],
            [22, -3],
          ],
          col(c, [255, 200, 40]),
          1.2,
        );
        for (let i = 0; i < 6; i++)
          shp(
            c,
            [
              [-21 + i * 6, -14],
              [-17 + i * 6, -14],
              [-17 + i * 6, -10],
              [-21 + i * 6, -10],
            ],
            col(c, [200, 230, 250]),
            0.8,
          );
        ln(
          c,
          [
            [-24, -7],
            [22, -7],
          ],
          0.8,
        );
        circ(c, -15, -2, 3.2, c.I.inkC, 0);
        circ(c, 13, -2, 3.2, c.I.inkC, 0);
      });
    },
  },
  {
    name: "farm-dog",
    places: ["farm"],
    when: (c) => !night(c),
    weight: 1.5,
    dur: [8, 10],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * (GROUND.farm.road! + 0.04);
      const run = c.t * 14;
      pen(c, 1);
      facing(c, x, y - Math.abs(Math.sin(run)) * 2 * c.s, r.dir, () => {
        const fur = col(c, [40, 36, 40]);
        ln(
          c,
          [
            [-5, -4],
            [-7 + Math.sin(run) * 3, 0],
          ],
          1.3,
        );
        ln(
          c,
          [
            [4, -4],
            [6 - Math.sin(run) * 3, 0],
          ],
          1.3,
        );
        shp(
          c,
          [
            [-7, -9],
            [5, -9],
            [7, -5],
            [-6, -4],
          ],
          fur,
          1,
        );
        ell(c, 1, -6.5, 3, 2, [255, 255, 255], 0);
        shp(
          c,
          [
            [5, -9],
            [7, -13],
            [12, -12],
            [12, -9],
            [7, -7],
          ],
          fur,
          1,
        );
        ln(
          c,
          [
            [-7, -8],
            [-11, -11 + Math.sin(c.t * 20)],
          ],
          1.2,
        );
      });
    },
  },
  // -------------------------------------------------------------- the city
  {
    name: "cyclist",
    places: ["city", "suburb"],
    when: (c) => dry(c) && !night(c),
    weight: 3,
    dur: [9, 12],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * GROUND[c.place].near;
      const spin = c.t * 9;
      const shirt: C = (
        [
          [255, 94, 87],
          [120, 200, 120],
          [90, 160, 230],
          [255, 220, 90],
        ] as C[]
      )[Math.floor(r.seed * 4)];
      pen(c, 1.1);
      facing(c, x, y, r.dir, () => {
        for (const wx of [-8, 8]) {
          circ(c, wx, -5, 5, null, 1.1);
          ln(
            c,
            [
              [wx + Math.cos(spin) * 5, -5 + Math.sin(spin) * 5],
              [wx - Math.cos(spin) * 5, -5 - Math.sin(spin) * 5],
            ],
            0.6,
          );
        }
        ln(
          c,
          [
            [-8, -5],
            [-2, -13],
            [6, -13],
            [8, -5],
          ],
          1.1,
        );
        ln(
          c,
          [
            [-2, -13],
            [0, -5],
            [6, -13],
          ],
          1,
        );
        ln(
          c,
          [
            [6, -13],
            [7, -16],
            [9, -16],
          ],
          1,
        );
        // rider: legs pedalling, body leaning over the bars
        const k = Math.sin(spin) * 2.5;
        ln(
          c,
          [
            [-3, -15],
            [0 + k, -9],
            [0 + k * 0.6, -5],
          ],
          1.4,
        );
        shp(
          c,
          [
            [-4, -15],
            [5, -21],
            [7, -19],
            [-2, -13],
          ],
          col(c, shirt),
          1,
        );
        ln(
          c,
          [
            [5, -20],
            [8, -16],
          ],
          1.2,
        );
        circ(c, 6.5, -24, 2.6, col(c, [236, 196, 160]), 1);
        shp(
          c,
          [
            [3.5, -25],
            [6.5, -28],
            [9.5, -25],
          ],
          col(c, [70, 80, 100]),
          0.9,
        );
      });
      c.g.strokeStyle = c.I.ink;
    },
  },
  {
    name: "ice-cream-truck",
    places: ["city", "suburb"],
    when: (c) => day(c) && dry(c) && (c.season === "summer" || c.season === "spring"),
    weight: 2,
    dur: [14, 18],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 50),
        y = c.h * GROUND[c.place].road! + 6 * c.s + Math.sin(c.t * 14) * 0.4 * c.s;
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-22, -3],
            [-22, -24],
            [10, -24],
            [10, -14],
            [20, -12],
            [22, -8],
            [22, -3],
          ],
          col(c, [250, 248, 240]),
          1.2,
        );
        shp(
          c,
          [
            [11, -22],
            [11, -15],
            [19, -13.5],
            [15, -22],
          ],
          col(c, [200, 230, 250]),
          0.9,
        );
        // pink stripe, serving window, a cone on the roof
        shp(
          c,
          [
            [-22, -9],
            [10, -9],
            [10, -6],
            [-22, -6],
          ],
          col(c, [255, 160, 190]),
          0.9,
        );
        shp(
          c,
          [
            [-17, -20],
            [3, -20],
            [3, -12],
            [-17, -12],
          ],
          col(c, [255, 220, 150]),
          0.9,
        );
        shp(
          c,
          [
            [-9, -24],
            [-6, -33],
            [-3, -24],
          ],
          col(c, [226, 170, 100]),
          1,
        );
        circ(c, -6, -33.5, 3.2, col(c, [255, 160, 190]), 1);
        const spin = c.t * 12;
        for (const wx of [-13, 13]) {
          circ(c, wx, -2, 3.6, c.I.inkC, 0);
          ln(
            c,
            [
              [wx + Math.cos(spin) * 1.6, -2 + Math.sin(spin) * 1.6],
              [wx - Math.cos(spin) * 1.6, -2 - Math.sin(spin) * 1.6],
            ],
            0.8,
          );
        }
      });
      // its little tune, as notes floating up
      for (let i = 0; i < 3; i++) {
        const q = (c.t * 0.6 + i / 3) % 1;
        c.g.globalAlpha = Math.sin(q * Math.PI) * 0.9;
        c.g.font = hand(11 * c.s);
        c.g.fillStyle = css(c.I.inkC);
        c.g.fillText(i % 2 ? "\u266A" : "\u266B", x + (i - 1) * 9 * c.s - r.dir * 10 * c.s, y - (38 + q * 22) * c.s);
      }
      c.g.globalAlpha = 1;
      c.g.strokeStyle = c.I.ink;
    },
  },
  {
    name: "city-bus",
    places: ["city"],
    when: () => true,
    weight: 3,
    dur: [11, 14],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 60),
        y = c.h * GROUND.city.road! - 3 * c.s;
      pen(c, 1.2);
      facing(c, x, y, r.dir, () => {
        shp(
          c,
          [
            [-36, -3],
            [-36, -22],
            [34, -22],
            [36, -18],
            [36, -3],
          ],
          col(c, [90, 160, 230]),
          1.2,
        );
        shp(
          c,
          [
            [-36, -9],
            [36, -9],
            [36, -6],
            [-36, -6],
          ],
          col(c, [255, 220, 90]),
          0.8,
        );
        for (let i = 0; i < 6; i++)
          shp(
            c,
            [
              [-32 + i * 10, -19],
              [-25 + i * 10, -19],
              [-25 + i * 10, -12],
              [-32 + i * 10, -12],
            ],
            c.I.lit ? c.I.window : col(c, [200, 230, 250]),
            0.8,
          );
        shp(
          c,
          [
            [29, -20],
            [35, -20],
            [35, -9],
            [29, -9],
          ],
          col(c, [200, 230, 250]),
          0.8,
        );
        const spin = c.t * 10;
        for (const wx of [-24, 22]) {
          circ(c, wx, -2, 3.8, c.I.inkC, 0);
          ln(
            c,
            [
              [wx + Math.cos(spin) * 1.7, -2 + Math.sin(spin) * 1.7],
              [wx - Math.cos(spin) * 1.7, -2 - Math.sin(spin) * 1.7],
            ],
            0.8,
          );
        }
      });
      c.g.strokeStyle = c.I.ink;
    },
  },
  // ------------------------------------------------------------ the desert
  {
    name: "roadrunner",
    places: ["desert"],
    when: (c) => !night(c),
    weight: 3,
    dur: [4, 6],
    draw(c, p, r) {
      const x = across(c, p, r.dir, 30),
        y = c.h * GROUND.desert.near;
      const run = Math.sin(c.t * 30);
      pen(c, 1);
      // a little dust behind it
      for (let i = 0; i < 4; i++) {
        c.g.fillStyle = `rgba(220,200,160,${0.4 - i * 0.09})`;
        c.g.beginPath();
        c.g.arc(x - r.dir * (12 + i * 6) * c.s, y - 2 * c.s, (2 + i) * c.s, 0, TAU);
        c.g.fill();
      }
      facing(c, x, y, r.dir, () => {
        ln(
          c,
          [
            [-2, -7],
            [-4 + run * 3, 0],
          ],
          1,
        );
        ln(
          c,
          [
            [1, -7],
            [3 - run * 3, 0],
          ],
          1,
        );
        shp(
          c,
          [
            [-14, -14],
            [-4, -8],
            [6, -9],
            [9, -13],
            [4, -14],
            [-4, -12],
          ],
          col(c, [150, 130, 110]),
          1,
        );
        shp(
          c,
          [
            [5, -13],
            [9, -18],
            [13, -17],
            [12, -14],
          ],
          col(c, [150, 130, 110]),
          1,
        );
        ln(
          c,
          [
            [12, -16],
            [18, -15.5],
          ],
          1.1,
        );
        ln(
          c,
          [
            [8, -18],
            [6, -22],
            [9, -19],
          ],
          0.9,
        );
        circ(c, 10.5, -16.2, 0.8, c.I.inkC, 0);
      });
      c.g.strokeStyle = c.I.ink;
    },
  },
  {
    name: "coyote",
    places: ["desert"],
    when: (c) => night(c),
    weight: 2,
    dur: [12, 16],
    draw(c, p, r) {
      // trots in, stops on a rise, howls, trots off
      const stop = p > 0.35 && p < 0.7;
      const q = p < 0.35 ? p / 0.35 / 2 : p > 0.7 ? 0.5 + (p - 0.7) / 0.3 / 2 : 0.5;
      const x = across(c, q, r.dir, 30),
        y = c.h * GROUND.desert.near - 6 * c.s;
      const step = stop ? 0 : Math.sin(c.t * 12);
      pen(c, 1);
      const fur = col(c, [176, 150, 120]);
      facing(c, x, y, r.dir, () => {
        for (const [lx, ph] of [
          [-9, 0],
          [-6, 1],
          [6, 1],
          [9, 0],
        ] as [number, number][])
          ln(
            c,
            [
              [lx, -8],
              [lx + (ph ? step : -step) * 2, 0],
            ],
            1.1,
          );
        shp(
          c,
          [
            [-12, -12],
            [8, -13],
            [10, -8],
            [-10, -7],
          ],
          fur,
          1,
        );
        ln(
          c,
          [
            [-12, -11],
            [-18, -8],
            [-20, -5],
          ],
          2,
        );
        const up = stop ? -6 : 0;
        shp(
          c,
          [
            [7, -12],
            [11, -18 + up],
            [14, -17 + up],
            [18, -15 + up * 1.3],
            [12, -11],
          ],
          fur,
          1,
        );
        ln(
          c,
          [
            [11, -18 + up],
            [11, -22 + up],
          ],
          1,
        );
        ln(
          c,
          [
            [13, -17.5 + up],
            [14, -21.5 + up],
          ],
          1,
        );
      });
      if (stop) {
        c.g.globalAlpha = Math.sin(((p - 0.35) / 0.35) * Math.PI);
        c.g.font = hand(12 * c.s);
        c.g.fillStyle = css(c.I.inkC);
        c.g.fillText("awoo", x + r.dir * 14 * c.s, y - 30 * c.s);
        c.g.globalAlpha = 1;
      }
      c.g.strokeStyle = c.I.ink;
    },
  },
];

// a coin flip that holds for the whole day, so some days are a bit different
function hashDay(c: Ctx) {
  const d = Math.floor(Date.now() / 864e5);
  return hash(d * 13.7 + c.place.length);
}

// ------------------------------------------------------------ the director
export class Moments {
  private runs: Run[] = [];
  private next = 4 + Math.random() * 6;
  private recent: string[] = [];
  private only: string | null = null;
  private busy = false;
  constructor() {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      this.only = q.get("event");
      this.busy = q.get("events") === "busy";
      if (this.busy || this.only) this.next = 0.3;
    }
  }

  step(c: Ctx) {
    const t = c.t;
    this.runs = this.runs.filter((r) => t - r.t0 < r.dur);
    // pick the next moment: something that suits here and now, and not one
    // we've just had
    const max = this.only ? 1 : this.busy ? 3 : 2;
    if (t >= this.next && this.runs.length < max) {
      const ok = DEFS.filter(
        (d) =>
          (!d.places || d.places.includes(c.place)) &&
          (this.only
            ? d.name === this.only
            : d.when(c) && !this.recent.includes(d.name) && !this.runs.some((r) => r.def === d)),
      );
      const total = ok.reduce((a, d) => a + d.weight, 0);
      if (total > 0) {
        let pick = Math.random() * total;
        const def = ok.find((d) => (pick -= d.weight) < 0) ?? ok[ok.length - 1];
        const dur = def.dur[0] + Math.random() * (def.dur[1] - def.dur[0]);
        this.runs.push({
          def,
          t0: t,
          dur,
          seed: Math.random(),
          dir: Math.random() < 0.5 ? 1 : -1,
          y: Math.random(),
        });
        this.recent = [def.name, ...this.recent].slice(0, Math.min(6, Math.max(1, ok.length - 1)));
      }
      this.next = t + (this.only ? 1.5 : this.busy ? 2 + Math.random() * 3 : 7 + Math.random() * 16);
    }
    for (const r of this.runs) {
      const age = t - r.t0;
      c.g.save();
      r.def.draw(c, clamp01(age / r.dur), r, age);
      c.g.restore();
      c.g.globalAlpha = 1;
    }
  }
}

export const MOMENTS = DEFS.map((d) => d.name);
