// The Globe's geometry, light and physics. Plain functions so the render
// loop can call them every frame without React in the way.

export type V3 = [number, number, number];

export const TILT = (23.44 * Math.PI) / 180; // spins on Earth's axis, north pole leaning right
export const PERSPECTIVE = 1000;
const TWO_PI = Math.PI * 2;

export type Camera = { yaw: number; pitch: number; roll: number };

// World direction to camera space (+z points at the viewer).
export function camV(v: V3, c: Camera, noRoll = false): V3 {
  const x0 = v[0] * Math.cos(c.yaw) + v[2] * Math.sin(c.yaw);
  const z1 = -v[0] * Math.sin(c.yaw) + v[2] * Math.cos(c.yaw);
  const x1 = x0 * Math.cos(TILT) - v[1] * Math.sin(TILT);
  const y1 = x0 * Math.sin(TILT) + v[1] * Math.cos(TILT);
  const y2 = y1 * Math.cos(c.pitch) - z1 * Math.sin(c.pitch);
  const z2 = y1 * Math.sin(c.pitch) + z1 * Math.cos(c.pitch);
  const r = noRoll ? 0 : c.roll;
  return [x1 * Math.cos(r) - y2 * Math.sin(r), x1 * Math.sin(r) + y2 * Math.cos(r), z2];
}

export function latLon(p: V3) {
  return { lat: Math.asin(Math.max(-1, Math.min(1, p[1]))), lon: Math.atan2(p[0], p[2]) };
}

// Yaw and pitch that bring a point on the sphere round to face the viewer,
// sitting a little below the middle (or dead centre with `exact`).
export function aim(p: V3, currentYaw: number, exact = false) {
  const c = [p[0], -p[1], p[2]];
  const rho = Math.max(1e-6, Math.hypot(c[0], c[2]));
  const y0 = Math.atan2(c[2], c[0]) - Math.acos(Math.max(-1, Math.min(1, (c[1] * Math.tan(TILT)) / rho)));
  const ux = c[0] * Math.cos(y0) + c[2] * Math.sin(y0);
  const uz = -c[0] * Math.sin(y0) + c[2] * Math.cos(y0);
  const pz = Math.atan2(ux * Math.sin(TILT) + c[1] * Math.cos(TILT), uz);
  return { yaw: y0 + TWO_PI * Math.round((currentYaw - y0) / TWO_PI), pitch: exact ? pz : pz - 0.42 };
}

// ---------------------------------------------------------------------------
// The sun
// ---------------------------------------------------------------------------

// A rough location from the timezone, good enough to light the room.
export function guessGeo() {
  const y = new Date().getFullYear();
  const std = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {}
  const south = /^(Australia|Antarctica)\/|Auckland|Sao_Paulo|Argentina|Santiago|Montevideo|Johannesburg|Lima|Jakarta/.test(tz);
  return { lat: south ? -30 : 40, lon: -std / 4 };
}

// NOAA-style approximation: azimuth from north (clockwise) and elevation, radians.
export function sunAt(date: Date, lat: number, lon: number) {
  const rad = Math.PI / 180;
  const N = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 864e5);
  const decl = 23.44 * rad * Math.sin((2 * Math.PI * (284 + N)) / 365);
  const B = (2 * Math.PI * (N - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const H = ((utcMin + 4 * lon + eot) / 4 - 180) * rad;
  const phi = lat * rad;
  const el = Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI;
  return { az, el };
}

export type Sun = { az: number; el: number; L: V3; day: number };

// The viewer faces north: east is screen-right, the noon sun sits behind you.
export function sunLight(date: Date, geo: { lat: number; lon: number }): Sun {
  const { az, el } = sunAt(date, geo.lat, geo.lon);
  const L: V3 = [Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)];
  const day = Math.max(0, Math.min(1, ((el * 180) / Math.PI + 6) / 12));
  return { az, el, L, day };
}

export function starField(n: number, seed: number, size: number, alpha: number) {
  let x = seed;
  const rnd = () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
  const out: string[] = [];
  for (let i = 0; i < n; i++)
    out.push(
      `${Math.round(rnd() * 1000)}px ${Math.round(rnd() * 1000)}px 0 ${size}px rgba(255,255,255,${(alpha * (0.35 + 0.65 * rnd())).toFixed(2)})`,
    );
  return out.join(", ");
}

// ---------------------------------------------------------------------------
// Tiles: rigid rounded squares that drift over the sphere, touch and bounce.
// The collision shape is exactly the drawn rounded square.
// ---------------------------------------------------------------------------

type Body = { p: V3; v: V3; sp: number };

const dot = (u: V3, v: V3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const norm = (v: V3) => {
  const n = Math.hypot(v[0], v[1], v[2]);
  v[0] /= n;
  v[1] /= n;
  v[2] /= n;
};
const frame = (p: V3) => {
  const { lat, lon } = latLon(p);
  return {
    e: [Math.cos(lon), 0, -Math.sin(lon)] as V3,
    d: [Math.sin(lat) * Math.sin(lon), -Math.cos(lat), Math.sin(lat) * Math.cos(lon)] as V3,
  };
};
const segPt = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const ex = bx - ax,
    ey = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
  return [ax + ex * t, ay + ey * t];
};

export class TileSim {
  bodies = new Map<number, Body>();

  // Each slot starts at a fixed spot spread evenly over the sphere, so a new
  // friend never shuffles everyone else.
  pos(k: number): V3 {
    let o = this.bodies.get(k);
    if (!o) {
      const q = (k * 37) % 100;
      const lat = Math.asin(1 - ((q + 0.5) * 2) / 100),
        lon = q * 2.39996;
      const r = (j: number) => {
        const x = Math.sin(k * 12.77 + j * 4.31) * 9973.1;
        return x - Math.floor(x);
      };
      const a = r(1) * TWO_PI,
        sp = 7 + r(2) * 8;
      const east = [Math.cos(lon), 0, -Math.sin(lon)];
      const north = [-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon)];
      o = {
        sp,
        p: [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)],
        v: [0, 1, 2].map((i) => (east[i] * Math.cos(a) + north[i] * Math.sin(a)) * sp) as V3,
      };
      this.bodies.set(k, o);
    }
    return o.p;
  }

  step(keys: number[], half: number, Rb: number, dt: number) {
    const h = half,
      rr = 0.26 * 2 * h,
      a = h - rr;
    const items = keys.map((k) => {
      this.pos(k);
      return this.bodies.get(k)!;
    });
    if (dt > 0)
      for (const o of items) {
        const { p, v } = o;
        // keep them off the poles
        if (Math.abs(p[1]) > 0.88) {
          const F = frame(p),
            sg = p[1] > 0 ? 1 : -1;
          for (let i = 0; i < 3; i++) v[i] += F.d[i] * sg * 30 * dt;
        }
        const sp = Math.hypot(v[0], v[1], v[2]) || 1;
        const g = 1 + (o.sp / sp - 1) * Math.min(1, dt * 0.6);
        for (let i = 0; i < 3; i++) {
          v[i] *= g;
          p[i] += (v[i] * dt) / Rb;
        }
        norm(p);
        const vp = dot(v, p);
        for (let i = 0; i < 3; i++) v[i] -= vp * p[i];
      }

    // signed gap between two rounded squares (negative = overlap) and the
    // push direction from A to B
    const contact = (A: Body, B: Body) => {
      const cosT = Math.max(-1, Math.min(1, dot(A.p, B.p)));
      const th = Math.acos(cosT);
      if (th * Rb > 3 * h) return null;
      const Fa = frame(A.p),
        Fb = frame(B.p);
      const tv: V3 = [B.p[0] - cosT * A.p[0], B.p[1] - cosT * A.p[1], B.p[2] - cosT * A.p[2]];
      const tl = Math.hypot(tv[0], tv[1], tv[2]) || 1e-9;
      const dx = (dot(tv, Fa.e) / tl) * th * Rb,
        dy = (dot(tv, Fa.d) / tl) * th * Rb;
      const phi = Math.atan2(dot(Fb.e, Fa.d), dot(Fb.e, Fa.e));
      const c = Math.cos(phi),
        sn = Math.sin(phi);
      const PA = [
        [-a, -a],
        [a, -a],
        [a, a],
        [-a, a],
      ];
      const PB = PA.map((q) => [dx + q[0] * c - q[1] * sn, dy + q[0] * sn + q[1] * c]);
      // inner squares overlapping? (separating axis test)
      let best = Infinity,
        bn: number[] | null = null,
        sep = false;
      const axes = [
        [1, 0],
        [0, 1],
        [c, sn],
        [-sn, c],
      ];
      for (let ai = 0; ai < 4 && !sep; ai++) {
        const n = axes[ai];
        const pa = PA.map((q) => q[0] * n[0] + q[1] * n[1]),
          pb = PB.map((q) => q[0] * n[0] + q[1] * n[1]);
        const o1 = Math.max(...pa) - Math.min(...pb),
          o2 = Math.max(...pb) - Math.min(...pa);
        const ov = Math.min(o1, o2);
        if (ov <= 0) sep = true;
        else if (ov < best) {
          best = ov;
          bn = o1 < o2 ? n : [-n[0], -n[1]];
        }
      }
      let gap: number,
        nx = 0,
        ny = 0;
      if (!sep) {
        gap = -best - 2 * rr;
        nx = bn![0];
        ny = bn![1];
      } else {
        let md = Infinity;
        const test = (P: number[][], Q: number[][], flip: boolean) => {
          for (let i = 0; i < 4; i++)
            for (let j = 0; j < 4; j++) {
              const q = segPt(P[i][0], P[i][1], Q[j][0], Q[j][1], Q[(j + 1) % 4][0], Q[(j + 1) % 4][1]);
              const ddx = q[0] - P[i][0],
                ddy = q[1] - P[i][1];
              const dd = Math.hypot(ddx, ddy);
              if (dd < md) {
                md = dd;
                nx = (flip ? -ddx : ddx) / (dd || 1);
                ny = (flip ? -ddy : ddy) / (dd || 1);
              }
            }
        };
        test(PA, PB, false);
        test(PB, PA, true);
        gap = md - 2 * rr;
      }
      return { gap, n3: [0, 1, 2].map((x) => nx * Fa.e[x] + ny * Fa.d[x]) as V3 };
    };

    for (let pass = 0; pass < 12; pass++) {
      let any = false;
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const A = items[i],
            B = items[j];
          const ct = contact(A, B);
          if (!ct || ct.gap >= 0) continue;
          any = true;
          const n3 = ct.n3,
            m = (-ct.gap / 2 + 0.01) / Rb;
          for (let x = 0; x < 3; x++) {
            A.p[x] -= n3[x] * m;
            B.p[x] += n3[x] * m;
          }
          norm(A.p);
          norm(B.p);
          const rel = dot(B.v, n3) - dot(A.v, n3);
          if (rel < 0)
            for (let x = 0; x < 3; x++) {
              A.v[x] += n3[x] * rel;
              B.v[x] -= n3[x] * rel;
            }
        }
      if (!any) break;
    }
  }
}

// ---------------------------------------------------------------------------
// Covers without artwork get a painted stand-in, picked from the song title.
// ---------------------------------------------------------------------------

const PALETTES = [
  ["#DDE3F5", "#7F8FC4", "#FFFFFF", "#5D6CA3"],
  ["#A9DCD6", "#2F6F7E", "#FFEBC2", "#245866"],
  ["#D7EBC9", "#4E7A4A", "#F7FBEA", "#355E34"],
  ["#F8DDE3", "#B57C9B", "#FFFFFF", "#84506F"],
  ["#FFC7A1", "#6B4C8C", "#FFEBC7", "#4A3267"],
  ["#FFE3C4", "#E08A6B", "#FFFFFF", "#B8604B"],
  ["#C4D2D6", "#536A73", "#F2F6F7", "#3D525A"],
  ["#FFE6A6", "#C9782E", "#FFF8E0", "#9C5A22"],
];

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function paintedCover(seed: string) {
  const [a, b, sun, hill] = PALETTES[hash(seed) % PALETTES.length];
  return `radial-gradient(circle at 62% 30%, ${sun} 11%, rgba(255,255,255,0) 12%), radial-gradient(ellipse 60% 45% at 25% 104%, ${hill} 99%, rgba(0,0,0,0) 100%), linear-gradient(165deg, ${a}, ${b})`;
}

export function coverBackground(artworkUrl: string | null | undefined, seed: string) {
  return artworkUrl ? `url("${artworkUrl.replace(/"/g, "%22")}")` : paintedCover(seed);
}
