// Little painted things for the Globe's world: leaves, petals, seeds, grass
// and flowers (one atlas the weather layer draws from), and the snow and
// frost that settle on the songs.

export const CELLS = 4; // the atlas is 4 × 4
export const TEX = {
  maple: 0,
  oak: 1,
  aspen: 2,
  elm: 3,
  petal: 4,
  petalWhite: 5,
  seed: 6,
  grass: 7,
  grassLush: 8,
  daisy: 9,
  crocus: 10,
  sprout: 11,
  grassDry: 12,
} as const;

const C = 128;

let rnd = 1;
const rand = () => {
  rnd = (rnd * 16807) % 2147483647;
  return rnd / 2147483647;
};

function leafPath(ctx: CanvasRenderingContext2D, r: (a: number) => number, n = 180) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = r(a);
    const x = Math.sin(a) * k,
      y = -Math.cos(a) * k;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// A leaf: its outline, a soft colour change from the middle out, a stem and veins.
function leaf(ctx: CanvasRenderingContext2D, r: (a: number) => number, inner: string, outer: string, vein: string, veins: number[]) {
  ctx.save();
  ctx.translate(64, 60);
  leafPath(ctx, r);
  const g = ctx.createRadialGradient(0, 8, 2, 0, 0, 58);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fill();
  // a little mottling, so no two patches of colour are flat
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? "60,25,5" : "255,220,140"},${(0.05 + rand() * 0.08).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc((rand() - 0.5) * 100, (rand() - 0.5) * 100, 4 + rand() * 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = vein;
  ctx.lineCap = "round";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(0, 64);
  ctx.stroke();
  ctx.lineWidth = 1.3;
  for (const a of veins) {
    const k = r(a) * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(Math.sin(a) * k * 0.4, 10 - Math.cos(a) * k * 0.5, Math.sin(a) * k, -Math.cos(a) * k);
    ctx.stroke();
  }
  ctx.restore();
}

function blade(ctx: CanvasRenderingContext2D, x: number, h: number, bend: number, w: number, col: [string, string]) {
  const g = ctx.createLinearGradient(0, C, 0, C - h);
  g.addColorStop(0, col[0]);
  g.addColorStop(1, col[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, C);
  ctx.quadraticCurveTo(x - w * 0.4 + bend * 0.3, C - h * 0.6, x + bend, C - h);
  ctx.quadraticCurveTo(x + w * 0.4 + bend * 0.3, C - h * 0.6, x + w, C);
  ctx.closePath();
  ctx.fill();
}

function tuft(ctx: CanvasRenderingContext2D, n: number, tall: number, cols: [string, string][]) {
  for (let i = 0; i < n; i++) {
    const x = 64 + (rand() - 0.5) * 50;
    const h = tall * (0.5 + rand() * 0.5);
    blade(ctx, x, h, (x - 64) * 0.9 + (rand() - 0.5) * 24, 2 + rand() * 2.2, cols[i % cols.length]);
  }
}

function stem(ctx: CanvasRenderingContext2D, top: number, bend: number) {
  ctx.strokeStyle = "#4F7A3A";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(64, C);
  ctx.quadraticCurveTo(64 + bend, (C + top) / 2, 64 + bend * 0.6, top);
  ctx.stroke();
}

let atlasCache: HTMLCanvasElement | null = null;

export function atlas(): HTMLCanvasElement {
  if (atlasCache) return atlasCache;
  rnd = 7;
  const cv = document.createElement("canvas");
  cv.width = cv.height = C * CELLS;
  const ctx = cv.getContext("2d")!;
  const cell = (i: number, paint: () => void) => {
    ctx.save();
    ctx.translate((i % CELLS) * C, Math.floor(i / CELLS) * C);
    ctx.beginPath();
    ctx.rect(0, 0, C, C);
    ctx.clip();
    paint();
    ctx.restore();
  };

  // a maple: five pointed lobes, slightly ragged
  cell(TEX.maple, () =>
    leaf(
      ctx,
      (a) => {
        const lobe = Math.pow(Math.abs(Math.cos(a * 2.5)), 0.7);
        const notch = Math.abs(Math.cos(a)) > 0.97 && Math.cos(a) < 0 ? 0.25 : 1;
        return (24 + 32 * lobe + 3 * Math.sin(a * 23)) * notch;
      },
      "#E8862C",
      "#B4291C",
      "rgba(110,25,10,0.45)",
      [-2.3, -1.2, 0, 1.2, 2.3],
    ),
  );
  // an oak: long, with rounded lobes down each side
  cell(TEX.oak, () =>
    leaf(
      ctx,
      (a) => {
        const e = 54 / Math.sqrt(1 + 1.6 * Math.sin(a) ** 2);
        return e * (0.86 + 0.14 * Math.cos(a * 9)) ;
      },
      "#D49A3A",
      "#8A5221",
      "rgba(80,40,10,0.4)",
      [-2.4, -1.6, -0.8, 0.8, 1.6, 2.4],
    ),
  );
  // an aspen: round, gold, finely toothed
  cell(TEX.aspen, () =>
    leaf(
      ctx,
      (a) => {
        const tip = Math.pow(Math.max(0, Math.cos(a)), 6) * 12;
        return 38 + tip + 1.5 * Math.sin(a * 40) - 6 * Math.max(0, -Math.cos(a));
      },
      "#F3CC4A",
      "#D08A1E",
      "rgba(120,80,10,0.35)",
      [-2, -1, 1, 2],
    ),
  );
  // an elm: lopsided oval, russet
  cell(TEX.elm, () =>
    leaf(
      ctx,
      (a) => {
        const e = 52 / Math.sqrt(1 + 2.2 * Math.sin(a) ** 2);
        return e * (1 + 0.08 * Math.sin(a)) + 2 * Math.sin(a * 30);
      },
      "#C8702A",
      "#7A3518",
      "rgba(70,25,8,0.4)",
      [-2.2, -1.5, -0.8, 0.8, 1.5, 2.2],
    ),
  );

  // blossom petals: a soft rounded teardrop with a notch at the tip
  const petal = (base: string, tip: string) => {
    ctx.save();
    ctx.translate(64, 64);
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.bezierCurveTo(-44, 20, -40, -40, -10, -44);
    ctx.quadraticCurveTo(0, -34, 10, -44);
    ctx.bezierCurveTo(40, -40, 44, 20, 0, 46);
    const g = ctx.createLinearGradient(0, 46, 0, -44);
    g.addColorStop(0, base);
    g.addColorStop(1, tip);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(200,90,120,0.18)";
    ctx.lineWidth = 1;
    for (const x of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.quadraticCurveTo(x * 0.6, 0, x, -30);
      ctx.stroke();
    }
    ctx.restore();
  };
  cell(TEX.petal, () => petal("#F2A6BC", "#FFE9F0"));
  cell(TEX.petalWhite, () => petal("#F4E6EA", "#FFFFFF"));

  // a dandelion seed: a fine stalk and a puff of silk
  cell(TEX.seed, () => {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(64, 120);
    ctx.lineTo(64, 50);
    ctx.stroke();
    ctx.fillStyle = "rgba(150,120,80,0.9)";
    ctx.fillRect(62.5, 108, 3, 14);
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 28; i++) {
      const a = -Math.PI / 2 + (i / 27 - 0.5) * 2.6;
      ctx.strokeStyle = `rgba(255,255,255,${(0.5 + rand() * 0.4).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(64, 50);
      ctx.quadraticCurveTo(64 + Math.cos(a) * 22, 50 + Math.sin(a) * 30, 64 + Math.cos(a) * 44, 46 + Math.sin(a) * 38);
      ctx.stroke();
    }
  });

  const greens: [string, string][] = [
    ["#3E6B2E", "#8DBA5A"],
    ["#4A7A33", "#A3C96A"],
    ["#35602A", "#7CAE4E"],
  ];
  cell(TEX.grass, () => tuft(ctx, 11, 92, greens));
  cell(TEX.grassLush, () => tuft(ctx, 16, 116, greens));
  cell(TEX.grassDry, () =>
    tuft(ctx, 10, 86, [
      ["#6B6A34", "#C2B270"],
      ["#7A6A3A", "#D3BE80"],
      ["#5E6A32", "#AFAA66"],
    ]),
  );

  // a daisy on a stem
  cell(TEX.daisy, () => {
    stem(ctx, 40, 6);
    ctx.save();
    ctx.translate(68, 36);
    for (let i = 0; i < 13; i++) {
      ctx.rotate((Math.PI * 2) / 13);
      ctx.fillStyle = i % 2 ? "#FFFFFF" : "#F4F2EC";
      ctx.beginPath();
      ctx.ellipse(0, -15, 4.5, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#F1B628";
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  // a crocus: a little purple cup
  cell(TEX.crocus, () => {
    stem(ctx, 56, -4);
    blade(ctx, 58, 64, -16, 2.4, ["#3E6B2E", "#7CAE4E"]);
    blade(ctx, 70, 58, 16, 2.4, ["#3E6B2E", "#7CAE4E"]);
    ctx.save();
    ctx.translate(61, 44);
    const g = ctx.createLinearGradient(0, 18, 0, -26);
    g.addColorStop(0, "#6B3FA0");
    g.addColorStop(1, "#B796E8");
    ctx.fillStyle = g;
    for (const [x, r] of [
      [-9, -0.3],
      [9, 0.3],
      [0, 0],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x, -4, 9, 22, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  // a sprout: two round leaves just opening
  cell(TEX.sprout, () => {
    stem(ctx, 70, 2);
    ctx.fillStyle = "#7DB24A";
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(65, 72);
      ctx.rotate(s * 0.9);
      ctx.beginPath();
      ctx.ellipse(0, -16, 9, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  atlasCache = cv;
  return cv;
}

// ---------------------------------------------------------------------------
// Snow and frost that settle on the songs (one tile wide, as data URLs)
// ---------------------------------------------------------------------------

const surface: Record<string, string> = {};

function valueNoise(size: number, cells: number, seed: number) {
  rnd = seed;
  const g = Array.from({ length: (cells + 1) * (cells + 1) }, rand);
  const at = (x: number, y: number) => g[(y % (cells + 1)) * (cells + 1) + (x % (cells + 1))];
  return (px: number, py: number) => {
    const fx = (px / size) * cells,
      fy = (py / size) * cells;
    const x0 = Math.floor(fx),
      y0 = Math.floor(fy);
    const tx = fx - x0,
      ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx),
      sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export function surfaceTexture(kind: "snow" | "frost"): string {
  if (surface[kind]) return surface[kind];
  const S = 96;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  // how far in from the tile's nearest edge, 0 at the edge .. 1 in the middle
  const inset = (x: number, y: number) => Math.min(x, y, S - 1 - x, S - 1 - y) / (S / 2);
  if (kind === "snow") {
    // a soft even blanket: gentle bumps of shadow, thinner and ragged at the edges
    const n1 = valueNoise(S, 6, 11),
      n2 = valueNoise(S, 16, 29);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const n = 0.65 * n1(x, y) + 0.35 * n2(x, y);
        const edge = Math.max(0, Math.min(1, inset(x, y) * 6 - 0.2 + (n - 0.5) * 1.2));
        const shade = 241 + 14 * n2(x, y);
        const i = (y * S + x) * 4;
        img.data[i] = shade - 5;
        img.data[i + 1] = shade - 2;
        img.data[i + 2] = Math.min(255, shade + 4);
        img.data[i + 3] = Math.round(255 * edge * (0.94 + 0.06 * n));
      }
    ctx.putImageData(img, 0, 0);
    rnd = 3;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${(0.7 + rand() * 0.3).toFixed(2)})`;
      ctx.fillRect(4 + rand() * (S - 8), 4 + rand() * (S - 8), 1, 1);
    }
  } else {
    // frost: a pale crystalline film, thickest round the edges
    const n1 = valueNoise(S, 10, 5);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const e = 1 - Math.min(1, inset(x, y) * 1.6);
        const a = 0.12 + 0.6 * Math.pow(e, 1.6) * (0.6 + 0.4 * n1(x, y));
        const i = (y * S + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 244;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(255 * a);
      }
    ctx.putImageData(img, 0, 0);
    rnd = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 260; i++) {
      const side = Math.floor(rand() * 4);
      const d = Math.pow(rand(), 2) * S * 0.45;
      const t = rand() * S;
      const [x, y] = side === 0 ? [t, d] : side === 1 ? [S - d, t] : side === 2 ? [t, S - d] : [d, t];
      // a feathery crystal: a spine with a few barbs
      const len = 3 + rand() * 7;
      const a = rand() * Math.PI * 2;
      ctx.strokeStyle = `rgba(255,255,255,${(0.35 + 0.5 * rand()).toFixed(3)})`;
      ctx.lineWidth = 0.7 + rand() * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      for (let j = 1; j <= 2; j++) {
        const bx = x + Math.cos(a) * len * (j / 3),
          by = y + Math.sin(a) * len * (j / 3);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + 0.7) * len * 0.35, by + Math.sin(a + 0.7) * len * 0.35);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a - 0.7) * len * 0.35, by + Math.sin(a - 0.7) * len * 0.35);
      }
      ctx.stroke();
    }
  }
  surface[kind] = cv.toDataURL("image/png");
  return surface[kind];
}
