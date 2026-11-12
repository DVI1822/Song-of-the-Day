import type { Season } from "./scene";
import type { C, Light } from "./setting";
import { Pen, css, inksFor, mix, type Inks, type LinePano } from "./line";
import {
  TAU,
  behind,
  curve,
  foliage,
  hull,
  ellipse,
  fir,
  hash,
  house,
  lamp,
  leafy,
  loopWave,
  rect,
  windows,
  type Kit,
  type Pt,
} from "./worldkit";
import { mountain } from "./mountain";

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
//   suburb: a street of houses with yards, a playground, the elementary
//          school, a strip mall
//   desert: saguaros before a stone arch, an adobe town with a mission, a
//          roadside motel, a trailer camp with a fire
//   woods:  a dock with a canoe on a lake, a log cabin, deep pines, an
//          island


export type WorldKind = "mountain" | "coast" | "farm" | "city" | "suburb" | "desert" | "woods";

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
    pens[1].fillOnly(
      [
        [-8, hz],
        [PW + 8, hz],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      I.snowy ? mix(sea, [230, 236, 246], 0.3) : sea,
    );
    pens[1].stroke(
      curve(() => hz, -8, PW + 8, 40),
      1.2,
      1,
    );
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
    for (let i = 0; i < (PW / k.w) * 4.5; i++) {
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
      pen.shape(
        rect(lx - tw * 0.8, gy - h * 0.018, tw * 1.6, h * 0.018),
        I.lit ? I.window : I.paint([200, 220, 236], 0.04),
        1.1,
        3,
      );
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
          pen.shape(
            [[cx, cy], ...ellipse(cx, cy, r, r * 0.55, 6, a0, a1)],
            i % 2 ? I.paint([250, 248, 240], 0.04) : c,
            1.1,
            i + x,
          );
        }
      };
      if (!I.snowy) {
        // towels laid out on the sand, each a slanted strip with a stripe
        const towel = (f: number, dy: number, len: number, c: C, stripe: C, seed: number) => {
          const xa = x0 + w * f,
            xb = xa + len;
          const ya = sh(xa) + h * dy,
            yb = sh(xb) + h * dy - 2;
          pen.shape(
            [
              [xa, ya],
              [xb, yb],
              [xb + 2, yb + 8],
              [xa + 2, ya + 8],
            ],
            I.paint(c, 0.04),
            1,
            seed,
          );
          pen.fillOnly(
            [
              [xa + len * 0.2, ya - (ya - yb) * 0.2 + 0.5],
              [xa + len * 0.3, ya - (ya - yb) * 0.3 + 0.5],
              [xa + len * 0.3 + 2, ya - (ya - yb) * 0.3 + 7.5],
              [xa + len * 0.2 + 2, ya - (ya - yb) * 0.2 + 7.5],
            ],
            I.paint(stripe, 0.04),
          );
        };
        towel(0.24, 0.055, w * 0.07, [240, 196, 80], [250, 248, 240], 9);
        towel(0.08, 0.075, w * 0.065, [90, 170, 200], [250, 248, 240], 10);
        towel(0.42, 0.07, w * 0.07, [226, 96, 120], [250, 220, 90], 11);
        towel(0.55, 0.05, w * 0.065, [120, 190, 120], [250, 248, 240], 12);
        towel(0.82, 0.065, w * 0.07, [240, 140, 70], [70, 120, 190], 13);
        towel(0.9, 0.095, w * 0.06, [150, 120, 200], [250, 248, 240], 14);
        umbrella(x0 + w * 0.2, sh(x0 + w * 0.2) + h * 0.05, 1, I.paint([226, 84, 70], 0.04));
        umbrella(x0 + w * 0.36, sh(x0 + w * 0.36) + h * 0.04, 0.85, I.paint([70, 140, 200], 0.04));
        umbrella(x0 + w * 0.06, sh(x0 + w * 0.06) + h * 0.07, 0.95, I.paint([240, 196, 70], 0.04));
        umbrella(x0 + w * 0.52, sh(x0 + w * 0.52) + h * 0.045, 0.8, I.paint([90, 170, 120], 0.04));
        umbrella(x0 + w * 0.88, sh(x0 + w * 0.88) + h * 0.09, 1.05, I.paint([226, 96, 140], 0.04));
        // a cooler and a bucket and spade
        pen.shape(rect(x0 + w * 0.5, sh(x0 + w * 0.5) + h * 0.085, 12, 8), I.paint([70, 130, 200], 0.04), 1, 15);
        pen.shape(rect(x0 + w * 0.5 - 1, sh(x0 + w * 0.5) + h * 0.085 - 2, 14, 3), I.paint([250, 248, 240], 0.04), 0.9, 16);
        {
          const bx = x0 + w * 0.65,
            by = sh(bx) + h * 0.08;
          pen.shape(
            [
              [bx - 4, by - 7],
              [bx + 4, by - 7],
              [bx + 3, by],
              [bx - 3, by],
            ],
            I.paint([240, 196, 70], 0.04),
            0.9,
            17,
          );
          pen.stroke(
            [
              [bx + 8, by],
              [bx + 11, by - 12],
            ],
            1,
            18,
          );
        }
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
    // the harbour: a rock jetty with a little green light at its end,
    // fishing boats moored in front of shacks on pilings, pots on the sand
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const sh = (x: number) => coast.shore(k, x);
      const hz = h * coast.hz;
      const rock: C = I.paint([150, 146, 140], 0.06);
      // a low breakwater of piled rock along the water, the light at its end
      const jx = x0 + w * 0.26;
      const wall: Pt[] = [];
      for (let i = 0; i <= 14; i++) {
        const x = x0 + w * 0.03 + ((jx + 6 - x0 - w * 0.03) * i) / 14;
        wall.push([x, sh(x) - 9 - Math.abs(Math.sin(i * 2.1)) * 3]);
      }
      pen.shape([...wall, [jx + 8, sh(jx) - 1], [x0 + w * 0.03, sh(x0 + w * 0.03) - 1]], rock, 1.2, 400);
      for (let i = 1; i < 14; i += 2) {
        const [x, y] = wall[i];
        pen.stroke(
          [
            [x, y + 1],
            [x + 2, y + 7],
          ],
          0.6,
          401 + i,
        );
      }
      const lt = sh(jx) - 10;
      pen.shape(rect(jx - 3, lt - 16, 6, 16), I.paint([70, 150, 100], 0.06), 1.1, 410);
      pen.shape(rect(jx - 2.5, lt - 21, 5, 5), I.lit ? I.window : I.paint([220, 236, 220], 0.06), 0.9, 411);
      pen.shape(
        [
          [jx - 4, lt - 21],
          [jx, lt - 25],
          [jx + 4, lt - 21],
        ],
        I.paint([70, 150, 100], 0.06),
        0.9,
        412,
      );
      void hz;
      // fish shacks standing in the shallows on pilings
      const shack = (cx: number, cw: number, c: C, seed: number) => {
        const base = sh(cx) - 6,
          ch = h * 0.024,
          lift = 9;
        for (const f of [-0.45, -0.15, 0.15, 0.45])
          pen.stroke(
            [
              [cx + cw * f, base + 6],
              [cx + cw * f, base - lift],
            ],
            1.1,
            seed + f,
          );
        pen.shape(rect(cx - cw / 2 - 3, base - lift - 2, cw + 6, 2), I.paint([150, 110, 80], 0.05), 1, seed + 1);
        pen.shape(rect(cx - cw / 2, base - lift - 2 - ch, cw, ch), c, 1.3, seed + 2);
        pen.shape(
          [
            [cx - cw / 2 - 3, base - lift - 2 - ch],
            [cx, base - lift - 2 - ch - h * 0.016],
            [cx + cw / 2 + 3, base - lift - 2 - ch],
          ],
          I.paint([90, 96, 110], 0.05),
          1.2,
          seed + 3,
        );
        pen.shape(rect(cx - 4, base - lift - 2 - ch * 0.8, 8, ch * 0.8), I.paint([90, 80, 70], 0.05), 0.9, seed + 4);
        // buoys hung on the wall
        for (const [d, bc] of [
          [-0.32, [226, 84, 70]],
          [0.3, [246, 200, 70]],
        ] as [number, C][])
          pen.shape(ellipse(cx + cw * d, base - lift - 2 - ch * 0.5, 2.2, 3, 8), I.paint(bc, 0.05), 0.8, seed + d);
      };
      shack(x0 + w * 0.45, w * 0.13, I.paint([170, 110, 96], 0.05), 420);
      shack(x0 + w * 0.68, w * 0.12, I.paint([140, 160, 170], 0.05), 430);
      // two boats moored in front, on the water
      if (!I.snowy || true) {
        const by = sh(x0 + w * 0.4) - 1;
        hull(pen, x0 + w * 0.34, by, 40, I.paint([240, 236, 226], 0.05), 440);
        pen.shape(rect(x0 + w * 0.34 - 2, by - 17, 11, 9), I.paint([240, 236, 226], 0.05), 1, 441);
        pen.shape(rect(x0 + w * 0.34, by - 15, 4, 4), I.paint([180, 210, 230], 0.05), 0.8, 442);
        pen.stroke(
          [
            [x0 + w * 0.34 - 10, by - 7],
            [x0 + w * 0.34 - 10, by - 28],
            [x0 + w * 0.34 - 18, by - 8],
          ],
          0.9,
          443,
        );
        const b2 = x0 + w * 0.58;
        hull(pen, b2, sh(b2) - 1, 34, I.paint([70, 120, 170], 0.05), 444);
        pen.shape(rect(b2 + 2, sh(b2) - 15, 9, 8), I.paint([240, 236, 226], 0.05), 1, 445);
        // mooring lines to the shacks
        pen.stroke(
          [
            [x0 + w * 0.34 + 20, by - 7],
            [x0 + w * 0.39, sh(x0 + w * 0.39) - 9],
          ],
          0.6,
          446,
        );
      }
      // lobster pots and a coil of rope on the sand
      for (const [f, r] of [
        [0.82, 0],
        [0.87, 0],
        [0.845, 1],
      ]) {
        const px = x0 + w * f,
          py = sh(px) + h * 0.05 - r * 11;
        pen.shape(rect(px - 9, py - 11, 18, 11), I.paint([200, 170, 120], 0.04), 1, 450 + f);
        for (const d of [-3, 3])
          pen.stroke(
            [
              [px + d, py - 11],
              [px + d, py],
            ],
            0.5,
            451 + f + d,
          );
      }
      pen.shape(ellipse(x0 + w * 0.26, sh(x0 + w * 0.26) + h * 0.07, 9, 3, 14), I.paint([210, 190, 150], 0.04), 0.9, 455);
      pen.shape(ellipse(x0 + w * 0.26, sh(x0 + w * 0.26) + h * 0.07, 4, 1.4, 10), null, 0.6, 456);
    },
    // the boardwalk: a raised walk along the sand, an ice cream stand with a
    // striped awning, a surf shack with boards leaning on it
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const sh = (x: number) => coast.shore(k, x);
      const deck = h * 0.875;
      const wood: C = I.paint([176, 132, 92], 0.04);
      // the stand and the shack sit on the walk
      const stand = (sx: number, sw: number, c: C, seed: number) => {
        const ht = h * 0.04;
        pen.shape(rect(sx, deck - ht, sw, ht), I.paint([246, 242, 232], 0.04), 1.3, seed);
        pen.shape(rect(sx + sw * 0.12, deck - ht * 0.82, sw * 0.76, ht * 0.4), I.lit ? I.window : I.paint([190, 220, 236], 0.04), 1, seed + 1);
        for (let i = 0; i < 6; i++)
          pen.shape(
            [
              [sx - 3 + ((sw + 6) * i) / 6, deck - ht],
              [sx - 3 + ((sw + 6) * (i + 1)) / 6, deck - ht],
              [sx - 3 + ((sw + 6) * (i + 1)) / 6, deck - ht - 9],
              [sx - 3 + ((sw + 6) * i) / 6, deck - ht - 9],
            ],
            i % 2 ? I.paint([250, 248, 240], 0.04) : c,
            0.8,
            seed + 2 + i,
          );
        pen.stroke(
          [
            [sx - 3, deck - ht],
            [sx + sw + 3, deck - ht],
          ],
          1.2,
          seed + 9,
        );
      };
      stand(x0 + w * 0.12, w * 0.2, I.paint([236, 120, 150], 0.04), 500);
      // a big cone on top of the ice cream stand
      {
        const cx = x0 + w * 0.22,
          cy = deck - h * 0.04 - 9;
        pen.shape(
          [
            [cx - 6, cy - 12],
            [cx + 6, cy - 12],
            [cx, cy],
          ],
          I.paint([222, 176, 110], 0.04),
          1,
          510,
        );
        pen.shape(ellipse(cx, cy - 15, 7, 6, 12), I.paint([250, 214, 226], 0.04), 1, 511);
      }
      stand(x0 + w * 0.6, w * 0.24, I.paint([80, 160, 190], 0.04), 520);
      // surfboards leaning against the shack
      const boards: C[] = [
        [246, 200, 70],
        [226, 96, 80],
        [120, 190, 170],
      ];
      boards.forEach((c, i) => {
        const bx = x0 + w * (0.87 + i * 0.035);
        pen.shape(ellipse(bx + 2, deck - 17, 3.4, 17, 14), I.paint(c, 0.04), 1, 530 + i);
        pen.stroke(
          [
            [bx + 2, deck - 31],
            [bx + 2, deck - 3],
          ],
          0.5,
          533 + i,
        );
      });
      // the walk itself: deck, posts down to the sand, a rail
      pen.shape(rect(x0 + w * 0.02, deck, w * 0.96, 4), wood, 1.2, 540);
      for (let x = x0 + w * 0.04; x < x0 + w * 0.98; x += 24)
        pen.stroke(
          [
            [x, deck + 4],
            [x, deck + 14],
          ],
          1.1,
          x,
        );
      for (let x = x0 + w * 0.36; x < x0 + w * 0.58; x += 10)
        pen.stroke(
          [
            [x, deck],
            [x, deck - 9],
          ],
          0.8,
          x + 1,
        );
      pen.stroke(
        [
          [x0 + w * 0.36, deck - 9],
          [x0 + w * 0.58, deck - 9],
        ],
        1,
        541,
      );
      lamp(pen, I, x0 + w * 0.47, deck, 30);
    },
    // the salt marsh: tall grass round winding channels, a heron fishing,
    // a plank walk out to a little bird hide
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const sh = (x: number) => coast.shore(k, x);
      const grass: C = I.snowy
        ? mix(I.snow, [200, 190, 160], 0.3)
        : I.paint(
            I.season === "autumn" ? [206, 170, 90] : I.season === "winter" ? [190, 170, 120] : I.season === "spring" ? [150, 196, 100] : [126, 176, 96],
            0.05,
          );
      const water: C = I.snowy ? mix(I.water, I.snow, 0.5) : I.paint([90, 156, 200], 0.05);
      // the marsh: a band of grass over the sand
      // its edge: up from the bottom of the screen, along the waterline, and
      // back down, ragged like grass
      const ragged = (pts: Pt[], seed: number) =>
        pts.map(([x, y], i) => [x + Math.sin(i * 2.7 + seed) * 2, y - Math.abs(Math.sin(i * 1.9 + seed)) * 3] as Pt);
      const lside: Pt[] = curve((y) => x0 + w * (0.06 + 0.05 * Math.sin((y / h) * 9)), sh(x0 + w * 0.06) + 4, h + 6, 8).map(
        ([y, x]) => [x, y] as Pt,
      );
      const rside: Pt[] = curve((y) => x0 + w * (0.95 - 0.04 * Math.sin((y / h) * 7)), sh(x0 + w * 0.95) + 4, h + 6, 8).map(
        ([y, x]) => [x, y] as Pt,
      );
      const top = ragged(curve((x) => sh(x) + 5, x0 + w * 0.07, x0 + w * 0.94, 6), 1);
      const edge = [...lside.slice().reverse(), ...top, ...rside];
      pen.fillOnly(edge, grass);
      pen.stroke(edge, 1.1, 550);
      // the channels winding through it toward us
      for (const [a, b, s] of [
        [0.3, 0.2, 1],
        [0.62, 0.74, -1],
      ]) {
        const chn: Pt[] = [],
          chr: Pt[] = [];
        for (let i = 0; i <= 10; i++) {
          const u = i / 10;
          const y = sh(x0 + w * a) + 6 + (h + 6 - sh(x0 + w * a) - 6) * u;
          const c = x0 + w * (a + (b - a) * u) + Math.sin(u * 5) * 8 * s;
          const hw = 2 + u * 12;
          chn.push([c - hw, y]);
          chr.push([c + hw, y]);
        }
        pen.fillOnly([...chn, ...chr.slice().reverse()], water);
        pen.stroke(chn, 0.9, 551 + a);
        pen.stroke(chr, 0.9, 552 + a);
      }
      // grass blades in clumps
      for (let i = 0; i < 40; i++) {
        const gx = x0 + w * (0.04 + hash(i * 3.1) * 0.92),
          gy = sh(gx) + 12 + hash(i * 1.7) * h * 0.13;
        const s = 0.7 + (gy - sh(gx)) / (h * 0.12);
        for (const d of [-2, 0, 2])
          pen.stroke(
            [
              [gx, gy],
              [gx + d * s, gy - 6 * s],
            ],
            0.7,
            560 + i + d,
          );
      }
      // the plank walk to the hide
      const wy = h * 0.9;
      pen.shape(rect(x0 + w * 0.36, wy, w * 0.4, 4), I.paint([176, 132, 92], 0.04), 1.1, 570);
      for (let x = x0 + w * 0.38; x < x0 + w * 0.76; x += 18)
        pen.stroke(
          [
            [x, wy + 4],
            [x, wy + 12],
          ],
          1,
          x,
        );
      const hx = x0 + w * 0.8,
        hb = wy + 4;
      for (const d of [-14, 14])
        pen.stroke(
          [
            [hx + d, hb + 8],
            [hx + d, hb],
          ],
          1.1,
          d,
        );
      pen.shape(rect(hx - 18, hb - 26, 36, 26), I.paint([150, 120, 86], 0.04), 1.3, 571);
      pen.shape(rect(hx - 12, hb - 18, 24, 5), [40, 36, 40], 1, 572);
      pen.shape(
        [
          [hx - 22, hb - 26],
          [hx + 22, hb - 32],
          [hx + 22, hb - 26],
        ],
        I.paint([90, 96, 110], 0.04),
        1.2,
        573,
      );
      // a heron standing in the near channel
      {
        const bx = x0 + w * 0.24,
          by = h * 0.93;
        pen.g.save();
        pen.g.translate(bx, by);
        pen.g.scale(1.6, 1.6);
        pen.g.translate(-bx, -by);
        const grey: C = I.paint([196, 204, 214], 0.04);
        for (const d of [-1.5, 1.5])
          pen.stroke(
            [
              [bx + d, by],
              [bx + d * 0.5, by - 14],
            ],
            0.9,
            580 + d,
          );
        pen.shape(ellipse(bx, by - 18, 8, 4.5, 14), grey, 1, 582);
        pen.stroke(
          [
            [bx + 6, by - 20],
            [bx + 9, by - 28],
            [bx + 7, by - 34],
          ],
          1.3,
          583,
        );
        pen.shape(
          [
            [bx + 7, by - 36],
            [bx + 17, by - 34],
            [bx + 7, by - 33],
          ],
          I.paint([236, 200, 90], 0.04),
          0.8,
          584,
        );
        pen.g.restore();
      }
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
      for (let i = 0; i < (PW / w) * 9; i++) {
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
    // boats out on the water, passing behind whatever stands between us
    // and them: the lighthouse point, the bait shack, the jetty light, the
    // harbour shacks. Sailboats far out, a fishing boat and a motorboat
    // with its wake nearer in, a freighter on the horizon
    {
      g.save();
      behind(g, X, PW, [
        [w * 0.58, w * 0.97, h * 0.55, 2],
        [w * 1.7, w * 1.92, h * 0.735, 2],
        [w * 1.08, w * 1.9, h * 0.778 - 13, 2],
        [w * 4.1, w * 4.2, h * 0.7, 2],
        [w * 4.36, w * 4.76, h * 0.74, 2],
      ]);
      const hz = h * coast.hz;
      const poly = (pts: Pt[], fill: string | null, lw = 1) => {
        g.beginPath();
        pts.forEach(([a, b], i) => (i ? g.lineTo(X(a, 1), b) : g.moveTo(X(a, 1), b)));
        g.closePath();
        if (fill) {
          g.fillStyle = fill;
          g.fill();
        }
        g.lineWidth = lw;
        g.stroke();
      };
      const white = css(I.paint([250, 250, 246], 0.2));
      const sail = (x: number, y: number, s: number, hullC: string, dir: number) => {
        poly(
          [
            [x - 7 * s, y],
            [x + 7 * s, y],
            [x + 5 * s, y + 3 * s],
            [x - 5 * s, y + 3 * s],
          ],
          hullC,
        );
        poly(
          [
            [x, y],
            [x, y - 17 * s],
            [x + 9 * s * dir, y - 2 * s],
          ],
          white,
        );
        poly(
          [
            [x - 1 * dir, y - 14 * s],
            [x - 7 * s * dir, y - 2 * s],
            [x - 1 * dir, y - 2 * s],
          ],
          white,
        );
      };
      const wrap = (v: number) => ((v % PW) + PW) % PW;
      // three sailboats at different distances and speeds
      sail(wrap(t * 3 + w * 1.4), hz + 4, 1, white, 1);
      sail(wrap(-t * 2.2 + w * 3.6), hz + 2, 0.7, css(I.paint([70, 110, 170], 0.3)), -1);
      sail(wrap(t * 4 + w * 5.5), hz + 9, 1.25, css(I.paint([214, 84, 70], 0.2)), 1);
      // a freighter creeping along the horizon
      {
        const x = wrap(-t * 0.8 + w * 2.2),
          y = hz + 0.5;
        g.globalAlpha = 0.85;
        poly(
          [
            [x - 22, y - 5],
            [x + 24, y - 5],
            [x + 20, y],
            [x - 20, y],
          ],
          css(I.paint([90, 96, 110], 0.4)),
          0.9,
        );
        for (let i = 0; i < 4; i++)
          poly(rect(x - 14 + i * 7, y - 9, 6, 4), css(I.paint([[210, 90, 70], [90, 140, 190], [230, 190, 80], [120, 170, 120]][i] as C, 0.4)), 0.7);
        poly(rect(x + 14, y - 13, 6, 8), white, 0.8);
        g.globalAlpha = 1;
      }
      // a fishing boat chugging out and back, nearer in
      {
        const ph = (t * 0.012) % 1;
        const dir = ph < 0.5 ? 1 : -1;
        const x = wrap(w * 0.9 + (ph < 0.5 ? ph : 1 - ph) * 2 * w * 2.6),
          y = hz + 14;
        poly(
          [
            [x - 14 * dir, y - 4],
            [x + 16 * dir, y - 6],
            [x + 12 * dir, y + 1],
            [x - 12 * dir, y + 1],
          ],
          css(I.paint([60, 110, 120], 0.15)),
          1.1,
        );
        poly(rect(x - 6 * dir - (dir < 0 ? 9 : 0), y - 12, 9, 7), white, 1);
        g.beginPath();
        g.moveTo(X(x - 10 * dir, 1), y - 4);
        g.lineTo(X(x - 10 * dir, 1), y - 18);
        g.lineTo(X(x + 10 * dir, 1), y - 5);
        g.lineWidth = 0.7;
        g.stroke();
      }
      // a motorboat skimming along with a white wake behind it
      if (!I.snowy && I.season !== "winter") {
        const x = wrap(t * 9 + w * 0.3),
          y = hz + 20;
        poly(
          [
            [x - 10, y - 3],
            [x + 9, y - 3],
            [x + 13, y - 5],
            [x + 10, y + 1],
            [x - 9, y + 1],
          ],
          white,
          1,
        );
        poly(
          [
            [x - 2, y - 3],
            [x + 2, y - 7],
            [x + 5, y - 7],
            [x + 4, y - 3],
          ],
          css(I.paint([150, 196, 226], 0.15)),
          0.8,
        );
        g.strokeStyle = night ? "rgba(220,230,255,0.6)" : "rgba(255,255,255,0.95)";
        for (let i = 1; i < 5; i++) {
          g.globalAlpha = 1 - i / 5;
          g.beginPath();
          g.moveTo(X(x - 10 - i * 7, 1), y + 1 - i * 0.6);
          g.lineTo(X(x - 15 - i * 7, 1), y - 1 - i * 0.6);
          g.moveTo(X(x - 10 - i * 7, 1), y + 1 + i * 0.4);
          g.lineTo(X(x - 15 - i * 7, 1), y + 2 + i * 0.6);
          g.lineWidth = 1;
          g.stroke();
        }
        g.globalAlpha = 1;
        g.strokeStyle = ink;
      }
      g.restore();
    }
    // surfers off the boardwalk: paddling out, then riding a wave in
    if (!I.snowy && I.season !== "winter")
      for (let i = 0; i < 2; i++) {
        const cyc = ((t + i * 9) % 18) / 18;
        const sx = w * (5.3 + i * 0.3) + (cyc < 0.6 ? 0 : (cyc - 0.6) * 60);
        const hz = h * coast.hz,
          shore = coast.shore(k, sx);
        const y = cyc < 0.6 ? shore - 8 - cyc * 30 : hz + 10 + ((cyc - 0.6) / 0.4) * (shore - hz - 16);
        const bx = X(sx, 2);
        g.fillStyle = css(I.paint(i ? [246, 200, 70] : [226, 96, 80], 0.04));
        g.beginPath();
        g.ellipse(bx, y, 8, 1.6, 0, 0, TAU);
        g.fill();
        g.lineWidth = 1;
        g.stroke();
        g.beginPath();
        if (cyc < 0.6) {
          g.arc(bx + 2, y - 3, 1.8, 0, TAU);
        } else {
          g.moveTo(bx - 2, y - 1);
          g.lineTo(bx, y - 8);
          g.lineTo(bx + 2, y - 1);
          g.moveTo(bx - 3, y - 6);
          g.lineTo(bx + 3, y - 6);
          g.stroke();
          g.beginPath();
          g.arc(bx, y - 10, 1.8, 0, TAU);
        }
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
    for (let i = 0; i < (PW / k.w) * 4; i++) {
      const x = hash(i * 9 + 1) * PW;
      // a few trees of different sizes, bunched unevenly, the tallest in
      // the middle the way a windbreak grows
      const n = 1 + Math.floor(hash(i) * 4);
      let cx = x;
      for (let j = 0; j < n; j++) {
        const mid = 1 - Math.abs(j - (n - 1) / 2) / Math.max(1, n / 2);
        const rr = 2.6 + hash(i * 5 + j) * 1.6 + mid * 1.4;
        const by = this.hills(k, cx) + 1;
        pens[0].shape(
          ellipse(cx, by - rr * 0.95, rr * 0.9, rr, 12),
          winter ? I.paint([150, 150, 160], 0.36) : I.paint([70, 120, 80], 0.36),
          1,
          i + j,
        );
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
    pens[2].stroke(
      curve(() => ry, -8, PW + 8, 30),
      1.2,
      6,
    );
    pens[2].stroke(
      curve(() => ry + h * 0.022, -8, PW + 8, 30),
      1.2,
      7,
    );
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
        pen.shape(
          rect(hx + hw * fx, base - hh * fy, 6, 6),
          I.lit ? I.window : I.paint([150, 190, 220], 0.04),
          1,
          fx + fy,
        );
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
        I.snowy || season === "winter"
          ? I.paint([196, 176, 130], 0.04)
          : season === "autumn"
            ? I.paint([214, 184, 100], 0.04)
            : I.paint([104, 168, 72], 0.04);
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
        for (let x = xa; x <= xb + 0.1; x += 3)
          crest.push([x, base - ht + (Math.round((x - xa) / 3) % 2 ? 1.6 : -0.6) * tall + (hash(x * 1.7) - 0.5) * 1.6]);
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
        for (let x = xa + 3; x < xb - 2; x += 9 + hash(x + 1) * 3)
          g2(pen, x, base + 3, ht * (0.75 + hash(x * 3) * 0.2), leafInk, tall < 1);
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
    // the orchard: two rows of apple trees, blossom in spring, apples in
    // summer and autumn, a ladder and bushel baskets at picking time
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const apple = (row: number, f: number, s: number, seed: number) => {
        const x = x0 + w * f,
          base = h * (row ? 0.86 : 0.83);
        pen.stroke(
          [
            [x, base],
            [x, base - s * 0.45],
          ],
          1.3,
          seed,
        );
        if (season === "winter" || I.snowy) {
          for (const [dx, dy] of [
            [-0.4, -0.85],
            [0.35, -0.9],
            [0, -1.05],
            [0.5, -0.65],
            [-0.5, -0.6],
          ])
            pen.stroke(
              [
                [x, base - s * 0.4],
                [x + dx * s * 0.6, base + dy * s],
              ],
              0.9,
              seed + dx,
            );
          return;
        }
        const crown: C =
          season === "autumn"
            ? I.paint(hash(seed) > 0.5 ? [196, 170, 70] : [170, 150, 64], 0.04)
            : foliage(I, seed, 0.04, [96, 160, 76]);
        pen.shape(ellipse(x, base - s * 0.78, s * 0.55, s * 0.36, 18), crown, 1.2, seed + 1);
        if (season === "spring") {
          for (let i = 0; i < 9; i++) {
            const a = hash(seed + i) * TAU,
              r = Math.sqrt(hash(seed * 2 + i)) * 0.8;
            pen.fillOnly(ellipse(x + Math.cos(a) * s * 0.5 * r, base - s * 0.78 + Math.sin(a) * s * 0.32 * r, 1.6, 1.6, 6), [250, 214, 226]);
          }
        } else {
          const ripe = season === "autumn" ? [214, 52, 46] : [176, 190, 70];
          for (let i = 0; i < 6; i++) {
            const a = hash(seed * 3 + i) * TAU,
              r = Math.sqrt(hash(seed * 5 + i)) * 0.8;
            pen.shape(
              ellipse(x + Math.cos(a) * s * 0.5 * r, base - s * 0.78 + Math.sin(a) * s * 0.32 * r, 1.8, 1.8, 6),
              I.paint(ripe as C, 0.04),
              0.6,
              seed + i,
            );
          }
        }
      };
      for (let i = 0; i < 6; i++) apple(0, 0.1 + i * 0.16, h * 0.042, 600 + i);
      for (let i = 0; i < 5; i++) apple(1, 0.17 + i * 0.17, h * 0.055, 610 + i);
      if (season === "autumn" && !I.snowy) {
        // a ladder against a tree, baskets of apples underneath
        const lx = x0 + w * 0.51 + 10;
        pen.stroke(
          [
            [lx, h * 0.862],
            [lx - 6, h * 0.815],
          ],
          1.1,
          620,
        );
        pen.stroke(
          [
            [lx + 6, h * 0.862],
            [lx, h * 0.815],
          ],
          1.1,
          621,
        );
        for (let r = 1; r < 5; r++) {
          const u = r / 5;
          pen.stroke(
            [
              [lx - 6 * u, h * (0.862 - 0.047 * u)],
              [lx + 6 - 6 * u, h * (0.862 - 0.047 * u)],
            ],
            0.7,
            622 + r,
          );
        }
        for (const f of [0.6, 0.64]) {
          const bx = x0 + w * f,
            by = h * 0.866;
          pen.shape(
            [
              [bx - 6, by - 8],
              [bx + 6, by - 8],
              [bx + 5, by],
              [bx - 5, by],
            ],
            I.paint([196, 150, 96], 0.04),
            1,
            630 + f,
          );
          for (let i = 0; i < 3; i++) pen.shape(ellipse(bx - 3.5 + i * 3.5, by - 9, 1.8, 1.8, 6), I.paint([214, 52, 46], 0.04), 0.6, 632 + i + f);
        }
      }
    },
    // the farm stand and the pumpkin patch: pumpkins in autumn, vines in
    // summer, seedlings in spring, bare rows under snow
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const base = h * 0.862;
      const sx = x0 + w * 0.12,
        sw = w * 0.26,
        sh = h * 0.034;
      const wood: C = I.paint([176, 124, 82], 0.04);
      for (const f of [0.04, 0.96])
        pen.stroke(
          [
            [sx + sw * f, base],
            [sx + sw * f, base - sh - 10],
          ],
          1.2,
          640 + f,
        );
      pen.shape(rect(sx, base - sh * 0.45, sw, sh * 0.45), wood, 1.2, 641);
      pen.shape(
        [
          [sx - 6, base - sh - 8],
          [sx + sw + 6, base - sh - 8],
          [sx + sw + 2, base - sh - 18],
          [sx - 2, base - sh - 18],
        ],
        I.paint([214, 84, 70], 0.04),
        1.2,
        642,
      );
      // crates of produce on the counter
      const crop: C[] =
        season === "autumn"
          ? [
              [236, 140, 50],
              [214, 52, 46],
              [236, 200, 80],
            ]
          : [
              [214, 52, 46],
              [110, 170, 70],
              [236, 200, 80],
            ];
      crop.forEach((c, i) => {
        const cx = sx + sw * (0.12 + i * 0.3);
        pen.shape(rect(cx, base - sh * 0.45 - 7, sw * 0.22, 7), I.paint([220, 190, 140], 0.04), 0.9, 643 + i);
        if (season !== "winter" && !I.snowy)
          for (let j = 0; j < 3; j++) pen.shape(ellipse(cx + 4 + j * (sw * 0.07), base - sh * 0.45 - 8, 2.4, 2, 6), I.paint(c, 0.04), 0.6, 646 + i + j);
      });
      // a blank board sign on two legs by the road
      pen.stroke(
        [
          [sx + sw + 18, base + 2],
          [sx + sw + 18, base - 16],
        ],
        1.1,
        650,
      );
      pen.shape(rect(sx + sw + 8, base - 26, 22, 12), I.paint([246, 240, 222], 0.04), 1, 651);
      // the patch: rows running away from us
      const px0 = x0 + w * 0.48,
        px1 = x0 + w * 0.97;
      pen.fillOnly(
        [
          [px0, h * 0.815],
          [px1, h * 0.815],
          [px1, base + 6],
          [px0, base + 6],
        ],
        I.snowy ? I.snow : I.paint([150, 116, 80], 0.04),
      );
      for (let r = 0; r < 4; r++) {
        const y = h * 0.822 + r * ((base + 2 - h * 0.822) / 3.2);
        pen.stroke(
          [
            [px0, y],
            [px1, y],
          ],
          0.6,
          652 + r,
        );
        if (I.snowy || season === "winter") continue;
        for (let i = 0; i < 7; i++) {
          const x = px0 + 10 + i * ((px1 - px0 - 20) / 6) + hash(r * 7 + i) * 8;
          const s = 0.7 + r * 0.15;
          if (season === "autumn") {
            if (hash(r * 3 + i) < 0.35) continue;
            pen.shape(ellipse(x, y - 4 * s, 6 * s, 4 * s, 12), I.paint([236, 128, 40], 0.04), 0.9, 660 + r * 9 + i);
            pen.stroke(
              [
                [x, y - 8 * s],
                [x + 1, y - 10 * s],
              ],
              1,
              661 + r * 9 + i,
            );
          } else if (season === "spring") {
            pen.stroke(
              [
                [x - 2, y - 3],
                [x, y],
                [x + 2, y - 3],
              ],
              0.8,
              662 + r * 9 + i,
            );
          } else {
            pen.shape(ellipse(x, y - 3 * s, 7 * s, 3 * s, 10, Math.PI, TAU), I.paint([90, 150, 70], 0.04), 0.8, 663 + r * 9 + i);
            if (hash(r + i * 5) > 0.6) pen.shape(ellipse(x + 3, y - 3 * s, 2, 2, 6), I.paint([246, 200, 60], 0.04), 0.6, 664 + r * 9 + i);
          }
        }
      }
      pen.stroke(
        [
          [px0, h * 0.815],
          [px1, h * 0.815],
        ],
        0.8,
        670,
      );
    },
    // the creek and the covered bridge: the road crosses on a red covered
    // bridge, the creek runs under it toward us
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const ry = h * farm.road,
        rb = ry + h * 0.022;
      const water: C = I.snowy ? mix(I.water, I.snow, 0.5) : I.paint([90, 156, 206], 0.04);
      const cx = x0 + w * 0.5;
      const creek = (y0: number, y1: number, hw0: number, hw1: number, seed: number) => {
        const L: Pt[] = [],
          R: Pt[] = [];
        for (let i = 0; i <= 8; i++) {
          const u = i / 8,
            y = y0 + (y1 - y0) * u;
          const c = cx + Math.sin(y * 0.06) * 6;
          const hw = hw0 + (hw1 - hw0) * u;
          L.push([c - hw, y]);
          R.push([c + hw, y]);
        }
        pen.fillOnly([...L, ...R.slice().reverse()], water);
        pen.stroke(L, 1, seed);
        pen.stroke(R, 1, seed + 1);
      };
      creek(farm.land(k, cx) + 1, ry, 3, 18, 680);
      creek(rb, h + 6, 22, 46, 682);
      // two trees on the banks
      leafy(pens[2], x0 + w * 0.3, h * 0.852, h * 0.06, foliage(I, 690, 0.04, [110, 170, 86]), I.snowy);
      leafy(pens[2], x0 + w * 0.73, h * 0.85, h * 0.05, foliage(I, 691, 0.04, [96, 160, 80]), I.snowy);
      // the covered bridge over the road where it crosses
      const b0 = cx - w * 0.17,
        b1 = cx + w * 0.17;
      const red: C = I.paint([184, 64, 52], 0.04);
      const wallTop = rb - h * 0.045;
      // stone abutments down to the water
      for (const x of [b0, b1]) pen.shape(rect(x - 6, rb, 12, 14), I.paint([170, 166, 160], 0.04), 1, 693 + x);
      pen.shape(rect(b0, wallTop, b1 - b0, rb + 2 - wallTop), red, 1.3, 695);
      for (let x = b0 + 8; x < b1; x += 8)
        pen.stroke(
          [
            [x, wallTop + 2],
            [x, rb],
          ],
          0.5,
          x,
        );
      // a strip of windows under the eaves
      pen.shape(rect(b0 + 10, wallTop + 4, b1 - b0 - 20, 5), [50, 40, 44], 0.8, 696);
      pen.shape(
        [
          [b0 - 6, wallTop],
          [b0 + 4, wallTop - h * 0.022],
          [b1 - 4, wallTop - h * 0.022],
          [b1 + 6, wallTop],
        ],
        I.snowy ? I.snow : I.paint([90, 86, 96], 0.04),
        1.3,
        697,
      );
      // the dark portals at each end
      for (const [x, d] of [
        [b0, 1],
        [b1, -1],
      ] as Pt[])
        pen.shape(
          [
            [x, rb + 2],
            [x, wallTop],
            [x + d * 8, wallTop + 3],
            [x + d * 8, ry + 1],
          ],
          [40, 34, 38],
          1,
          698 + x,
        );
    },
    // the grain elevator and the sheep: a tall elevator with its bins and a
    // grain truck; sheep grazing behind a stone wall in front of the road
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * 0.862;
      const white: C = I.paint([236, 232, 222], 0.04);
      const grey: C = I.paint([186, 188, 192], 0.04);
      // the bins
      for (let i = 0; i < 3; i++) {
        const bx = x0 + w * (0.48 + i * 0.075),
          bw = w * 0.034,
          bh = h * 0.07;
        pen.shape(rect(bx - bw, base - bh, bw * 2, bh), grey, 1.2, 700 + i);
        pen.shape(
          [
            [bx - bw - 1, base - bh],
            [bx, base - bh - h * 0.014],
            [bx + bw + 1, base - bh],
          ],
          grey,
          1.1,
          703 + i,
        );
        for (let f = 0.25; f < 1; f += 0.25)
          pen.stroke(
            [
              [bx - bw, base - bh * f],
              [bx + bw, base - bh * f],
            ],
            0.5,
            706 + f + i,
          );
      }
      // the elevator itself: a tall house with the head house on top
      const ex = x0 + w * 0.2,
        ew = w * 0.16,
        eh = h * 0.13;
      pen.shape(rect(ex, base - eh, ew, eh), white, 1.3, 710);
      pen.shape(rect(ex + ew * 0.3, base - eh - h * 0.03, ew * 0.4, h * 0.03), white, 1.2, 711);
      pen.shape(
        [
          [ex + ew * 0.26, base - eh - h * 0.03],
          [ex + ew * 0.5, base - eh - h * 0.045],
          [ex + ew * 0.74, base - eh - h * 0.03],
        ],
        I.paint([96, 92, 100], 0.04),
        1.1,
        712,
      );
      pen.shape(
        [
          [ex - 3, base - eh],
          [ex + ew * 0.3, base - eh - h * 0.012],
          [ex + ew * 0.7, base - eh - h * 0.012],
          [ex + ew + 3, base - eh],
        ],
        I.paint([96, 92, 100], 0.04),
        1.1,
        713,
      );
      pen.shape(rect(ex + ew * 0.35, base - h * 0.03, ew * 0.3, h * 0.03), I.paint([110, 90, 80], 0.04), 1, 714);
      // the spout from the head house down to the bins
      pen.stroke(
        [
          [ex + ew * 0.7, base - eh - h * 0.02],
          [x0 + w * 0.48, base - h * 0.08],
        ],
        1.4,
        715,
      );
      // a grain truck parked beside it
      {
        const tx = x0 + w * 0.68,
          ty = base + 2;
        pen.shape(rect(tx, ty - 16, 40, 12), I.paint([214, 84, 64], 0.04), 1.2, 716);
        pen.shape(
          [
            [tx + 40, ty - 4],
            [tx + 40, ty - 16],
            [tx + 50, ty - 16],
            [tx + 56, ty - 9],
            [tx + 56, ty - 4],
          ],
          I.paint([240, 236, 226], 0.04),
          1.2,
          717,
        );
        pen.shape(rect(tx + 43, ty - 14, 7, 5), I.paint([200, 224, 240], 0.04), 0.8, 718);
        for (const wx of [tx + 8, tx + 30, tx + 48]) pen.shape(ellipse(wx, ty - 3, 3.5, 3.5, 10), [40, 40, 48], 1, wx);
      }
      // the stone wall below the road, sheep grazing in front of it
      const wy = h * 0.93;
      const wall: Pt[] = [];
      for (let x = x0 + w * 0.04; x <= x0 + w * 0.96; x += 6) wall.push([x, wy - 10 - Math.abs(Math.sin(x * 0.7)) * 3]);
      pen.shape([...wall, [x0 + w * 0.96, wy], [x0 + w * 0.04, wy]], I.paint([176, 172, 164], 0.04), 1.1, 720);
      for (let x = x0 + w * 0.06; x < x0 + w * 0.95; x += 9)
        pen.stroke(
          [
            [x + (x % 18 < 9 ? 0 : 4), wy - 9],
            [x + (x % 18 < 9 ? 0 : 4), wy - 4],
          ],
          0.5,
          x,
        );
      const wool: C = I.paint([246, 244, 236], 0.04);
      for (const [f, d] of [
        [0.18, 1],
        [0.36, -1],
        [0.62, 1],
        [0.82, -1],
      ]) {
        const sx = x0 + w * f,
          sy = h * 0.965 + hash(f) * 6;
        pen.g.save();
        pen.g.translate(sx, sy);
        pen.g.scale(1.8, 1.8);
        pen.g.translate(-sx, -sy);
        for (const lx of [-4, -2, 3, 5])
          pen.stroke(
            [
              [sx + lx, sy - 3],
              [sx + lx, sy + 3],
            ],
            1,
            730 + f + lx,
          );
        const fleece: Pt[] = [];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          const r = 1 + 0.12 * Math.abs(Math.sin(a * 3));
          fleece.push([sx + Math.cos(a) * 8 * r, sy - 5 + Math.sin(a) * 4.5 * r]);
        }
        pen.shape(fleece, wool, 1, 731 + f);
        pen.shape(ellipse(sx + d * 9, sy - 6, 3, 2.4, 8), [50, 46, 50], 0.8, 732 + f);
        pen.g.restore();
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
    // a tractor puttering round the road, a puff of dust behind; it goes
    // through the covered bridge, hidden by its near wall
    {
      const PW = k.PW;
      g.save();
      behind(g, X, PW, [[w * 6.33 + 8, w * 6.67 - 8, h * farm.road + h * 0.022 - h * 0.045 - h * 0.022, 2]]);
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
      g.restore();
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
              if (hash(b.i * 9 + r * 3 + c) > 0.6)
                pens[0].fillOnly(rect(x + 3 + c * 6, top + 4 + r * 7, 2, 2.5), I.window);
      }
    // the river, with a few rows of little wave marks
    const water: C = I.snowy
      ? mix(I.paint([84, 140, 190], 0.14), [220, 230, 240], 0.25)
      : I.paint([84, 140, 190], 0.14);
    pens[1].fillOnly(
      [
        [-8, hz],
        [PW + 8, hz],
        [PW + 8, bank + 2],
        [-8, bank + 2],
      ],
      water,
    );
    pens[1].stroke(
      curve(() => hz, -8, PW + 8, 40),
      1.2,
      1,
    );
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
    pens[2].fillOnly(
      [
        [-8, bank],
        [PW + 8, bank],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      paving,
    );
    pens[2].stroke(
      curve(() => bank, -8, PW + 8, 30),
      1.3,
      2,
    );
    pens[2].stroke(
      curve(() => bank - 7, -8, PW + 8, 30),
      1.1,
      3,
    );
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
    const road: C = I.snowy
      ? mix(I.paint([120, 124, 136], 0.04), [230, 234, 240], 0.35)
      : I.paint([120, 124, 136], 0.04);
    pens[2].shape(
      [
        [-8, s0],
        [PW + 8, s0],
        [PW + 8, s1],
        [-8, s1],
      ],
      road,
      1.3,
      4,
    );
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
    pens[2].fillOnly(
      [
        [-8, s1],
        [PW + 8, s1],
        [PW + 8, s2],
        [-8, s2],
      ],
      paving,
    );
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
    pens[2].shape(
      [
        [-8, s2],
        [PW + 8, s2],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      verge,
      1.2,
      6,
    );
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
          // a fire escape: a railed landing under each row of windows,
          // a ladder down from one landing to the next
          const gy = ((base - top) * 0.62) / 3;
          const fx0 = x + 2,
            fx1 = x + hw * 0.58;
          for (let f = 0; f < 3; f++) {
            const fy = top + 5 + gy * (f + 1) - 1;
            pen.shape(rect(fx0, fy, fx1 - fx0, 2), I.paint([60, 60, 70], 0.04), 0.8, 40 + f);
            pen.stroke(
              [
                [fx0, fy - 5],
                [fx1, fy - 5],
              ],
              0.7,
              43 + f,
            );
            for (const px of [fx0, (fx0 + fx1) / 2, fx1])
              pen.stroke(
                [
                  [px, fy],
                  [px, fy - 5],
                ],
                0.6,
                46 + f + px * 0.01,
              );
            if (f < 2)
              pen.stroke(
                [
                  [fx1 - 4, fy + 2],
                  [fx0 + 6, fy + gy - 1],
                ],
                0.8,
                50 + f,
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
    // the museum: a stone front with columns and wide steps, a fountain
    // on the plaza beside it
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * city.street[0] - 1;
      const stone: C = I.paint([232, 224, 206], 0.04);
      const mx = x0 + w * 0.36,
        mw = w * 0.56,
        mh = h * 0.07;
      // steps
      for (let s = 0; s < 3; s++) pen.shape(rect(mx - 6 + s * 5, base - (s + 1) * 3, mw + 12 - s * 10, 3), stone, 0.9, 1400 + s);
      const fb = base - 9;
      pen.shape(rect(mx, fb - mh, mw, mh), stone, 1.3, 1404);
      // the columns across the front, dark doorways between the middle ones
      const n = 6;
      for (let i = 0; i < n; i++) {
        const cx = mx + mw * (0.08 + (i * 0.84) / (n - 1));
        pen.shape(rect(cx - 4, fb - mh + 6, 8, mh - 6), I.paint([244, 238, 224], 0.04), 1, 1405 + i);
        pen.stroke(
          [
            [cx - 1.5, fb - mh + 8],
            [cx - 1.5, fb - 2],
          ],
          0.4,
          1411 + i,
        );
      }
      for (const f of [0.38, 0.55]) pen.shape(rect(mx + mw * f, fb - mh * 0.5, mw * 0.07, mh * 0.5), I.lit ? I.window : [60, 56, 60], 1, 1415 + f);
      pen.shape(rect(mx - 4, fb - mh - 4, mw + 8, 5), stone, 1.1, 1417);
      pen.shape(
        [
          [mx - 6, fb - mh - 4],
          [mx + mw / 2, fb - mh - h * 0.035],
          [mx + mw + 6, fb - mh - 4],
        ],
        stone,
        1.3,
        1418,
      );
      pen.shape(ellipse(mx + mw / 2, fb - mh - h * 0.015, 5, 3, 10), null, 0.7, 1419);
      // banners hanging between the columns
      for (const [f, c] of [
        [0.2, [226, 96, 86]],
        [0.74, [70, 120, 190]],
      ] as [number, C][])
        pen.shape(rect(mx + mw * f, fb - mh + 8, 7, mh * 0.45), I.paint(c, 0.04), 0.9, 1420 + f);
      // the fountain on the plaza (the water: live)
      const fx = x0 + w * 0.16,
        fy = base - 2;
      pen.shape(rect(fx - 26, fy - 8, 52, 8), stone, 1.2, 1425);
      pen.shape(rect(fx - 22, fy - 8, 44, 3), I.snowy ? I.snow : I.paint([110, 180, 220], 0.04), 0.8, 1426);
      pen.shape(rect(fx - 3, fy - 24, 6, 16), stone, 1, 1427);
      pen.shape(ellipse(fx, fy - 24, 10, 2.6, 12), stone, 1, 1428);
      lamp(pen, I, x0 + w * 0.03, base, 34);
    },
    // the subway entrance: green railings and globe lamps round the stairs
    // down, a newsstand, a bus shelter
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * city.street[0] - 1;
      const green: C = I.paint([70, 130, 100], 0.04);
      // the stairs going down, a railing round three sides
      const sx = x0 + w * 0.12,
        sw = w * 0.22;
      pen.shape(
        [
          [sx, base],
          [sx + sw, base],
          [sx + sw - 8, base - 6],
          [sx + 8, base - 6],
        ],
        [50, 48, 54],
        1,
        1430,
      );
      for (let i = 1; i < 4; i++)
        pen.stroke(
          [
            [sx + 2 + i * 2, base - i * 1.5],
            [sx + sw - 2 - i * 2, base - i * 1.5],
          ],
          0.5,
          1431 + i,
        );
      for (const x of [sx, sx + sw])
        pen.stroke(
          [
            [x, base],
            [x, base - 16],
          ],
          1.3,
          1435 + x,
        );
      pen.stroke(
        [
          [sx, base - 16],
          [sx + sw, base - 16],
        ],
        1.3,
        1436,
      );
      for (let x = sx + 6; x < sx + sw; x += 6)
        pen.stroke(
          [
            [x, base - 6],
            [x, base - 16],
          ],
          0.6,
          1437 + x,
        );
      for (const x of [sx, sx + sw]) {
        pen.stroke(
          [
            [x, base - 16],
            [x, base - 28],
          ],
          1,
          1440 + x,
        );
        pen.shape(ellipse(x, base - 31, 4, 4, 10), I.lit ? I.window : I.paint([110, 190, 130], 0.04), 1, 1441 + x);
      }
      pen.shape(rect(sx + sw * 0.25, base - 24, sw * 0.5, 7), green, 1, 1443);
      // the newsstand
      const nx = x0 + w * 0.46;
      pen.shape(rect(nx, base - h * 0.035, w * 0.14, h * 0.035), green, 1.2, 1445);
      pen.shape(rect(nx - 4, base - h * 0.035 - 5, w * 0.14 + 8, 5), I.paint([60, 110, 84], 0.04), 1.1, 1446);
      pen.shape(rect(nx + 5, base - h * 0.026, w * 0.14 - 10, h * 0.014), I.lit ? I.window : I.paint([240, 236, 220], 0.04), 0.8, 1447);
      for (let i = 0; i < 4; i++) pen.shape(rect(nx + 6 + i * 13, base - h * 0.012, 10, 8), I.paint(i % 2 ? [240, 220, 140] : [230, 230, 236], 0.04), 0.5, 1448 + i);
      // the bus shelter: glass panels, a roof, a bench, the route sign
      const bx = x0 + w * 0.72,
        bw = w * 0.2;
      pen.shape(rect(bx, base - 28, bw, 3), I.paint([90, 96, 110], 0.04), 1.1, 1452);
      for (const f of [0, 1])
        pen.stroke(
          [
            [bx + bw * f, base],
            [bx + bw * f, base - 25],
          ],
          1.1,
          1453 + f,
        );
      pen.shape(rect(bx + 3, base - 24, bw - 6, 18), I.paint([200, 224, 240], 0.04), 0.7, 1455);
      pen.shape(rect(bx + bw * 0.2, base - 9, bw * 0.6, 3), I.paint([150, 110, 80], 0.04), 0.8, 1456);
      pen.stroke(
        [
          [bx + bw + 10, base],
          [bx + bw + 10, base - 34],
        ],
        1,
        1457,
      );
      pen.shape(rect(bx + bw + 5, base - 42, 10, 10), I.paint([70, 120, 190], 0.04), 0.9, 1458);
    },
    // the arena across the river, its ring of lights; plane trees and a
    // row of bikes on our side
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const mid = pens[1];
      const hz = h * city.hz;
      const ax = x0 + w * 0.5,
        aw = w * 0.36;
      const shell: C = I.paint([214, 218, 226], 0.14);
      mid.shape(
        [
          [ax - aw, hz],
          [ax - aw, hz - h * 0.035],
          ...ellipse(ax, hz - h * 0.035, aw, h * 0.025, 24, Math.PI, TAU).slice(1, -1),
          [ax + aw, hz - h * 0.035],
          [ax + aw, hz],
        ],
        shell,
        1.1,
        1460,
      );
      // ribs and the band of lights round the top
      for (let i = 1; i < 12; i++) {
        const x = ax - aw + (aw * 2 * i) / 12;
        mid.stroke(
          [
            [x, hz],
            [x, hz - h * 0.035],
          ],
          0.5,
          1461 + i,
        );
      }
      mid.shape(rect(ax - aw, hz - h * 0.035, aw * 2, 4), I.lit ? I.window : I.paint([150, 160, 176], 0.14), 0.8, 1475);
      // two light masts over the roof
      for (const d of [-0.7, 0.7]) {
        const lx = ax + aw * d;
        mid.stroke(
          [
            [lx, hz - h * 0.04],
            [lx, hz - h * 0.085],
          ],
          0.9,
          1476 + d,
        );
        mid.shape(rect(lx - 6, hz - h * 0.092, 12, 6), I.lit ? I.window : I.paint([220, 226, 230], 0.14), 0.8, 1477 + d);
      }
      // our side: plane trees along the walk, a row of bikes in a rack
      const pen = pens[2];
      const base = h * city.street[0] - 2;
      for (const f of [0.12, 0.36, 0.64, 0.88])
        leafy(pen, x0 + w * f, base, 46, foliage(I, 1480 + f, 0.04, [110, 170, 96]), season === "winter");
      for (let i = 0; i < 5; i++) {
        const bx = x0 + w * 0.44 + i * 10;
        pen.stroke(ellipse(bx, base - 4, 4, 4, 10), 0.8, 1490 + i);
        pen.stroke(ellipse(bx + 7, base - 4, 4, 4, 10), 0.8, 1491 + i);
        pen.stroke(
          [
            [bx, base - 4],
            [bx + 3, base - 10],
            [bx + 7, base - 4],
          ],
          0.9,
          1492 + i,
        );
      }
    },
    // the market street: a bakery, a florist with buckets of flowers out
    // front, a café with tables on the walk, a bodega on the corner
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const base = h * city.street[0] - 1;
      const shops: [C, C, number][] = [
        [
          [226, 196, 160],
          [150, 90, 70],
          0.71,
        ],
        [
          [170, 200, 176],
          [226, 120, 150],
          0.73,
        ],
        [
          [206, 120, 96],
          [60, 80, 110],
          0.7,
        ],
        [
          [236, 220, 170],
          [70, 140, 100],
          0.725,
        ],
      ];
      const sw = (w * 0.94) / 4;
      shops.forEach(([wall, awn, tp], i) => {
        const x = x0 + w * 0.03 + i * sw,
          top = h * tp;
        pen.shape(rect(x, top, sw, base - top), I.paint(wall, 0.04), 1.3, 1500 + i);
        pen.shape(rect(x - 2, top - 3, sw + 4, 4), I.paint([244, 236, 220], 0.04), 1.1, 1504 + i);
        windows(pen, I, x + 5, top + 6, sw - 10, (base - top) * 0.42, 2, 2, 1508 + i, I.paint([196, 220, 236], 0.04));
        // the shop window and door under a sloped awning
        const sy = base - (base - top) * 0.36;
        pen.shape(rect(x + 4, sy + 6, sw * 0.58, base - sy - 8), I.lit ? I.window : I.paint([196, 220, 236], 0.04), 1, 1512 + i);
        pen.shape(rect(x + sw * 0.7, sy + 8, sw * 0.18, base - sy - 8), I.paint([90, 70, 60], 0.04), 1, 1516 + i);
        pen.shape(
          [
            [x + 1, sy],
            [x + sw - 1, sy],
            [x + sw + 3, sy + 8],
            [x - 3, sy + 8],
          ],
          I.paint(awn, 0.04),
          1.1,
          1520 + i,
        );
      });
      // the florist's buckets: tulips in spring, roses in summer, sunflowers
      // and gourds in autumn, a little tree for sale in winter
      const fx = x0 + w * 0.03 + sw + 6;
      for (let i = 0; i < 4; i++) {
        const bx = fx + i * 12;
        pen.shape(rect(bx, base - 8, 9, 8), I.paint([150, 160, 170], 0.04), 0.8, 1530 + i);
        if (season === "winter") continue;
        const c: C =
          season === "autumn" ? (i % 2 ? [244, 196, 50] : [226, 120, 50]) : season === "spring" ? (i % 2 ? [236, 110, 150] : [250, 220, 90]) : [214, 60, 70];
        for (let j = 0; j < 3; j++) pen.shape(ellipse(bx + 2 + j * 2.5, base - 12 - (j % 2) * 2, 2, 2, 6), I.paint(c, 0.04), 0.5, 1534 + i + j);
      }
      if (season === "winter") fir(pen, I, fx + 52, base, 22, 1540);
      // café tables and chairs on the walk
      for (const f of [0.55, 0.64]) {
        const tx = x0 + w * f;
        pen.shape(ellipse(tx, base - 9, 6, 1.6, 10), I.paint([240, 240, 236], 0.04), 0.8, 1541 + f);
        pen.stroke(
          [
            [tx, base - 9],
            [tx, base],
          ],
          0.8,
          1542 + f,
        );
        for (const d of [-9, 9])
          pen.stroke(
            [
              [tx + d, base],
              [tx + d, base - 6],
              [tx + d + Math.sign(d) * 2, base - 11],
            ],
            0.7,
            1543 + f + d,
          );
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
    // boats on the river: a tug pushing upstream, a ferry the other way.
    // They pass behind what stands on our bank (the houses, the museum,
    // the market, the wheel's legs) and behind the bridge towers
    {
      g.save();
      const R = h * 0.075;
      behind(g, X, PW, [
        [w * 1.22 - w * 0.035, w * 1.22 + w * 0.035, h * 0.6, 1],
        [w * 1.78 - w * 0.035, w * 1.78 + w * 0.035, h * 0.6, 1],
        [w * 2.6 - R * 0.62, w * 2.6 + R * 0.62, h * 0.69, 2],
        [w * 2.6 + R * 0.7, w * 2.6 + R * 0.7 + 14, bank - 14, 2],
        [w * 3.03, w * 3.97, h * 0.69, 2],
        [w * 4.36 - 6, w * 4.92 + 6, h * 0.66, 2],
        [w * 7.01, w * 7.99, h * 0.69, 2],
      ]);
      const tx = (t * 6 + w * 0.3) % PW,
        ty = bank - 9;
      box(
        [
          [tx - 12, ty],
          [tx + 10, ty],
          [tx + 7, ty + 5],
          [tx - 10, ty + 5],
        ],
        1,
        css(I.paint([214, 80, 70], 0.1)),
      );
      box(
        [
          [tx - 6, ty - 7],
          [tx + 2, ty - 7],
          [tx + 2, ty],
          [tx - 6, ty],
        ],
        1,
        css(I.paint([246, 240, 226], 0.1)),
      );
      box(
        [
          [tx - 4, ty - 12],
          [tx - 1, ty - 12],
          [tx - 1, ty - 7],
          [tx - 4, ty - 7],
        ],
        1,
        css(I.paint([60, 60, 70], 0.1)),
      );
      const fx = PW - ((t * 4 + w * 1.7) % PW),
        fy = hz + 7;
      box(
        [
          [fx - 16, fy],
          [fx + 16, fy],
          [fx + 13, fy + 4],
          [fx - 13, fy + 4],
        ],
        1,
        css(I.paint([246, 210, 90], 0.2)),
      );
      box(
        [
          [fx - 11, fy - 6],
          [fx + 11, fy - 6],
          [fx + 11, fy],
          [fx - 11, fy],
        ],
        1,
        css(I.paint([250, 248, 240], 0.2)),
      );
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = night ? css(I.window) : css(I.paint([150, 190, 220], 0.2));
        g.fillRect(X(fx + i * 4, 1) - 1.2, fy - 4, 2.4, 2.2);
      }
      g.restore();
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
      box(
        [
          [x - 5, y],
          [x - 4, y - 4],
          [x + 4, y - 4],
          [x + 5, y],
        ],
        1,
        css(I.paint(cl[i], 0.12)),
        0.9,
      );
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
      const lanes = [s0 + (s1 - s0) * 0.33, s0 + (s1 - s0) * 0.82]; // wheels mid-lane, either side of the dashes
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

// ---------------------------------------------------------------------------
// the suburbs
// ---------------------------------------------------------------------------

// a house: walls, a gable roof, a door, windows, maybe a garage
const suburb = {
  hz: 0.735,
  yard: 0.8, // where the houses stand
  walk: [0.835, 0.85] as [number, number],
  street: [0.85, 0.905] as [number, number],
  ground(k: Kit) {
    const { pens, I, h, PW, season } = k;
    const winter = I.snowy;
    // far: a low line of trees with a water tower and a steeple poking up
    const tl = (x: number) => h * (this.hz - 0.012 + 0.006 * loopWave(x, PW, 21));
    const treeline: Pt[] = [];
    for (let x = -8; x <= PW + 8; x += 5)
      treeline.push([x, tl(x) - Math.abs(Math.sin(x * 0.09)) * 5 - Math.abs(Math.sin(x * 0.031)) * 4]);
    const far: C = winter
      ? I.paint([170, 176, 190], 0.38)
      : season === "autumn"
        ? I.paint([196, 150, 96], 0.38)
        : I.paint([100, 150, 110], 0.38);
    pens[0].fillOnly([...treeline, [PW + 8, h + 8], [-8, h + 8]], far);
    pens[0].stroke(treeline, 1.1, 1);
    // the town water tower
    {
      const wx = k.w * 0.48,
        b = tl(wx);
      for (const d of [-7, 7])
        pens[0].stroke(
          [
            [wx + d, b],
            [wx + d * 0.6, b - h * 0.05],
          ],
          1,
          d,
        );
      pens[0].shape(ellipse(wx, b - h * 0.062, 12, 9, 18), I.paint([170, 200, 220], 0.38), 1.1, 3);
      pens[0].stroke(
        [
          [wx - 4, b - h * 0.075],
          [wx, b - h * 0.08],
        ],
        1.4,
        4,
      );
    }
    // a church steeple
    {
      const sx = k.w * 2.32,
        b = tl(sx);
      pens[0].shape(rect(sx - 4, b - h * 0.035, 8, h * 0.035), I.paint([240, 236, 226], 0.38), 1, 5);
      pens[0].shape(
        [
          [sx - 5, b - h * 0.035],
          [sx, b - h * 0.07],
          [sx + 5, b - h * 0.035],
        ],
        I.paint([140, 150, 170], 0.38),
        1,
        6,
      );
    }
    // middle: the backyards, rooftops of the next street over, power lines
    const back: C = winter ? I.snow : I.paint([140, 186, 110], 0.18);
    pens[1].fillOnly(
      [
        [-8, h * this.hz],
        [PW + 8, h * this.hz],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      back,
    );
    pens[1].stroke(
      curve(() => h * this.hz, -8, PW + 8, 30),
      1.1,
      2,
    );
    const roofs: C[] = [
      [150, 110, 100],
      [110, 120, 140],
      [170, 140, 110],
      [120, 100, 110],
    ];
    for (let x = 10, i = 0; x < PW - 20; i++) {
      const rw = 26 + hash(i * 3.3) * 16,
        rb = h * (this.hz + 0.016);
      pens[1].shape(
        [
          [x, rb],
          [x + rw * 0.25, rb - 9 - hash(i) * 4],
          [x + rw * 0.75, rb - 9 - hash(i) * 4],
          [x + rw, rb],
        ],
        winter ? I.snow : I.paint(roofs[i % 4], 0.18),
        1,
        i,
      );
      x += rw + 10 + hash(i * 7) * 30;
    }
    // backyard fences in front of those roofs
    {
      const fb = h * (this.hz + 0.02);
      const wood: C = winter ? I.paint([200, 190, 176], 0.18) : I.paint([190, 160, 120], 0.18);
      pens[1].fillOnly(
        [
          [-8, fb - 6],
          [PW + 8, fb - 6],
          [PW + 8, fb],
          [-8, fb],
        ],
        wood,
      );
      pens[1].stroke(
        curve(() => fb - 6, -8, PW + 8, 30),
        0.8,
        7,
      );
      pens[1].stroke(
        curve(() => fb, -8, PW + 8, 30),
        0.8,
        8,
      );
      for (let x = 0; x < PW; x += 7)
        pens[1].stroke(
          [
            [x, fb],
            [x, fb - 6],
          ],
          0.5,
          x,
        );
    }
    for (let x = 0; x < PW; x += 120)
      pens[1].stroke(
        [
          [x, h * (this.hz + 0.03)],
          [x, h * (this.hz - 0.03)],
        ],
        1.1,
        x,
      );
    for (const dy of [0, 4])
      for (let x = 0; x < PW; x += 120) {
        const pts: Pt[] = [];
        for (let i = 0; i <= 10; i++)
          pts.push([x + i * 12, h * (this.hz - 0.03) + dy + Math.sin((i / 10) * Math.PI) * 6]);
        pens[1].stroke(pts, 0.6, x + dy);
      }
    // near: front lawns, the sidewalk, the street, the lawn on our side
    const lawn: C = winter
      ? I.snow
      : season === "autumn"
        ? I.paint([150, 176, 100], 0.04)
        : I.paint([126, 186, 100], 0.04);
    const yard = h * (this.yard - 0.018);
    pens[2].fillOnly(
      [
        [-8, yard],
        [PW + 8, yard],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      lawn,
    );
    pens[2].stroke(
      curve(() => yard, -8, PW + 8, 30),
      1.1,
      3,
    );
    const walk: C = winter ? mix(I.snow, [200, 200, 200], 0.2) : I.paint([214, 210, 200], 0.04);
    const [w0, w1] = this.walk.map((f) => h * f);
    pens[2].shape(
      [
        [-8, w0],
        [PW + 8, w0],
        [PW + 8, w1],
        [-8, w1],
      ],
      walk,
      1.1,
      4,
    );
    for (let x = 0; x < PW; x += 22)
      pens[2].stroke(
        [
          [x, w0],
          [x - 2, w1],
        ],
        0.6,
        x,
      );
    const [s0, s1] = this.street.map((f) => h * f);
    const road: C = winter ? mix(I.paint([120, 124, 136], 0.04), [230, 234, 240], 0.3) : I.paint([120, 124, 136], 0.04);
    pens[2].shape(
      [
        [-8, s0],
        [PW + 8, s0],
        [PW + 8, s1],
        [-8, s1],
      ],
      road,
      1.3,
      5,
    );
    for (let x = 6; x < PW; x += 30)
      pens[2].stroke(
        [
          [x, (s0 + s1) / 2],
          [x + 14, (s0 + s1) / 2],
        ],
        1.2,
        x,
      );
    pens[2].shape(
      [
        [-8, s1],
        [PW + 8, s1],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      lawn,
      1.2,
      6,
    );
    if (!winter)
      for (let i = 0; i < PW / 12; i++) {
        const x = hash(i * 3.7) * PW,
          y = s1 + 8 + hash(i * 5.1) * (h - s1 - 14);
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
  },
  scenes: [
    // a street of houses: picket fence, mailbox, a hoop over the garage
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const base = h * suburb.yard;
      const ht = h * 0.042;
      house(
        pen,
        I,
        x0 + w * 0.04,
        base,
        w * 0.24,
        ht,
        I.paint([246, 236, 210], 0.04),
        I.paint([110, 120, 150], 0.04),
        true,
        1,
      );
      house(
        pen,
        I,
        x0 + w * 0.5,
        base,
        w * 0.22,
        ht * 1.08,
        I.paint([170, 200, 214], 0.04),
        I.paint([180, 90, 80], 0.04),
        false,
        2,
      );
      house(
        pen,
        I,
        x0 + w * 0.76,
        base,
        w * 0.2,
        ht,
        I.paint([240, 200, 170], 0.04),
        I.paint([100, 110, 100], 0.04),
        false,
        3,
      );
      // driveway
      const wb = h * suburb.walk[0];
      pen.shape(
        [
          [x0 + w * 0.28, base],
          [x0 + w * 0.4, base],
          [x0 + w * 0.42, wb],
          [x0 + w * 0.26, wb],
        ],
        I.paint([200, 196, 188], 0.04),
        1,
        4,
      );
      // the basketball hoop over the garage
      pen.stroke(
        [
          [x0 + w * 0.34, base - ht * 0.72 - h * 0.006],
          [x0 + w * 0.34, base - ht * 0.72 - h * 0.022],
        ],
        1,
        5,
      );
      pen.shape(rect(x0 + w * 0.325, base - ht * 0.72 - h * 0.03, 11, 8), I.paint([250, 250, 246], 0.04), 0.9, 6);
      pen.stroke(
        [
          [x0 + w * 0.33, base - ht * 0.72 - h * 0.021],
          [x0 + w * 0.335, base - ht * 0.72 - h * 0.015],
          [x0 + w * 0.345, base - ht * 0.72 - h * 0.015],
          [x0 + w * 0.35, base - ht * 0.72 - h * 0.021],
        ],
        0.8,
        7,
      );
      // a white picket fence in front of the middle house
      const fy = (base + wb) / 2 + 4;
      pen.stroke(
        [
          [x0 + w * 0.47, fy - 5],
          [x0 + w * 0.74, fy - 5],
        ],
        0.9,
        8,
      );
      for (let x = x0 + w * 0.47; x <= x0 + w * 0.74; x += 5)
        pen.shape(
          [
            [x - 1.4, fy],
            [x - 1.4, fy - 8],
            [x, fy - 10],
            [x + 1.4, fy - 8],
            [x + 1.4, fy],
          ],
          I.paint([250, 250, 246], 0.04),
          0.6,
          x,
        );
      // mailbox
      const mx = x0 + w * 0.2;
      pen.stroke(
        [
          [mx, wb - 1],
          [mx, wb - 11],
        ],
        1.1,
        9,
      );
      pen.shape(
        [
          [mx - 5, wb - 11],
          [mx - 5, wb - 16],
          [mx + 5, wb - 16],
          [mx + 5, wb - 11],
        ],
        I.paint([90, 110, 150], 0.04),
        1,
        10,
      );
      pen.stroke(
        [
          [mx + 5, wb - 16],
          [mx + 5, wb - 21],
          [mx + 8, wb - 20],
        ],
        1,
        11,
      );
      // shade trees
      const leaf: C = season === "autumn" ? I.paint([230, 140, 60], 0.04) : I.paint([100, 166, 90], 0.04);
      leafy(pen, x0 + w * 0.45, base + 4, 40, leaf, season === "winter");
      leafy(pen, x0 + w * 0.985, base + 2, 34, leaf, season === "winter");
    },
    // the playground in the little park at the end of the cul-de-sac
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const base = h * suburb.yard + 6;
      // wood chips under the play set
      pen.shape(ellipse(x0 + w * 0.5, base, w * 0.3, h * 0.012, 28), I.paint([200, 160, 110], 0.04), 1, 1);
      // the swing frame (the swings move: live)
      const sx = x0 + w * 0.32,
        top = base - h * 0.06;
      for (const d of [-w * 0.09, w * 0.09]) {
        pen.stroke(
          [
            [sx + d - 6, base],
            [sx + d, top],
            [sx + d + 6, base],
          ],
          1.4,
          d,
        );
      }
      pen.stroke(
        [
          [sx - w * 0.09, top],
          [sx + w * 0.09, top],
        ],
        1.6,
        2,
      );
      // the slide with its ladder and little roof
      const tx = x0 + w * 0.62,
        deck = base - h * 0.04;
      pen.shape(rect(tx, deck, 22, 3), I.paint([200, 150, 100], 0.04), 1, 3);
      for (const d of [0, 22])
        pen.stroke(
          [
            [tx + d, deck],
            [tx + d, base],
          ],
          1.2,
          d + 4,
        );
      pen.shape(
        [
          [tx - 3, deck - 16],
          [tx + 11, deck - 26],
          [tx + 25, deck - 16],
        ],
        I.paint([226, 96, 86], 0.04),
        1.1,
        5,
      );
      for (const d of [0, 22])
        pen.stroke(
          [
            [tx + d, deck],
            [tx + d, deck - 16],
          ],
          1,
          d + 6,
        );
      pen.shape(
        [
          [tx + 22, deck],
          [tx + 50, base - 2],
          [tx + 54, base - 2],
          [tx + 26, deck + 3],
        ],
        I.paint([246, 206, 80], 0.04),
        1.1,
        7,
      );
      for (let r = 0; r < 4; r++)
        pen.stroke(
          [
            [tx - 8, base - (r + 1) * 6],
            [tx, base - (r + 1) * 6],
          ],
          0.8,
          r,
        );
      pen.stroke(
        [
          [tx - 8, base],
          [tx - 6, deck],
        ],
        1,
        8,
      );
      // a big oak and a bench
      const leaf: C = season === "autumn" ? I.paint([214, 120, 60], 0.04) : I.paint([90, 150, 80], 0.04);
      leafy(pen, x0 + w * 0.1, base, 54, leaf, season === "winter");
      leafy(pen, x0 + w * 0.9, base - 2, 40, leaf, season === "winter");
      const bx = x0 + w * 0.78;
      pen.shape(rect(bx, base - 7, 18, 3), I.paint([170, 120, 80], 0.04), 1, 9);
      pen.stroke(
        [
          [bx, base - 11],
          [bx + 18, base - 11],
        ],
        1.1,
        10,
      );
    },
    // the elementary school: brick, a clock, the flag, a soccer goal
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * suburb.yard;
      const brick: C = I.paint([196, 110, 86], 0.04);
      const glass: C = I.paint([200, 224, 240], 0.04);
      const sx = x0 + w * 0.2,
        sw = w * 0.56,
        sh = h * 0.05;
      pen.shape(rect(sx, base - sh, sw, sh), brick, 1.3, 1);
      pen.shape(rect(sx - 3, base - sh - 3, sw + 6, 4), I.paint([236, 226, 206], 0.04), 1.1, 2);
      windows(pen, I, sx + 4, base - sh + 5, sw * 0.38, sh * 0.6, 4, 2, 3, glass);
      windows(pen, I, sx + sw * 0.6, base - sh + 5, sw * 0.38, sh * 0.6, 4, 2, 4, glass);
      // the entrance with its pediment and clock
      const ex = sx + sw / 2;
      pen.shape(rect(ex - 14, base - sh - 10, 28, sh + 10), I.paint([236, 226, 206], 0.04), 1.2, 5);
      pen.shape(
        [
          [ex - 17, base - sh - 10],
          [ex, base - sh - 22],
          [ex + 17, base - sh - 10],
        ],
        I.paint([236, 226, 206], 0.04),
        1.2,
        6,
      );
      pen.shape(ellipse(ex, base - sh - 2, 5, 5, 14), I.paint([250, 250, 246], 0.04), 1, 7);
      pen.stroke(
        [
          [ex, base - sh - 5],
          [ex, base - sh - 2],
          [ex + 2.5, base - sh - 2],
        ],
        0.8,
        8,
      );
      pen.shape(rect(ex - 7, base - 16, 14, 16), I.paint([110, 130, 160], 0.04), 1.1, 9);
      // the flagpole (the flag waves: live)
      pen.stroke(
        [
          [x0 + w * 0.12, base + 4],
          [x0 + w * 0.12, base - h * 0.085],
        ],
        1.2,
        10,
      );
      pen.shape(ellipse(x0 + w * 0.12, base - h * 0.086, 1.6, 1.6, 8), I.paint([240, 210, 120], 0.04), 0.8, 11);
      // a soccer goal on the field
      const gx = x0 + w * 0.84;
      pen.stroke(
        [
          [gx, base + 6],
          [gx, base - 12],
          [gx + 26, base - 12],
          [gx + 26, base + 6],
        ],
        1.2,
        12,
      );
      for (let i = 1; i < 6; i++)
        pen.stroke(
          [
            [gx + i * 4.3, base - 12],
            [gx + i * 4.3 + 3, base + 4],
          ],
          0.5,
          i,
        );
    },
    // the strip mall: a row of shops under one roof, a parking lot, a sign
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * suburb.yard;
      const sh = h * 0.04;
      const mx = x0 + w * 0.08,
        mw = w * 0.74;
      pen.shape(rect(mx, base - sh, mw, sh), I.paint([236, 226, 206], 0.04), 1.3, 1);
      pen.shape(rect(mx - 3, base - sh - 7, mw + 6, 7), I.paint([200, 186, 160], 0.04), 1.2, 2);
      const shops: C[] = [
        [226, 96, 86],
        [90, 160, 200],
        [120, 180, 110],
        [246, 190, 80],
      ];
      const n = 4,
        sw = mw / n;
      for (let i = 0; i < n; i++) {
        const x = mx + sw * i;
        if (i)
          pen.stroke(
            [
              [x, base - sh],
              [x, base],
            ],
            0.9,
            i,
          );
        pen.shape(
          rect(x + 4, base - sh + 9, sw - 8, sh - 9),
          I.lit ? I.window : I.paint([200, 224, 240], 0.04),
          1,
          i + 0.2,
        );
        // a sign over each shop in its own colour
        pen.shape(rect(x + 6, base - sh - 5, sw - 12, 4), I.paint(shops[i], 0.04), 0.8, i + 0.4);
        // a striped awning on two of them
        if (i % 2 === 0)
          for (let s = 0; s < 5; s++)
            pen.shape(
              [
                [x + 4 + ((sw - 8) * s) / 5, base - sh + 4],
                [x + 4 + ((sw - 8) * (s + 1)) / 5, base - sh + 4],
                [x + 4 + ((sw - 8) * (s + 1)) / 5, base - sh + 8],
                [x + 4 + ((sw - 8) * s) / 5, base - sh + 8],
              ],
              s % 2 ? I.paint([250, 246, 236], 0.04) : I.paint(shops[i], 0.04),
              0.7,
              s + i,
            );
      }
      // the parking lot lines in front
      const wb = h * suburb.walk[0];
      pen.shape(
        [
          [mx - 6, base + 1],
          [mx + mw + 6, base + 1],
          [mx + mw + 10, wb - 1],
          [mx - 10, wb - 1],
        ],
        I.paint([150, 154, 164], 0.04),
        1,
        9,
      );
      for (let x = mx; x < mx + mw; x += 14)
        pen.stroke(
          [
            [x, base + 3],
            [x - 3, (base + wb) / 2],
          ],
          0.9,
          x,
        );
      // the tall sign by the road (its OPEN light flickers on: live)
      const px = x0 + w * 0.9;
      pen.stroke(
        [
          [px, wb - 1],
          [px, base - h * 0.06],
        ],
        1.4,
        10,
      );
      pen.shape(rect(px - 14, base - h * 0.085, 28, h * 0.026), I.paint([250, 246, 236], 0.04), 1.2, 11);
      for (let i = 0; i < 3; i++)
        pen.shape(rect(px - 11 + i * 8, base - h * 0.08, 6, h * 0.015), I.paint(shops[i], 0.04), 0.7, 12 + i);
    },
    // the cul-de-sac: a split-level with a hoop over the garage, a bike on
    // the lawn, a trampoline out back; a leaf pile in autumn, a snowman
    // in winter
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const base = h * suburb.yard;
      // the trampoline behind, peeking over
      pen.shape(ellipse(x0 + w * 0.08, base - 14, 18, 3, 16), [50, 50, 60], 1, 1200);
      for (const d of [-14, 0, 14])
        pen.stroke(
          [
            [x0 + w * 0.08 + d, base - 13],
            [x0 + w * 0.08 + d, base - 2],
          ],
          0.9,
          1201 + d,
        );
      house(pen, I, x0 + w * 0.22, base, w * 0.22, h * 0.035, I.paint([226, 214, 186], 0.04), I.paint([110, 90, 80], 0.04), true, 1205);
      // the hoop over the garage door
      const hx = x0 + w * 0.22 + w * 0.22 + w * 0.11;
      pen.shape(rect(hx - 7, base - h * 0.035 * 0.72 - 13, 14, 9), I.paint([250, 250, 250], 0.04), 0.9, 1210);
      pen.stroke(ellipse(hx, base - h * 0.035 * 0.72 - 4, 4, 1.4, 10), 0.9, 1211);
      // the driveway down to the walk
      pen.fillOnly(
        [
          [hx - w * 0.05, base],
          [hx + w * 0.05, base],
          [hx + w * 0.06, h * suburb.walk[0]],
          [hx - w * 0.06, h * suburb.walk[0]],
        ],
        I.snowy ? mix(I.snow, [200, 200, 210], 0.2) : I.paint([200, 200, 196], 0.04),
      );
      // a bike lying on the lawn
      if (!I.snowy) {
        const bx = x0 + w * 0.16,
          by = h * 0.825;
        pen.stroke(ellipse(bx - 7, by, 5, 1.6, 10), 0.9, 1212);
        pen.stroke(ellipse(bx + 7, by, 5, 1.6, 10), 0.9, 1213);
        pen.stroke(
          [
            [bx - 7, by],
            [bx, by - 1],
            [bx + 7, by],
          ],
          1,
          1214,
        );
      }
      // the season on the lawn
      const lx = x0 + w * 0.82,
        ly = h * 0.83;
      if (I.snowy || season === "winter") {
        pen.shape(ellipse(lx, ly - 7, 9, 8, 14), I.snow, 1.1, 1220);
        pen.shape(ellipse(lx, ly - 20, 7, 6, 14), I.snow, 1.1, 1221);
        pen.shape(ellipse(lx, ly - 30, 5, 4.5, 12), I.snow, 1.1, 1222);
        pen.shape(
          [
            [lx + 3, ly - 30],
            [lx + 10, ly - 29],
            [lx + 3, ly - 28],
          ],
          I.paint([240, 140, 50], 0.04),
          0.7,
          1223,
        );
        pen.stroke(
          [
            [lx - 7, ly - 21],
            [lx - 16, ly - 27],
          ],
          0.9,
          1224,
        );
        pen.stroke(
          [
            [lx + 7, ly - 21],
            [lx + 15, ly - 28],
          ],
          0.9,
          1225,
        );
      } else if (season === "autumn") {
        pen.shape(ellipse(lx, ly, 16, 7, 16, Math.PI, TAU), I.paint([226, 140, 60], 0.04), 1, 1226);
        for (let i = 0; i < 6; i++)
          pen.shape(ellipse(lx - 12 + i * 5, ly - 3 - hash(i) * 4, 2, 1.2, 6), I.paint(i % 2 ? [204, 76, 52] : [244, 204, 76], 0.04), 0.5, 1227 + i);
        pen.stroke(
          [
            [lx + 16, ly],
            [lx + 26, ly - 22],
          ],
          1.1,
          1233,
        );
      }
      leafy(pen, x0 + w * 0.92, base + 2, 40, foliage(I, 1234, 0.04, [100, 166, 90]), season === "winter");
    },
    // the community pool: a chain-link fence, a slide, the lifeguard's
    // chair; covered over out of season
    (k: Kit, x0: number) => {
      const { pens, I, w, h, season } = k;
      const pen = pens[2];
      const base = h * suburb.yard;
      const open = season === "summer" && !I.snowy;
      // the pool house
      pen.shape(rect(x0 + w * 0.06, base - h * 0.03, w * 0.2, h * 0.03), I.paint([236, 230, 214], 0.04), 1.3, 1240);
      pen.shape(rect(x0 + w * 0.05, base - h * 0.03 - 4, w * 0.22, 4), I.paint([80, 150, 190], 0.04), 1.1, 1241);
      windows(pen, I, x0 + w * 0.08, base - h * 0.024, w * 0.16, h * 0.012, 3, 1, 1242, I.paint([200, 224, 240], 0.04));
      // the pool, seen low and wide
      const px0 = x0 + w * 0.32,
        px1 = x0 + w * 0.9,
        py = base - 3;
      pen.shape(rect(px0 - 4, py - 3, px1 - px0 + 8, 9), I.paint([230, 226, 214], 0.04), 1, 1243);
      pen.shape(rect(px0, py - 2, px1 - px0, 5), open ? I.paint([90, 190, 220], 0.04) : I.snowy ? I.snow : I.paint([70, 110, 90], 0.04), 1, 1244);
      if (open)
        for (let x = px0 + 10; x < px1; x += 22)
          pen.stroke(
            [
              [x, py],
              [x + 6, py],
            ],
            0.6,
            1245 + x,
          );
      // the slide and the lifeguard's chair
      const sx = px0 + 14;
      pen.stroke(
        [
          [sx, py - 3],
          [sx, py - 26],
        ],
        1,
        1250,
      );
      pen.stroke(
        [
          [sx + 5, py - 3],
          [sx + 5, py - 26],
        ],
        1,
        1251,
      );
      for (let y = py - 8; y > py - 26; y -= 5)
        pen.stroke(
          [
            [sx, y],
            [sx + 5, y],
          ],
          0.6,
          1252 + y,
        );
      pen.shape(
        [
          [sx + 5, py - 26],
          [sx + 9, py - 26],
          [sx + 30, py - 3],
          [sx + 25, py - 3],
        ],
        I.paint([240, 196, 70], 0.04),
        1,
        1253,
      );
      const cx = px1 - 30;
      pen.stroke(
        [
          [cx - 6, py - 3],
          [cx - 3, py - 26],
        ],
        1.1,
        1254,
      );
      pen.stroke(
        [
          [cx + 6, py - 3],
          [cx + 3, py - 26],
        ],
        1.1,
        1255,
      );
      pen.shape(rect(cx - 6, py - 32, 12, 6), I.paint([250, 250, 250], 0.04), 1, 1256);
      if (open) {
        pen.stroke(
          [
            [cx, py - 32],
            [cx, py - 46],
          ],
          0.8,
          1257,
        );
        for (let i = 0; i < 3; i++)
          pen.shape(
            [[cx, py - 46], ...ellipse(cx, py - 46, 10, 6, 4, Math.PI + (i * Math.PI) / 3, Math.PI + ((i + 1) * Math.PI) / 3)],
            i % 2 ? I.paint([250, 250, 250], 0.04) : I.paint([226, 84, 70], 0.04),
            0.8,
            1258 + i,
          );
      }
      // the chain-link fence in front, along the walk
      const fy = h * suburb.walk[0] - 1;
      for (let x = x0 + w * 0.3; x <= x0 + w * 0.94; x += 20)
        pen.stroke(
          [
            [x, fy],
            [x, fy - 14],
          ],
          1,
          1260 + x,
        );
      pen.stroke(
        [
          [x0 + w * 0.3, fy - 14],
          [x0 + w * 0.94, fy - 14],
        ],
        0.9,
        1261,
      );
      const g = pen.g;
      g.save();
      g.globalAlpha = 0.35;
      for (let x = x0 + w * 0.3; x < x0 + w * 0.94; x += 4)
        pen.stroke(
          [
            [x, fy - 14],
            [x + 4, fy],
          ],
          0.4,
          1262 + x,
        );
      g.restore();
    },
    // the ballfield: a backstop, the diamond, bleachers, light towers that
    // come on in the evening
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * suburb.yard;
      const dirt: C = I.snowy ? mix(I.snow, [220, 200, 180], 0.2) : I.paint([206, 160, 110], 0.04);
      // the infield, a flat diamond seen low
      const dx = x0 + w * 0.5,
        dy = h * 0.818;
      pen.shape(
        [
          [dx - w * 0.2, dy],
          [dx, dy - 10],
          [dx + w * 0.2, dy],
          [dx, dy + 10],
        ],
        dirt,
        1.1,
        1270,
      );
      for (const [bx, by] of [
        [dx - w * 0.2, dy],
        [dx, dy - 10],
        [dx + w * 0.2, dy],
      ])
        pen.shape(rect(bx - 2.5, by - 1.5, 5, 3), I.paint([250, 250, 250], 0.04), 0.7, 1271 + bx);
      // the backstop, curved fence behind home plate (home is nearest us,
      // so the backstop stands at the front)
      // light towers at the back corners
      for (const f of [0.12, 0.88]) {
        const lx = x0 + w * f;
        pen.stroke(
          [
            [lx, base],
            [lx, base - h * 0.11],
          ],
          1.2,
          1280 + f,
        );
        pen.shape(rect(lx - 9, base - h * 0.11 - 9, 18, 9), I.lit ? I.window : I.paint([220, 226, 230], 0.04), 1, 1281 + f);
        for (let i = 1; i < 3; i++)
          pen.stroke(
            [
              [lx - 9, base - h * 0.11 - 9 + i * 3],
              [lx + 9, base - h * 0.11 - 9 + i * 3],
            ],
            0.5,
            1282 + f + i,
          );
      }
      // bleachers along the first-base side
      const bx = x0 + w * 0.68;
      for (let r = 0; r < 4; r++)
        pen.shape(rect(bx + r * 4, base + 6 - r * 6, w * 0.16 - r * 8, 2.5), I.paint([190, 196, 204], 0.04), 0.8, 1290 + r);
      pen.stroke(
        [
          [bx, base + 8],
          [bx + 12, base - 16],
        ],
        0.8,
        1294,
      );
      // the dugout on the third-base side
      pen.shape(rect(x0 + w * 0.18, base - 2, w * 0.14, 12), [60, 60, 70], 1, 1295);
      pen.shape(rect(x0 + w * 0.17, base - 6, w * 0.16, 4), I.paint([80, 110, 160], 0.04), 1, 1296);
      // the backstop
      const fy = h * suburb.walk[0] - 1;
      for (let x = dx - 34; x <= dx + 34; x += 17)
        pen.stroke(
          [
            [x, fy],
            [x, fy - 26],
          ],
          1,
          1297 + x,
        );
      pen.stroke(
        [
          [dx - 34, fy - 26],
          [dx + 34, fy - 26],
        ],
        1,
        1298,
      );
      const g = pen.g;
      g.save();
      g.globalAlpha = 0.35;
      for (let x = dx - 34; x < dx + 34; x += 4)
        pen.stroke(
          [
            [x, fy - 26],
            [x + 6, fy],
          ],
          0.4,
          1299 + x,
        );
      g.restore();
    },
    // the corner gas station: a canopy over the pumps, a little shop with
    // a pole sign
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * suburb.yard + 4;
      // the shop
      const sx = x0 + w * 0.6,
        sw = w * 0.3,
        sh = h * 0.035;
      pen.shape(rect(sx, base - sh, sw, sh), I.paint([236, 232, 222], 0.04), 1.3, 1300);
      pen.shape(rect(sx - 2, base - sh - 5, sw + 4, 5), I.paint([226, 84, 70], 0.04), 1.1, 1301);
      pen.shape(rect(sx + sw * 0.08, base - sh * 0.75, sw * 0.6, sh * 0.5), I.lit ? I.window : I.paint([200, 224, 240], 0.04), 1, 1302);
      pen.shape(rect(sx + sw * 0.76, base - sh * 0.75, sw * 0.16, sh * 0.75), I.paint([200, 224, 240], 0.04), 1, 1303);
      // the canopy on two posts, the pumps under it
      const cx0 = x0 + w * 0.1,
        cx1 = x0 + w * 0.48,
        ct = base - h * 0.05;
      for (const f of [0.25, 0.75]) {
        const px = cx0 + (cx1 - cx0) * f;
        pen.stroke(
          [
            [px, base],
            [px, ct + 6],
          ],
          1.4,
          1305 + f,
        );
        pen.shape(rect(px + 6, base - 16, 9, 16), I.paint([226, 84, 70], 0.04), 1, 1306 + f);
        pen.shape(rect(px + 8, base - 13, 5, 4), I.paint([220, 236, 230], 0.04), 0.6, 1307 + f);
      }
      pen.shape(rect(cx0, ct, cx1 - cx0, 6), I.paint([250, 250, 250], 0.04), 1.2, 1308);
      pen.shape(rect(cx0, ct + 6, cx1 - cx0, 2), I.paint([226, 84, 70], 0.04), 0.8, 1309);
      // the pole sign with the prices
      const px = x0 + w * 0.94;
      pen.stroke(
        [
          [px, base + 4],
          [px, base - h * 0.08],
        ],
        1.3,
        1310,
      );
      pen.shape(rect(px - 12, base - h * 0.1, 24, h * 0.024), I.paint([226, 84, 70], 0.04), 1.1, 1311);
      for (let i = 0; i < 3; i++) pen.shape(rect(px - 9, base - h * 0.074 + i * 6, 18, 4.5), I.paint([250, 250, 246], 0.04), 0.6, 1312 + i);
    },
  ],
  live(g: CanvasRenderingContext2D, k: Kit, t: number, X: (x: number, layer: number) => number) {
    const { I, h, w, PW } = k;
    const ink = css(I.inkC, 0.9);
    g.strokeStyle = ink;
    g.lineCap = "round";
    g.lineJoin = "round";
    const night = I.night > 0.5;
    const base = h * suburb.yard;
    // the swings going back and forth
    {
      const sx = w * 1.32,
        top = base + 6 - h * 0.06;
      for (const [d, ph] of [
        [-w * 0.04, 0],
        [w * 0.04, 1.7],
      ]) {
        const a = Math.sin(t * 1.6 + ph) * 0.5;
        const L = h * 0.045;
        const px = X(sx + d, 2),
          sx2 = px + Math.sin(a) * L,
          sy = top + Math.cos(a) * L;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(px - 3, top);
        g.lineTo(sx2 - 3, sy);
        g.moveTo(px + 3, top);
        g.lineTo(sx2 + 3, sy);
        g.stroke();
        g.fillStyle = css(I.paint([226, 96, 86], 0.04));
        g.fillRect(sx2 - 4, sy - 1, 8, 2.4);
        g.lineWidth = 0.9;
        g.strokeRect(sx2 - 4, sy - 1, 8, 2.4);
      }
    }
    // the school flag waving
    {
      const fx = X(w * 2.12, 2),
        fy = base - h * 0.082;
      const pts: Pt[] = [];
      for (let i = 0; i <= 8; i++) pts.push([fx + i * 2.6, fy + Math.sin(t * 5 - i * 0.7) * (i / 8) * 2.2]);
      const bot = pts.map(([x, y]) => [x, y + 11] as Pt).reverse();
      g.beginPath();
      [...pts, ...bot].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = css(I.paint([226, 96, 86], 0.04));
      g.fill();
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = css(I.paint([250, 250, 246], 0.04));
      for (let r = 1; r < 3; r++) {
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y + r * 3.6) : g.moveTo(x, y + r * 3.6)));
        g.lineWidth = 1.4;
        g.strokeStyle = css(I.paint([250, 250, 246], 0.04));
        g.stroke();
      }
      g.strokeStyle = ink;
    }
    // a sprinkler ticking across the first lawn on summer mornings and evenings
    if (!night && k.season !== "winter") {
      const cx = X(w * 0.33, 2),
        cy = (base + h * suburb.walk[0]) / 2 + 2;
      const a = Math.PI + 0.3 + ((Math.sin(t * 0.8) + 1) / 2) * (Math.PI - 0.6);
      g.strokeStyle = "rgba(160,210,255,0.85)";
      for (let i = 0; i < 6; i++) {
        const r = 6 + i * 4;
        g.globalAlpha = 1 - i / 7;
        g.beginPath();
        g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5 - Math.sin((i / 6) * Math.PI) * 5, 0.9, 0, TAU);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.strokeStyle = ink;
    }
    // OPEN lit at the strip mall after dark, with a flicker
    if (I.night > 0.3) {
      const on = Math.sin(t * 7) > -0.8 || Math.sin(t * 0.7) > 0;
      g.fillStyle = on ? "rgba(255,90,80,0.95)" : "rgba(140,60,60,0.5)";
      g.font = "700 9px system-ui, sans-serif";
      g.fillText("OPEN", X(w * 3.13, 2), base - h * 0.012);
    }
    // cars and the odd minivan along the street
    {
      const [s0, s1] = suburb.street.map((f) => h * f);
      const lanes = [s0 + (s1 - s0) * 0.33, s0 + (s1 - s0) * 0.82]; // wheels mid-lane, either side of the dashes
      const cl: C[] = [
        [120, 170, 220],
        [226, 96, 86],
        [240, 240, 236],
        [150, 200, 130],
      ];
      for (let i = 0; i < 4; i++) {
        const dir = i % 2 ? -1 : 1;
        const sp = 18 + hash(i * 3 + 1) * 10;
        const xx = (((hash(i * 5.7) * PW + t * sp * dir) % PW) + PW) % PW;
        const y = lanes[i % 2];
        const L = 26,
          H = 10;
        const pts: Pt[] = (
          [
            [-L / 2, 0],
            [-L / 2, -H * 0.85],
            [L * 0.15, -H],
            [L * 0.3, -H * 0.55],
            [L / 2, -H * 0.45],
            [L / 2, 0],
          ] as Pt[]
        ).map(([a, b]) => [X(xx + a * dir, 2), y + b] as Pt);
        g.beginPath();
        pts.forEach(([a, b], j) => (j ? g.lineTo(a, b) : g.moveTo(a, b)));
        g.closePath();
        g.fillStyle = css(I.paint(cl[i], 0.04));
        g.fill();
        g.lineWidth = 1.1;
        g.stroke();
        for (const f of [-0.28, 0.28]) {
          g.fillStyle = css(I.paint([50, 50, 60], 0.04));
          g.beginPath();
          g.arc(X(xx + L * f, 2), y, 3, 0, TAU);
          g.fill();
          g.stroke();
        }
        if (night) {
          const hx = X(xx + (L / 2) * dir, 2);
          const gr = g.createLinearGradient(hx, y, hx + dir * 28, y);
          gr.addColorStop(0, "rgba(255,236,170,0.5)");
          gr.addColorStop(1, "rgba(255,236,170,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(hx, y - 4);
          g.lineTo(hx + dir * 28, y - 9);
          g.lineTo(hx + dir * 28, y + 2);
          g.closePath();
          g.fill();
        }
      }
    }
    // fireflies over the lawns on summer nights
    if (night && k.season === "summer")
      for (let i = 0; i < 10; i++) {
        const a = Math.max(0, Math.sin(t * 1.5 + i * 2.1));
        g.fillStyle = `rgba(230,255,140,${a})`;
        g.beginPath();
        g.arc(X(hash(i * 3.1) * PW + Math.sin(t * 0.4 + i) * 8, 2), base - 10 + hash(i * 1.7) * 30, 1.4, 0, TAU);
        g.fill();
      }
  },
};

// ---------------------------------------------------------------------------
// the desert
// ---------------------------------------------------------------------------

// a saguaro: a ribbed trunk and a couple of arms turned up
function saguaro(pen: Pen, I: Inks, x: number, base: number, ht: number, seed: number) {
  const green: C = I.paint([110, 160, 110], 0.04);
  const tw = ht * 0.13;
  const trunk: Pt[] = [
    [x - tw / 2, base],
    [x - tw / 2, base - ht + tw / 2],
    ...ellipse(x, base - ht + tw / 2, tw / 2, tw / 2, 10, Math.PI, TAU),
    [x + tw / 2, base],
  ];
  const arm = (side: number, at: number, up: number) => {
    const ay = base - ht * at,
      ax = x + side * tw * 0.4,
      aw = tw * 0.8;
    const outer = x + side * (tw * 0.5 + ht * 0.2),
      inner = outer - side * aw,
      topY = ay - ht * up;
    const pts: Pt[] = [
      [ax, ay],
      [outer, ay],
      [outer, topY],
      ...ellipse(outer - (side * aw) / 2, topY, aw / 2, aw / 2, 8, side > 0 ? 0 : Math.PI, side > 0 ? -Math.PI : TAU),
      [inner, ay - aw],
      [ax, ay - aw],
    ];
    pen.shape(pts, green, 1.2, seed + side);
  };
  arm(-1, 0.45 + hash(seed) * 0.1, 0.25);
  if (hash(seed * 3) > 0.25) arm(1, 0.55 + hash(seed * 5) * 0.1, 0.22);
  pen.shape(trunk, green, 1.3, seed);
  for (const f of [-0.2, 0.15])
    pen.stroke(
      [
        [x + tw * f, base - 2],
        [x + tw * f, base - ht + tw],
      ],
      0.6,
      seed + f,
    );
}

const desert = {
  hz: 0.73,
  floor: 0.79, // where the near things stand
  road: [0.855, 0.905] as [number, number],
  mesa(k: Kit, x: number) {
    // flat-topped mesas and buttes along the skyline, looping round
    const u = (((x / k.PW) % 1) + 1) % 1;
    let top = 0;
    // centre, half-width (shares of the loop) and height, for eight scenes
    const bumps: [number, number, number][] = [
      [0.04, 0.03, 0.05],
      [0.11, 0.015, 0.07],
      [0.205, 0.04, 0.045],
      [0.3, 0.01, 0.08],
      [0.39, 0.025, 0.055],
      [0.465, 0.0125, 0.035],
      [0.56, 0.05, 0.04],
      [0.66, 0.012, 0.075],
      [0.73, 0.03, 0.05],
      [0.83, 0.02, 0.065],
      [0.92, 0.035, 0.04],
    ];
    for (const [c, half, hgt] of bumps) {
      const d = Math.min(Math.abs(u - c), 1 - Math.abs(u - c));
      // steep sides, a flat top
      const f = d < half ? 1 : d < half + 0.006 ? 1 - (d - half) / 0.006 : 0;
      top = Math.max(top, f * hgt);
    }
    return k.h * (this.hz - top);
  },
  ground(k: Kit) {
    const { pens, I, h, PW } = k;
    const winter = I.snowy;
    // far: the mesas, banded red rock
    const sky: Pt[] = curve((x) => this.mesa(k, x), -8, PW + 8, 3);
    const rock: C = I.paint([206, 120, 86], 0.36);
    pens[0].fillOnly([...sky, [PW + 8, h + 8], [-8, h + 8]], rock);
    pens[0].stroke(sky, 1.1, 1);
    for (const f of [0.35, 0.65]) {
      const band = curve(
        (x) => {
          const m = this.mesa(k, x);
          return m + (h * this.hz - m) * f;
        },
        -8,
        PW + 8,
        6,
      ).filter(([x]) => this.mesa(k, x) < h * this.hz - 4);
      // only across the rock, broken where the mesas end
      let run: Pt[] = [];
      for (const p of band) {
        if (run.length && p[0] - run[run.length - 1][0] > 8) {
          if (run.length > 1) pens[0].stroke(run, 0.7, f);
          run = [];
        }
        run.push(p);
      }
      if (run.length > 1) pens[0].stroke(run, 0.7, f);
    }
    if (winter) for (const p of sky) if (p[1] < h * this.hz - 6) pens[0].fillOnly(rect(p[0], p[1], 3.2, 2.5), I.snow);
    // middle: the desert floor with sage and scattered rocks
    const sand: C = winter ? mix(I.paint([226, 196, 150], 0.18), [240, 240, 246], 0.4) : I.paint([226, 196, 150], 0.18);
    pens[1].fillOnly(
      [
        [-8, h * this.hz],
        [PW + 8, h * this.hz],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      sand,
    );
    pens[1].stroke(
      curve(() => h * this.hz, -8, PW + 8, 30),
      1.1,
      2,
    );
    for (let i = 0; i < PW / 16; i++) {
      const x = hash(i * 2.9) * PW,
        y = h * (this.hz + 0.008 + hash(i * 4.3) * 0.05);
      const r = 2 + hash(i) * 3;
      if (hash(i * 7) > 0.7)
        pens[1].shape(ellipse(x, y, r * 1.3, r * 0.7, 10, Math.PI, TAU), I.paint([180, 150, 120], 0.18), 0.8, i);
      else pens[1].shape(ellipse(x, y - r * 0.5, r, r * 0.6, 10), I.paint([150, 170, 130], 0.18), 0.7, i);
    }
    // near: paler ground, the highway with its yellow line
    const near: C = winter
      ? mix(I.paint([236, 214, 172], 0.04), [244, 244, 248], 0.45)
      : I.paint([236, 214, 172], 0.04);
    const fl = h * (this.floor - 0.02);
    pens[2].fillOnly(
      [
        [-8, fl],
        [PW + 8, fl],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      near,
    );
    pens[2].stroke(
      curve((x) => fl + Math.sin(x * 0.02) * 1.5, -8, PW + 8, 12),
      1,
      3,
    );
    const [r0, r1] = this.road.map((f) => h * f);
    pens[2].shape(
      [
        [-8, r0],
        [PW + 8, r0],
        [PW + 8, r1],
        [-8, r1],
      ],
      I.paint([110, 112, 120], 0.04),
      1.3,
      4,
    );
    pens[2].g.save();
    for (let x = 6; x < PW; x += 26) pens[2].fillOnly(rect(x, (r0 + r1) / 2 - 1, 14, 2), I.paint([246, 206, 80], 0.04));
    pens[2].g.restore();
    // pebbles and dry grass on our side
    for (let i = 0; i < PW / 10; i++) {
      const x = hash(i * 3.7) * PW,
        y = r1 + 8 + hash(i * 5.1) * (h - r1 - 14);
      if (i % 3)
        pens[2].stroke(
          [
            [x - 2, y - 3],
            [x, y],
            [x + 2, y - 3],
          ],
          0.7,
          i,
        );
      else pens[2].shape(ellipse(x, y, 2.2, 1.4, 8), I.paint([200, 170, 140], 0.04), 0.7, i);
    }
  },
  scenes: [
    // saguaros in front of a stone arch
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const fl = h * desert.floor;
      // the arch, on the middle layer
      {
        const p = pens[1],
          ax = x0 + w * 0.62,
          ab = h * (desert.hz + 0.02),
          aw = w * 0.32,
          ah = h * 0.07;
        const outer: Pt[] = [
          [ax - aw / 2, ab],
          [ax - aw / 2 + 4, ab - ah * 0.7],
          ...ellipse(ax, ab - ah * 0.72, aw / 2 - 4, ah * 0.32, 18, Math.PI, TAU),
          [ax + aw / 2 - 4, ab - ah * 0.7],
          [ax + aw / 2, ab],
          [ax + aw * 0.3, ab],
          [ax + aw * 0.3, ab - ah * 0.5],
          ...ellipse(ax, ab - ah * 0.5, aw * 0.3, ah * 0.32, 16, TAU, Math.PI),
          [ax - aw * 0.3, ab],
        ];
        p.shape(outer, I.paint([214, 130, 92], 0.18), 1.2, 1);
        p.stroke(
          [
            [ax - aw * 0.42, ab - ah * 0.4],
            [ax - aw * 0.34, ab - ah * 0.42],
          ],
          0.7,
          2,
        );
      }
      saguaro(pens[2], I, x0 + w * 0.18, fl + 6, h * 0.1, 3);
      saguaro(pens[2], I, x0 + w * 0.4, fl - 2, h * 0.065, 7);
      saguaro(pens[2], I, x0 + w * 0.9, fl + 4, h * 0.085, 11);
      // a prickly pear by the road
      for (const [dx, dy, r] of [
        [0, 0, 5],
        [-6, -6, 4],
        [5, -8, 4.5],
        [-1, -14, 3.5],
      ] as [number, number, number][])
        pens[2].shape(
          ellipse(x0 + w * 0.66 + dx, h * desert.road[0] - 6 + dy, r * 0.8, r, 10),
          I.paint([120, 170, 110], 0.04),
          1,
          dx + dy,
        );
      pens[2].shape(
        ellipse(x0 + w * 0.66 + 5, h * desert.road[0] - 18, 1.6, 1.8, 6),
        I.paint([230, 90, 120], 0.04),
        0.7,
        9,
      );
    },
    // an adobe town: flat roofs, beams poking out, a mission with a bell
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const fl = h * desert.floor;
      const adobe: C[] = [
        [222, 170, 120],
        [232, 190, 140],
        [210, 150, 110],
      ];
      const glass: C = I.paint([120, 150, 170], 0.04);
      const blocks: [number, number, number][] = [
        [0.04, 0.17, 0.035],
        [0.2, 0.14, 0.05],
        [0.72, 0.12, 0.04],
        [0.83, 0.15, 0.03],
      ];
      blocks.forEach(([f, bw, bh], i) => {
        const x = x0 + w * f,
          ww = w * bw,
          hh = h * bh;
        // soft corners like mud plaster
        const pts: Pt[] = [
          [x, fl],
          [x, fl - hh + 2],
          [x + 1, fl - hh],
          [x + ww - 1, fl - hh],
          [x + ww, fl - hh + 2],
          [x + ww, fl],
        ];
        pen.shape(pts, I.paint(adobe[i % 3], 0.04), 1.3, i);
        for (let v = 0; v < 4; v++)
          pen.shape(rect(x + 4 + v * (ww / 4), fl - hh + 3, 4, 2.2), I.paint([140, 100, 70], 0.04), 0.7, i + v);
        pen.shape(rect(x + ww * 0.2, fl - hh * 0.55, 6, 6), I.lit ? I.window : glass, 0.9, i + 0.5);
        pen.shape(rect(x + ww * 0.6, fl - hh * 0.6, 7, hh * 0.6), I.paint([60, 120, 150], 0.04), 1, i + 0.7);
      });
      // a string of red chiles by one door
      for (let c = 0; c < 6; c++)
        pen.shape(
          ellipse(x0 + w * 0.2 + w * 0.14 * 0.55, fl - h * 0.05 + 6 + c * 3.2, 1.4, 1.9, 8),
          I.paint([214, 60, 50], 0.04),
          0.6,
          c,
        );
      // the mission: a gabled front, a bell tower, a wooden door
      const mx = x0 + w * 0.38,
        mw = w * 0.3,
        mh = h * 0.06;
      const white: C = I.paint([246, 238, 222], 0.04);
      pen.shape(
        [
          [mx, fl],
          [mx, fl - mh],
          [mx + mw * 0.3, fl - mh],
          [mx + mw * 0.5, fl - mh - h * 0.022],
          [mx + mw * 0.7, fl - mh],
          [mx + mw, fl - mh],
          [mx + mw, fl],
        ],
        white,
        1.3,
        9,
      );
      const tx = mx + mw * 0.12;
      pen.shape(rect(tx - 9, fl - mh - h * 0.03, 18, h * 0.03), white, 1.2, 10);
      pen.shape(ellipse(tx, fl - mh - h * 0.03, 9, 5, 12, Math.PI, TAU), white, 1.2, 11);
      pen.shape(ellipse(tx, fl - mh - h * 0.015, 4, 5, 12, Math.PI, TAU), I.paint([90, 80, 80], 0.04), 0.9, 12);
      pen.shape(ellipse(tx, fl - mh - h * 0.016, 2, 2, 8, 0, Math.PI), I.paint([230, 190, 90], 0.04), 0.8, 13);
      pen.stroke(
        [
          [mx + mw * 0.5, fl - mh - h * 0.022],
          [mx + mw * 0.5, fl - mh - h * 0.04],
        ],
        1.1,
        14,
      );
      pen.stroke(
        [
          [mx + mw * 0.5 - 4, fl - mh - h * 0.034],
          [mx + mw * 0.5 + 4, fl - mh - h * 0.034],
        ],
        1.1,
        15,
      );
      pen.shape(
        [
          [mx + mw * 0.42, fl],
          [mx + mw * 0.42, fl - mh * 0.5],
          ...ellipse(mx + mw * 0.5, fl - mh * 0.5, mw * 0.08, mh * 0.12, 10, Math.PI, TAU),
          [mx + mw * 0.58, fl],
        ],
        I.paint([150, 100, 70], 0.04),
        1.1,
        16,
      );
      pen.shape(ellipse(mx + mw * 0.5, fl - mh * 0.78, 4, 4, 10), I.lit ? I.window : glass, 0.9, 17);
    },
    // the roadside motel: a tall arrow sign, a row of doors, an old pump
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const fl = h * desert.floor;
      const mx = x0 + w * 0.3,
        mw = w * 0.5,
        mh = h * 0.034;
      pen.shape(rect(mx, fl - mh, mw, mh), I.paint([150, 210, 200], 0.04), 1.3, 1);
      pen.shape(rect(mx - 4, fl - mh - 4, mw + 8, 4), I.paint([246, 238, 222], 0.04), 1.1, 2);
      for (let i = 0; i < 5; i++) {
        const dx = mx + 6 + i * (mw / 5);
        pen.shape(rect(dx, fl - mh * 0.75, 6, mh * 0.75), I.paint([226, 96, 86], 0.04), 0.9, i);
        pen.shape(
          rect(dx + 9, fl - mh * 0.7, 9, 6),
          I.lit && hash(i) > 0.3 ? I.window : I.paint([200, 224, 240], 0.04),
          0.8,
          i + 0.5,
        );
      }
      // the sign (its neon blinks: live)
      const sx = x0 + w * 0.16;
      pen.stroke(
        [
          [sx, fl + 2],
          [sx, fl - h * 0.09],
        ],
        1.6,
        3,
      );
      pen.shape(rect(sx - 16, fl - h * 0.13, 32, h * 0.04), I.paint([246, 206, 80], 0.04), 1.3, 4);
      pen.shape(
        [
          [sx - 10, fl - h * 0.088],
          [sx + 16, fl - h * 0.088],
          [sx + 16, fl - h * 0.094],
          [sx + 24, fl - h * 0.08],
          [sx + 16, fl - h * 0.066],
          [sx + 16, fl - h * 0.072],
          [sx - 10, fl - h * 0.072],
        ],
        I.paint([226, 96, 86], 0.04),
        1.2,
        5,
      );
      // an old gas pump
      const gx = x0 + w * 0.88;
      pen.shape(rect(gx - 6, fl - 26, 12, 26), I.paint([226, 96, 86], 0.04), 1.2, 6);
      pen.shape(ellipse(gx, fl - 30, 5, 5, 12), I.paint([250, 250, 246], 0.04), 1, 7);
      pen.shape(rect(gx - 4, fl - 20, 8, 6), I.paint([250, 250, 246], 0.04), 0.8, 8);
      pen.stroke(
        [
          [gx + 6, fl - 16],
          [gx + 10, fl - 10],
          [gx + 9, fl - 4],
        ],
        1,
        9,
      );
    },
    // a camp out on the flats: an aluminium trailer, string lights, a fire
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const fl = h * desert.floor;
      const tx = x0 + w * 0.3,
        tw = w * 0.3,
        th = h * 0.032;
      const silver: C = I.paint([214, 220, 228], 0.04);
      pen.shape(
        [
          [tx, fl - 4],
          [tx, fl - th * 0.5],
          ...ellipse(tx + th * 0.5, fl - th * 0.5, th * 0.5, th * 0.5, 10, Math.PI, Math.PI * 1.5),
          [tx + tw - th * 0.5, fl - th],
          ...ellipse(tx + tw - th * 0.5, fl - th * 0.5, th * 0.5, th * 0.5, 10, Math.PI * 1.5, TAU),
          [tx + tw, fl - 4],
        ],
        silver,
        1.3,
        1,
      );
      for (let i = 1; i < 4; i++)
        pen.stroke(
          [
            [tx + 3, fl - th * (i / 4)],
            [tx + tw - 3, fl - th * (i / 4)],
          ],
          0.5,
          i,
        );
      pen.shape(rect(tx + tw * 0.2, fl - th * 0.7, 10, 7), I.lit ? I.window : I.paint([200, 224, 240], 0.04), 0.9, 2);
      pen.shape(rect(tx + tw * 0.6, fl - th * 0.85, 8, th * 0.8), I.paint([180, 186, 196], 0.04), 0.9, 3);
      for (const d of [0.25, 0.75])
        pen.shape(ellipse(tx + tw * d, fl - 3, 4, 4, 10), I.paint([60, 60, 70], 0.04), 1, d);
      // an awning, two chairs
      pen.shape(
        [
          [tx + tw * 0.55, fl - th * 0.95],
          [tx + tw * 1.05, fl - th * 0.75],
          [tx + tw * 1.05, fl - th * 0.6],
          [tx + tw * 0.55, fl - th * 0.8],
        ],
        I.paint([246, 190, 80], 0.04),
        1,
        4,
      );
      pen.stroke(
        [
          [tx + tw * 1.05, fl - th * 0.6],
          [tx + tw * 1.05, fl],
        ],
        0.9,
        5,
      );
      for (const cx of [x0 + w * 0.72, x0 + w * 0.82]) {
        pen.shape(
          [
            [cx - 4, fl - 8],
            [cx + 4, fl - 8],
            [cx + 5, fl - 16],
            [cx - 3, fl - 15],
          ],
          I.paint([90, 160, 200], 0.04),
          0.9,
          cx,
        );
        pen.stroke(
          [
            [cx - 4, fl - 8],
            [cx - 2, fl],
          ],
          0.8,
          cx + 1,
        );
        pen.stroke(
          [
            [cx + 4, fl - 8],
            [cx + 2, fl],
          ],
          0.8,
          cx + 2,
        );
      }
      // the fire ring (the fire itself: live)
      const fx = x0 + w * 0.77;
      for (let i = 0; i < 7; i++)
        pen.shape(ellipse(fx - 9 + i * 3, fl + 6 + (i % 2), 2.2, 1.6, 8), I.paint([150, 140, 130], 0.04), 0.7, i);
      // and a Joshua-ish old saguaro off to the side
      saguaro(pen, I, x0 + w * 0.08, fl + 2, h * 0.075, 21);
    },
    // a ghost town: a leaning saloon with batwing doors, a boarded-up
    // assay office, a wooden water tank on stilts, a wagon wheel
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const fl = h * desert.floor;
      const weathered: C = I.paint([170, 140, 110], 0.04);
      const grey: C = I.paint([150, 140, 130], 0.04);
      // the water tank, behind the buildings
      const tx = x0 + w * 0.82;
      for (const d of [-10, 10])
        pen.stroke(
          [
            [tx + d, fl + 2],
            [tx + d * 0.7, fl - h * 0.05],
          ],
          1.2,
          800 + d,
        );
      pen.stroke(
        [
          [tx - 9, fl - 2],
          [tx + 7, fl - h * 0.045],
        ],
        0.6,
        801,
      );
      pen.shape(rect(tx - 14, fl - h * 0.085, 28, h * 0.035), weathered, 1.2, 802);
      for (let i = 1; i < 4; i++)
        pen.stroke(
          [
            [tx - 14, fl - h * 0.085 + (h * 0.035 * i) / 4],
            [tx + 14, fl - h * 0.085 + (h * 0.035 * i) / 4],
          ],
          0.5,
          803 + i,
        );
      pen.shape(
        [
          [tx - 16, fl - h * 0.085],
          [tx, fl - h * 0.098],
          [tx + 16, fl - h * 0.085],
        ],
        grey,
        1.1,
        807,
      );
      // the saloon: a tall false front, leaning a little
      const sx = x0 + w * 0.12,
        sw = w * 0.26,
        sh = h * 0.06;
      pen.shape(
        [
          [sx, fl + 3],
          [sx + 2, fl + 3 - sh],
          [sx + sw + 2, fl + 3 - sh],
          [sx + sw, fl + 3],
        ],
        weathered,
        1.3,
        810,
      );
      for (let x = sx + 8; x < sx + sw; x += 8)
        pen.stroke(
          [
            [x, fl + 2],
            [x + 2, fl + 4 - sh],
          ],
          0.4,
          x,
        );
      pen.shape(rect(sx + sw * 0.15, fl + 6 - sh, sw * 0.7, sh * 0.18), I.paint([226, 210, 176], 0.04), 0.9, 811);
      // the batwing doors under a porch
      pen.shape(rect(sx + sw * 0.42, fl + 3 - sh * 0.45, sw * 0.16, sh * 0.45), [40, 34, 38], 1, 812);
      pen.shape(rect(sx + sw * 0.42, fl + 3 - sh * 0.36, sw * 0.16, sh * 0.2), weathered, 0.9, 813);
      pen.stroke(
        [
          [sx + sw * 0.5, fl + 3 - sh * 0.36],
          [sx + sw * 0.5, fl + 3 - sh * 0.16],
        ],
        0.6,
        814,
      );
      for (const f of [0.12, 0.72]) {
        pen.shape(rect(sx + sw * f, fl + 3 - sh * 0.5, sw * 0.16, sh * 0.2), [44, 40, 46], 0.9, 815 + f);
        // boards nailed across
        pen.stroke(
          [
            [sx + sw * f - 2, fl + 3 - sh * 0.46],
            [sx + sw * (f + 0.16) + 2, fl + 3 - sh * 0.36],
          ],
          1.6,
          816 + f,
        );
      }
      pen.shape(rect(sx - 6, fl + 3 - sh * 0.62, sw + 12, 3), grey, 1, 817);
      for (const f of [0.0, 1.0])
        pen.stroke(
          [
            [sx - 4 + (sw + 8) * f, fl + 3 - sh * 0.6],
            [sx - 4 + (sw + 8) * f, fl + 3],
          ],
          0.9,
          818 + f,
        );
      // the assay office, smaller, its roof sagging
      const ax = x0 + w * 0.46,
        aw = w * 0.18,
        ah = h * 0.04;
      pen.shape(rect(ax, fl + 3 - ah, aw, ah), I.paint([196, 170, 140], 0.04), 1.3, 820);
      pen.shape(
        [
          [ax - 4, fl + 3 - ah],
          [ax + aw * 0.4, fl + 3 - ah - h * 0.016],
          [ax + aw * 0.55, fl + 3 - ah - h * 0.012],
          [ax + aw + 4, fl + 3 - ah],
        ],
        grey,
        1.2,
        821,
      );
      pen.shape(rect(ax + aw * 0.4, fl + 3 - ah * 0.7, aw * 0.2, ah * 0.7), [44, 40, 46], 1, 822);
      pen.stroke(
        [
          [ax + aw * 0.38, fl + 3 - ah * 0.6],
          [ax + aw * 0.62, fl + 3 - ah * 0.2],
        ],
        1.4,
        823,
      );
      // a wagon wheel leaning on the wall, a hitching rail
      {
        const wx = ax + aw + 14,
          wy = fl - 6;
        pen.shape(ellipse(wx, wy, 9, 9, 18), null, 1.2, 824);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI;
          pen.stroke(
            [
              [wx - Math.cos(a) * 9, wy - Math.sin(a) * 9],
              [wx + Math.cos(a) * 9, wy + Math.sin(a) * 9],
            ],
            0.6,
            825 + i,
          );
        }
      }
      pen.stroke(
        [
          [sx + sw + 16, fl + 6],
          [sx + sw + 16, fl - 4],
          [sx + sw + 40, fl - 4],
          [sx + sw + 40, fl + 6],
        ],
        1.1,
        830,
      );
      saguaro(pen, I, x0 + w * 0.95, fl + 10, h * 0.07, 831);
    },
    // Joshua trees on the flats, a windmill pumping into a stock tank,
    // cattle come to drink
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const fl = h * desert.floor;
      const joshua = (x: number, base: number, ht: number, seed: number) => {
        const bark: C = I.paint([150, 120, 90], 0.04);
        const spikes: C = I.paint([110, 150, 100], 0.04);
        const arms: [number, number, number][] = [
          [0, -1, 0],
          [-0.35, -0.75, 1],
          [0.4, -0.85, 1],
          [-0.55, -1.05, 2],
          [0.2, -1.1, 2],
        ];
        pen.shape(rect(x - 2.5, base - ht * 0.55, 5, ht * 0.55), bark, 1, seed);
        for (const [dx, dy, lvl] of arms) {
          if (lvl === 2 && hash(seed + dx) < 0.4) continue;
          const sx = x + (lvl === 2 ? dx * ht * 0.4 : 0),
            sy = base - ht * (lvl === 2 ? 0.8 : 0.55);
          const ex = x + dx * ht * 0.6,
            ey = base + dy * ht;
          pen.stroke(
            [
              [sx, sy],
              [ex, ey + ht * 0.08],
            ],
            3.2,
            seed + dx,
          );
          // a spiky tuft at the tip
          const tuft: Pt[] = [];
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU,
              r = i % 2 ? 3 : 7;
            tuft.push([ex + Math.cos(a) * r * 0.8, ey + Math.sin(a) * r]);
          }
          pen.shape(tuft, spikes, 0.8, seed + dx + 1);
        }
      };
      joshua(x0 + w * 0.08, fl + 6, h * 0.06, 840);
      joshua(x0 + w * 0.28, fl + 2, h * 0.045, 841);
      joshua(x0 + w * 0.88, fl + 8, h * 0.065, 842);
      // the windmill on its lattice tower
      const mx = x0 + w * 0.48,
        mt = fl - h * 0.12;
      for (const d of [-9, 9])
        pen.stroke(
          [
            [mx + d, fl + 2],
            [mx + d * 0.2, mt],
          ],
          1.1,
          850 + d,
        );
      for (let i = 1; i < 5; i++) {
        const y = fl + 2 - ((fl + 2 - mt) * i) / 5;
        const half = 9 - 7.2 * (i / 5);
        pen.stroke(
          [
            [mx - half, y],
            [mx + half, y + 6],
          ],
          0.5,
          851 + i,
        );
      }
      // the vane behind; the wheel itself turns (live)
      pen.shape(
        [
          [mx + 2, mt - 2],
          [mx + 22, mt - 6],
          [mx + 24, mt + 2],
          [mx + 2, mt + 2],
        ],
        I.paint([226, 220, 206], 0.04),
        1,
        856,
      );
      // the stock tank, a trough and a couple of cows
      const sx = x0 + w * 0.62,
        sy = fl + 10;
      pen.shape(rect(sx - 20, sy - 9, 40, 9), I.paint([170, 176, 186], 0.04), 1.2, 857);
      pen.shape(ellipse(sx, sy - 9, 20, 2.5, 16), I.snowy ? I.snow : I.paint([90, 156, 206], 0.04), 0.9, 858);
      pen.stroke(
        [
          [mx + 2, fl - 4],
          [sx - 20, sy - 6],
        ],
        1.1,
        859,
      );
      for (const [f, c] of [
        [0.72, [120, 76, 52]],
        [0.79, [60, 50, 50]],
      ] as [number, C][]) {
        const cx = x0 + w * f,
          cy = fl + 8;
        for (const lx of [-6, -4, 4, 6])
          pen.stroke(
            [
              [cx + lx, cy - 4],
              [cx + lx, cy + 3],
            ],
            1,
            860 + lx + f,
          );
        pen.shape(ellipse(cx, cy - 7, 9, 4.5, 14), I.paint(c, 0.04), 1.1, 861 + f);
        pen.shape(ellipse(cx - 10, cy - 6, 3.4, 2.6, 10), I.paint(c, 0.04), 1, 862 + f);
      }
    },
    // the observatory: white domes up on a hill, a winding road up to them
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const mid = pens[1];
      const hz = h * desert.hz;
      const hill = (x: number) => {
        const u = (x - (x0 + w * 0.5)) / (w * 0.42);
        return hz - (Math.abs(u) < 1 ? h * 0.09 * Math.pow(Math.cos((u * Math.PI) / 2), 1.2) : 0);
      };
      const top = curve(hill, x0 + w * 0.06, x0 + w * 0.94, 4);
      mid.shape([...top, [x0 + w * 0.94, hz + 2], [x0 + w * 0.06, hz + 2]], I.paint([196, 150, 110], 0.18), 1.1, 870);
      mid.stroke(
        [
          [x0 + w * 0.2, hz + 1],
          [x0 + w * 0.36, hill(x0 + w * 0.36) + 6],
          [x0 + w * 0.3, hill(x0 + w * 0.3) + 4],
          [x0 + w * 0.44, hill(x0 + w * 0.44) + 2],
        ],
        1,
        871,
      );
      const white: C = I.paint([246, 244, 240], 0.18);
      for (const [f, r] of [
        [0.47, 14],
        [0.6, 10],
      ]) {
        const dx = x0 + w * f,
          db = hill(dx) + 2;
        mid.shape(rect(dx - r, db - r * 0.7, r * 2, r * 0.7), white, 1.1, 872 + f);
        mid.shape(ellipse(dx, db - r * 0.7, r, r * 0.9, 18, Math.PI, TAU), white, 1.1, 873 + f);
        // the slit, open after dark
        mid.shape(rect(dx - 2, db - r * 1.55, 4, r * 0.85), I.night > 0.5 ? [30, 30, 46] : I.paint([210, 206, 200], 0.18), 0.7, 874 + f);
      }
      // a radio dish beside them
      const rx = x0 + w * 0.7,
        rb = hill(rx) + 2;
      mid.stroke(
        [
          [rx, rb],
          [rx, rb - 8],
        ],
        1,
        876,
      );
      mid.shape(ellipse(rx, rb - 12, 7, 4, 12, Math.PI * 0.2, Math.PI * 1.2), white, 1, 877);
      // our side: a couple of saguaros and a creosote bush
      saguaro(pens[2], I, x0 + w * 0.14, h * desert.floor + 8, h * 0.06, 878);
      saguaro(pens[2], I, x0 + w * 0.84, h * desert.floor + 4, h * 0.045, 879);
    },
    // hoodoos: striped rock spires standing over a dry wash with a little
    // wooden footbridge
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const fl = h * desert.floor;
      const bands: C[] = [
        [220, 150, 110],
        [236, 200, 160],
        [206, 120, 86],
      ];
      const spire = (x: number, ht: number, wd: number, seed: number) => {
        const base = fl + 4;
        for (let i = 0; i < 5; i++) {
          const y0 = base - (ht * i) / 5,
            y1 = base - (ht * (i + 1)) / 5;
          const half = (y: number) => wd * (0.6 + 0.18 * Math.sin(((base - y) / ht) * 7 + seed)) * (1 - ((base - y) / ht) * 0.3);
          pen.shape(
            [
              [x - half(y0), y0],
              [x - half(y1), y1],
              [x + half(y1), y1],
              [x + half(y0), y0],
            ],
            I.paint(bands[i % 3], 0.04),
            1,
            seed + i,
          );
        }
        // a cap rock
        pen.shape(ellipse(x, base - ht - 2, wd * 0.7, 4, 12), I.paint([150, 130, 120], 0.04), 1.1, seed + 9);
      };
      spire(x0 + w * 0.12, h * 0.08, 20, 880);
      spire(x0 + w * 0.23, h * 0.115, 24, 890);
      spire(x0 + w * 0.33, h * 0.06, 16, 900);
      spire(x0 + w * 0.69, h * 0.1, 22, 910);
      spire(x0 + w * 0.81, h * 0.13, 26, 920);
      spire(x0 + w * 0.92, h * 0.07, 18, 930);
      // the dry wash, pale sand and pebbles running toward the highway
      const [r0] = desert.road.map((f) => h * f);
      const wash: Pt[] = [
        [x0 + w * 0.46, fl + 2],
        [x0 + w * 0.54, fl + 2],
        [x0 + w * 0.6, r0 - 2],
        [x0 + w * 0.4, r0 - 2],
      ];
      pen.shape(wash, I.snowy ? I.snow : I.paint([244, 230, 200], 0.04), 0.9, 940);
      for (let i = 0; i < 10; i++)
        pen.shape(
          ellipse(x0 + w * (0.44 + hash(i) * 0.12), fl + 6 + hash(i + 3) * (r0 - fl - 12), 1.8, 1.2, 6),
          I.paint([180, 160, 140], 0.04),
          0.6,
          941 + i,
        );
      // the footbridge over it
      const by = fl + (r0 - fl) * 0.45;
      pen.shape(rect(x0 + w * 0.38, by, w * 0.24, 3), I.paint([170, 130, 90], 0.04), 1.1, 952);
      for (const f of [0.38, 0.62])
        pen.stroke(
          [
            [x0 + w * f, by + 3],
            [x0 + w * f, by + 10],
          ],
          1,
          953 + f,
        );
      for (let x = x0 + w * 0.38; x <= x0 + w * 0.62; x += w * 0.04)
        pen.stroke(
          [
            [x, by],
            [x, by - 7],
          ],
          0.7,
          955 + x,
        );
      pen.stroke(
        [
          [x0 + w * 0.38, by - 7],
          [x0 + w * 0.62, by - 7],
        ],
        0.9,
        956,
      );
    },
  ],
  live(g: CanvasRenderingContext2D, k: Kit, t: number, X: (x: number, layer: number) => number) {
    // the windmill's wheel turning, faster in a stronger wind
    {
      const { I, w, h } = k;
      const cx = X(w * 5.48, 2),
        cy = h * desert.floor - h * 0.12;
      const a = t * (0.6 + Math.min(2, k.L.wind / 4));
      g.strokeStyle = css(I.inkC, 0.9);
      g.fillStyle = css(I.paint([226, 220, 206], 0.04));
      g.lineWidth = 0.9;
      for (let i = 0; i < 12; i++) {
        const b = a + (i / 12) * TAU;
        g.beginPath();
        g.moveTo(cx + Math.cos(b) * 3, cy + Math.sin(b) * 3);
        g.lineTo(cx + Math.cos(b - 0.12) * 13, cy + Math.sin(b - 0.12) * 13);
        g.lineTo(cx + Math.cos(b + 0.12) * 13, cy + Math.sin(b + 0.12) * 13);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.beginPath();
      g.arc(cx, cy, 2.5, 0, TAU);
      g.fill();
      g.stroke();
    }
    const { I, h, w, PW } = k;
    const ink = css(I.inkC, 0.9);
    g.strokeStyle = ink;
    g.lineCap = "round";
    g.lineJoin = "round";
    const night = I.night > 0.5;
    const fl = h * desert.floor;
    // a tumbleweed bouncing along with the wind
    {
      const x = (t * (14 + Math.min(20, k.L.wind)) + w * 0.5) % PW;
      const bounce = Math.abs(Math.sin(t * 3)) * 8;
      const cx = X(x, 2),
        cy = fl + 10 - bounce;
      g.lineWidth = 0.7;
      for (let i = 0; i < 7; i++) {
        const a = t * 4 + i * 0.9;
        g.beginPath();
        g.ellipse(cx, cy, 6, 4.5, a, 0, TAU);
        g.stroke();
      }
    }
    // the motel's neon: VACANCY flickers, the arrow chases
    {
      const sx = X(w * 2.16, 2);
      const on = Math.sin(t * 9) > -0.7 || Math.sin(t * 0.5) > 0.3;
      g.fillStyle =
        I.night <= 0.3 ? css(I.paint([200, 70, 60], 0.04)) : on ? "rgba(255,90,140,0.95)" : "rgba(120,50,70,0.5)";
      g.font = "700 8px system-ui, sans-serif";
      g.fillText("MOTEL", sx - 13, fl - h * 0.098);
    }
    if (I.night > 0.3) {
      const sx = X(w * 2.16, 2);
      for (let i = 0; i < 4; i++) {
        const lit = Math.floor(t * 4) % 4 === i;
        g.fillStyle = lit ? "rgba(255,240,140,1)" : "rgba(255,240,140,0.25)";
        g.beginPath();
        g.arc(sx - 6 + i * 6, fl - h * 0.08, 1.6, 0, TAU);
        g.fill();
      }
    }
    // the campfire flickering, sparks going up, string lights after dark
    {
      const fx = X(w * 3.77, 2),
        fy = fl + 5;
      for (let i = 0; i < 3; i++) {
        const fh = 7 + Math.sin(t * 9 + i * 2) * 2.5 + i * 2;
        g.fillStyle = (["rgba(255,90,60,0.95)", "rgba(255,160,60,0.95)", "rgba(255,230,120,0.95)"] as const)[i];
        g.beginPath();
        g.moveTo(fx - 6 + i * 2, fy);
        g.quadraticCurveTo(fx - 4 + i * 1.5, fy - fh * 0.6, fx + Math.sin(t * 7 + i) * 1.5, fy - fh);
        g.quadraticCurveTo(fx + 4 - i * 1.5, fy - fh * 0.6, fx + 6 - i * 2, fy);
        g.closePath();
        g.fill();
      }
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(fx - 6, fy);
      g.quadraticCurveTo(fx, fy - 14, fx + 6, fy);
      g.stroke();
      for (let i = 0; i < 4; i++) {
        const q = (t * 0.6 + i / 4) % 1;
        g.fillStyle = `rgba(255,200,100,${1 - q})`;
        g.fillRect(fx + Math.sin(t * 2 + i * 3) * 6, fy - 12 - q * 30, 1.4, 1.4);
      }
      if (I.night > 0.35) {
        const a = X(w * 3.47, 2),
          b = X(w * 3.62, 2);
        for (let i = 0; i <= 8; i++) {
          const f = i / 8;
          g.fillStyle = `rgba(255,220,140,${0.6 + 0.4 * Math.sin(t * 2 + i)})`;
          g.beginPath();
          g.arc(a + (b - a) * f, fl - h * 0.03 + Math.sin(f * Math.PI) * 5, 1.4, 0, TAU);
          g.fill();
        }
      }
    }
    // a car and a pickup on the highway, kicking up a little dust
    {
      const [r0, r1] = desert.road.map((f) => h * f);
      const lanes = [r0 + (r1 - r0) * 0.33, r0 + (r1 - r0) * 0.82]; // wheels mid-lane, either side of the dashes
      const cl: C[] = [
        [120, 170, 220],
        [226, 96, 86],
        [240, 240, 236],
      ];
      for (let i = 0; i < 3; i++) {
        const dir = i % 2 ? -1 : 1;
        const sp = 34 + hash(i * 3 + 2) * 12;
        const xx = (((hash(i * 5.9) * PW + t * sp * dir) % PW) + PW) % PW;
        const y = lanes[i % 2];
        const L = 26,
          H = 9;
        const pts: Pt[] = (
          [
            [-L / 2, 0],
            [-L / 2, -H * 0.55],
            [-L * 0.2, -H * 0.6],
            [-L * 0.1, -H],
            [L * 0.2, -H],
            [L * 0.32, -H * 0.55],
            [L / 2, -H * 0.45],
            [L / 2, 0],
          ] as Pt[]
        ).map(([a, b]) => [X(xx + a * dir, 2), y + b] as Pt);
        g.beginPath();
        pts.forEach(([a, b], j) => (j ? g.lineTo(a, b) : g.moveTo(a, b)));
        g.closePath();
        g.fillStyle = css(I.paint(cl[i], 0.04));
        g.fill();
        g.lineWidth = 1.1;
        g.stroke();
        for (const f of [-0.28, 0.28]) {
          g.fillStyle = css(I.paint([50, 50, 60], 0.04));
          g.beginPath();
          g.arc(X(xx + L * f, 2), y, 3, 0, TAU);
          g.fill();
          g.stroke();
        }
        if (night) {
          const hx = X(xx + (L / 2) * dir, 2);
          const gr = g.createLinearGradient(hx, y, hx + dir * 34, y);
          gr.addColorStop(0, "rgba(255,236,170,0.5)");
          gr.addColorStop(1, "rgba(255,236,170,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(hx, y - 4);
          g.lineTo(hx + dir * 34, y - 9);
          g.lineTo(hx + dir * 34, y + 2);
          g.closePath();
          g.fill();
        }
      }
    }
  },
};

// ---------------------------------------------------------------------------
// the woods and lakes
// ---------------------------------------------------------------------------

// a fir: a trunk and three tiers of jagged boughs
const woods = {
  hz: 0.725, // the far shore
  lake: 0.795, // our shore
  ground(k: Kit) {
    const { pens, I, h, PW, season } = k;
    const winter = I.snowy;
    // far: forested hills, a row of fir tips along the top, a fire tower
    const hill = (x: number) => h * (this.hz - 0.03 + 0.016 * loopWave(x, PW, 31));
    const sky: Pt[] = [];
    for (let x = -8; x <= PW + 8; x += 4) sky.push([x, hill(x) - (x % 8 < 4 ? 5 : 0)]);
    const forest: C = winter
      ? I.paint([150, 160, 170], 0.38)
      : season === "autumn"
        ? I.paint([170, 120, 80], 0.38)
        : I.paint([70, 120, 96], 0.38);
    pens[0].fillOnly([...sky, [PW + 8, h + 8], [-8, h + 8]], forest);
    pens[0].stroke(sky, 1, 1);
    {
      const tx = k.w * 2.64,
        b = hill(tx);
      for (const d of [-5, 5])
        pens[0].stroke(
          [
            [tx + d, b],
            [tx + d * 0.5, b - h * 0.04],
          ],
          0.9,
          d,
        );
      pens[0].stroke(
        [
          [tx - 4, b - h * 0.013],
          [tx + 4, b - h * 0.027],
        ],
        0.6,
        2,
      );
      pens[0].shape(
        rect(tx - 5, b - h * 0.05, 10, h * 0.01),
        I.lit ? I.window : I.paint([200, 170, 130], 0.38),
        0.9,
        3,
      );
      pens[0].shape(
        [
          [tx - 7, b - h * 0.05],
          [tx, b - h * 0.058],
          [tx + 7, b - h * 0.05],
        ],
        I.paint([150, 80, 70], 0.38),
        0.9,
        4,
      );
    }
    // middle: the far shore's trees, then the lake
    const shore = h * this.hz;
    pens[1].fillOnly(
      [
        [-8, shore - 2],
        [PW + 8, shore - 2],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      forest,
    );
    for (let x = 4, i = 0; x < PW; i++) {
      fir(pens[1], I, x, shore + 1, 14 + hash(i * 1.9) * 10, i, 0.2);
      x += 7 + hash(i * 3.1) * 9;
    }
    const water: C = winter
      ? mix(I.paint([110, 160, 196], 0.14), [226, 234, 244], 0.55)
      : I.paint([90, 150, 196], 0.14);
    pens[1].fillOnly(
      [
        [-8, shore],
        [PW + 8, shore],
        [PW + 8, h + 8],
        [-8, h + 8],
      ],
      water,
    );
    pens[1].stroke(
      curve(() => shore, -8, PW + 8, 30),
      1.1,
      5,
    );
    // the far trees reflected, faintly
    if (!winter)
      for (let x = 6, i = 0; x < PW; i++) {
        const r = 8 + hash(i * 1.9) * 6;
        pens[1].fillOnly(
          [
            [x - r * 0.25, shore + 1],
            [x, shore + r],
            [x + r * 0.25, shore + 1],
          ],
          mix(water, forest, 0.35),
        );
        x += 9 + hash(i * 3.1) * 11;
      }
    for (let r = 1; r < 5; r++) {
      const y = shore + (h * this.lake - shore) * (r / 5);
      for (let x = hash(r) * 50; x < PW - 10; x += 40 + hash(x + r) * 40)
        pens[1].stroke(
          [
            [x, y],
            [x + 3 + r, y - 0.6],
            [x + 6 + r * 2, y],
          ],
          0.7,
          x,
        );
    }
    // near: our shore, mossy ground and pine needles, a dirt path
    const moss: C = winter
      ? I.snow
      : season === "autumn"
        ? I.paint([150, 150, 90], 0.04)
        : I.paint([110, 160, 96], 0.04);
    const ns = (x: number) => h * (this.lake + 0.004 * loopWave(x, PW, 41));
    const edge = curve(ns, -8, PW + 8, 8);
    pens[2].fillOnly([...edge, [PW + 8, h + 8], [-8, h + 8]], moss);
    pens[2].stroke(edge, 1.3, 6);
    for (let i = 0; i < PW / 40; i++) {
      const x = hash(i * 7.3) * PW;
      pens[2].shape(
        ellipse(x, ns(x) + 2, 5 + hash(i) * 4, 2.6, 10, Math.PI, TAU),
        I.paint([150, 150, 150], 0.04),
        0.9,
        i,
      );
    }
    const p0 = h * 0.87,
      p1 = h * 0.895;
    pens[2].shape(
      [
        ...curve((x) => p0 + 2 * loopWave(x, PW, 43), -8, PW + 8, 10),
        ...curve((x) => p1 + 2 * loopWave(x, PW, 43), -8, PW + 8, 10).reverse(),
      ],
      winter ? mix(I.snow, [200, 190, 180], 0.3) : I.paint([190, 160, 120], 0.04),
      1,
      7,
    );
    if (!winter)
      for (let i = 0; i < PW / 10; i++) {
        const x = hash(i * 3.7) * PW,
          y = h * 0.82 + hash(i * 5.1) * h * 0.17;
        if (y > p0 - 3 && y < p1 + 3) continue;
        pens[2].stroke(
          [
            [x - 2, y - 3],
            [x, y],
            [x + 2, y - 3],
          ],
          0.7,
          i,
        );
      }
  },
  scenes: [
    // a dock out into the lake, a canoe tied up, two chairs at the end
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const wood: C = I.paint([176, 130, 90], 0.04);
      const dy = h * woods.lake - 12;
      const dx0 = x0 + w * 0.3,
        dx1 = x0 + w * 0.78;
      for (let x = dx0 + 6; x < dx1; x += 18)
        pen.stroke(
          [
            [x, dy],
            [x, dy + 12],
          ],
          1.4,
          x,
        );
      pen.shape(rect(dx0, dy - 4, dx1 - dx0, 4), wood, 1.3, 1);
      for (let x = dx0 + 9; x < dx1; x += 9)
        pen.stroke(
          [
            [x, dy - 4],
            [x, dy],
          ],
          0.5,
          x + 1,
        );
      // Adirondack chairs
      for (const cx of [dx1 - 26, dx1 - 12]) {
        const red: C = cx > dx1 - 20 ? I.paint([226, 96, 86], 0.04) : I.paint([246, 206, 80], 0.04);
        pen.shape(
          [
            [cx - 4, dy - 4],
            [cx - 6, dy - 16],
            [cx - 2, dy - 17],
            [cx, dy - 9],
            [cx + 5, dy - 9],
            [cx + 5, dy - 4],
          ],
          red,
          1,
          cx,
        );
      }
      // birches on our shore
      for (const [f, ht] of [
        [0.12, 0.07],
        [0.2, 0.055],
      ] as [number, number][]) {
        const bx = x0 + w * f,
          by = h * 0.86;
        pen.shape(rect(bx - 2, by - h * ht, 4, h * ht), I.paint([244, 242, 236], 0.04), 1, f);
        for (let i = 1; i < 6; i++)
          pen.stroke(
            [
              [bx - 2, by - h * ht * (i / 6)],
              [bx, by - h * ht * (i / 6) + 1],
            ],
            1,
            f + i,
          );
        pen.shape(
          ellipse(bx, by - h * ht, 12, 10, 16),
          k.season === "autumn" ? I.paint([246, 200, 80], 0.04) : I.paint([140, 190, 100], 0.04),
          1.1,
          f + 9,
        );
      }
      fir(pen, I, x0 + w * 0.92, h * 0.88, h * 0.1, 41);
    },
    // a log cabin with a stone chimney, a porch and a woodpile
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * 0.865;
      const cx = x0 + w * 0.32,
        cw = w * 0.36,
        ch = h * 0.045;
      const log: C = I.paint([166, 112, 74], 0.04);
      pen.shape(rect(cx, base - ch, cw, ch), log, 1.3, 1);
      for (let i = 1; i < 6; i++)
        pen.stroke(
          [
            [cx - 2, base - (ch * i) / 6],
            [cx + cw + 2, base - (ch * i) / 6],
          ],
          0.7,
          i,
        );
      pen.shape(
        [
          [cx - 8, base - ch],
          [cx + cw * 0.5, base - ch - h * 0.032],
          [cx + cw + 8, base - ch],
        ],
        I.paint([96, 110, 100], 0.04),
        1.3,
        7,
      );
      // stone chimney (smoke: live)
      const chx = cx + cw * 0.8;
      pen.shape(rect(chx - 5, base - ch - h * 0.034, 10, h * 0.03), I.paint([170, 166, 160], 0.04), 1.1, 8);
      for (let i = 0; i < 4; i++)
        pen.stroke(
          [
            [chx - 5, base - ch - h * 0.03 + i * 5],
            [chx + 5, base - ch - h * 0.03 + i * 5],
          ],
          0.5,
          i + 8,
        );
      // door, windows, porch
      pen.shape(rect(cx + cw * 0.44, base - ch * 0.7, cw * 0.12, ch * 0.7), I.paint([110, 70, 50], 0.04), 1.1, 9);
      for (const f of [0.14, 0.7]) {
        pen.shape(
          rect(cx + cw * f, base - ch * 0.72, cw * 0.15, ch * 0.4),
          I.lit ? I.window : I.paint([200, 224, 240], 0.04),
          1,
          f,
        );
        pen.stroke(
          [
            [cx + cw * (f + 0.075), base - ch * 0.72],
            [cx + cw * (f + 0.075), base - ch * 0.32],
          ],
          0.6,
          f + 1,
        );
      }
      pen.shape(rect(cx - 6, base - 2, cw + 12, 4), I.paint([150, 100, 70], 0.04), 1.1, 10);
      // the woodpile and a stump with an axe
      const wx = x0 + w * 0.76;
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < 4 - r; i++)
          pen.shape(
            ellipse(wx + i * 7 + r * 3.5, base - 3 - r * 6, 3.5, 3, 10),
            I.paint([200, 160, 110], 0.04),
            0.8,
            r * 4 + i,
          );
      const sx = x0 + w * 0.15;
      pen.shape(rect(sx - 6, base - 8, 12, 8), I.paint([166, 112, 74], 0.04), 1, 30);
      pen.shape(ellipse(sx, base - 8, 6, 2, 10), I.paint([220, 190, 140], 0.04), 0.8, 31);
      pen.stroke(
        [
          [sx + 1, base - 9],
          [sx + 8, base - 20],
        ],
        1.3,
        32,
      );
      pen.shape(
        [
          [sx - 1, base - 12],
          [sx + 3, base - 11],
          [sx + 1, base - 7],
        ],
        I.paint([180, 186, 196], 0.04),
        0.8,
        33,
      );
      fir(pen, I, x0 + w * 0.05, base + 6, h * 0.11, 51);
      fir(pen, I, x0 + w * 0.95, base + 8, h * 0.09, 52);
    },
    // deep in the pines: tall firs close up, a trail sign, mushrooms
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      for (const [f, ht, b] of [
        [0.08, 0.15, 0.9],
        [0.25, 0.12, 0.88],
        [0.42, 0.17, 0.92],
        [0.66, 0.13, 0.88],
        [0.85, 0.16, 0.91],
      ] as [number, number, number][])
        fir(pen, I, x0 + w * f, h * b, h * ht, f * 100);
      // the trail sign
      const sx = x0 + w * 0.55,
        sb = h * 0.866;
      pen.stroke(
        [
          [sx, sb],
          [sx, sb - 26],
        ],
        1.4,
        1,
      );
      pen.shape(
        [
          [sx - 16, sb - 26],
          [sx + 12, sb - 26],
          [sx + 18, sb - 22],
          [sx + 12, sb - 18],
          [sx - 16, sb - 18],
        ],
        I.paint([140, 100, 70], 0.04),
        1.1,
        2,
      );
      pen.stroke(
        [
          [sx - 12, sb - 22],
          [sx + 8, sb - 22],
        ],
        0.6,
        3,
      );
      // red-capped mushrooms
      if (k.season !== "winter")
        for (const [dx, s] of [
          [0.32, 1],
          [0.34, 0.7],
          [0.76, 0.9],
        ] as [number, number][]) {
          const mx = x0 + w * dx,
            my = h * 0.93;
          pen.shape(rect(mx - 1.2 * s, my - 5 * s, 2.4 * s, 5 * s), I.paint([246, 240, 226], 0.04), 0.7, dx);
          pen.shape(
            ellipse(mx, my - 5 * s, 4.5 * s, 3.5 * s, 10, Math.PI, TAU),
            I.paint([214, 70, 60], 0.04),
            0.8,
            dx + 1,
          );
        }
    },
    // an island of pines out on the lake, a bit of beach with a fire ring
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const ix = x0 + w * 0.55,
        iy = h * (woods.hz + 0.03);
      pens[1].shape(ellipse(ix, iy, w * 0.14, h * 0.008, 20, Math.PI, TAU), I.paint([120, 150, 100], 0.14), 1, 1);
      for (const [d, ht] of [
        [-0.08, 18],
        [-0.03, 26],
        [0.02, 22],
        [0.07, 16],
      ] as [number, number][])
        fir(pens[1], I, ix + w * d, iy - 1, ht, d * 100 + 5, 0.14);
      // our little beach
      const pen = pens[2];
      const bx = x0 + w * 0.2;
      pen.shape(ellipse(bx, h * 0.84, w * 0.1, h * 0.012, 20), I.snowy ? I.snow : I.paint([230, 210, 170], 0.04), 1, 2);
      for (const d of [-1, 1])
        pen.shape(rect(bx + d * w * 0.065 - 7, h * 0.838, 14, 4), I.paint([166, 112, 74], 0.04), 0.9, d);
      for (let i = 0; i < 7; i++)
        pen.shape(ellipse(bx - 9 + i * 3, h * 0.845 + (i % 2), 2.2, 1.6, 8), I.paint([150, 140, 130], 0.04), 0.7, i);
      fir(pen, I, x0 + w * 0.88, h * 0.89, h * 0.12, 61);
    },
    // the campground: two tents, a picnic table, a fire ring, a lantern
    // on a post, a hammock slung between two pines
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * 0.86;
      // the hammock between two pines at the back
      const p0 = x0 + w * 0.68,
        p1 = x0 + w * 0.9;
      fir(pen, I, p0, h * 0.84, h * 0.13, 1001);
      fir(pen, I, p1, h * 0.845, h * 0.12, 1002);
      if (I.season === "summer" && !I.snowy) {
        const hy = h * 0.815;
        pen.shape(
          [
            [p0 + 2, hy],
            [(p0 + p1) / 2, hy + 12],
            [p1 - 2, hy],
            [(p0 + p1) / 2, hy + 8],
          ],
          I.paint([236, 120, 80], 0.04),
          1,
          1003,
        );
      }
      // the tents
      const tent = (x: number, tw: number, th: number, c: C, seed: number) => {
        pen.shape(
          [
            [x - tw / 2, base],
            [x, base - th],
            [x + tw / 2, base],
          ],
          c,
          1.3,
          seed,
        );
        pen.shape(
          [
            [x - tw * 0.16, base],
            [x, base - th * 0.6],
            [x + tw * 0.16, base],
          ],
          I.lit ? I.window : [50, 44, 48],
          1,
          seed + 1,
        );
        for (const d of [-1, 1])
          pen.stroke(
            [
              [x + (d * tw) / 2, base],
              [x + d * (tw / 2 + 8), base + 2],
            ],
            0.6,
            seed + d,
          );
      };
      tent(x0 + w * 0.16, w * 0.14, h * 0.04, I.paint([236, 140, 60], 0.04), 1010);
      // a dome tent
      pen.shape(ellipse(x0 + w * 0.36, base, w * 0.07, h * 0.032, 20, Math.PI, TAU), I.paint([90, 150, 110], 0.04), 1.3, 1015);
      pen.stroke(
        [
          [x0 + w * 0.36, base - h * 0.032],
          [x0 + w * 0.36, base],
        ],
        0.6,
        1016,
      );
      pen.stroke(ellipse(x0 + w * 0.36, base, w * 0.04, h * 0.032, 12, Math.PI, TAU), 0.6, 1017);
      // the picnic table
      const tx = x0 + w * 0.52,
        ty = h * 0.875;
      pen.shape(rect(tx - 20, ty - 12, 40, 3), I.paint([170, 120, 80], 0.04), 1, 1020);
      for (const d of [-14, 14])
        pen.stroke(
          [
            [tx + d, ty - 9],
            [tx + d * 1.2, ty],
          ],
          1.1,
          1021 + d,
        );
      pen.shape(rect(tx - 24, ty - 6, 48, 2.5), I.paint([170, 120, 80], 0.04), 0.9, 1022);
      // the fire ring (flames: live)
      const fx = x0 + w * 0.58,
        fy = h * 0.93;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        pen.shape(ellipse(fx + Math.cos(a) * 14, fy + Math.sin(a) * 4, 4, 2.6, 8), I.paint([150, 146, 140], 0.04), 0.8, 1025 + i);
      }
    },
    // the beaver pond: a lodge of sticks out in the shallows, a moose
    // standing in the water, reeds along our shore
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const lake = h * woods.lake;
      // the lodge, on the middle layer with the water
      const lx = x0 + w * 0.3,
        ly = h * (woods.hz + 0.045);
      pens[1].shape(ellipse(lx, ly, 26, 13, 20, Math.PI, TAU), I.paint([140, 110, 80], 0.14), 1.1, 1040);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        pens[1].stroke(
          [
            [lx + Math.cos(a) * 24, ly + Math.sin(a) * 11],
            [lx + Math.cos(a + 0.5) * 10, ly + Math.sin(a + 0.5) * 6 - 2],
          ],
          0.6,
          1041 + i,
        );
      }
      // the moose, standing in the shallows by our shore
      {
        const mx = x0 + w * 0.68,
          my = lake - 4;
        const coat: C = I.paint([90, 66, 52], 0.04);
        for (const lx2 of [-12, -8, 9, 13])
          pen.stroke(
            [
              [mx + lx2, my - 18],
              [mx + lx2, my],
            ],
            1.6,
            1050 + lx2,
          );
        pen.shape(
          [
            [mx - 16, my - 18],
            [mx - 15, my - 30],
            [mx + 6, my - 34],
            [mx + 14, my - 30],
            [mx + 16, my - 18],
          ],
          coat,
          1.2,
          1051,
        );
        // the head hanging low, the big bell of a nose
        pen.shape(
          [
            [mx + 12, my - 30],
            [mx + 22, my - 26],
            [mx + 30, my - 18],
            [mx + 27, my - 14],
            [mx + 18, my - 20],
          ],
          coat,
          1.1,
          1052,
        );
        // antlers, flat palms
        pen.shape(
          [
            [mx + 18, my - 27],
            [mx + 12, my - 38],
            [mx + 16, my - 36],
            [mx + 18, my - 41],
            [mx + 21, my - 36],
            [mx + 25, my - 40],
            [mx + 23, my - 30],
          ],
          I.paint([214, 196, 160], 0.04),
          1,
          1053,
        );
        // ripples round its legs
        pen.stroke(ellipse(mx, my, 20, 2.5, 16), 0.6, 1054);
      }
      // reeds and cattails on our shore
      for (let i = 0; i < 14; i++) {
        const rx = x0 + w * (0.05 + i * 0.065) + hash(i) * 6;
        if (rx > x0 + w * 0.6 && rx < x0 + w * 0.8) continue;
        const ry = lake + 4 + hash(i + 2) * 6;
        const ht = 14 + hash(i + 5) * 10;
        pen.stroke(
          [
            [rx, ry],
            [rx + 1, ry - ht],
          ],
          0.9,
          1060 + i,
        );
        if (i % 2 && I.season !== "winter") pen.shape(rect(rx - 1.6, ry - ht + 1, 3.2, 7), I.paint([130, 90, 60], 0.04), 0.7, 1061 + i);
      }
      fir(pen, I, x0 + w * 0.94, h * 0.9, h * 0.12, 1075);
    },
    // the ranger station: a log office with a porch, a flag, a sign, the
    // green truck parked out front
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const base = h * 0.866;
      const rx = x0 + w * 0.22,
        rw = w * 0.32,
        rh = h * 0.045;
      pen.shape(rect(rx, base - rh, rw, rh), I.paint([150, 104, 70], 0.04), 1.3, 1080);
      for (let i = 1; i < 5; i++)
        pen.stroke(
          [
            [rx, base - (rh * i) / 5],
            [rx + rw, base - (rh * i) / 5],
          ],
          0.5,
          1081 + i,
        );
      pen.shape(
        [
          [rx - 8, base - rh],
          [rx + rw / 2, base - rh - h * 0.028],
          [rx + rw + 8, base - rh],
        ],
        I.paint([70, 110, 80], 0.04),
        1.3,
        1086,
      );
      windows(pen, I, rx + rw * 0.06, base - rh * 0.8, rw * 0.3, rh * 0.42, 2, 1, 1087, I.paint([200, 224, 240], 0.04));
      windows(pen, I, rx + rw * 0.64, base - rh * 0.8, rw * 0.3, rh * 0.42, 2, 1, 1088, I.paint([200, 224, 240], 0.04));
      pen.shape(rect(rx + rw * 0.43, base - rh * 0.72, rw * 0.14, rh * 0.72), I.paint([90, 60, 44], 0.04), 1, 1089);
      pen.shape(rect(rx - 4, base - 2, rw + 8, 4), I.paint([170, 120, 80], 0.04), 1, 1090);
      // the flagpole (the flag itself: live)
      pen.stroke(
        [
          [x0 + w * 0.64, base + 2],
          [x0 + w * 0.64, base - h * 0.1],
        ],
        1.1,
        1091,
      );
      // the carved sign on two posts
      const sx = x0 + w * 0.08;
      for (const d of [-12, 12])
        pen.stroke(
          [
            [sx + d, h * 0.9],
            [sx + d, h * 0.865],
          ],
          1.3,
          1092 + d,
        );
      pen.shape(rect(sx - 18, h * 0.862 - 14, 36, 14), I.paint([120, 84, 56], 0.04), 1.1, 1093);
      pen.stroke(
        [
          [sx - 11, h * 0.862 - 7],
          [sx + 11, h * 0.862 - 7],
        ],
        0.8,
        1094,
      );
      // the truck, parked on the path
      const tx = x0 + w * 0.7,
        ty = h * 0.89;
      pen.shape(
        [
          [tx, ty - 6],
          [tx + 22, ty - 6],
          [tx + 25, ty - 15],
          [tx + 38, ty - 15],
          [tx + 41, ty - 6],
          [tx + 50, ty - 6],
          [tx + 50, ty],
          [tx, ty],
        ],
        I.paint([70, 120, 80], 0.04),
        1.2,
        1095,
      );
      pen.shape(rect(tx + 27, ty - 13, 9, 5), I.paint([200, 224, 240], 0.04), 0.8, 1096);
      for (const wx of [tx + 10, tx + 40]) pen.shape(ellipse(wx, ty, 4, 4, 10), [40, 40, 48], 1, 1097 + wx);
      fir(pen, I, x0 + w * 0.92, h * 0.9, h * 0.14, 1099);
    },
    // the boathouse and the rope swing: a boathouse half over the water,
    // a big leaning pine with a tire swing above the shallows
    (k: Kit, x0: number) => {
      const { pens, I, w, h } = k;
      const pen = pens[2];
      const lake = h * woods.lake;
      const bx = x0 + w * 0.14,
        bw = w * 0.3,
        bh = h * 0.04;
      // pilings into the water, the house on top
      for (let x = bx + 4; x < bx + bw; x += 16)
        pen.stroke(
          [
            [x, lake - 6],
            [x, lake + 6],
          ],
          1.1,
          1100 + x,
        );
      pen.shape(rect(bx, lake - 6 - bh, bw, bh), I.paint([200, 96, 80], 0.04), 1.3, 1101);
      pen.shape(rect(bx + bw * 0.1, lake - 6 - bh * 0.8, bw * 0.4, bh * 0.8), [40, 40, 46], 1, 1102);
      pen.shape(
        [
          [bx - 6, lake - 6 - bh],
          [bx + bw / 2, lake - 6 - bh - h * 0.025],
          [bx + bw + 6, lake - 6 - bh],
        ],
        I.paint([80, 86, 100], 0.04),
        1.3,
        1103,
      );
      windows(pen, I, bx + bw * 0.62, lake - 6 - bh * 0.8, bw * 0.3, bh * 0.4, 2, 1, 1104, I.paint([200, 224, 240], 0.04));
      // the leaning pine, its trunk out over the water
      const px = x0 + w * 0.7,
        pb = h * 0.86;
      pen.shape(
        [
          [px - 4, pb],
          [px + 4, pb],
          [px + 32, pb - h * 0.12],
          [px + 26, pb - h * 0.12],
        ],
        I.paint([130, 90, 60], 0.04),
        1.2,
        1110,
      );
      // the bough the swing hangs from
      pen.stroke(
        [
          [px + 22, pb - h * 0.1],
          [px - 22, pb - h * 0.115],
        ],
        2,
        1111,
      );
      for (let i = 0; i < 3; i++) {
        const tb = pb - h * (0.11 + i * 0.03),
          tx = px + 29 + i * 2;
        pen.shape(
          [
            [tx - 22 + i * 4, tb],
            [tx, tb - h * 0.04],
            [tx + 22 - i * 4, tb],
          ],
          I.snowy ? I.paint([90, 120, 110], 0.04) : I.paint([60, 120, 90], 0.04),
          1.1,
          1112 + i,
        );
      }
      // a big flat rock to jump from
      pen.shape(ellipse(x0 + w * 0.86, lake + 6, 26, 8, 16, Math.PI, TAU), I.paint([160, 156, 150], 0.04), 1.1, 1120);
    },
  ],
  live(g: CanvasRenderingContext2D, k: Kit, t: number, X: (x: number, layer: number) => number) {
    const { I, h, w, PW } = k;
    const ink = css(I.inkC, 0.9);
    g.strokeStyle = ink;
    g.lineCap = "round";
    g.lineJoin = "round";
    const night = I.night > 0.5;
    const shore = h * woods.hz,
      lake = h * woods.lake;
    if (I.snowy) return;
    // the lake glinting
    g.strokeStyle = night ? "rgba(220,235,255,0.5)" : "rgba(255,255,255,0.9)";
    g.lineWidth = 1;
    for (let i = 0; i < (PW / w) * 6; i++) {
      const life = (t * 0.3 + hash(i * 3.3)) % 1;
      if (life > 0.5) continue;
      const a = Math.sin((life / 0.5) * Math.PI);
      const x = hash(i * 7.1) * PW + t * 1.5;
      const y = shore + 4 + hash(i * 5.7) * (lake - shore - 8);
      g.globalAlpha = a;
      g.beginPath();
      g.moveTo(X(x, 1) - 3 * a, y);
      g.lineTo(X(x, 1) + 3 * a, y);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.strokeStyle = ink;
    // the canoe tied at the dock, bobbing
    {
      const cx = X(w * 0.55, 2),
        cy = lake - 5 + Math.sin(t * 1.4) * 1;
      g.fillStyle = css(I.paint([226, 96, 86], 0.04));
      g.beginPath();
      g.moveTo(cx - 20, cy - 3);
      g.quadraticCurveTo(cx, cy + 6, cx + 20, cy - 3);
      g.quadraticCurveTo(cx, cy, cx - 20, cy - 3);
      g.fill();
      g.lineWidth = 1.1;
      g.stroke();
    }
    // a little fishing boat drifting, someone casting now and then; it
    // passes behind the island, the beaver lodge, the moose, the boathouse,
    // the leaning pine and the chairs on the dock
    {
      g.save();
      behind(g, X, PW, [
        [w * 0.6, w * 0.78, h * 0.76, 2],
        [w * 3.41, w * 3.69, h * 0.68, 1],
        [w * 5.3 - 26, w * 5.3 + 26, h * 0.757, 1],
        [w * 5.68 - 16, w * 5.68 + 31, h * 0.745, 2],
        [w * 7.12, w * 7.46, h * 0.72, 2],
        [w * 7.7 - 26, w * 7.7 + 60, h * 0.6, 2],
      ]);
      const x = (t * 2 + w * 2.3) % PW;
      const bx = X(x, 1),
        by = shore + (lake - shore) * 0.55 + Math.sin(t * 1.2) * 0.8;
      g.fillStyle = css(I.paint([150, 180, 200], 0.14));
      g.beginPath();
      g.moveTo(bx - 10, by);
      g.lineTo(bx + 10, by);
      g.lineTo(bx + 7, by + 4);
      g.lineTo(bx - 7, by + 4);
      g.closePath();
      g.fill();
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx, by - 7);
      g.stroke();
      g.beginPath();
      g.arc(bx, by - 9, 2, 0, TAU);
      g.stroke();
      const cast = (t * 0.25) % 1;
      const tipX = bx + 4 + Math.cos(-0.9 + cast * 0.6) * 14,
        tipY = by - 7 + Math.sin(-0.9 + cast * 0.6) * 14;
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(bx + 1, by - 6);
      g.lineTo(tipX, tipY);
      g.quadraticCurveTo(tipX + 10, tipY + 4, tipX + 14, by + 1);
      g.stroke();
      g.restore();
    }
    // a loon bobbing, diving every so often
    {
      const cyc = (t * 0.1) % 1;
      if (cyc < 0.8) {
        const lx = X(w * 3.2 + cyc * 40, 1),
          ly = shore + (lake - shore) * 0.35 + Math.sin(t * 1.3) * 0.6;
        g.fillStyle = css(I.paint([40, 44, 52], 0.14));
        g.beginPath();
        g.ellipse(lx, ly, 6, 2.4, 0, Math.PI, TAU);
        g.fill();
        g.stroke();
        g.beginPath();
        g.arc(lx + 5, ly - 4, 1.8, 0, TAU);
        g.fill();
        g.stroke();
      }
    }
    // smoke from the cabin chimney
    {
      const cx = w * 1.32 + w * 0.36 * 0.8;
      const top = h * 0.865 - h * 0.045 - h * 0.034;
      for (let i = 0; i < 5; i++) {
        const q = (t * 0.25 + i / 5) % 1;
        g.globalAlpha = 0.6 * (1 - q);
        g.beginPath();
        g.arc(X(cx + q * 18 * (k.L.wind > 3 ? 2 : 1), 2), top - q * 34, 2 + q * 5, 0, TAU);
        g.lineWidth = 0.9;
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // the campfire: flames licking up, sparks after dark
    {
      const fx = X(w * 4.58, 2),
        fy = h * 0.93;
      if (!I.snowy || night) {
        for (let i = 0; i < 3; i++) {
          const f = Math.sin(t * 9 + i * 2.1) * 2;
          g.fillStyle = css(i === 1 ? [255, 214, 90] : [246, 120, 50], 0.95);
          g.beginPath();
          g.moveTo(fx - 7 + i * 5, fy);
          g.quadraticCurveTo(fx - 6 + i * 5 + f, fy - 9 - i * 2, fx - 3 + i * 5 + f, fy - 14 - (i === 1 ? 4 : 0));
          g.quadraticCurveTo(fx - 2 + i * 5, fy - 6, fx - 1 + i * 5, fy);
          g.closePath();
          g.fill();
          g.lineWidth = 0.8;
          g.strokeStyle = ink;
          g.stroke();
        }
        if (night)
          for (let i = 0; i < 4; i++) {
            const q = (t * 0.6 + i / 4) % 1;
            g.fillStyle = `rgba(255,200,100,${1 - q})`;
            g.fillRect(fx + Math.sin(i * 3 + t) * 5, fy - 16 - q * 30, 1.5, 1.5);
          }
      }
    }
    // the flag at the ranger station, rippling in the wind
    {
      const px = X(w * 6.64, 2),
        top = h * 0.866 - h * 0.1;
      const wind = 0.5 + Math.min(1, k.L.wind / 8);
      g.fillStyle = css(I.paint([70, 110, 80], 0.04));
      g.beginPath();
      g.moveTo(px, top + 1);
      for (let i = 0; i <= 6; i++) g.lineTo(px + i * 3.5 * wind + 1, top + 1 + Math.sin(t * 5 - i) * 1.5 * wind);
      for (let i = 6; i >= 0; i--) g.lineTo(px + i * 3.5 * wind + 1, top + 11 + Math.sin(t * 5 - i) * 1.5 * wind);
      g.closePath();
      g.fill();
      g.lineWidth = 0.9;
      g.strokeStyle = ink;
      g.stroke();
    }
    // the tire swing swaying under the bough
    {
      const ax = w * 7.7 - 14,
        ay = h * 0.86 - h * 0.113;
      const a = Math.sin(t * 1.3) * (I.season === "summer" ? 0.3 : 0.08);
      const len = h * 0.07;
      const ex = X(ax, 2) + Math.sin(a) * len,
        ey = ay + Math.cos(a) * len;
      g.strokeStyle = ink;
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(X(ax, 2), ay);
      g.lineTo(ex, ey);
      g.stroke();
      g.fillStyle = css([40, 40, 48]);
      g.beginPath();
      g.ellipse(ex, ey + 5, 4, 6, a, 0, TAU);
      g.fill();
      g.stroke();
    }
    // a beaver swimming out from its lodge, a wake spreading behind
    {
      const q = (t * 0.03) % 1;
      const bx = w * 5.3 + 30 + Math.sin(q * TAU) * 60,
        by = h * (woods.hz + 0.05) + Math.cos(q * TAU) * 6;
      const dir = Math.cos(q * TAU) >= 0 ? 1 : -1;
      const sx = X(bx, 1);
      g.strokeStyle = ink;
      g.fillStyle = css(I.paint([110, 80, 60], 0.14));
      g.beginPath();
      g.ellipse(sx, by, 4, 1.8, 0, Math.PI, TAU);
      g.fill();
      g.stroke();
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(sx - dir * 4, by);
      g.lineTo(sx - dir * 16, by - 3);
      g.moveTo(sx - dir * 4, by);
      g.lineTo(sx - dir * 16, by + 3);
      g.stroke();
    }
    // fireflies along the shore on summer nights
    if (night && k.season === "summer")
      for (let i = 0; i < 12; i++) {
        const a = Math.max(0, Math.sin(t * 1.4 + i * 2.3));
        g.fillStyle = `rgba(230,255,140,${a})`;
        g.beginPath();
        g.arc(X(hash(i * 3.1) * PW + Math.sin(t * 0.4 + i) * 8, 2), lake + 8 + hash(i * 1.7) * 40, 1.4, 0, TAU);
        g.fill();
      }
  },
};

const WORLDS = { mountain: { ...mountain, top: 0.42 }, coast, farm, city, suburb, desert, woods };

// ---------------------------------------------------------------------------
// painting the loop, and the moving bits
// ---------------------------------------------------------------------------

export type WorldPano = LinePano & { kit: Kit; kind: WorldKind };

export function paintWorldPano(
  kind: WorldKind,
  w: number,
  h: number,
  L: Light,
  season: Season,
  style: number,
  dpr: number,
): WorldPano {
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
  if (kind === "mountain") mountain.ground(kit);
  else if (kind === "coast") coast.ground(kit);
  else if (kind === "city") city.ground(kit);
  else if (kind === "suburb") suburb.ground(kit);
  else if (kind === "desert") desert.ground(kit);
  else if (kind === "woods") woods.ground(kit);
  else farm.draw(kit);
  def.scenes.forEach((scene, i) => scene(kit, i * w));
  if (kind === "mountain") mountain.front(kit);
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
