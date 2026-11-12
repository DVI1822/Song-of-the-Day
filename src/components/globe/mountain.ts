import { css, mix, type Inks, type Pen } from "./line";
import type { C } from "./setting";
import { TAU, curve, ellipse, fir, foliage, hash, lamp, loopWave, rect, windows, type Kit, type Pt } from "./worldkit";

// The mountains (Montana), drawn like the other worlds: one loop of eight
// scenes under a shared range of snowy peaks, a forested ridge and a meadow.
//
//   1 homestead: a cabin up on a knoll, a paddock, the river winding out
//   2 lake:      a still lake, a dock reaching out from our shore, a canoe
//   3 railway:   a trestle over a gully between two tunnels in the rock;
//                the train only ever runs on its rails, tunnel to tunnel
//   4 town:      a little main street of false-front shops, a white church,
//                the water tower up behind
//   5 canyon:    the river coming out of a red-rock gorge under a steel
//                truss bridge, the gravel road curving off toward us
//   6 ski hill:  runs cut down a forested hill, a chairlift, an A-frame lodge
//   7 falls:     a waterfall dropping between two cliffs, a footbridge
//   8 ranch:     a log gate, a horse barn, a corral with horses, hay bales
//
// Everything that moves keeps to its own ground: the deer graze only on dry
// meadow, the canoe stays on the lake, the train stays on its track.

// shares of the screen height
export const MTN = {
  ridge: 0.705, // the far forested ridge
  near: 0.755, // the near treeline
  edge: 0.79, // where the meadow starts
};

type Peak = [number, number, number]; // x (share of the scene), top (of h), half-width (of the scene)
const PEAKS: Peak[][] = [
  [
    [0.1, 0.5, 0.25],
    [0.38, 0.535, 0.17],
    [0.72, 0.47, 0.27],
  ],
  [
    [0.25, 0.52, 0.24],
    [0.6, 0.545, 0.2],
    [0.92, 0.5, 0.22],
  ],
  [
    [0.18, 0.53, 0.2],
    [0.5, 0.46, 0.26],
    [0.85, 0.55, 0.18],
  ],
  [
    [0.15, 0.55, 0.2],
    [0.46, 0.505, 0.25],
    [0.8, 0.53, 0.22],
  ],
  [
    [0.3, 0.555, 0.2],
    [0.75, 0.515, 0.24],
  ],
  [
    [0.1, 0.56, 0.16],
    [0.56, 0.45, 0.3],
  ],
  [
    [0.2, 0.5, 0.22],
    [0.6, 0.48, 0.22],
    [0.95, 0.55, 0.18],
  ],
  [
    [0.35, 0.53, 0.25],
    [0.75, 0.5, 0.22],
  ],
];

const ROCK: C = [176, 164, 156];
const RED_ROCK: C = [196, 116, 84];
const WOOD: C = [166, 112, 74];
const DARK_WOOD: C = [120, 80, 58];

function meadowY(k: Kit, x: number) {
  return k.h * (MTN.edge + 0.006 * loopWave(x, k.PW, 11));
}

// the range: every column takes the highest peak slope over it
function rangeY(k: Kit, x: number) {
  const { w, h, PW } = k;
  let y = h * (0.665 + 0.012 * loopWave(x, PW, 3));
  PEAKS.forEach((ps, i) =>
    ps.forEach(([fx, top, half]) => {
      for (const sh of [0, -PW, PW]) {
        const px = i * w + fx * w + sh,
          d = Math.abs(x - px) / (half * 1.55 * w);
        if (d >= 1.3) continue;
        const yy = h * top + (h * 0.72 - h * top) * (0.55 * d + 0.45 * d * d);
        if (yy < y) y = yy;
      }
    }),
  );
  // a little rock texture along the skyline
  return y + Math.sin(x * 0.37) * 0.9 + Math.sin(x * 0.11 + 2) * 1.6;
}

// little conifer tips along a treeline, filled down to the bottom
function treeline(pen: Pen, k: Kit, base: (x: number) => number, tip: number, fill: C, seed: number) {
  const { PW, h } = k;
  const pts: Pt[] = [[-8, base(-8)]];
  let x = -8,
    i = 0;
  while (x < PW + 8) {
    const tw = 5 + hash(i * 3.1 + seed) * 5;
    const ht = tip * (0.55 + hash(i * 7.7 + seed) * 0.7) * (hash(i + seed * 3) < 0.12 ? 1.45 : 1);
    pts.push([x, base(x)]);
    pts.push([x + tw / 2, base(x + tw / 2) - ht]);
    x += tw;
    i++;
  }
  pts.push([PW + 8, base(PW + 8)]);
  pen.fillOnly([...pts, [PW + 8, h + 8], [-8, h + 8]], fill);
  pen.stroke(pts, 1.1, seed);
}

// a cluster of aspens: white trunks, round crowns that turn gold in autumn
function aspens(pen: Pen, I: Inks, x: number, base: number, n: number, ht: number, seed: number) {
  const bark: C = I.paint([240, 238, 230], 0.04);
  for (let i = 0; i < n; i++) {
    const ax = x + (i - (n - 1) / 2) * ht * 0.32 + (hash(seed + i) - 0.5) * 4;
    const ah = ht * (0.8 + hash(seed * 2 + i) * 0.35);
    const ab = base + hash(seed * 5 + i) * 3;
    pen.shape(rect(ax - 1.3, ab - ah, 2.6, ah), bark, 0.9, seed + i);
    for (let j = 1; j < 4; j++)
      pen.stroke(
        [
          [ax - 1.3, ab - ah * (j / 4)],
          [ax, ab - ah * (j / 4) + 0.6],
        ],
        0.7,
        seed + i + j,
      );
    if (I.season === "winter") continue;
    const leaf =
      I.season === "autumn"
        ? I.paint(hash(seed + i * 1.3) > 0.3 ? [246, 200, 64] : [236, 160, 50], 0.04)
        : foliage(I, seed + i, 0.04, [134, 184, 90]);
    pen.shape(ellipse(ax, ab - ah, ht * 0.16, ht * 0.22, 14), leaf, 1, seed + i + 0.5);
  }
}

// a log cabin with a stone chimney; returns the chimney top for the smoke
function cabin(pen: Pen, I: Inks, x: number, base: number, cw: number, ch: number, seed: number): Pt {
  pen.shape(rect(x, base - ch, cw, ch), I.paint(WOOD, 0.04), 1.3, seed);
  for (let i = 1; i < 5; i++)
    pen.stroke(
      [
        [x, base - (ch * i) / 5],
        [x + cw, base - (ch * i) / 5],
      ],
      0.6,
      seed + i,
    );
  const chx = x + cw * 0.78,
    chTop = base - ch - ch * 0.95;
  pen.shape(rect(chx - 4, chTop, 8, ch * 0.7), I.paint(ROCK, 0.04), 1.1, seed + 8);
  pen.shape(
    [
      [x - 6, base - ch],
      [x + cw / 2, base - ch - ch * 0.75],
      [x + cw + 6, base - ch],
    ],
    I.paint([70, 82, 104], 0.04),
    1.3,
    seed + 7,
  );
  pen.shape(rect(x + cw * 0.42, base - ch * 0.68, cw * 0.16, ch * 0.68), I.paint(DARK_WOOD, 0.04), 1, seed + 9);
  for (const f of [0.12, 0.7])
    pen.shape(
      rect(x + cw * f, base - ch * 0.72, cw * 0.18, ch * 0.36),
      I.lit ? I.window : I.paint([200, 224, 240], 0.04),
      0.9,
      seed + f,
    );
  return [chx, chTop];
}

function fence(pen: Pen, I: Inks, x0: number, x1: number, y0: number, y1: number, post: number, seed: number) {
  const n = Math.max(2, Math.round((x1 - x0) / 16));
  const yAt = (x: number) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pen.stroke(
      [
        [x, yAt(x)],
        [x, yAt(x) - post],
      ],
      1.1,
      seed + i,
    );
  }
  for (const f of [0.4, 0.85])
    pen.stroke(
      [
        [x0, yAt(x0) - post * f],
        [x1, yAt(x1) - post * f],
      ],
      0.9,
      seed + f,
    );
  void I;
}

// a horse standing, drawn facing right (dir -1 faces left)
function horse(pen: Pen, x: number, base: number, s: number, coat: C, dir: number, seed: number) {
  const X = (dx: number) => x + dx * s * dir;
  for (const lx of [-5, -3.5, 4, 5.5])
    pen.stroke(
      [
        [X(lx), base - 6 * s],
        [X(lx), base],
      ],
      1,
      seed + lx,
    );
  pen.shape(ellipse(x, base - 7.5 * s, 7.5 * s, 3 * s, 16), coat, 1.1, seed);
  pen.shape(
    [
      [X(5.5), base - 9 * s],
      [X(8.5), base - 14.5 * s],
      [X(11.5), base - 13 * s],
      [X(11), base - 11.5 * s],
      [X(8.5), base - 11 * s],
      [X(7), base - 7 * s],
    ],
    coat,
    1.1,
    seed + 1,
  );
  pen.stroke(
    [
      [X(-7.3), base - 8.5 * s],
      [X(-9), base - 4 * s],
    ],
    1.3,
    seed + 2,
  );
}

// ---------------------------------------------------------------------------
// the land under all eight scenes
// ---------------------------------------------------------------------------

function ground(k: Kit) {
  const { pens, I, L, h, PW } = k;
  // far: the range, with snow down to one shared snowline
  const top: Pt[] = curve((x) => rangeY(k, x), -8, PW + 8, 3);
  pens[0].fillOnly([...top, [PW + 8, h + 8], [-8, h + 8]], I.fill[0]);
  const line = h * (0.53 + 0.05 * L.snowline + (I.snowy ? 0.03 : 0));
  const hem = (x: number) => line - Math.abs((((x / 7) % 2) + 2) % 2 - 1) * 6 + Math.sin(x * 0.21) * 2;
  let run: Pt[] = [],
    low: Pt[] = [];
  const flush = () => {
    if (run.length > 1) {
      pens[0].fillOnly([...run, ...low.slice().reverse()], I.snow);
      pens[0].stroke(low, 1, run[0][0]);
    }
    run = [];
    low = [];
  };
  for (const [x, y] of top) {
    const hy = hem(x);
    if (y < hy - 1) {
      run.push([x, y]);
      low.push([x, hy]);
    } else flush();
  }
  flush();
  // a spine down from each summit, on the shaded side
  const sunSide = L.sun[0] >= 0 ? 1 : -1;
  PEAKS.forEach((ps, i) =>
    ps.forEach(([fx, tp, half], j) => {
      const px = i * k.w + fx * k.w,
        py = h * tp;
      if (Math.abs(rangeY(k, px) - py) > 4) return;
      const dx = -sunSide * half * k.w * 0.18;
      pens[0].stroke(
        [
          [px, py + 2],
          [px + dx * 0.4, py + h * 0.03],
          [px + dx, py + h * 0.075],
        ],
        0.9,
        i * 7 + j,
      );
      pens[0].stroke(
        [
          [px + half * k.w * 0.3 * sunSide, py + h * 0.05],
          [px + half * k.w * 0.36 * sunSide, py + h * 0.1],
        ],
        0.7,
        i * 7 + j + 3,
      );
    }),
  );
  pens[0].stroke(top, 1.3, 1);
  // middle: the far forested ridge; near: the treeline above the meadow
  const tint = (c: C): C =>
    I.season === "autumn" ? mix(c, [150, 130, 70], 0.25) : I.snowy ? mix(c, [200, 210, 220], 0.35) : c;
  treeline(pens[1], k, (x) => h * (MTN.ridge + 0.012 * loopWave(x, PW, 7)), 9, tint(I.fill[1]), 3);
  treeline(pens[2], k, (x) => h * (MTN.near + 0.008 * loopWave(x, PW, 9)), 13, tint(I.fill[2]), 8);
  const edge = curve((x) => meadowY(k, x), -8, PW + 8, 8);
  pens[2].fillOnly([...edge, [PW + 8, h + 8], [-8, h + 8]], I.meadow);
  pens[2].stroke(edge, 1.3, 5);
  // tufts of grass, bigger as they come closer
  if (!I.snowy)
    for (let i = 0; i < PW / 22; i++) {
      const x = hash(i * 3.3 + 1) * PW,
        y = h * (MTN.edge + 0.03) + Math.pow(hash(i * 7.1 + 2), 0.7) * h * 0.18;
      const s = 0.6 + ((y - h * 0.8) / (h * 0.2)) * 1.4;
      pens[2].stroke(
        [
          [x - 2.4 * s, y - 3 * s],
          [x, y],
          [x + 2.4 * s, y - 3 * s],
        ],
        0.8,
        i,
      );
    }
}

// ---------------------------------------------------------------------------
// the scenes
// ---------------------------------------------------------------------------

// where things in the scenes stand, for the moving bits
const AT = {
  homestead: { knollTop: 0.745, cabin: 0.15 },
  lake: { cy: 0.838, rx: 0.4, ry: 0.034 },
  rail: { deck: 0.8, l: 0.21, r: 0.79 },
  ski: { base: [0.42, 0.728] as Pt, top: [0.66, 0.585] as Pt },
  falls: { lip: 0.69, pool: 0.865 },
};

function knollY(k: Kit, x0: number, x: number) {
  const d = (x - (x0 + k.w * 0.22)) / (k.w * 0.22);
  const m = meadowY(k, x);
  return Math.abs(d) < 1 ? m - (m - k.h * AT.homestead.knollTop) * Math.pow(Math.cos((d * Math.PI) / 2), 1.5) : m;
}

// the river in the homestead scene: from the meadow's edge, widening toward us
function riverAt(k: Kit, x0: number, y: number): [number, number] {
  const { w, h } = k;
  const t = Math.max(0, (y - h * 0.8) / (h * 0.2));
  const c = x0 + w * (0.66 + 0.18 * Math.pow(t, 1.2)) + Math.sin(t * 6) * 6;
  return [c, 2 + t * t * w * 0.11];
}

const SCENES = [
  // 1 homestead
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const pen = pens[2];
    const knoll = curve((x) => knollY(k, x0, x), x0 + w * 0.0, x0 + w * 0.44, 4);
    pen.fillOnly([...knoll, [x0 + w * 0.44, h * 0.83], [x0, h * 0.83]], I.meadow);
    pen.stroke(knoll, 1.3, 1);
    const cx = x0 + w * 0.12,
      cb = knollY(k, x0, x0 + w * 0.2) + 3;
    cabin(pen, I, cx, cb, w * 0.2, h * 0.04, 11);
    fence(pen, I, x0 + w * 0.34, x0 + w * 0.43, knollY(k, x0, x0 + w * 0.34) + 4, knollY(k, x0, x0 + w * 0.43) + 4, 7, 20);
    fir(pen, I, x0 + w * 0.05, knollY(k, x0, x0 + w * 0.05) + 6, h * 0.05, 13);
    aspens(pen, I, x0 + w * 0.5, h * 0.805, 3, h * 0.045, 17);
    // the river
    const left: Pt[] = [],
      right: Pt[] = [];
    for (let y = h * 0.8; y <= h + 4; y += 4) {
      const [c, hw] = riverAt(k, x0, y);
      left.push([c - hw, y]);
      right.push([c + hw, y]);
    }
    pen.fillOnly([...left, ...right.slice().reverse()], I.snowy ? mix(I.water, I.snow, 0.5) : I.water);
    pen.stroke(left, 1.3, 21);
    pen.stroke(right, 1.3, 22);
    fir(pen, I, x0 + w * 0.97, h * 0.985, h * 0.11, 23);
  },
  // 2 lake
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const pen = pens[2];
    const cx = x0 + w * 0.5,
      cy = h * AT.lake.cy,
      rx = w * AT.lake.rx,
      ry = h * AT.lake.ry;
    const frozen = I.snowy;
    pen.shape(ellipse(cx, cy, rx, ry, 40), frozen ? mix(I.water, I.snow, 0.7) : I.water, 1.3, 31);
    for (const [u, v, l] of [
      [-0.6, 0.2, 10],
      [-0.2, 0.5, 14],
      [0.25, 0.1, 8],
      [0.55, 0.45, 12],
    ])
      pen.stroke(
        [
          [cx + u * rx - l / 2, cy + v * ry],
          [cx + u * rx + l / 2, cy + v * ry],
        ],
        0.7,
        u,
      );
    // a dock from our shore, planks in perspective
    const d0 = cx + rx * 0.4,
      dy0 = cy + ry * 0.95;
    const deck: Pt[] = [
      [d0 - 7, dy0 + 10],
      [d0 + 11, dy0 + 10],
      [d0 + 14, cy - ry * 0.05],
      [d0 + 2, cy - ry * 0.05],
    ];
    for (const [px, py] of deck.slice(2)) pen.stroke([[px, py], [px, py + 6]], 1.1, px);
    pen.shape(deck, I.paint(WOOD, 0.04), 1.2, 33);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      pen.stroke(
        [
          [d0 - 7 + 9 * t, dy0 + 10 - (dy0 + 10 - (cy - ry * 0.05)) * t],
          [d0 + 11 + 3 * t, dy0 + 10 - (dy0 + 10 - (cy - ry * 0.05)) * t],
        ],
        0.5,
        i + 33,
      );
    }
    // rocks along our shore, firs at each end
    for (let i = 0; i < 5; i++) {
      const rx2 = cx - rx * 0.8 + i * rx * 0.3 + hash(i) * 10;
      if (Math.abs(rx2 - d0) < 20) continue;
      pen.shape(ellipse(rx2, cy + ry * 1.05, 5 + hash(i + 2) * 4, 3, 10, Math.PI, TAU), I.paint(ROCK, 0.04), 0.9, i + 40);
    }
    fir(pen, I, x0 + w * 0.06, h * 0.86, h * 0.09, 35);
    fir(pen, I, x0 + w * 0.94, h * 0.9, h * 0.12, 36);
  },
  // 3 railway
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const pen = pens[2];
    const deck = h * AT.rail.deck;
    // the gully under the trestle, a creek running down it toward us
    const gully = (x: number) => {
      const u = (x - (x0 + w * 0.5)) / (w * 0.29);
      return Math.abs(u) >= 1 ? meadowY(k, x) : meadowY(k, x) + h * 0.07 * Math.pow(Math.cos((u * Math.PI) / 2), 1.3);
    };
    const gl = curve(gully, x0 + w * 0.2, x0 + w * 0.8, 4);
    pen.fillOnly([...gl, [x0 + w * 0.8, h * 0.79], [x0 + w * 0.2, h * 0.79]], mix(I.meadow, [60, 80, 60], 0.18));
    pen.stroke(gl, 1.1, 51);
    const cTop = gully(x0 + w * 0.5);
    pen.shape(
      [
        [x0 + w * 0.5 - 3, cTop - 1],
        [x0 + w * 0.5 + 3, cTop - 1],
        [x0 + w * 0.6, h + 4],
        [x0 + w * 0.44, h + 4],
      ],
      I.snowy ? mix(I.water, I.snow, 0.5) : I.water,
      1.1,
      52,
    );
    // the trestle: legs from the deck to the gully floor, cross braces
    const xl = x0 + w * AT.rail.l,
      xr = x0 + w * AT.rail.r;
    for (let x = xl + 10; x < xr - 4; x += 14) {
      const yb = gully(x) + 1;
      if (yb < deck + 4) continue;
      pen.stroke(
        [
          [x, deck + 2],
          [x, yb],
        ],
        1.1,
        x,
      );
      // one cross brace per bay, just under the deck
      const xn = x + 14,
        ybn = gully(xn) + 1;
      if (xn < xr - 4 && ybn > deck + 10)
        pen.stroke(
          [
            [x, deck + 3],
            [xn, deck + Math.min(14, (Math.min(yb, ybn) - deck) * 0.6)],
          ],
          0.6,
          x + 1,
        );
    }
    pen.shape(rect(xl, deck, xr - xl, 3), I.paint(DARK_WOOD, 0.04), 1.2, 53);
    pen.stroke(
      [
        [xl, deck - 1],
        [xr, deck - 1],
      ],
      1.1,
      54,
    );
    // the bluffs at each end, each with a tunnel mouth at the rails
    for (const side of [-1, 1]) {
      const inner = side < 0 ? xl : xr,
        outer = side < 0 ? x0 + w * 0.02 : x0 + w * 0.98;
      const topY = h * 0.735;
      const bluff: Pt[] = [
        [outer - side * 6, meadowY(k, outer) + 2],
        [outer + (inner - outer) * 0.12, topY + 14],
        [outer + (inner - outer) * 0.3, topY + 2],
        [outer + (inner - outer) * 0.55, topY - 3],
        [outer + (inner - outer) * 0.8, topY + 6],
        [inner + side * 1, deck - 22],
        [inner, deck + 3],
      ];
      pen.fillOnly([...bluff, [inner, meadowY(k, inner) + 8], [outer - side * 6, meadowY(k, outer) + 8]], I.paint(ROCK, 0.04));
      pen.stroke(bluff, 1.3, 55 + side);
      for (let i = 0; i < 3; i++) {
        const fx = outer + (inner - outer) * (0.25 + i * 0.22);
        pen.stroke(
          [
            [fx, topY + 8 + i * 2],
            [fx + side * 3, topY + 22 + i * 3],
          ],
          0.7,
          i + 57,
        );
      }
      // the portal: an arch of dressed stone around the dark opening
      const pw = 16,
        ph = 17;
      const px = inner - side * (pw / 2 + 4);
      pen.shape(
        [...ellipse(px, deck - ph + pw / 2 + 2, pw / 2 + 3, pw / 2 + 3, 14, Math.PI, TAU), [px + pw / 2 + 3, deck + 1], [px - pw / 2 - 3, deck + 1]],
        I.paint([200, 190, 176], 0.04),
        1.1,
        59 + side,
      );
      pen.shape(
        [...ellipse(px, deck - ph + pw / 2 + 2, pw / 2, pw / 2, 14, Math.PI, TAU), [px + pw / 2, deck], [px - pw / 2, deck]],
        [34, 30, 38],
        1,
        61 + side,
      );
      fir(pen, I, outer + (inner - outer) * 0.45, topY + 2, h * 0.04, 63 + side);
    }
  },
  // 4 town
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const pen = pens[2];
    const base = h * 0.865;
    // the water tower, up on the slope behind town
    {
      const tx = x0 + w * 0.52,
        tb = meadowY(k, x0 + w * 0.52) + 2;
      for (const d of [-9, 9])
        pen.stroke(
          [
            [tx + d, tb],
            [tx + d * 0.6, tb - h * 0.045],
          ],
          1.1,
          d,
        );
      pen.stroke(
        [
          [tx - 8, tb - 4],
          [tx + 6, tb - h * 0.04],
        ],
        0.6,
        70,
      );
      pen.shape(rect(tx - 11, tb - h * 0.075, 22, h * 0.032), I.paint([200, 196, 186], 0.04), 1.1, 71);
      pen.shape(
        [
          [tx - 13, tb - h * 0.075],
          [tx, tb - h * 0.086],
          [tx + 13, tb - h * 0.075],
        ],
        I.paint([150, 90, 76], 0.04),
        1.1,
        72,
      );
    }
    // main street: false-front shops along a boardwalk
    const shops: [number, number, number, C][] = [
      [0.04, 0.12, 0.058, [190, 86, 70]],
      [0.16, 0.11, 0.07, [226, 190, 110]],
      [0.27, 0.13, 0.062, [104, 150, 150]],
      [0.4, 0.1, 0.075, [236, 230, 214]],
      [0.5, 0.11, 0.06, [150, 104, 80]],
    ];
    shops.forEach(([f, sw, sh, col], i) => {
      const sx = x0 + w * f,
        bw = w * sw,
        bh = h * sh;
      pen.shape(rect(sx, base - bh, bw, bh), I.paint(col, 0.04), 1.3, 80 + i);
      // the false front's cornice and a blank signboard
      pen.shape(rect(sx - 1, base - bh - 3, bw + 2, 3), I.paint(mix(col, [40, 40, 50], 0.3), 0.04), 1, 85 + i);
      pen.shape(rect(sx + bw * 0.15, base - bh + 4, bw * 0.7, bh * 0.16), I.paint([246, 240, 222], 0.04), 0.9, 90 + i);
      windows(pen, I, sx + bw * 0.08, base - bh * 0.62, bw * 0.84, bh * 0.22, 2, 1, 95 + i, I.paint([200, 224, 240], 0.04));
      pen.shape(rect(sx + bw * 0.4, base - bh * 0.34, bw * 0.2, bh * 0.34), I.paint(DARK_WOOD, 0.04), 1, 100 + i);
    });
    // the porch roof along the fronts, on posts
    const px0 = x0 + w * 0.04,
      px1 = x0 + w * 0.61;
    pen.shape(rect(px0, base - h * 0.024, px1 - px0, 2.5), I.paint([110, 100, 96], 0.04), 1, 110);
    for (let x = px0 + 4; x < px1; x += 22)
      pen.stroke(
        [
          [x, base - h * 0.022],
          [x, base],
        ],
        0.9,
        x,
      );
    pen.shape(rect(px0 - 4, base, px1 - px0 + 8, 3), I.paint(WOOD, 0.04), 1, 111);
    lamp(pen, I, x0 + w * 0.65, base + 2, 26);
    // the church, white with a steeple
    const ch = x0 + w * 0.72,
      cw = w * 0.15,
      cb = base - 1,
      chh = h * 0.05;
    pen.shape(rect(ch, cb - chh, cw, chh), I.paint([244, 242, 236], 0.04), 1.3, 120);
    pen.shape(
      [
        [ch - 4, cb - chh],
        [ch + cw / 2, cb - chh - h * 0.03],
        [ch + cw + 4, cb - chh],
      ],
      I.paint([90, 100, 120], 0.04),
      1.3,
      121,
    );
    const sx = ch + cw * 0.2;
    pen.shape(rect(sx - 7, cb - chh - h * 0.045, 14, h * 0.045), I.paint([244, 242, 236], 0.04), 1.2, 122);
    pen.shape(
      [
        [sx - 9, cb - chh - h * 0.045],
        [sx, cb - chh - h * 0.09],
        [sx + 9, cb - chh - h * 0.045],
      ],
      I.paint([90, 100, 120], 0.04),
      1.2,
      123,
    );
    pen.shape(ellipse(sx, cb - chh - h * 0.03, 3, 3, 10), I.paint([120, 90, 70], 0.04), 0.8, 124);
    pen.shape(rect(ch + cw * 0.55, cb - chh * 0.55, cw * 0.18, chh * 0.55), I.paint(DARK_WOOD, 0.04), 1, 125);
    for (const f of [0.38, 0.82])
      pen.shape(
        [...ellipse(ch + cw * f, cb - chh * 0.62, 3, 3, 8, Math.PI, TAU), [ch + cw * f + 3, cb - chh * 0.3], [ch + cw * f - 3, cb - chh * 0.3]],
        I.lit ? I.window : I.paint([180, 210, 230], 0.04),
        0.8,
        126 + f,
      );
    // a pickup parked out front of the shops
    {
      const tx = x0 + w * 0.22,
        ty = base + 14;
      pen.shape(
        [
          [tx, ty - 8],
          [tx + 14, ty - 8],
          [tx + 17, ty - 15],
          [tx + 28, ty - 15],
          [tx + 30, ty - 8],
          [tx + 38, ty - 8],
          [tx + 38, ty - 2],
          [tx, ty - 2],
        ],
        I.paint([96, 140, 180], 0.04),
        1.2,
        130,
      );
      pen.shape(rect(tx + 19, ty - 13, 8, 4), I.paint([200, 224, 240], 0.04), 0.8, 131);
      for (const wx of [tx + 8, tx + 31]) pen.shape(ellipse(wx, ty - 2, 3.5, 3.5, 10), [40, 40, 48], 1, wx);
    }
    fir(pen, I, x0 + w * 0.96, h * 0.9, h * 0.1, 135);
    aspens(pen, I, x0 + w * 0.68, base + 4, 2, h * 0.05, 136);
  },
  // 5 canyon: the river coming out of a gorge between two red-rock walls,
  // a steel truss bridge carrying the gravel road over it
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const pen = pens[2];
    const foot = h * 0.875;
    const rock = I.paint(RED_ROCK, 0.04);
    const deep = mix(rock, [60, 30, 40], 0.25);
    // inside the gorge: the far walls, darker, the river winding out
    pen.fillOnly(
      [
        [x0 + w * 0.43, h * 0.66],
        [x0 + w * 0.57, h * 0.66],
        [x0 + w * 0.57, foot],
        [x0 + w * 0.43, foot],
      ],
      deep,
    );
    const river = I.snowy ? mix(I.water, I.snow, 0.4) : I.water;
    const rv: Pt[] = [
      [x0 + w * 0.49, h * 0.78],
      [x0 + w * 0.51, h * 0.78],
      [x0 + w * 0.54, foot],
      [x0 + w * 0.6, h + 4],
      [x0 + w * 0.38, h + 4],
      [x0 + w * 0.46, foot],
    ];
    pen.shape(rv, river, 1.1, 300);
    // the two walls, banded
    const walls: Pt[][] = [
      [
        [x0 + w * 0.03, meadowY(k, x0 + w * 0.03) + 2],
        [x0 + w * 0.07, h * 0.68],
        [x0 + w * 0.12, h * 0.665],
        [x0 + w * 0.15, h * 0.63],
        [x0 + w * 0.3, h * 0.625],
        [x0 + w * 0.33, h * 0.6],
        [x0 + w * 0.42, h * 0.605],
        [x0 + w * 0.455, h * 0.65],
        [x0 + w * 0.46, foot],
        [x0 + w * 0.03, foot],
      ],
      [
        [x0 + w * 0.54, h * 0.64],
        [x0 + w * 0.57, h * 0.615],
        [x0 + w * 0.7, h * 0.61],
        [x0 + w * 0.73, h * 0.645],
        [x0 + w * 0.88, h * 0.65],
        [x0 + w * 0.92, h * 0.69],
        [x0 + w * 0.97, meadowY(k, x0 + w * 0.97) + 2],
        [x0 + w * 0.97, foot],
        [x0 + w * 0.545, foot],
      ],
    ];
    walls.forEach((c, i) => {
      pen.fillOnly(c, rock);
      // strata: level bands across each face, a little darker low down
      const xs = c.map((p) => p[0]),
        lo = Math.min(...xs),
        hi = Math.max(...xs);
      const topAt = (x: number) => {
        for (let j = 0; j < c.length - 3; j++) {
          const [ax, ay] = c[j],
            [bx, by] = c[j + 1];
          if ((x - ax) * (x - bx) <= 0 && ax !== bx) return ay + ((by - ay) * (x - ax)) / (bx - ax);
        }
        return foot;
      };
      for (let b = 1; b < 6; b++) {
        const y = h * 0.6 + ((foot - h * 0.6) * b) / 6 + 4;
        const seg = curve((x) => y + Math.sin(x * 0.07 + b) * 1.5, lo + 3, hi - 3, 6).filter(([x, yy]) => yy > topAt(x) + 3);
        if (b >= 4)
          pen.fillOnly(
            [...seg, ...seg.map(([x]) => [x, foot] as Pt).reverse()],
            mix(rock, [90, 40, 40], 0.06 * (b - 3)),
          );
        if (seg.length > 1) pen.stroke(seg, 0.6, 301 + b + i * 9);
      }
      pen.stroke(c, 1.3, 320 + i);
      // junipers clinging along the rim
      for (let j = 2; j < c.length - 4; j += 2) {
        const [ax, ay] = c[j],
          [bx, by] = c[j + 1];
        fir(pen, I, (ax + bx) / 2, (ay + by) / 2 + 3, h * 0.028, 325 + i * 5 + j);
      }
    });
    // the gravel road: down off the screen toward us on the left, across
    // the bridge, and round the right wall's foot into the gorge
    const by = h * 0.895;
    const road: C = I.snowy ? mix(I.snow, [190, 180, 170], 0.3) : I.paint([206, 186, 148], 0.04);
    const b0 = x0 + w * 0.33,
      b1 = x0 + w * 0.67;
    pen.shape(
      [
        [x0 + w * 0.08, h + 4],
        [x0 + w * 0.2, h + 4],
        [b0, by + 5],
        [b0, by - 1],
      ],
      road,
      0.9,
      330,
    );
    pen.shape(
      [
        [b1, by - 1],
        [b1, by + 5],
        [x0 + w * 0.82, h + 4],
        [x0 + w * 0.94, h + 4],
      ],
      road,
      0.9,
      331,
    );
    // the truss bridge
    pen.shape(rect(b0, by - 1, b1 - b0, 5), road, 1.1, 332);
    const top = by - 16;
    const panels = 6;
    const px = (i: number) => b0 + ((b1 - b0) * i) / panels;
    pen.stroke(
      [
        [b0, by - 1],
        [px(1), top],
        [px(panels - 1), top],
        [b1, by - 1],
      ],
      1.6,
      333,
    );
    for (let i = 1; i < panels; i++) {
      pen.stroke(
        [
          [px(i), top],
          [px(i), by - 1],
        ],
        1,
        334 + i,
      );
      // diagonals leaning in toward the middle
      if (i !== panels / 2)
        pen.stroke(
          [
            [px(i), top],
            [px(i < panels / 2 ? i + 1 : i - 1), by - 1],
          ],
          0.7,
          340 + i,
        );
    }
    // piers down to the water
    for (const f of [0.42, 0.58]) {
      const x = x0 + w * f;
      pen.shape(rect(x - 3, by + 4, 6, h + 4 - by - 4), I.paint([180, 170, 160], 0.04), 1, 350 + f);
    }
    fir(pen, I, x0 + w * 0.05, h * 0.99, h * 0.1, 165);
  },
  // 6 ski hill
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const mid = pens[1];
    const winter = I.snowy || I.season === "winter";
    const hill = (x: number) => {
      const u = (x - (x0 + w * 0.6)) / (w * 0.46);
      return h * MTN.near - (Math.abs(u) < 1 ? h * 0.17 * Math.pow(Math.cos((u * Math.PI) / 2), 1.4) : 0);
    };
    const top = curve(hill, x0 + w * 0.14, x0 + w * 1.0, 4);
    const forest = winter ? mix(I.fill[1], [210, 220, 228], 0.3) : I.fill[1];
    mid.fillOnly([...top, [x0 + w, h * 0.8], [x0 + w * 0.14, h * 0.8]], forest);
    // tree tips along its top
    for (let x = x0 + w * 0.2; x < x0 + w * 0.98; x += 7) {
      const y = hill(x);
      mid.stroke(
        [
          [x - 3, y + 1],
          [x, y - 5 - hash(x) * 4],
          [x + 3, y + 1],
        ],
        0.8,
        x,
      );
    }
    mid.stroke(top, 1.1, 170);
    // three runs cut down through the trees
    const run: C = winter ? I.snow : I.paint(I.season === "autumn" ? [196, 186, 120] : [150, 196, 110], 0.2);
    for (const [a, b, wd] of [
      [0.5, 0.36, 10],
      [0.64, 0.6, 14],
      [0.74, 0.86, 10],
    ]) {
      const ta = x0 + w * a,
        tb = x0 + w * b;
      const ya = hill(ta) + 3;
      mid.shape(
        [
          [ta - wd * 0.4, ya],
          [ta + wd * 0.4, ya],
          [tb + wd, h * 0.79],
          [tb - wd, h * 0.79],
        ],
        run,
        0.9,
        a * 100,
      );
    }
    // the chairlift: towers up the slope, the cable over them
    const [bx, byf] = AT.ski.base,
      [tx, tyf] = AT.ski.top;
    const pen = pens[2];
    const B: Pt = [x0 + w * bx, h * byf],
      T: Pt = [x0 + w * tx, h * tyf];
    for (let i = 0; i <= 4; i++) {
      const u = i / 4;
      const px = B[0] + (T[0] - B[0]) * u,
        py = B[1] + (T[1] - B[1]) * u;
      const groundY = Math.max(hill(px), py) + 10;
      mid.stroke(
        [
          [px, groundY],
          [px, py - 2],
        ],
        1.1,
        180 + i,
      );
      mid.stroke(
        [
          [px - 5, py - 2],
          [px + 5, py - 2],
        ],
        1,
        185 + i,
      );
    }
    mid.stroke([B.map((v, j) => v - (j ? 2 : 0)) as Pt, T.map((v, j) => v - (j ? 2 : 0)) as Pt], 0.7, 190);
    // the lift's huts at the bottom and the top
    for (const [px, py] of [B, T]) {
      mid.shape(rect(px - 6, py + 2, 12, 8), I.paint([150, 90, 70], 0.2), 0.9, px);
      mid.shape(
        [
          [px - 8, py + 2],
          [px, py - 3],
          [px + 8, py + 2],
        ],
        I.paint([80, 80, 96], 0.2),
        0.9,
        px + 1,
      );
    }
    // the lodge at the bottom: an A-frame with a glass front
    const lx = x0 + w * 0.17,
      lb = h * 0.855,
      lw = w * 0.17,
      lh = h * 0.07;
    pen.shape(
      [
        [lx - 4, lb],
        [lx + lw / 2, lb - lh],
        [lx + lw + 4, lb],
      ],
      I.paint([90, 70, 60], 0.04),
      1.3,
      191,
    );
    pen.shape(
      [
        [lx + lw * 0.2, lb],
        [lx + lw / 2, lb - lh * 0.66],
        [lx + lw * 0.8, lb],
      ],
      I.lit ? I.window : I.paint([200, 224, 240], 0.04),
      1,
      192,
    );
    pen.stroke(
      [
        [lx + lw / 2, lb - lh * 0.66],
        [lx + lw / 2, lb],
      ],
      0.7,
      193,
    );
    pen.stroke(
      [
        [lx + lw * 0.3, lb - lh * 0.3],
        [lx + lw * 0.7, lb - lh * 0.3],
      ],
      0.7,
      194,
    );
    pen.shape(rect(lx + lw * 0.78, lb - lh * 0.8, 7, lh * 0.5), I.paint(ROCK, 0.04), 1, 195);
    pen.shape(rect(lx - 8, lb, lw + 16, 3), I.paint(WOOD, 0.04), 1, 196);
    // a rack of skis by the door in winter, a bench in summer
    if (winter)
      for (let i = 0; i < 4; i++)
        pen.stroke(
          [
            [lx + lw + 10 + i * 3, lb],
            [lx + lw + 12 + i * 3, lb - 14],
          ],
          1,
          197 + i,
        );
    fir(pen, I, x0 + w * 0.06, h * 0.9, h * 0.1, 199);
    fir(pen, I, x0 + w * 0.93, h * 0.95, h * 0.12, 200);
  },
  // 7 falls
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const pen = pens[2];
    const lip = h * AT.falls.lip,
      pool = h * AT.falls.pool;
    const rock = I.paint(ROCK, 0.04);
    const foot = h * 0.86;
    const cliffs: Pt[][] = [
      [
        [x0 + w * 0.03, meadowY(k, x0 + w * 0.03) + 2],
        [x0 + w * 0.08, h * 0.71],
        [x0 + w * 0.2, h * 0.665],
        [x0 + w * 0.33, h * 0.672],
        [x0 + w * 0.44, lip - 2],
        [x0 + w * 0.455, foot],
        [x0 + w * 0.2, foot + 2],
        [x0 + w * 0.06, foot - 4],
      ],
      [
        [x0 + w * 0.545, lip],
        [x0 + w * 0.6, h * 0.66],
        [x0 + w * 0.74, h * 0.645],
        [x0 + w * 0.88, h * 0.69],
        [x0 + w * 0.97, meadowY(k, x0 + w * 0.97) + 2],
        [x0 + w * 0.94, foot - 4],
        [x0 + w * 0.8, foot + 2],
        [x0 + w * 0.545, foot],
      ],
    ];
    // boulders at the cliffs' feet
    for (let i = 0; i < 6; i++) {
      const bx = x0 + w * (0.1 + i * 0.15) + hash(i + 5) * 8;
      if (bx > x0 + w * 0.4 && bx < x0 + w * 0.6) continue;
      pen.shape(ellipse(bx, foot + 2, 7 + hash(i) * 5, 5, 12, Math.PI, TAU), I.paint(ROCK, 0.04), 0.9, 236 + i);
    }
    cliffs.forEach((c, i) => {
      pen.shape(c, rock, 1.3, 210 + i);
      // cracks running down the faces
      for (let j = 0; j < 4; j++) {
        const fx = c[1][0] + (c[3][0] - c[1][0]) * (0.15 + j * 0.25);
        const fy = Math.max(c[1][1], c[3][1]) + 8 + hash(j + i) * 10;
        if (fy + 26 > foot - 4) continue;
        pen.stroke(
          [
            [fx, fy],
            [fx + 2, fy + 14],
            [fx - 1, fy + 26],
          ],
          0.7,
          212 + i * 5 + j,
        );
      }
      // pines along the clifftops
      for (let j = 1; j < 3; j++) {
        const fx = c[j][0] + (c[j + 1][0] - c[j][0]) * 0.5,
          fy = c[j][1] + (c[j + 1][1] - c[j][1]) * 0.5;
        fir(pen, I, fx, fy + 3, h * 0.035, 220 + i * 3 + j);
      }
    });
    // the water: the fall itself, the pool, the stream out toward us
    const frozen = I.snowy || I.season === "winter";
    const fall: C = frozen ? I.paint([214, 230, 240], 0.04) : mix(I.water, [255, 255, 255], 0.35);
    pen.shape(
      [
        [x0 + w * 0.455, lip],
        [x0 + w * 0.545, lip],
        [x0 + w * 0.55, pool],
        [x0 + w * 0.45, pool],
      ],
      fall,
      1.1,
      230,
    );
    pen.shape(ellipse(x0 + w * 0.5, pool, w * 0.11, h * 0.012, 24), frozen ? mix(I.water, I.snow, 0.5) : I.water, 1.2, 231);
    pen.shape(
      [
        [x0 + w * 0.47, pool + h * 0.01],
        [x0 + w * 0.53, pool + h * 0.01],
        [x0 + w * 0.6, h + 4],
        [x0 + w * 0.46, h + 4],
      ],
      frozen ? mix(I.water, I.snow, 0.5) : I.water,
      1.1,
      232,
    );
    // the footbridge over the stream
    const fy = h * 0.925,
      f0 = x0 + w * 0.4,
      f1 = x0 + w * 0.66;
    pen.shape(rect(f0, fy, f1 - f0, 4), I.paint(WOOD, 0.04), 1.1, 233);
    for (let x = f0; x <= f1; x += (f1 - f0) / 6)
      pen.stroke(
        [
          [x, fy],
          [x, fy - 9],
        ],
        0.9,
        x,
      );
    pen.stroke(
      [
        [f0, fy - 9],
        [f1, fy - 9],
      ],
      1,
      234,
    );
  },
  // 8 ranch
  (k: Kit, x0: number) => {
    const { pens, I, w, h } = k;
    const pen = pens[2];
    // the log gate with a hanging sign
    const gx0 = x0 + w * 0.06,
      gx1 = x0 + w * 0.24,
      gb = h * 0.885;
    fence(pen, I, x0 + w * 0.02, gx0 - 3, gb - 2, gb, 9, 238);
    fence(pen, I, gx1 + 3, x0 + w * 0.36, gb, gb - 6, 9, 239);
    for (const gx of [gx0, gx1]) pen.shape(rect(gx - 3, gb - h * 0.08, 6, h * 0.08), I.paint(WOOD, 0.04), 1.2, gx);
    pen.shape(rect(gx0 - 8, gb - h * 0.088, gx1 - gx0 + 16, 6), I.paint(WOOD, 0.04), 1.2, 240);
    const sm = (gx0 + gx1) / 2;
    for (const d of [-14, 14])
      pen.stroke(
        [
          [sm + d, gb - h * 0.082],
          [sm + d, gb - h * 0.066],
        ],
        0.7,
        d,
      );
    pen.shape(rect(sm - 20, gb - h * 0.066, 40, 10), I.paint([224, 200, 150], 0.04), 1, 241);
    pen.stroke(
      [
        [sm - 12, gb - h * 0.06],
        [sm + 12, gb - h * 0.06],
      ],
      0.8,
      242,
    );
    // the lane through the gate, up to the barn
    pen.fillOnly(
      [
        [gx0 + 6, h + 4],
        [gx1 - 6, h + 4],
        [x0 + w * 0.5, h * 0.845],
        [x0 + w * 0.44, h * 0.845],
      ],
      I.snowy ? mix(I.snow, [200, 190, 180], 0.25) : I.paint([206, 180, 140], 0.04),
    );
    // the barn: logs, a tin gambrel roof, a hayloft door
    const bx = x0 + w * 0.42,
      bb = h * 0.85,
      bw = w * 0.26,
      bh = h * 0.05;
    pen.shape(rect(bx, bb - bh, bw, bh), I.paint(WOOD, 0.04), 1.3, 243);
    for (let i = 1; i < 5; i++)
      pen.stroke(
        [
          [bx, bb - (bh * i) / 5],
          [bx + bw, bb - (bh * i) / 5],
        ],
        0.6,
        243 + i,
      );
    pen.shape(
      [
        [bx - 5, bb - bh],
        [bx + bw * 0.14, bb - bh - h * 0.028],
        [bx + bw / 2, bb - bh - h * 0.043],
        [bx + bw * 0.86, bb - bh - h * 0.028],
        [bx + bw + 5, bb - bh],
      ],
      I.paint([150, 160, 170], 0.04),
      1.3,
      249,
    );
    pen.shape(rect(bx + bw * 0.38, bb - bh * 0.7, bw * 0.24, bh * 0.7), I.paint(DARK_WOOD, 0.04), 1.1, 250);
    pen.stroke(
      [
        [bx + bw * 0.38, bb - bh * 0.7],
        [bx + bw * 0.62, bb],
      ],
      0.7,
      251,
    );
    pen.stroke(
      [
        [bx + bw * 0.62, bb - bh * 0.7],
        [bx + bw * 0.38, bb],
      ],
      0.7,
      252,
    );
    pen.shape(rect(bx + bw * 0.44, bb - bh - h * 0.024, bw * 0.12, h * 0.016), I.paint(DARK_WOOD, 0.04), 1, 253);
    // round hay bales by the barn
    for (const [f, r] of [
      [0.74, 11],
      [0.8, 10],
    ] as Pt[]) {
      const hx = x0 + w * f;
      pen.shape(ellipse(hx, bb - r + 1, r, r, 16), I.paint([222, 196, 120], 0.04), 1.1, hx);
      pen.shape(ellipse(hx, bb - r + 1, r * 0.4, r * 0.4, 10), null, 0.6, hx + 1);
    }
    // the corral in front, two horses in it
    fence(pen, I, x0 + w * 0.56, x0 + w * 0.9, h * 0.875, h * 0.875, 9, 262);
    fence(pen, I, x0 + w * 0.52, x0 + w * 0.56, h * 0.96, h * 0.875, 11, 265);
    fence(pen, I, x0 + w * 0.94, x0 + w * 0.9, h * 0.96, h * 0.875, 11, 268);
    horse(pen, x0 + w * 0.66, h * 0.925, 2.1, I.paint([150, 96, 60], 0.04), 1, 270);
    horse(pen, x0 + w * 0.84, h * 0.915, 1.9, I.paint([236, 232, 222], 0.04), -1, 275);
    fence(pen, I, x0 + w * 0.52, x0 + w * 0.94, h * 0.96, h * 0.96, 13, 260);
    fir(pen, I, x0 + w * 0.32, h * 0.855, h * 0.07, 280);
    aspens(pen, I, x0 + w * 0.94, h * 0.85, 3, h * 0.05, 281);
  },
];

// ---------------------------------------------------------------------------
// the moving bits
// ---------------------------------------------------------------------------

function live(g: CanvasRenderingContext2D, k: Kit, t: number, X: (x: number, layer: number) => number) {
  const { I, L, w, h, PW } = k;
  const ink = css(I.inkC, 0.9);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = ink;
  const night = I.night > 0.5;
  // draws something that spans [a, a + span] on the near layer, twice if
  // it straddles the loop's join, clipped to that span
  const span = (a: number, wd: number, draw: (ox: number) => void) => {
    const sx = X(a, 2);
    for (const ox of [sx, sx - PW]) {
      if (ox > w + 40 || ox + wd < -40) continue;
      g.save();
      g.beginPath();
      g.rect(ox, 0, wd, h);
      g.clip();
      draw(ox);
      g.restore();
    }
  };
  const puff = (x: number, y: number, seed: number) => {
    const wind = 0.4 + Math.min(1, L.wind / 8);
    for (let i = 0; i < 5; i++) {
      const q = (t * 0.2 + i / 5 + seed) % 1;
      g.globalAlpha = 0.6 * (1 - q) * Math.min(1, q * 6);
      g.beginPath();
      g.arc(X(x + wind * q * q * 22, 2), y - q * 30, 1.5 + q * 4.5, 0, TAU);
      g.lineWidth = 0.9;
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  // chimney smoke: the homestead cabin, the lodge, a shop in town
  {
    const cb = knollY(k, 0, w * 0.2) + 3;
    puff(w * 0.12 + w * 0.2 * 0.78, cb - h * 0.04 - h * 0.038, 0);
    puff(w * 5 + w * 0.17 + w * 0.17 * 0.78 + 3, h * 0.855 - h * 0.07 * 0.8, 0.3);
  }
  // the river glinting in the homestead and the canyon
  if (!I.snowy) {
    g.strokeStyle = night ? "rgba(220,235,255,0.45)" : "rgba(255,255,255,0.85)";
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const q = (t * 0.12 + i / 14) % 1;
      const y = h * (0.82 + q * 0.17);
      const [c, hw] = riverAt(k, 0, y);
      const o = Math.sin(i * 2.1) * hw * 0.5;
      g.globalAlpha = Math.sin(q * Math.PI);
      g.beginPath();
      g.moveTo(X(c + o - hw * 0.15, 2), y);
      g.lineTo(X(c + o + hw * 0.15, 2), y);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.strokeStyle = ink;
  }
  // deer grazing below the knoll: they wander between the cabin's paddock
  // and the aspens and never reach the river
  {
    const ph = ((t + 12) % 120) / 120;
    const back = ph >= 0.5;
    const hp = (ph % 0.5) * 2;
    const keys = [0, 0.3, 0.45, 0.75, 1];
    const pos = [0, 0.45, 0.45, 1, 1];
    let j = 0;
    while (j < keys.length - 2 && hp > keys[j + 1]) j++;
    const f = (hp - keys[j]) / (keys[j + 1] - keys[j]);
    const grazing = pos[j] === pos[j + 1];
    let along = pos[j] + (pos[j + 1] - pos[j]) * f;
    if (back) along = 1 - along;
    const dir = back ? -1 : 1;
    const x = w * (0.08 + 0.3 * along);
    const step = Math.floor(t * 4) % 2 ? 1 : -1;
    deer(g, I, X(x, 2), h * 0.95, 1.6, dir, grazing ? 0 : step, !grazing || Math.sin(t * 0.8) > 0.6);
    deer(g, I, X(x - dir * 20, 2), h * 0.958, 1.15, dir, grazing ? 0 : -step, !grazing || Math.sin(t * 0.8 + 2) > 0.3);
  }
  // the canoe on the lake: paddles across and back, always on the water
  if (!I.snowy) {
    const cx = w * 1.5,
      cy = h * AT.lake.cy,
      rx = w * AT.lake.rx * 0.6;
    const x = cx + Math.sin(t * 0.07) * rx,
      y = cy - h * AT.lake.ry * 0.2;
    const sx = X(x, 2);
    g.fillStyle = css(I.paint([228, 92, 64], 0.04));
    g.beginPath();
    g.moveTo(sx - 12, y - 2);
    g.quadraticCurveTo(sx, y + 4, sx + 12, y - 2);
    g.closePath();
    g.fill();
    g.lineWidth = 1.1;
    g.stroke();
    g.beginPath();
    g.arc(sx, y - 5, 1.8, 0, TAU);
    g.stroke();
    const st = Math.sin(t * 2) > 0 ? 1 : -1;
    g.beginPath();
    g.moveTo(sx - st * 3, y - 7);
    g.lineTo(sx + st * 5, y + 1);
    g.stroke();
    // a trout jumping now and then, well away from the canoe
    const jn = Math.floor(t / 7),
      jt = (t % 7) / 1.2;
    if (jt < 1) {
      const fx = cx + (hash(jn) - 0.5) * w * 0.6;
      if (Math.abs(fx - x) > 40) {
        const fy = cy + h * AT.lake.ry * 0.3;
        const fxs = X(fx + (jt - 0.5) * 14, 2),
          fys = fy - Math.sin(jt * Math.PI) * 12;
        g.fillStyle = css(I.water);
        g.beginPath();
        g.ellipse(fxs, fys, 4.5, 1.8, Math.cos(jt * Math.PI) * -0.9, 0, TAU);
        g.fill();
        g.stroke();
        for (const [at, dx] of [
          [0, -7],
          [1, 7],
        ]) {
          const a = (jt - at) * 1.6;
          if (a > 0 && a < 1) {
            g.globalAlpha = 1 - a;
            g.beginPath();
            g.ellipse(X(fx + dx, 2), fy, 2 + a * 6, 0.8 + a * 1.5, 0, 0, TAU);
            g.stroke();
            g.globalAlpha = 1;
          }
        }
      }
    }
  }
  // the train: out of the left tunnel, over the trestle, into the right one
  {
    const xl = w * 2 + w * AT.rail.l,
      xr = w * 2 + w * AT.rail.r;
    const inL = xl + 2,
      inR = xr - 2; // inside faces of the two portals
    const len = 112;
    const run = (t % 42) / 18;
    if (run < 1) {
      const head = inL + run * (inR - inL + len);
      const deck = h * AT.rail.deck - 1;
      span(inL, inR - inL, (ox) => {
        const at = (x: number) => ox + (x - inL);
        g.fillStyle = css(I.paint([70, 76, 92], 0.04));
        const box = (x: number, wd: number, ht: number, c: C) => {
          g.fillStyle = css(c);
          g.beginPath();
          g.rect(at(x), deck - ht, wd, ht);
          g.fill();
          g.lineWidth = 1.1;
          g.stroke();
        };
        const wheel = (x: number) => {
          g.fillStyle = css([40, 40, 48]);
          g.beginPath();
          g.arc(at(x), deck - 1.5, 2.2, 0, TAU);
          g.fill();
          g.stroke();
        };
        const cars: C[] = [I.paint([196, 80, 64], 0.04), I.paint([90, 130, 120], 0.04), I.paint([206, 170, 90], 0.04)];
        for (let c = 0; c < 3; c++) {
          const cx = head - 32 - (c + 1) * 26;
          box(cx, 23, 11, cars[c]);
          wheel(cx + 5);
          wheel(cx + 18);
        }
        // the locomotive: boiler, cab, stack
        box(head - 32, 24, 8, I.paint([60, 64, 76], 0.04));
        box(head - 32, 9, 14, I.paint([60, 64, 76], 0.04));
        box(head - 13, 3, 13, I.paint([40, 42, 50], 0.04));
        for (const wx of [head - 27, head - 19, head - 11]) wheel(wx);
        for (let s = 0; s < 5; s++) {
          const q = (t * 0.9 + s / 5) % 1;
          g.globalAlpha = (1 - q) * 0.7;
          g.beginPath();
          g.arc(at(head - 11.5 - q * 26), deck - 15 - q * 12, 1.5 + q * 4, 0, TAU);
          g.stroke();
        }
        g.globalAlpha = 1;
      });
    }
  }
  // the chairlift: chairs riding up one side of the cable
  {
    const [bx, by] = AT.ski.base,
      [tx, ty] = AT.ski.top;
    for (let i = 0; i < 6; i++) {
      const u = 0.06 + 0.88 * ((t * 0.02 + i / 6) % 1);
      const x = w * 5 + w * (bx + (tx - bx) * u),
        y = h * (by + (ty - by) * u) - 2;
      const sx = X(x, 1);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(sx, y);
      g.lineTo(sx, y + 9);
      g.lineTo(sx - 6, y + 9);
      g.lineTo(sx - 6, y + 5);
      g.stroke();
      if (I.snowy || I.season === "winter") {
        g.fillStyle = css(I.paint(i % 2 ? [226, 92, 70] : [70, 120, 200], 0.2));
        g.beginPath();
        g.arc(sx - 3, y + 6, 2, 0, TAU);
        g.fill();
      }
    }
  }
  // the falls: streaks sliding down, mist rising at the foot
  if (!(I.snowy || I.season === "winter")) {
    const fx0 = w * 6 + w * 0.455,
      fx1 = w * 6 + w * 0.545;
    const lip = h * AT.falls.lip,
      pool = h * AT.falls.pool;
    g.strokeStyle = night ? "rgba(220,235,255,0.55)" : "rgba(255,255,255,0.95)";
    g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const q = (t * 0.7 + hash(i * 3.3)) % 1;
      const x = fx0 + (fx1 - fx0) * (0.12 + 0.76 * hash(i * 7.1));
      const y = lip + (pool - lip) * q;
      g.beginPath();
      g.moveTo(X(x, 2), y);
      g.lineTo(X(x, 2), y + 8);
      g.stroke();
    }
    g.strokeStyle = ink;
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.3 + i / 4) % 1;
      g.globalAlpha = 0.5 * (1 - q);
      g.beginPath();
      g.arc(X(w * 6.5 + (i - 1.5) * 8, 2), pool - 2 - q * 12, 2 + q * 5, 0, TAU);
      g.lineWidth = 0.8;
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  // a hawk circling high over the homestead by day; fireflies on summer nights
  if (!night) {
    const a = t * 0.25;
    const hx = X(w * 0.45 + Math.cos(a) * 30, 0),
      hy = h * 0.6 + Math.sin(a) * 6;
    const flap = Math.sin(t * 3) > 0.6 ? 1.2 : -0.5;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(hx - 5, hy - flap);
    g.quadraticCurveTo(hx - 2, hy - 1, hx, hy + 0.5);
    g.quadraticCurveTo(hx + 2, hy - 1, hx + 5, hy - flap);
    g.stroke();
  } else if (k.season === "summer" && !I.snowy) {
    for (let i = 0; i < 14; i++) {
      const a = Math.max(0, Math.sin(t * 1.4 + i * 2.3));
      // only over the dry meadow of the homestead and the ranch
      const x = (i % 2 ? w * 7.05 : w * 0.05) + hash(i * 3.1) * w * 0.35 + Math.sin(t * 0.4 + i) * 6;
      g.fillStyle = `rgba(230,255,140,${a})`;
      g.beginPath();
      g.arc(X(x, 2), h * 0.88 + hash(i * 1.7) * h * 0.1, 1.4, 0, TAU);
      g.fill();
    }
  }
}

// a deer, facing right (dir -1 faces left); step swings the legs
function deer(
  g: CanvasRenderingContext2D,
  I: Inks,
  x: number,
  y: number,
  s: number,
  dir: number,
  step: number,
  up: boolean,
) {
  g.save();
  g.translate(x, y);
  g.scale(dir * s, s);
  g.fillStyle = css(I.deer);
  g.lineWidth = 1.1 / s;
  const seg = (pts: Pt[]) => {
    g.beginPath();
    pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
    g.stroke();
  };
  const sw = step * 1.2;
  for (const [lx, d] of [
    [-4.2, sw],
    [-2.8, -sw],
    [2.8, -sw],
    [4.2, sw],
  ] as Pt[])
    seg([
      [lx, -1],
      [lx + d, 5],
    ]);
  g.beginPath();
  g.ellipse(0, -2.4, 5.6, 2.3, 0, 0, TAU);
  g.fill();
  g.stroke();
  if (up) {
    seg([
      [4.6, -3.4],
      [6.2, -8.4],
      [8.8, -7.6],
    ]);
    seg([
      [6.2, -8.4],
      [5.6, -10.4],
    ]);
  } else
    seg([
      [4.6, -3],
      [7, 1.6],
    ]);
  seg([
    [-5.6, -3],
    [-6.8, -4],
  ]);
  g.restore();
}

export const mountain = { scenes: SCENES, ground, live };
