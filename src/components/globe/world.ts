import type { Season } from "./scene";
import type { C, Light } from "./setting";
import { Pen, css, inksFor, mix, type Inks, type LinePano } from "./line";

// More places to be, in the same ink-and-colour style as the mountains
// (line.ts): each "world" is a loop of a few scenes that turns with the
// globe. The land itself (horizon, sea, fields, hills) is drawn as smooth
// loops round the whole panorama so the scenes join without seams; each
// scene adds its own landmarks inside its stretch.
//
//   coast: a lighthouse on a rocky point, a pier, a beach day with
//          umbrellas and a lifeguard tower, dunes with cottages on stilts
//   farm:  a red barn and silo, a farmhouse with a windpump, a cornfield
//          with a scarecrow, a pasture with cows and a pond
//   city:  downtown across a river, a stone suspension bridge, a park with
//          a Ferris wheel, a street of houses with a corner diner

type Pt = [number, number];

export type WorldKind = "coast" | "farm" | "city";

type Kit = {
  pens: Pen[]; // one per layer: far, middle, near
  I: Inks;
  L: Light;
  w: number; // one scene's width, points
  h: number;
  PW: number; // the whole loop
  season: Season;
};

const TAU = Math.PI * 2;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// a gentle wave that loops exactly once round the panorama, so a line drawn
// with it meets itself at the join
function loopWave(x: number, PW: number, seed: number) {
  let s = 0;
  for (let k = 1; k <= 4; k++) s += Math.sin((TAU * k * (x + seed * 97)) / PW + seed * k * 1.7) / (k * 1.4);
  return s;
}

const curve = (f: (x: number) => number, x0: number, x1: number, step = 6): Pt[] => {
  const pts: Pt[] = [];
  for (let x = x0; x < x1; x += step) pts.push([x, f(x)]);
  pts.push([x1, f(x1)]);
  return pts;
};

const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

function ellipse(cx: number, cy: number, rx: number, ry: number, n = 28, a0 = 0, a1 = TAU): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

// a leafy tree: trunk and a lumpy round crown (bare branches in winter)
function leafy(pen: Pen, x: number, base: number, size: number, leaf: C, bare: boolean) {
  pen.stroke(
    [
      [x, base],
      [x, base - size * 0.55],
    ],
    1.3,
  );
  if (bare) {
    for (const [dx, dy] of [
      [-0.35, -0.95],
      [0.3, -1],
      [-0.15, -1.15],
      [0.45, -0.8],
    ])
      pen.stroke(
        [
          [x, base - size * 0.45],
          [x + dx * size * 0.6, base + dy * size],
        ],
        1,
      );
    return;
  }
  const pts: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    // soft lumps, a bit flatter underneath
    const r = (1 + 0.07 * Math.abs(Math.sin(a * 3.5 + x))) * (Math.sin(a) > 0 ? 0.92 : 1);
    pts.push([x + Math.cos(a) * size * 0.5 * r, base - size * 0.95 + Math.sin(a) * size * 0.42 * r]);
  }
  pen.shape(pts, leaf, 1.3, x);
}

// ---------------------------------------------------------------------------
// the coast
// ---------------------------------------------------------------------------

const coast = {
  hz: 0.745, // the horizon
  shore(k: Kit, x: number) {
    return k.h * (0.815 + 0.008 * loopWave(x, k.PW, 2));
  },
  ground(k: Kit) {
    const { pens, I, h, PW } = k;
    const hz = h * this.hz;
    const sea = I.paint([70, 146, 206], 0.14);
    // the sea, with the horizon and a few rows of little wave marks
    pens[1].fillOnly([[-8, hz], [PW + 8, hz], [PW + 8, h + 8], [-8, h + 8]], I.snowy ? mix(sea, [230, 236, 246], 0.3) : sea);
    pens[1].stroke(curve(() => hz, -8, PW + 8, 40), 1.2, 1);
    for (let r = 1; r < 6; r++) {
      const y = hz + (h * 0.07 * (r / 6)) ** 1 * 1;
      const gap = 40 + r * 12;
      for (let x = hash(r) * gap; x < PW - 10; x += gap * (0.7 + hash(x + r) * 0.6)) {
        const l = 3 + r * 1.6;
        pens[1].stroke(
          [
            [x, y],
            [x + l * 0.5, y - 0.8],
            [x + l, y],
          ],
          0.8,
          x,
        );
      }
    }
    // the beach
    const sand: C = I.snowy ? I.snow : I.paint([234, 212, 158], 0.06);
    const shore = curve((x) => this.shore(k, x), -8, PW + 8);
    pens[2].fillOnly([...shore, [PW + 8, h + 8], [-8, h + 8]], sand);
    pens[2].stroke(shore, 1.3, 3);
    // the wet edge and a scatter of shells
    const wet = curve((x) => this.shore(k, x) + 5, -8, PW + 8, 10);
    for (let i = 0; i < wet.length - 1; i += 3) pens[2].stroke([wet[i], wet[i + 1]], 0.8, i);
    for (let i = 0; i < 18; i++) {
      const x = hash(i * 5) * PW,
        y = this.shore(k, x) + 14 + hash(i * 3) * h * 0.12;
      pens[2].stroke(
        [
          [x - 1.2, y],
          [x, y - 1],
          [x + 1.2, y],
        ],
        0.8,
        i,
      );
    }
  },
  scenes: [
    // a lighthouse on a rocky point, the keeper's cottage beside it
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const sh = (x: number) => coast.shore(k, x);
      const rock: C = I.paint([150, 140, 130], 0.06);
      const top = h * 0.712;
      const pts: Pt[] = [
        [x0 + w * 0.5, sh(x0 + w * 0.5)],
        [x0 + w * 0.56, h * 0.76],
        [x0 + w * 0.6, top + 3],
        [x0 + w * 0.64, top],
        [x0 + w * 0.9, top - 1],
        [x0 + w * 0.94, h * 0.74],
        [x0 + w * 0.96, sh(x0 + w * 0.96)],
      ];
      pen.shape(pts, rock, 1.3, 7);
      // a cap of grass along the top, and a few cracks
      pen.shape(
        [
          [x0 + w * 0.605, top + 2],
          [x0 + w * 0.64, top],
          [x0 + w * 0.9, top - 1],
          [x0 + w * 0.915, top + 4],
          [x0 + w * 0.64, top + 4],
        ],
        I.snowy ? I.snow : I.paint([120, 166, 90], 0.06),
        1.1,
        8,
      );
      for (const [a, b] of [
        [0.6, 0.77],
        [0.72, 0.775],
        [0.86, 0.765],
      ])
        pen.stroke(
          [
            [x0 + w * a, h * 0.735],
            [x0 + w * (a + 0.012), h * 0.75],
            [x0 + w * (a + 0.004), h * b],
          ],
          0.9,
          a,
        );
      // the lighthouse
      const lx = x0 + w * 0.8,
        base = top,
        th = h * 0.12,
        bw = w * 0.026,
        tw = w * 0.018;
      const tower: Pt[] = [
        [lx - bw, base],
        [lx - tw, base - th],
        [lx + tw, base - th],
        [lx + bw, base],
      ];
      const white: C = I.paint([248, 246, 240], 0.04),
        red: C = I.paint([214, 70, 60], 0.04);
      pen.shape(tower, white, 1.3, 9);
      for (const f of [0.22, 0.6]) {
        const y0 = base - th * f,
          y1 = base - th * (f + 0.16);
        const half = (y: number) => bw + (tw - bw) * ((base - y) / th);
        pen.shape(
          [
            [lx - half(y0), y0],
            [lx - half(y1), y1],
            [lx + half(y1), y1],
            [lx + half(y0), y0],
          ],
          red,
          1.1,
          f,
        );
      }
      // gallery, lantern room, cap
      const gy = base - th;
      pen.stroke(
        [
          [lx - tw * 1.6, gy],
          [lx + tw * 1.6, gy],
        ],
        1.3,
      );
      pen.shape(rect(lx - tw * 0.8, gy - h * 0.018, tw * 1.6, h * 0.018), I.lit ? I.window : I.paint([200, 220, 236], 0.04), 1.1, 3);
      pen.shape(ellipse(lx, gy - h * 0.018, tw * 1.1, h * 0.012, 14, Math.PI, TAU), red, 1.2, 4);
      for (let i = -1; i <= 1; i++)
        pen.stroke(
          [
            [lx + i * tw * 1.4, gy],
            [lx + i * tw * 1.4, gy - h * 0.006],
          ],
          0.9,
        );
      pen.stroke(
        [
          [lx - tw * 1.6, gy - h * 0.006],
          [lx + tw * 1.6, gy - h * 0.006],
        ],
        0.9,
      );
      // a door
      pen.shape(rect(lx - 2.5, base - 9, 5, 9), I.paint([90, 110, 140], 0.04), 1, 5);
      // the keeper's cottage
      const cx = x0 + w * 0.68,
        cw = w * 0.07,
        ch = h * 0.024;
      pen.shape(rect(cx - cw / 2, top - ch, cw, ch), white, 1.3, 11);
      pen.shape(
        [
          [cx - cw / 2 - 3, top - ch],
          [cx, top - ch - h * 0.022],
          [cx + cw / 2 + 3, top - ch],
        ],
        red,
        1.3,
        12,
      );
      pen.shape(rect(cx - cw * 0.3, top - ch * 0.75, 5, 5), I.lit ? I.window : null, 1);
      pen.shape(rect(cx + cw * 0.15, top - ch * 0.75, 5, 5), I.lit ? I.window : null, 1);
    },
    // a wooden pier out over the water, a little shack at the end
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const wood: C = I.paint([168, 122, 84], 0.05);
      const deck = h * 0.778;
      const xs = x0 + w * 0.14,
        xe = x0 + w * 0.88;
      const sh = coast.shore(k, xs);
      // the ramp up from the sand
      pen.shape(
        [
          [xs - w * 0.06, sh + 2],
          [xs, deck],
          [xs, deck + 3],
          [xs - w * 0.055, sh + 5],
        ],
        wood,
        1.2,
        2,
      );
      // posts down into the water
      for (let x = xs; x <= xe; x += w * 0.06)
        pen.stroke(
          [
            [x, deck + 3],
            [x, deck + h * 0.03],
          ],
          1.3,
          x,
        );
      // deck and rail
      pen.shape(rect(xs, deck, xe - xs, 3), wood, 1.3, 3);
      pen.stroke(
        [
          [xs, deck - 7],
          [xe - w * 0.1, deck - 7],
        ],
        1,
        4,
      );
      for (let x = xs; x <= xe - w * 0.1; x += w * 0.045)
        pen.stroke(
          [
            [x, deck],
            [x, deck - 7],
          ],
          1,
          x + 1,
        );
      // two lamp posts
      for (const f of [0.35, 0.6]) {
        const x = xs + (xe - xs) * f;
        pen.stroke(
          [
            [x, deck],
            [x, deck - 18],
            [x + 3, deck - 18],
          ],
          1.1,
          f,
        );
        pen.shape(ellipse(x + 3, deck - 16.5, 1.8, 1.6, 10), I.lit ? I.window : I.paint([250, 240, 210], 0.05), 0.9, f);
      }
      // the bait shack at the end
      const sx = xe - w * 0.07,
        sw = w * 0.08,
        shh = h * 0.022;
      pen.shape(rect(sx - sw / 2, deck - shh, sw, shh), I.paint([92, 150, 196], 0.05), 1.3, 6);
      pen.shape(
        [
          [sx - sw / 2 - 2, deck - shh],
          [sx, deck - shh - h * 0.014],
          [sx + sw / 2 + 2, deck - shh],
        ],
        I.paint([240, 236, 226], 0.05),
        1.2,
        7,
      );
      pen.shape(rect(sx - 3, deck - shh * 0.75, 6, 6), I.lit ? I.window : null, 1);
    },
    // a beach day: two striped umbrellas, a towel, a lifeguard tower; a
    // small island far out
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const hz = h * coast.hz;
      const far = pens[0];
      far.shape(
        [
          [x0 + w * 0.18, hz + 1],
          [x0 + w * 0.22, hz - 6],
          [x0 + w * 0.27, hz - 9],
          [x0 + w * 0.33, hz - 5],
          [x0 + w * 0.36, hz + 1],
        ],
        I.paint([96, 138, 110], 0.4),
        1,
        5,
      );
      const pen = pens[2];
      const sh = (x: number) => coast.shore(k, x);
      const umbrella = (x: number, y: number, s: number, c: C) => {
        pen.stroke(
          [
            [x, y],
            [x + 1, y - 22 * s],
          ],
          1.2,
          x,
        );
        const cx = x + 1,
          cy = y - 22 * s;
        const r = 14 * s;
        for (let i = 0; i < 4; i++) {
          const a0 = Math.PI + (i * Math.PI) / 4,
            a1 = Math.PI + ((i + 1) * Math.PI) / 4;
          pen.shape([[cx, cy], ...ellipse(cx, cy, r, r * 0.55, 6, a0, a1)], i % 2 ? I.paint([250, 248, 240], 0.04) : c, 1.1, i + x);
        }
      };
      if (!I.snowy) {
        umbrella(x0 + w * 0.2, sh(x0 + w * 0.2) + h * 0.05, 1, I.paint([226, 84, 70], 0.04));
        umbrella(x0 + w * 0.36, sh(x0 + w * 0.36) + h * 0.04, 0.85, I.paint([70, 140, 200], 0.04));
        pen.shape(
          [
            [x0 + w * 0.24, sh(x0 + w * 0.24) + h * 0.055],
            [x0 + w * 0.31, sh(x0 + w * 0.31) + h * 0.052],
            [x0 + w * 0.315, sh(x0 + w * 0.31) + h * 0.06],
            [x0 + w * 0.245, sh(x0 + w * 0.24) + h * 0.063],
          ],
          I.paint([240, 196, 80], 0.04),
          1,
          9,
        );
      }
      // the lifeguard tower
      const tx = x0 + w * 0.72,
        ty = sh(tx) + h * 0.03;
      const red: C = I.paint([220, 76, 64], 0.04),
        white: C = I.paint([248, 246, 240], 0.04);
      for (const s of [-1, 1])
        pen.stroke(
          [
            [tx + s * 12, ty],
            [tx + s * 8, ty - 24],
          ],
          1.3,
          s,
        );
      pen.stroke(
        [
          [tx - 11, ty - 8],
          [tx + 11, ty - 8],
        ],
        1,
      );
      pen.shape(rect(tx - 12, ty - 38, 24, 14), white, 1.3, 2);
      pen.shape(rect(tx - 7, ty - 35, 14, 6), I.paint([150, 196, 226], 0.04), 1, 3);
      pen.shape(
        [
          [tx - 15, ty - 38],
          [tx, ty - 47],
          [tx + 15, ty - 38],
        ],
        red,
        1.3,
        4,
      );
      pen.stroke(
        [
          [tx + 13, ty - 38],
          [tx + 13, ty - 58],
        ],
        1,
      );
      pen.shape(
        [
          [tx + 13, ty - 58],
          [tx + 22, ty - 55],
          [tx + 13, ty - 52],
        ],
        red,
        1,
        5,
      );
    },
    // dunes with grass and a slatted fence, two cottages on stilts
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const sh = (x: number) => coast.shore(k, x);
      const sand: C = I.snowy ? I.snow : I.paint([226, 202, 146], 0.05);
      const dune = (x: number) => {
        const u = (x - x0 - w * 0.05) / (w * 0.5);
        return sh(x) + 6 - Math.sin(Math.max(0, Math.min(1, u)) * Math.PI) * h * 0.035;
      };
      const top = curve(dune, x0 + w * 0.05, x0 + w * 0.55, 5);
      pen.shape([...top, [x0 + w * 0.55, sh(x0 + w * 0.55) + 8], [x0 + w * 0.05, sh(x0 + w * 0.05) + 8]], sand, 1.3, 6);
      // marram grass in tufts along the crest
      for (let i = 0; i < 9; i++) {
        const x = x0 + w * (0.1 + i * 0.05 + hash(i) * 0.02);
        const y = dune(x) + 1;
        for (const d of [-3, 0, 3])
          pen.stroke(
            [
              [x, y],
              [x + d, y - 7 - hash(i + d) * 3],
            ],
            0.9,
            i + d,
          );
      }
      // a slatted snow fence leaning down the dune
      for (let x = x0 + w * 0.12; x < x0 + w * 0.5; x += 6)
        pen.stroke(
          [
            [x, dune(x) + 10],
            [x + 1, dune(x) + 3],
          ],
          0.9,
          x,
        );
      // cottages on stilts, a boardwalk down to the sand
      const cottage = (cx: number, c: C, seed: number) => {
        const base = sh(cx) + h * 0.018;
        const cw = w * 0.11,
          ch = h * 0.026,
          lift = h * 0.016;
        for (const f of [-0.42, -0.1, 0.22, 0.42])
          pen.stroke(
            [
              [cx + cw * f, base],
              [cx + cw * f, base - lift],
            ],
            1.1,
            f + seed,
          );
        pen.stroke(
          [
            [cx - cw / 2 - 4, base - lift],
            [cx + cw / 2, base - lift],
          ],
          1.2,
        );
        pen.shape(rect(cx - cw / 2, base - lift - ch, cw, ch), c, 1.3, seed);
        pen.shape(
          [
            [cx - cw / 2 - 3, base - lift - ch],
            [cx, base - lift - ch - h * 0.02],
            [cx + cw / 2 + 3, base - lift - ch],
          ],
          I.paint([96, 104, 120], 0.05),
          1.3,
          seed + 1,
        );
        pen.shape(rect(cx - cw * 0.3, base - lift - ch * 0.75, 5, 6), I.lit ? I.window : null, 1);
        pen.shape(rect(cx + cw * 0.12, base - lift - ch * 0.75, 5, 6), I.lit ? I.window : null, 1);
        // steps down
        pen.stroke(
          [
            [cx - cw / 2 - 4, base - lift],
            [cx - cw / 2 - 12, base],
          ],
          1,
        );
      };
      cottage(x0 + w * 0.68, I.paint([120, 172, 214], 0.05), 21);
      cottage(x0 + w * 0.86, I.paint([244, 208, 112], 0.05), 31);
    },
  ],
  live(g: CanvasRenderingContext2D, k: Kit, t: number, X: (x: number, layer: number) => number) {
    const { I, h, w, PW } = k;
    const ink = css(I.inkC, 0.9);
    g.strokeStyle = ink;
    g.lineCap = "round";
    g.lineJoin = "round";
    const line = (pts: Pt[], layer: number, lw = 1.1) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(X(x, layer), y) : g.moveTo(X(x, layer), y)));
      g.lineWidth = lw;
      g.stroke();
    };
    // the sea glinting: little ticks of light that come and go, thicker
    // where the sun is, drifting slowly with the swell
    {
      const hz = h * coast.hz;
      const glint = I.night > 0.6 ? "rgba(220,235,255,0.5)" : "rgba(255,255,255,0.9)";
      g.strokeStyle = glint;
      g.lineWidth = 1;
      for (let i = 0; i < 36; i++) {
        const life = (t * 0.35 + hash(i * 3.3)) % 1;
        if (life > 0.5) continue;
        const a = Math.sin((life / 0.5) * Math.PI);
        const x = hash(i * 7.1) * PW + t * 3;
        const y = hz + 3 + hash(i * 5.7) * (h * 0.055);
        const len = (2 + 4 * hash(i)) * a;
        g.globalAlpha = a;
        g.beginPath();
        g.moveTo(X(x, 1) - len, y);
        g.lineTo(X(x, 1) + len, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.strokeStyle = ink;
    }
    // the surf: a line of foam running up the sand and sliding back, in
    // short stretches so it breaks up like real waves
    const night = I.night > 0.5;
    g.strokeStyle = night ? "rgba(220,230,255,0.6)" : "rgba(255,255,255,0.95)";
    const cyc = (t * 0.22) % 1;
    const reach = Math.sin(cyc * Math.PI);
    for (let x = 0; x < PW; x += 26) {
      const X0 = X(x, 2);
      if (X0 > w + 30) continue;
      const seg: Pt[] = [];
      for (let d = 0; d < 20; d += 4) {
        const xx = x + d;
        seg.push([xx, coast.shore(k, xx) + 3 - reach * 4 + Math.sin(xx * 0.2) * 0.6]);
      }
      if (X(seg[seg.length - 1][0], 2) < X0) continue; // across the wrap
      g.globalAlpha = 0.4 + reach * 0.6;
      line(seg, 2, 1.2);
    }
    g.globalAlpha = 1;
    g.strokeStyle = ink;
    // a sailboat drifting along, far out
    {
      const x = (t * 3 + w * 1.4) % PW;
      const y = h * coast.hz + 4;
      g.fillStyle = css(I.paint([250, 250, 246], 0.2));
      const hull: Pt[] = [
        [x - 7, y],
        [x + 7, y],
        [x + 5, y + 3],
        [x - 5, y + 3],
      ];
      g.beginPath();
      hull.forEach(([a, b], i) => (i ? g.lineTo(X(a, 1), b) : g.moveTo(X(a, 1), b)));
      g.closePath();
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.moveTo(X(x, 1), y);
      g.lineTo(X(x, 1), y - 17);
      g.lineTo(X(x + 9, 1), y - 2);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(X(x - 1, 1), y - 14);
      g.lineTo(X(x - 7, 1), y - 2);
      g.lineTo(X(x - 1, 1), y - 2);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // gulls wheeling over the beach
    if (!night)
      for (let i = 0; i < 3; i++) {
        const a = t * (0.25 + i * 0.05) + i * 2;
        const cx = w * (0.3 + i * 0.25) + Math.cos(a) * 30,
          cy = h * (0.6 + i * 0.03) + Math.sin(a * 1.3) * 6;
        const f = Math.sin(t * 4 + i) > 0.3 ? -2 : 1;
        g.beginPath();
        g.moveTo(cx - 5, cy + f);
        g.quadraticCurveTo(cx - 2, cy - 2, cx, cy);
        g.quadraticCurveTo(cx + 2, cy - 2, cx + 5, cy + f);
        g.lineWidth = 1.1;
        g.stroke();
      }
    // the lighthouse beam sweeping after dark
    if (I.night > 0.35) {
      const lx = w * 0.8,
        ly = h * 0.712 - h * 0.12 - h * 0.009;
      const sx = X(lx, 2);
      const a = t * 0.9;
      const reachB = w * 0.55;
      for (const side of [0, Math.PI]) {
        const ang = a + side;
        const dx = Math.cos(ang),
          spread = Math.sin(ang);
        if (Math.abs(spread) > 0.9) continue;
        const grad = g.createLinearGradient(sx, ly, sx + dx * reachB, ly);
        grad.addColorStop(0, `rgba(255,236,170,${0.45 * I.night})`);
        grad.addColorStop(1, "rgba(255,236,170,0)");
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(sx, ly);
        g.lineTo(sx + dx * reachB, ly - 10 - Math.abs(spread) * 6);
        g.lineTo(sx + dx * reachB, ly + 10 + Math.abs(spread) * 6);
        g.closePath();
        g.fill();
      }
    }
    // a kite over the beach day
    if (!night && !I.snowy) {
      const ax = w * 2.3,
        ay = coast.shore(k, ax) + h * 0.05;
      const kx = ax + 30 + Math.sin(t * 0.9) * 6,
        ky = h * 0.62 + Math.sin(t * 1.3) * 5;
      line(
        [
          [ax, ay],
          [(ax + kx) / 2 + 4, (ay + ky) / 2 + 6],
          [kx, ky + 6],
        ],
        2,
        0.7,
      );
      g.fillStyle = css(I.paint([240, 196, 70], 0.04));
      g.beginPath();
      g.moveTo(X(kx, 2), ky - 6);
      g.lineTo(X(kx + 5, 2), ky);
      g.lineTo(X(kx, 2), ky + 6);
      g.lineTo(X(kx - 5, 2), ky);
      g.closePath();
      g.fill();
      g.lineWidth = 1.1;
      g.stroke();
      line(
        [
          [kx, ky + 6],
          [kx - 3, ky + 10],
          [kx + 1, ky + 13],
          [kx - 2, ky + 17],
        ],
        2,
        0.8,
      );
    }
  },
};

// ---------------------------------------------------------------------------
// the farm
// ---------------------------------------------------------------------------

const farm = {
  hills(k: Kit, x: number) {
    return k.h * (0.718 + 0.012 * loopWave(x, k.PW, 5));
  },
  fields(k: Kit, x: number) {
    return k.h * (0.748 + 0.006 * loopWave(x, k.PW, 9));
  },
  ground(k: Kit, y: number) {
    void y;
    return k.h * 0.79;
  },
  land(k: Kit, x: number) {
    return k.h * (0.79 + 0.005 * loopWave(x, k.PW, 13));
  },
  road: 0.875,
  draw(k: Kit) {
    const { pens, I, h, PW, season } = k;
    const winter = I.snowy;
    // far: low rolling hills with clumps of trees on the skyline
    const hill = curve((x) => this.hills(k, x), -8, PW + 8);
    pens[0].fillOnly([...hill, [PW + 8, h + 8], [-8, h + 8]], winter ? I.snow : I.paint([120, 160, 104], 0.36));
    pens[0].stroke(hill, 1.2, 1);
    for (let i = 0; i < 16; i++) {
      const x = hash(i * 9 + 1) * PW;
      // a few trees of different sizes, bunched unevenly, the tallest in
      // the middle the way a windbreak grows
      const n = 1 + Math.floor(hash(i) * 4);
      let cx = x;
      for (let j = 0; j < n; j++) {
        const mid = 1 - Math.abs(j - (n - 1) / 2) / Math.max(1, n / 2);
        const rr = 2.6 + hash(i * 5 + j) * 1.6 + mid * 1.4;
        const by = this.hills(k, cx) + 1;
        pens[0].shape(ellipse(cx, by - rr * 0.95, rr * 0.9, rr, 12), winter ? I.paint([150, 150, 160], 0.36) : I.paint([70, 120, 80], 0.36), 1, i + j);
        cx += rr * (1 + hash(i + j * 13) * 0.5);
      }
    }
    // middle: a patchwork of fields, divided by lines that fan toward you
    const crops: C[] =
      season === "autumn"
        ? [
            [220, 190, 110],
            [150, 116, 80],
            [190, 170, 90],
            [130, 150, 80],
          ]
        : season === "winter"
          ? [
              [200, 186, 150],
              [150, 120, 96],
              [190, 180, 150],
              [170, 156, 120],
            ]
          : season === "spring"
            ? [
                [130, 180, 90],
                [150, 116, 80],
                [170, 200, 110],
                [110, 160, 80],
              ]
            : [
                [222, 196, 100],
                [110, 168, 80],
                [150, 190, 90],
                [196, 176, 96],
              ];
    // field edges round the loop; each edge leans one way, the same on both
    // fields it divides, and the loop closes on itself
    const edges: number[] = [0];
    for (let i = 0; edges[edges.length - 1] < PW - 60; i++) edges.push(edges[edges.length - 1] + 50 + hash(i * 3) * 70);
    edges.push(PW);
    const lean = (i: number) => (i === edges.length - 1 ? 0 : (hash(i * 7 + 2) - 0.5) * 30) * (i === 0 ? 0 : 1);
    for (const shift of [-PW, 0, PW])
      for (let i = 0; i < edges.length - 1; i++) {
        const x = edges[i] + shift,
          x1 = edges[i + 1] + shift;
        if (x1 < -40 || x > PW + 40) continue;
        const l0 = lean(i),
          l1 = lean(i + 1);
        const top = curve((xx) => this.fields(k, xx), x, x1, 8);
        const poly: Pt[] = [...top, [x1 + l1, this.land(k, x1) + 2], [x + l0, this.land(k, x) + 2]];
        pens[1].shape(poly, winter ? I.snow : I.paint(crops[i % crops.length], 0.2), 1, i);
        // crop rows on every other field
        if (i % 2 === 0 && !winter)
          for (let r = 1; r < 4; r++) {
            const f = r / 4;
            const y = (y0: number, y1: number) => y0 + (y1 - y0) * f;
            pens[1].stroke(
              [
                [x + l0 * f + 4, y(this.fields(k, x), this.land(k, x))],
                [x1 + l1 * f - 4, y(this.fields(k, x1), this.land(k, x1))],
              ],
              0.7,
              r + i,
            );
          }
      }
    const ft = curve((xx) => this.fields(k, xx), -8, PW + 8);
    pens[1].stroke(ft, 1.1, 4);
    // near: grass, and a gravel road running round the whole loop
    const grass: C = winter ? I.snow : I.meadow;
    const land = curve((xx) => this.land(k, xx), -8, PW + 8);
    pens[2].fillOnly([...land, [PW + 8, h + 8], [-8, h + 8]], grass);
    pens[2].stroke(land, 1.3, 5);
    const ry = h * this.road;
    const road: C = winter ? I.paint([226, 228, 236], 0.04) : I.paint([206, 192, 160], 0.04);
    pens[2].fillOnly(
      [
        [-8, ry],
        [PW + 8, ry],
        [PW + 8, ry + h * 0.022],
        [-8, ry + h * 0.022],
      ],
      road,
    );
    pens[2].stroke(curve(() => ry, -8, PW + 8, 30), 1.2, 6);
    pens[2].stroke(curve(() => ry + h * 0.022, -8, PW + 8, 30), 1.2, 7);
    for (let j = 0; j < 30; j++) {
      const gx = hash(j * 11) * PW,
        gy = ry + 3 + hash(j * 5) * (h * 0.022 - 6);
      pens[2].stroke(
        [
          [gx, gy],
          [gx + 1.5, gy],
        ],
        0.8,
        j,
      );
    }
  },
  scenes: [
    // a red barn, a silo, round hay bales
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * 0.86;
      const red: C = I.paint([194, 62, 50], 0.04),
        white: C = I.paint([246, 244, 236], 0.04);
      // the silo, behind the barn's shoulder
      const sx = x0 + w * 0.46,
        sw = w * 0.032,
        sh = h * 0.11;
      pen.shape(rect(sx - sw, base - sh, sw * 2, sh), I.paint([186, 188, 190], 0.04), 1.3, 2);
      for (let f = 0.2; f < 1; f += 0.2)
        pen.stroke(
          [
            [sx - sw, base - sh * f],
            [sx + sw, base - sh * f],
          ],
          0.8,
          f,
        );
      pen.shape(ellipse(sx, base - sh, sw, sw * 0.9, 14, Math.PI, TAU), I.paint([150, 160, 170], 0.04), 1.3, 3);
      // the barn, with a gambrel roof
      const bx = x0 + w * 0.3,
        bw = w * 0.11,
        wall = h * 0.04;
      pen.shape(rect(bx - bw, base - wall, bw * 2, wall), red, 1.3, 4);
      pen.shape(
        [
          [bx - bw - 3, base - wall],
          [bx - bw * 0.75, base - wall - h * 0.026],
          [bx, base - wall - h * 0.04],
          [bx + bw * 0.75, base - wall - h * 0.026],
          [bx + bw + 3, base - wall],
        ],
        I.snowy ? I.snow : I.paint([96, 92, 100], 0.04),
        1.3,
        5,
      );
      // big door with a white X, a hay loft window
      const dw = bw * 0.38,
        dh = wall * 0.78;
      pen.shape(rect(bx - dw, base - dh, dw * 2, dh), red, 1.2, 6);
      pen.stroke(
        [
          [bx - dw, base - dh],
          [bx + dw, base],
        ],
        1,
      );
      pen.stroke(
        [
          [bx + dw, base - dh],
          [bx - dw, base],
        ],
        1,
      );
      pen.shape(rect(bx - 4, base - wall - h * 0.022, 8, 7), I.lit ? I.window : white, 1.1, 7);
      // round hay bales
      if (!I.snowy)
        for (const [f, r] of [
          [0.68, 7],
          [0.76, 6],
          [0.83, 7],
        ]) {
          // lying on its side: a rounded body, the rolled end facing you
          const hx = x0 + w * f,
            hy = base - r + 2;
          const hay = I.paint([226, 196, 110], 0.04);
          pen.shape(
            [
              [hx - r * 1.5, hy - r],
              [hx, hy - r],
              [hx, hy + r],
              [hx - r * 1.5, hy + r],
              [hx - r * 1.5 - r * 0.4, hy],
            ],
            hay,
            1.2,
            f,
          );
          pen.shape(ellipse(hx, hy, r * 0.55, r, 16), mix(hay, [255, 240, 200], 0.25), 1.2, f + 2);
          pen.stroke(ellipse(hx, hy, r * 0.24, r * 0.45, 10, 0, TAU * 0.8), 0.7, f + 1);
        }
    },
    // a white farmhouse with a porch, a windpump, a big oak
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * 0.862;
      const white: C = I.paint([246, 244, 236], 0.04);
      const hx = x0 + w * 0.3,
        hw = w * 0.09,
        hh = h * 0.05;
      pen.shape(rect(hx - hw, base - hh, hw * 2, hh), white, 1.3, 2);
      pen.shape(
        [
          [hx - hw - 4, base - hh],
          [hx, base - hh - h * 0.03],
          [hx + hw + 4, base - hh],
        ],
        I.snowy ? I.snow : I.paint([86, 92, 110], 0.04),
        1.3,
        3,
      );
      pen.shape(rect(hx + hw * 0.45, base - hh - h * 0.03, 5, h * 0.016), I.paint([170, 80, 64], 0.04), 1, 4);
      // windows upstairs and down, a porch roof across the front
      for (const [fx, fy] of [
        [-0.6, 0.75],
        [0.4, 0.75],
        [-0.6, 0.38],
        [0.4, 0.38],
      ])
        pen.shape(rect(hx + hw * fx, base - hh * fy, 6, 6), I.lit ? I.window : I.paint([150, 190, 220], 0.04), 1, fx + fy);
      pen.stroke(
        [
          [hx - hw - 2, base - hh * 0.5],
          [hx + hw + 2, base - hh * 0.5],
        ],
        1.2,
      );
      for (const f of [-0.95, -0.3, 0.3, 0.95])
        pen.stroke(
          [
            [hx + hw * f, base - hh * 0.5],
            [hx + hw * f, base],
          ],
          0.9,
          f,
        );
      pen.shape(rect(hx - 3, base - hh * 0.42, 6, hh * 0.42), I.paint([120, 90, 70], 0.04), 1, 5);
      // the windpump's tower (the wheel turns, in live)
      const mx = x0 + w * 0.62,
        mt = base - h * 0.1;
      for (const s of [-1, 1])
        pen.stroke(
          [
            [mx + s * 9, base],
            [mx + s * 2, mt],
          ],
          1.2,
          s,
        );
      for (let f = 0.25; f < 1; f += 0.25) {
        const y = base - (base - mt) * f;
        const half = 9 - 7 * f;
        pen.stroke(
          [
            [mx - half, y],
            [mx + half, y],
          ],
          0.8,
          f,
        );
      }
      pen.stroke(
        [
          [mx - 9, base],
          [mx + 4.4, base - (base - mt) * 0.66],
        ],
        0.7,
      );
      pen.stroke(
        [
          [mx + 9, base],
          [mx - 4.4, base - (base - mt) * 0.66],
        ],
        0.7,
      );
      // a stock tank at its foot
      pen.shape(rect(mx + 10, base - 5, 14, 5), I.paint([170, 176, 180], 0.04), 1, 6);
      // the oak
      leafy(pen, x0 + w * 0.84, base + 2, h * 0.07, I.leaf, I.snowy || k.season === "winter");
      // a mailbox by the road
      const bx = x0 + w * 0.47,
        by = h * farm.road;
      pen.stroke(
        [
          [bx, by],
          [bx, by - 9],
        ],
        1.1,
      );
      pen.shape(rect(bx - 4, by - 13, 8, 4.5), I.paint([70, 84, 100], 0.04), 1, 7);
    },
    // a cornfield along the road, a scarecrow
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const top = h * 0.81,
        base = h * 0.868;
      const stalk: C =
        I.snowy || season === "winter" ? I.paint([196, 176, 130], 0.04) : season === "autumn" ? I.paint([214, 184, 100], 0.04) : I.paint([104, 168, 72], 0.04);
      const tall = I.snowy || season === "winter" ? 0.25 : 1;
      // the field as one mass with a ragged tassel line on top, split for
      // the scarecrow; only the front row is drawn stalk by stalk
      const leafInk = mix(stalk, [20, 40, 20], 0.45);
      for (const [a, b] of [
        [0.06, 0.52],
        [0.64, 0.94],
      ]) {
        const xa = x0 + w * a,
          xb = x0 + w * b;
        const ht = 22 * tall;
        const crest: Pt[] = [];
        for (let x = xa; x <= xb + 0.1; x += 3) crest.push([x, base - ht + (Math.round((x - xa) / 3) % 2 ? 1.6 : -0.6) * tall + (hash(x * 1.7) - 0.5) * 1.6]);
        pen.shape([[xa, base], ...crest, [xb, base]], stalk, 1.1, a);
        // a few rows of leaves hinted inside
        const g = pen.g;
        g.strokeStyle = css(leafInk, 0.7);
        g.lineWidth = 0.8;
        for (let x = xa + 5; x < xb - 4; x += 7 + hash(x) * 3) {
          const y = base - ht * (0.35 + hash(x * 7) * 0.4);
          const sd = hash(x * 11) > 0.5 ? 1 : -1;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + sd * 3, y - 3, x + sd * 5, y + 0.5);
          g.stroke();
        }
        for (let x = xa + 3; x < xb - 2; x += 9 + hash(x + 1) * 3) g2(pen, x, base + 3, ht * (0.75 + hash(x * 3) * 0.2), leafInk, tall < 1);
      }
      // the scarecrow
      const sx = x0 + w * 0.58,
        sy = top + 2;
      pen.stroke(
        [
          [sx, base],
          [sx, sy - 14],
        ],
        1.3,
      );
      pen.stroke(
        [
          [sx - 12, sy - 6],
          [sx + 12, sy - 6],
        ],
        1.3,
      );
      pen.shape(
        [
          [sx - 6, sy - 7],
          [sx + 6, sy - 7],
          [sx + 5, sy + 6],
          [sx - 5, sy + 6],
        ],
        I.paint([90, 130, 190], 0.04),
        1.1,
        2,
      );
      pen.shape(ellipse(sx, sy - 12, 3.6, 3.8, 12), I.paint([230, 200, 120], 0.04), 1.1, 3);
      pen.shape(
        [
          [sx - 7, sy - 14.5],
          [sx + 7, sy - 14.5],
          [sx + 3, sy - 18],
          [sx - 3, sy - 18],
        ],
        I.paint([150, 110, 70], 0.04),
        1.1,
        4,
      );
    },
    // a pasture: a pond, cows (in live), power poles along the road
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const pond = ellipse(x0 + w * 0.66, h * 0.835, w * 0.13, h * 0.016, 30);
      pen.shape(pond, I.snowy ? I.paint([226, 236, 246], 0.04) : I.water, 1.3, 2);
      pen.stroke(
        [
          [x0 + w * 0.6, h * 0.835],
          [x0 + w * 0.64, h * 0.835],
        ],
        0.8,
      );
      // cattails at the pond's edge
      for (let i = 0; i < 4; i++) {
        const cx = x0 + w * (0.54 + i * 0.012),
          cy = h * 0.84;
        pen.stroke(
          [
            [cx, cy],
            [cx + 1, cy - 10 - i],
          ],
          0.9,
          i,
        );
        pen.shape(rect(cx, cy - 13 - i, 2.4, 5), I.paint([120, 84, 60], 0.04), 0.8, i);
      }
      // power poles and the wires between them
      const ry = h * farm.road;
      const poles = [0.12, 0.42, 0.9].map((f) => x0 + w * f);
      for (const px of poles) {
        pen.stroke(
          [
            [px, ry - 2],
            [px, ry - h * 0.075],
          ],
          1.3,
          px,
        );
        pen.stroke(
          [
            [px - 7, ry - h * 0.07],
            [px + 7, ry - h * 0.07],
          ],
          1.1,
          px + 1,
        );
      }
      for (let i = 0; i < poles.length - 1; i++)
        for (const d of [-6, 6]) {
          const a = poles[i] + d,
            b = poles[i + 1] + d,
            y = ry - h * 0.07;
          const pts: Pt[] = [];
          for (let s = 0; s <= 10; s++) {
            const u = s / 10;
            pts.push([a + (b - a) * u, y + Math.sin(u * Math.PI) * 6]);
          }
          pen.stroke(pts, 0.7, i + d);
        }
    },
  ],
  live(g: CanvasRenderingContext2D, k: Kit, t: number, X: (x: number, layer: number) => number) {
    const { I, h, w } = k;
    g.strokeStyle = css(I.inkC, 0.9);
    g.lineCap = "round";
    g.lineJoin = "round";
    const night = I.night > 0.5;
    // the windpump's wheel turning in the wind
    {
      const mx = X(w * 1.62, 2),
        my = h * 0.862 - h * 0.1;
      const spin = t * (1.2 + Math.min(3, k.L.wind / 3));
      g.lineWidth = 1;
      g.beginPath();
      g.arc(mx, my, 9, 0, TAU);
      g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = spin + (i * TAU) / 12;
        g.beginPath();
        g.moveTo(mx + Math.cos(a) * 2, my + Math.sin(a) * 2);
        g.lineTo(mx + Math.cos(a) * 9, my + Math.sin(a) * 9);
        g.stroke();
      }
      g.fillStyle = css(I.paint([226, 84, 70], 0.04));
      g.beginPath();
      g.moveTo(mx + 1, my - 1.5);
      g.lineTo(mx + 15, my - 3);
      g.lineTo(mx + 15, my + 4);
      g.lineTo(mx + 1, my + 1.5);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // smoke from the farmhouse chimney
    {
      const cx = w * 1.3 + w * 0.09 * 0.45 + 2,
        cy = h * 0.862 - h * 0.05 - h * 0.03;
      for (let i = 0; i < 5; i++) {
        const age = (t * 0.12 + i / 5) % 1;
        g.globalAlpha = (1 - age) * Math.min(1, age * 6) * 0.8;
        g.beginPath();
        g.arc(X(cx + age * age * 30, 2), cy - age * 40, 1.6 + age * 4, 0, TAU);
        g.lineWidth = 0.9;
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // a tractor puttering round the road, a puff of dust behind
    {
      const PW = k.PW;
      const x = (t * 9) % PW;
      const y = h * farm.road + h * 0.016;
      const sx = X(x, 2);
      g.fillStyle = css(I.paint([96, 160, 80], 0.04));
      g.lineWidth = 1.2;
      g.beginPath();
      g.rect(sx - 8, y - 12, 12, 7);
      g.fill();
      g.stroke();
      g.beginPath();
      g.rect(sx - 6, y - 19, 7, 7);
      g.fillStyle = css(I.paint([200, 220, 236], 0.04));
      g.fill();
      g.stroke();
      g.fillStyle = css(I.paint([70, 70, 80], 0.04));
      g.beginPath();
      g.arc(sx - 5, y - 4, 5, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(sx + 4, y - 2.5, 3, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(sx + 2, y - 12);
      g.lineTo(sx + 2, y - 16);
      g.stroke();
      if (night) {
        g.fillStyle = "rgba(255,230,150,0.9)";
        g.beginPath();
        g.arc(sx + 4.5, y - 9, 1.4, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 4; i++) {
        const age = (t * 1.2 + i / 4) % 1;
        g.globalAlpha = (1 - age) * 0.6;
        g.beginPath();
        g.arc(sx - 12 - age * 14, y - 2 - age * 4, 1.5 + age * 3, 0, TAU);
        g.lineWidth = 0.8;
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // the pond: rings spreading where a fish rose or a bug landed
    if (!I.snowy) {
      for (let i = 0; i < 2; i++) {
        const life = (t * 0.25 + i * 0.5) % 1;
        const px = w * 3 + w * (0.6 + 0.12 * hash(Math.floor(t * 0.25 + i * 0.5) * 3 + i)),
          py = h * 0.836;
        g.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - life)).toFixed(3)})`;
        g.lineWidth = 0.9;
        g.beginPath();
        g.ellipse(X(px, 2), py, 2 + life * 9, 0.6 + life * 1.8, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = css(I.inkC, 0.9);
    }
    // cows grazing in the pasture, heads going up and down
    for (let i = 0; i < 3; i++) {
      const cx = w * (3.18 + i * 0.1),
        cy = h * (0.832 + (i % 2) * 0.012);
      const sx = X(cx, 2);
      const down = Math.sin(t * 0.5 + i * 2) > 0;
      g.fillStyle = css(I.paint([248, 246, 240], 0.04));
      g.lineWidth = 1.1;
      for (const lx of [-5, -3, 3, 5]) {
        g.beginPath();
        g.moveTo(sx + lx, cy + 2);
        g.lineTo(sx + lx, cy + 7);
        g.stroke();
      }
      g.beginPath();
      g.ellipse(sx, cy, 7, 3.6, 0, 0, TAU);
      g.fill();
      g.stroke();
      // patches
      g.fillStyle = css(I.paint([40, 40, 46], 0.04));
      g.beginPath();
      g.ellipse(sx - 2, cy - 0.5, 2, 1.6, 0.4, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(sx + 3.5, cy + 0.8, 1.4, 1.2, 0, 0, TAU);
      g.fill();
      // head
      g.fillStyle = css(I.paint([248, 246, 240], 0.04));
      const hy = down ? cy + 4 : cy - 2;
      g.beginPath();
      g.ellipse(sx + 9, hy, 2.6, 2, down ? 0.8 : 0, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(sx - 7, cy - 1);
      g.lineTo(sx - 9, cy + 3);
      g.stroke();
    }
    // crows round the scarecrow by day, fireflies at night
    if (!night)
      for (let i = 0; i < 2; i++) {
        const a = t * 0.6 + i * 3;
        const cx = X(w * 2.58 + Math.cos(a) * 24, 2),
          cy = h * 0.77 + Math.sin(a * 1.4) * 5;
        const f = Math.sin(t * 6 + i) > 0 ? -1.6 : 1;
        g.beginPath();
        g.moveTo(cx - 4, cy + f);
        g.lineTo(cx, cy);
        g.lineTo(cx + 4, cy + f);
        g.lineWidth = 1.4;
        g.stroke();
      }
    else if (!I.snowy) {
      g.fillStyle = "rgba(255,226,120,0.95)";
      for (let i = 0; i < 14; i++) {
        if (Math.sin(t * 1.4 + i * 2.3) < 0.5) continue;
        const x = X(hash(i + 50) * k.PW + Math.sin(t * 0.5 + i) * 6, 2);
        const y = h * (0.8 + hash(i + 60) * 0.12) + Math.cos(t * 0.7 + i) * 3;
        g.beginPath();
        g.arc(x, y, 1.3, 0, TAU);
        g.fill();
      }
    }
  },
};

// one corn stalk: a stem, a few leaves arching out, a tassel
function g2(pen: Pen, x: number, base: number, h: number, c: C, stubble: boolean) {
  pen.stroke(
    [
      [x, base],
      [x + 0.6, base - h],
    ],
    1,
    x,
  );
  if (stubble) return;
  const g = pen.g;
  g.strokeStyle = css(c);
  g.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) {
    const y = base - h * (0.3 + i * 0.22);
    const s = i % 2 ? 1 : -1;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + s * 5, y - 4, x + s * 7, y + 1);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(x + 0.6, base - h);
  g.lineTo(x - 1, base - h - 3);
  g.moveTo(x + 0.6, base - h);
  g.lineTo(x + 2, base - h - 3);
  g.stroke();
}

// ---------------------------------------------------------------------------
// the city
// ---------------------------------------------------------------------------

// a grid of windows on a building face; some lit after dark
function windows(pen: Pen, I: Inks, x: number, y: number, bw: number, bh: number, cols: number, rows: number, seed: number, glass: C) {
  const gx = bw / cols,
    gy = bh / rows;
  const ww = Math.max(2, gx * 0.5),
    wh = Math.max(2.5, gy * 0.55);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const lit = I.lit && hash(seed * 13.7 + r * 7.1 + c * 3.3) > 0.42;
      pen.shape(rect(x + gx * c + (gx - ww) / 2, y + gy * r + (gy - wh) / 2, ww, wh), lit ? I.window : glass, 0.7, seed + r + c * 0.1);
    }
}

// a little street lamp: post, arm and lantern
function lamp(pen: Pen, I: Inks, x: number, base: number, ht: number) {
  pen.stroke(
    [
      [x, base],
      [x, base - ht],
    ],
    1.3,
    x,
  );
  pen.shape(rect(x - 2.5, base - ht - 5, 5, 5), I.lit ? I.window : I.paint([236, 232, 214], 0.04), 1, x + 1);
  pen.stroke(
    [
      [x - 3.5, base - ht - 5],
      [x, base - ht - 8],
      [x + 3.5, base - ht - 5],
    ],
    1,
    x + 2,
  );
}

const city = {
  top: 0.4, // towers stand taller than hills, so the drawing starts higher
  hz: 0.745, // the far bank
  bank: 0.79, // the railing on our side of the river
  street: [0.835, 0.9] as [number, number],
  ground(k: Kit) {
    const { pens, I, h, PW } = k;
    const hz = h * this.hz,
      bank = h * this.bank,
      s0 = h * this.street[0],
      s1 = h * this.street[1];
    // far: the rest of the city across the river, a pale jumble of towers
    // that loops round the whole panorama
    type B = { x: number; bw: number; bh: number; i: number };
    const bs: B[] = [];
    for (let x = 0, i = 0; x < PW; i++) {
      const bw = 12 + hash(i * 3.1) * 24;
      const bh = h * (0.025 + hash(i * 7.7) ** 2 * 0.09);
      bs.push({ x, bw, bh, i });
      x += bw * (0.75 + hash(i * 5.5) * 0.3);
    }
    const tones: C[] = [
      [150, 170, 196],
      [176, 186, 204],
      [160, 176, 186],
      [190, 180, 196],
    ];
    for (const sh of [-PW, 0, PW])
      for (const b of bs) {
        const x = b.x + sh;
        if (x > PW + 8 || x + b.bw < -8) continue;
        const top = hz - b.bh;
        pens[0].shape(rect(x, top, b.bw, b.bh + 2), I.paint(tones[b.i % 4], 0.4), 1, b.i);
        if (hash(b.i * 2.3) > 0.78)
          pens[0].stroke(
            [
              [x + b.bw / 2, top],
              [x + b.bw / 2, top - 8 - hash(b.i) * 8],
            ],
            1,
            b.i,
          );
        else if (hash(b.i * 4.1) > 0.7)
          pens[0].shape(
            [
              [x + 2, top],
              [x + b.bw / 2, top - b.bw * 0.4],
              [x + b.bw - 2, top],
            ],
            I.paint(tones[(b.i + 1) % 4], 0.4),
            1,
            b.i + 0.5,
          );
        if (I.lit)
          for (let r = 0; r < b.bh / 7 - 1; r++)
            for (let c = 0; c < b.bw / 6 - 1; c++)
              if (hash(b.i * 9 + r * 3 + c) > 0.6) pens[0].fillOnly(rect(x + 3 + c * 6, top + 4 + r * 7, 2, 2.5), I.window);
      }
    // the river, with a few rows of little wave marks
    const water: C = I.snowy ? mix(I.paint([84, 140, 190], 0.14), [220, 230, 240], 0.25) : I.paint([84, 140, 190], 0.14);
    pens[1].fillOnly([[-8, hz], [PW + 8, hz], [PW + 8, bank + 2], [-8, bank + 2]], water);
    pens[1].stroke(curve(() => hz, -8, PW + 8, 40), 1.2, 1);
    for (let r = 1; r < 5; r++) {
      const y = hz + (bank - hz) * (r / 5);
      const gap = 36 + r * 10;
      for (let x = hash(r) * gap; x < PW - 10; x += gap * (0.7 + hash(x + r) * 0.6)) {
        const l = 3 + r * 1.5;
        pens[1].stroke(
          [
            [x, y],
            [x + l * 0.5, y - 0.8],
            [x + l, y],
          ],
          0.8,
          x,
        );
      }
    }
    // our side: a paved walk along the water with a railing
    const paving: C = I.snowy ? I.snow : I.paint([222, 212, 192], 0.04);
    pens[2].fillOnly([[-8, bank], [PW + 8, bank], [PW + 8, h + 8], [-8, h + 8]], paving);
    pens[2].stroke(curve(() => bank, -8, PW + 8, 30), 1.3, 2);
    pens[2].stroke(curve(() => bank - 7, -8, PW + 8, 30), 1.1, 3);
    for (let x = 0; x < PW; x += 12)
      pens[2].stroke(
        [
          [x, bank],
          [x, bank - 7],
        ],
        0.9,
        x,
      );
    for (let x = 20; x < PW; x += 34)
      pens[2].stroke(
        [
          [x, bank + 6 + (x % 3)],
          [x + 6, bank + 6 + (x % 3)],
        ],
        0.7,
        x,
      );
    // the street: kerb, asphalt, a dashed middle line, and the far pavement
    const road: C = I.snowy ? mix(I.paint([120, 124, 136], 0.04), [230, 234, 240], 0.35) : I.paint([120, 124, 136], 0.04);
    pens[2].shape([[-8, s0], [PW + 8, s0], [PW + 8, s1], [-8, s1]], road, 1.3, 4);
    for (let x = 6; x < PW; x += 26)
      pens[2].stroke(
        [
          [x, (s0 + s1) / 2],
          [x + 12, (s0 + s1) / 2],
        ],
        1.2,
        x,
      );
    // the near pavement, then a strip of grass with a hydrant here and there
    const s2 = s1 + h * 0.035;
    pens[2].fillOnly([[-8, s1], [PW + 8, s1], [PW + 8, s2], [-8, s2]], paving);
    for (let x = 0; x < PW; x += 30)
      pens[2].stroke(
        [
          [x, s1 + 2],
          [x - 3, s2 - 1],
        ],
        0.7,
        x,
      );
    const verge: C = I.snowy ? I.snow : I.paint([132, 182, 104], 0.04);
    pens[2].shape([[-8, s2], [PW + 8, s2], [PW + 8, h + 8], [-8, h + 8]], verge, 1.2, 6);
    if (!I.snowy)
      for (let i = 0; i < PW / 14; i++) {
        const x = hash(i * 3.7) * PW,
          y = s2 + 8 + hash(i * 5.1) * (h - s2 - 14);
        pens[2].stroke(
          [
            [x - 2, y - 3],
            [x, y],
            [x + 2, y - 3],
          ],
          0.8,
          i,
        );
      }
    for (let x = 140; x < PW; x += 310) {
      const red: C = I.paint([214, 70, 60], 0.04);
      pens[2].shape(rect(x - 3, s1 + h * 0.012, 6, 9), red, 1, x);
      pens[2].shape(ellipse(x, s1 + h * 0.012, 3.4, 2.4, 10, Math.PI, TAU), red, 1, x + 1);
    }
    // street lamps along the walk, and a few young trees on the far
    // pavement, skipping the stretch where the houses stand
    for (let x = 30; x < PW; x += 96) lamp(pens[2], I, x, s0 - 2, h * 0.045);
  },
  scenes: [
    // downtown across the river: a stepped spire, a glass tower, an old
    // brick block with a water tower, a slim tower with a beacon
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[1];
      const hz = h * city.hz;
      const glass: C = I.paint([196, 220, 236], 0.12);
      // the stepped spire
      {
        const cx = x0 + w * 0.22,
          bw = w * 0.13;
        const steps: [number, number][] = [
          [1, 0.58],
          [0.74, 0.545],
          [0.5, 0.52],
        ];
        const cream: C = I.paint([238, 226, 196], 0.12);
        let base = hz;
        for (const [f, top] of steps) {
          const ww = bw * f;
          pen.shape(rect(cx - ww / 2, h * top, ww, base - h * top), cream, 1.3, f);
          base = h * top;
        }
        windows(pen, I, cx - bw / 2 + 4, h * 0.6, bw - 8, hz - h * 0.6 - 4, 4, 10, 1, glass);
        for (const f of [-0.18, 0, 0.18])
          pen.stroke(
            [
              [cx + bw * f, h * 0.547],
              [cx + bw * f, h * 0.578],
            ],
            0.8,
            f,
          );
        pen.shape(
          [
            [cx - bw * 0.25, h * 0.52],
            [cx, h * 0.47],
            [cx + bw * 0.25, h * 0.52],
          ],
          I.paint([200, 186, 150], 0.12),
          1.2,
          3,
        );
        pen.stroke(
          [
            [cx, h * 0.47],
            [cx, h * 0.445],
          ],
          1.2,
          4,
        );
      }
      // the glass tower, slanted top
      {
        const x = x0 + w * 0.37,
          bw = w * 0.14;
        const blue: C = I.paint([140, 186, 222], 0.12);
        pen.shape(
          [
            [x, hz],
            [x, h * 0.535],
            [x + bw, h * 0.5],
            [x + bw, hz],
          ],
          blue,
          1.3,
          5,
        );
        for (let y = h * 0.54; y < hz - 3; y += 7)
          pen.stroke(
            [
              [x, y],
              [x + bw, y],
            ],
            0.6,
            y,
          );
        // the sky in the glass
        for (const f of [0.25, 0.4])
          pen.stroke(
            [
              [x + bw * f, h * 0.6],
              [x + bw * (f + 0.25), h * 0.55],
            ],
            1.4,
            f,
          );
        if (I.lit) windows(pen, I, x + 3, h * 0.55, bw - 6, hz - h * 0.55 - 4, 5, 12, 9, blue);
      }
      // the brick block with a water tower
      {
        const x = x0 + w * 0.54,
          bw = w * 0.15,
          top = h * 0.635;
        const brick: C = I.paint([196, 110, 86], 0.12);
        pen.shape(rect(x, top, bw, hz - top), brick, 1.3, 6);
        pen.shape(rect(x - 2, top - 3, bw + 4, 4), I.paint([226, 214, 190], 0.12), 1.1, 7);
        windows(pen, I, x + 3, top + 6, bw - 6, hz - top - 10, 4, 6, 3, glass);
        // water tower: legs, tank, cone
        const tx = x + bw * 0.62,
          tb = top - 3;
        for (const d of [-5, 5])
          pen.stroke(
            [
              [tx + d, tb],
              [tx + d * 0.8, tb - 8],
            ],
            1,
            d,
          );
        const wood: C = I.paint([166, 124, 88], 0.12);
        pen.shape(rect(tx - 7, tb - 21, 14, 13), wood, 1.2, 8);
        pen.stroke(
          [
            [tx - 7, tb - 15],
            [tx + 7, tb - 15],
          ],
          0.7,
          9,
        );
        pen.shape(
          [
            [tx - 8, tb - 21],
            [tx, tb - 28],
            [tx + 8, tb - 21],
          ],
          I.paint([120, 110, 100], 0.12),
          1.2,
          10,
        );
      }
      // the slim tower with an antenna (its light blinks: live)
      {
        const x = x0 + w * 0.72,
          bw = w * 0.085,
          top = h * 0.5;
        const slate: C = I.paint([110, 124, 150], 0.12);
        pen.shape(rect(x, top, bw, hz - top), slate, 1.3, 11);
        for (let i = 1; i < 4; i++)
          pen.stroke(
            [
              [x + (bw * i) / 4, top + 3],
              [x + (bw * i) / 4, hz],
            ],
            0.6,
            i,
          );
        if (I.lit) windows(pen, I, x + 2, top + 4, bw - 4, hz - top - 8, 3, 18, 13, slate);
        pen.stroke(
          [
            [x + bw / 2, top],
            [x + bw / 2, top - h * 0.04],
          ],
          1.2,
          12,
        );
      }
      // a low pink building to finish the block
      {
        const x = x0 + w * 0.84,
          bw = w * 0.12,
          top = h * 0.69;
        pen.shape(rect(x, top, bw, hz - top), I.paint([230, 170, 160], 0.12), 1.3, 14);
        windows(pen, I, x + 3, top + 5, bw - 6, hz - top - 8, 3, 4, 15, glass);
      }
    },
    // a stone suspension bridge across the river
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[1];
      // on our side, a hot dog cart under a striped umbrella
      {
        const p2 = pens[2],
          cx = x0 + w * 0.5,
          b = h * city.street[0] - 4;
        p2.shape(rect(cx - 12, b - 14, 24, 10), I.paint([240, 240, 236], 0.04), 1.2, 1);
        p2.shape(rect(cx - 12, b - 10, 24, 3), I.paint([226, 96, 86], 0.04), 0.9, 2);
        for (const d of [-8, 8]) p2.shape(ellipse(cx + d, b - 2, 3, 3, 10), I.paint([60, 60, 70], 0.04), 1, d);
        p2.stroke(
          [
            [cx, b - 14],
            [cx, b - 30],
          ],
          1,
          3,
        );
        for (let s = 0; s < 4; s++)
          p2.shape(
            [
              [cx, b - 34],
              [cx - 16 + s * 8, b - 28],
              [cx - 8 + s * 8, b - 28],
            ],
            s % 2 ? I.paint([250, 246, 236], 0.04) : I.paint([246, 206, 80], 0.04),
            0.9,
            s + 4,
          );
      }
      const deck = h * 0.733;
      const stone: C = I.paint([206, 190, 166], 0.12);
      const t1 = x0 + w * 0.22,
        t2 = x0 + w * 0.78,
        tt = h * 0.615,
        tw = w * 0.07;
      // cables: the long sag between the towers and the short runs to the banks
      const sag = (a: number, b: number, ya: number, yb: number, dip: number): Pt[] => {
        const pts: Pt[] = [];
        for (let i = 0; i <= 24; i++) {
          const f = i / 24;
          pts.push([a + (b - a) * f, ya + (yb - ya) * f + Math.sin(f * Math.PI) * dip]);
        }
        return pts;
      };
      const main = sag(t1, t2, tt + 4, tt + 4, deck - tt - 10);
      const left = sag(x0, t1, deck - 2, tt + 4, -6);
      const right = sag(t2, x0 + w, tt + 4, deck - 2, -6);
      // hangers down to the deck
      for (const run of [main, left, right])
        for (let i = 1; i < run.length - 1; i += 2)
          pen.stroke(
            [
              [run[i][0], run[i][1]],
              [run[i][0], deck],
            ],
            0.6,
            i,
          );
      for (const run of [main, left, right]) pen.stroke(run, 1.3, 2);
      // the deck
      pen.shape(rect(x0 - 2, deck, w + 4, 5), I.paint([150, 140, 130], 0.12), 1.3, 3);
      // the towers, with tall pointed arches, standing in the water
      for (const tx of [t1, t2]) {
        pen.shape(rect(tx - tw / 2, tt, tw, h * city.bank - tt - 6), stone, 1.3, tx);
        pen.shape(
          [
            [tx - tw * 0.22, deck - 2],
            [tx - tw * 0.22, tt + h * 0.03],
            [tx, tt + h * 0.015],
            [tx + tw * 0.22, tt + h * 0.03],
            [tx + tw * 0.22, deck - 2],
          ],
          I.paint([150, 186, 220], 0.2),
          1.1,
          tx + 1,
        );
        pen.shape(rect(tx - tw / 2 - 2, tt - 3, tw + 4, 4), stone, 1.1, tx + 2);
        // where it meets the water
        pen.shape(rect(tx - tw / 2 - 3, h * city.bank - 9, tw + 6, 5), I.paint([170, 160, 150], 0.1), 1.1, tx + 3);
      }
    },
    // the park on our side: a Ferris wheel by the water, trees and benches
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const bank = h * city.bank;
      // the wheel's frame (the wheel itself turns: live)
      const cx = x0 + w * 0.6,
        cy = h * 0.69,
        R = h * 0.075;
      const steel: C = I.paint([236, 236, 240], 0.04);
      pen.stroke(
        [
          [cx - R * 0.5, bank + 2],
          [cx, cy],
          [cx + R * 0.5, bank + 2],
        ],
        1.6,
        1,
      );
      pen.shape(rect(cx - R * 0.62, bank - 1, R * 1.24, 4), steel, 1.1, 2);
      // a ticket booth
      pen.shape(rect(cx + R * 0.7, bank - 14, 14, 14), I.paint([226, 96, 86], 0.04), 1.2, 3);
      pen.shape(
        [
          [cx + R * 0.7 - 2, bank - 14],
          [cx + R * 0.7 + 7, bank - 20],
          [cx + R * 0.7 + 16, bank - 14],
        ],
        I.paint([250, 246, 236], 0.04),
        1.2,
        4,
      );
      pen.shape(rect(cx + R * 0.7 + 3, bank - 11, 8, 5), I.lit ? I.window : I.paint([210, 230, 240], 0.04), 0.9, 5);
      // trees and benches along the walk
      const bare = season === "winter";
      const leaf: C = season === "autumn" ? I.paint([226, 150, 70], 0.04) : I.paint([110, 170, 96], 0.04);
      for (const [f, s] of [
        [0.06, 26],
        [0.16, 32],
        [0.27, 24],
        [0.9, 30],
      ] as [number, number][])
        leafy(pen, x0 + w * f, h * city.street[0] - 3, s, leaf, bare);
      for (const f of [0.32, 0.78]) {
        const bx = x0 + w * f,
          by = h * city.street[0] - 4;
        pen.shape(rect(bx, by - 7, 18, 3), I.paint([170, 120, 80], 0.04), 1, f);
        pen.stroke(
          [
            [bx + 2, by - 4],
            [bx + 2, by],
          ],
          1,
          f + 1,
        );
        pen.stroke(
          [
            [bx + 16, by - 4],
            [bx + 16, by],
          ],
          1,
          f + 2,
        );
        pen.stroke(
          [
            [bx, by - 11],
            [bx + 18, by - 11],
          ],
          1.1,
          f + 3,
        );
      }
    },
    // our street: a row of houses in different colours, a corner diner
    // with a striped awning, a fire escape, a water tower on the roof
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * city.street[0] - 1;
      const cols: C[] = [
        [214, 120, 96],
        [238, 214, 160],
        [150, 180, 160],
        [176, 120, 110],
        [230, 180, 170],
      ];
      const tops = [0.705, 0.72, 0.695, 0.715, 0.73];
      const glass: C = I.paint([196, 220, 236], 0.04);
      let x = x0 + w * 0.03;
      const hw = (w * 0.94) / 5;
      for (let i = 0; i < 5; i++) {
        const top = h * tops[i];
        pen.shape(rect(x, top, hw, base - top), I.paint(cols[i], 0.04), 1.3, i);
        // cornice
        pen.shape(rect(x - 2, top - 3, hw + 4, 4), I.paint([244, 236, 220], 0.04), 1.1, i + 0.3);
        if (i === 1) {
          // the corner diner: big window, awning
          windows(pen, I, x + 4, top + 6, hw - 8, (base - top) * 0.45, 3, 2, i * 7, glass);
          const ay = base - (base - top) * 0.38;
          pen.shape(rect(x + 3, ay + 6, hw - 6, base - ay - 9), I.lit ? I.window : glass, 1.1, 21);
          const n = 6;
          for (let s = 0; s < n; s++)
            pen.shape(
              [
                [x + 1 + ((hw - 2) * s) / n, ay],
                [x + 1 + ((hw - 2) * (s + 1)) / n, ay],
                [x + 1 + ((hw - 2) * (s + 1)) / n, ay + 6],
                [x + 1 + ((hw - 2) * s) / n, ay + 6],
              ],
              s % 2 ? I.paint([250, 246, 236], 0.04) : I.paint([226, 96, 86], 0.04),
              0.9,
              s,
            );
        } else {
          windows(pen, I, x + 4, top + 5, hw - 8, (base - top) * 0.62, 2, 3, i * 7, glass);
          // door and stoop
          const dx = x + hw * (i % 2 ? 0.62 : 0.24);
          pen.shape(rect(dx, base - 15, 8, 13), I.paint([90, 70, 60], 0.04), 1, i + 0.6);
          for (let st = 0; st < 3; st++)
            pen.stroke(
              [
                [dx - 2 - st, base - 2 + st * 0.5 - 1],
                [dx + 10 + st, base - 2 + st * 0.5 - 1],
              ],
              0.9,
              st,
            );
        }
        if (i === 3) {
          // a fire escape zigzagging down the front
          for (let f = 0; f < 3; f++) {
            const fy = top + 14 + f * 13;
            pen.stroke(
              [
                [x + 3, fy],
                [x + hw * 0.5, fy],
              ],
              1,
              f,
            );
            pen.stroke(
              [
                [x + 5, fy],
                [x + hw * 0.45, fy + 13],
              ],
              0.8,
              f + 0.5,
            );
          }
        }
        if (i === 4) {
          // a water tower on the roof
          const tx = x + hw * 0.5,
            tb = top - 3;
          for (const d of [-4, 4])
            pen.stroke(
              [
                [tx + d, tb],
                [tx + d * 0.8, tb - 6],
              ],
              1,
              d,
            );
          pen.shape(rect(tx - 6, tb - 17, 12, 11), I.paint([166, 124, 88], 0.04), 1.2, 30);
          pen.shape(
            [
              [tx - 7, tb - 17],
              [tx, tb - 23],
              [tx + 7, tb - 17],
            ],
            I.paint([120, 110, 100], 0.04),
            1.2,
            31,
          );
        }
        x += hw;
      }
    },
  ],
  live(g: CanvasRenderingContext2D, k: Kit, t: number, X: (x: number, layer: number) => number) {
    const { I, h, w, PW } = k;
    const ink = css(I.inkC, 0.9);
    g.strokeStyle = ink;
    g.lineCap = "round";
    g.lineJoin = "round";
    const night = I.night > 0.5;
    const hz = h * city.hz,
      bank = h * city.bank;
    // the river glinting
    {
      g.strokeStyle = night ? "rgba(255,226,160,0.55)" : "rgba(255,255,255,0.9)";
      g.lineWidth = 1;
      for (let i = 0; i < 28; i++) {
        const life = (t * 0.35 + hash(i * 3.3)) % 1;
        if (life > 0.5) continue;
        const a = Math.sin((life / 0.5) * Math.PI);
        const x = hash(i * 7.1) * PW + t * 2;
        const y = hz + 3 + hash(i * 5.7) * (bank - hz - 8);
        const len = (2 + 3 * hash(i)) * a;
        g.globalAlpha = a;
        g.beginPath();
        g.moveTo(X(x, 1) - len, y);
        g.lineTo(X(x, 1) + len, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.strokeStyle = ink;
    }
    const box = (pts: Pt[], layer: number, fill: string | null, lw = 1) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(X(x, layer), y) : g.moveTo(X(x, layer), y)));
      g.closePath();
      if (fill) {
        g.fillStyle = fill;
        g.fill();
      }
      g.lineWidth = lw;
      g.stroke();
    };
    // boats on the river: a tug pushing upstream, a ferry the other way
    {
      const tx = (t * 6 + w * 0.3) % PW,
        ty = bank - 9;
      box([[tx - 12, ty], [tx + 10, ty], [tx + 7, ty + 5], [tx - 10, ty + 5]], 1, css(I.paint([214, 80, 70], 0.1)));
      box([[tx - 6, ty - 7], [tx + 2, ty - 7], [tx + 2, ty], [tx - 6, ty]], 1, css(I.paint([246, 240, 226], 0.1)));
      box([[tx - 4, ty - 12], [tx - 1, ty - 12], [tx - 1, ty - 7], [tx - 4, ty - 7]], 1, css(I.paint([60, 60, 70], 0.1)));
      const fx = PW - ((t * 4 + w * 1.7) % PW),
        fy = hz + 7;
      box([[fx - 16, fy], [fx + 16, fy], [fx + 13, fy + 4], [fx - 13, fy + 4]], 1, css(I.paint([246, 210, 90], 0.2)));
      box([[fx - 11, fy - 6], [fx + 11, fy - 6], [fx + 11, fy], [fx - 11, fy]], 1, css(I.paint([250, 248, 240], 0.2)));
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = night ? css(I.window) : css(I.paint([150, 190, 220], 0.2));
        g.fillRect(X(fx + i * 4, 1) - 1.2, fy - 4, 2.4, 2.2);
      }
    }
    // traffic on the bridge
    for (let i = 0; i < 4; i++) {
      const dir = i % 2 ? 1 : -1;
      const p = (t * (0.07 + i * 0.012) + i * 0.27) % 1;
      const x = w + (dir > 0 ? p : 1 - p) * w,
        y = h * 0.733 - 1;
      const cl: C[] = [
        [226, 96, 86],
        [246, 206, 80],
        [120, 170, 220],
        [240, 240, 236],
      ];
      box([[x - 5, y], [x - 4, y - 4], [x + 4, y - 4], [x + 5, y]], 1, css(I.paint(cl[i], 0.12)), 0.9);
    }
    // the bridge's string of lights along its cables after dark
    if (I.night > 0.45) {
      const t1 = w * 1.22,
        t2 = w * 1.78,
        tt = h * 0.615 + 4,
        deck = h * 0.733;
      for (let i = 0; i <= 28; i++) {
        const f = i / 28;
        const x = t1 + (t2 - t1) * f,
          y = tt + Math.sin(f * Math.PI) * (deck - tt - 14);
        g.fillStyle = `rgba(255,230,160,${(0.55 + 0.45 * Math.sin(t * 2 + i * 0.7)) * I.night})`;
        g.beginPath();
        g.arc(X(x, 1), y, 1.2, 0, TAU);
        g.fill();
      }
    }
    // the Ferris wheel turning, lit up at night
    {
      const cx = w * 2.6,
        cy = h * 0.69,
        R = h * 0.075;
      const sx = X(cx, 2);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(sx, cy, R, 0, TAU);
      g.stroke();
      g.lineWidth = 0.7;
      g.beginPath();
      g.arc(sx, cy, R * 0.86, 0, TAU);
      g.stroke();
      const n = 10,
        spin = t * 0.25;
      const cab: C[] = [
        [226, 96, 86],
        [246, 206, 80],
        [120, 180, 220],
        [150, 200, 130],
        [230, 160, 200],
      ];
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * TAU;
        const px = sx + Math.cos(a) * R,
          py = cy + Math.sin(a) * R;
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(sx, cy);
        g.lineTo(px, py);
        g.stroke();
        if (night) {
          g.fillStyle = `rgba(255,220,140,${0.6 + 0.4 * Math.sin(t * 3 + i)})`;
          g.beginPath();
          g.arc(px, py, 1.6, 0, TAU);
          g.fill();
        }
        // the cars hang straight down
        g.fillStyle = css(I.paint(cab[i % 5], 0.04));
        g.beginPath();
        g.moveTo(px - 4, py + 2);
        g.lineTo(px + 4, py + 2);
        g.lineTo(px + 3.4, py + 7.5);
        g.lineTo(px - 3.4, py + 7.5);
        g.closePath();
        g.fill();
        g.lineWidth = 0.9;
        g.stroke();
      }
      g.fillStyle = css(I.paint([236, 236, 240], 0.04));
      g.beginPath();
      g.arc(sx, cy, 2.5, 0, TAU);
      g.fill();
      g.stroke();
    }
    // the slim tower's beacon
    {
      const on = Math.sin(t * 2.4) > 0.2;
      const bx = X(w * 0.72 + w * 0.0425, 1),
        by = h * 0.5 - h * 0.04;
      g.fillStyle = on ? "rgba(255,70,60,0.95)" : "rgba(140,40,40,0.6)";
      g.beginPath();
      g.arc(bx, by, on ? 2.2 : 1.6, 0, TAU);
      g.fill();
      if (on && night) {
        g.fillStyle = "rgba(255,80,60,0.25)";
        g.beginPath();
        g.arc(bx, by, 6, 0, TAU);
        g.fill();
      }
    }
    // cars and taxis along our street, both ways, headlights after dark
    {
      const s0 = h * city.street[0],
        s1 = h * city.street[1];
      const lanes = [s0 + (s1 - s0) * 0.42, s1 - 3];
      const cl: C[] = [
        [246, 206, 80],
        [226, 96, 86],
        [120, 170, 220],
        [246, 206, 80],
        [150, 200, 130],
        [240, 240, 236],
      ];
      for (let i = 0; i < 6; i++) {
        const dir = i % 2 ? -1 : 1;
        const sp = 22 + hash(i * 3) * 14;
        const x0 = (hash(i * 5.3) * PW + t * sp * dir) % PW,
          x = ((x0 % PW) + PW) % PW;
        const y = lanes[i % 2];
        const L = 26,
          H = 9;
        const body: Pt[] = [
          [x - L / 2, y],
          [x - L / 2, y - H * 0.55],
          [x - L * 0.25, y - H * 0.6],
          [x - L * 0.15, y - H],
          [x + L * 0.2, y - H],
          [x + L * 0.32, y - H * 0.6],
          [x + L / 2, y - H * 0.5],
          [x + L / 2, y],
        ].map(([a, b]) => [x + (a - x) * dir, b] as Pt);
        box(body, 2, css(I.paint(cl[i], 0.04)), 1.1);
        // windows and wheels
        box(
          [
            [x - L * 0.12 * dir, y - H * 0.9],
            [x + L * 0.17 * dir, y - H * 0.9],
            [x + L * 0.26 * dir, y - H * 0.62],
            [x - L * 0.12 * dir, y - H * 0.62],
          ],
          2,
          css(I.paint([200, 224, 240], 0.04)),
          0.8,
        );
        for (const f of [-0.28, 0.28]) {
          g.fillStyle = css(I.paint([50, 50, 60], 0.04));
          g.beginPath();
          g.arc(X(x + L * f, 2), y, 3, 0, TAU);
          g.fill();
          g.stroke();
        }
        if (i % 3 === 0) {
          // the taxi light
          g.fillStyle = css(I.paint([255, 236, 150], 0.04));
          g.fillRect(X(x, 2) - 2, y - H - 2.5, 4, 2.5);
        }
        if (night) {
          const hx = X(x + (L / 2) * dir, 2);
          const gr = g.createLinearGradient(hx, y, hx + dir * 30, y);
          gr.addColorStop(0, "rgba(255,236,170,0.5)");
          gr.addColorStop(1, "rgba(255,236,170,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(hx, y - 4);
          g.lineTo(hx + dir * 30, y - 9);
          g.lineTo(hx + dir * 30, y + 2);
          g.closePath();
          g.fill();
        }
      }
    }
    // pigeons pecking along the walk by day
    if (!night)
      for (let i = 0; i < 4; i++) {
        const x = X(w * (2.15 + i * 0.07) + Math.sin(t * 0.3 + i) * 10, 2),
          y = bank + 14 + (i % 2) * 5;
        const peck = Math.sin(t * 5 + i * 2) > 0.6 ? 2 : 0;
        g.fillStyle = css(I.paint([150, 156, 172], 0.04));
        g.beginPath();
        g.ellipse(x, y - 3, 4, 2.6, 0, 0, TAU);
        g.fill();
        g.lineWidth = 0.9;
        g.stroke();
        g.beginPath();
        g.arc(x + 3.5, y - 5 + peck, 1.7, 0, TAU);
        g.fill();
        g.stroke();
      }
  },
};

const WORLDS = { coast, farm, city };

// ---------------------------------------------------------------------------
// painting the loop, and the moving bits
// ---------------------------------------------------------------------------

export type WorldPano = LinePano & { kit: Kit; kind: WorldKind };

export function paintWorldPano(kind: WorldKind, w: number, h: number, L: Light, season: Season, style: number, dpr: number): WorldPano {
  const I = inksFor(L, season, style);
  const def = WORLDS[kind];
  const n = def.scenes.length;
  const PW = w * n;
  const top = h * ("top" in def ? def.top : 0.55);
  const scale = Math.min(1.5, dpr);
  const layers = [0, 1, 2].map(() => {
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(PW * scale);
    cv.height = Math.ceil((h - top) * scale);
    return cv;
  });
  const pens = layers.map((cv, i) => {
    const g = cv.getContext("2d")!;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.setTransform(scale, 0, 0, scale, 0, -top * scale);
    return new Pen(g, I, [0.5, 0.72, 1][i]);
  });
  const kit: Kit = { pens, I, L, w, h, PW, season };
  if (kind === "coast") coast.ground(kit);
  else if (kind === "city") city.ground(kit);
  else farm.draw(kit);
  def.scenes.forEach((scene, i) => scene(kit, i * w));
  return { W: PW, H: h, top, scale, layers, lays: [], I, kit, kind };
}

export function liveWorld(g: CanvasRenderingContext2D, pano: WorldPano, offs: number[], t: number) {
  const PW = pano.W;
  const X = (x: number, layer: number) => {
    const v = x - offs[layer];
    return ((v % PW) + PW) % PW;
  };
  WORLDS[pano.kind].live(g, pano.kit, t, X);
}

export { mix };
