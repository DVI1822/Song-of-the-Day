import type { Weather } from "@/lib/weather";
import { PERSPECTIVE, TILT, camInv, camV, type Camera, type V3 } from "./math";

// Rain, snow, fog and lightning in the Globe's own 3D space. Everything here is
// a plain element inside the globe's preserve-3d world, so the browser sorts
// it against the songs: rain passes in front of the globe and behind it, and
// drops that hit the globe land on the songs, bead up, roll round with the
// spin and slide off. Underneath, a puddle (or snow) spreads across the floor
// the globe stands on, and drops ripple it. The floor is drawn on a canvas
// under the globe with the same perspective (browsers won't reliably paint a
// huge 3D plane); the floor is always below and behind the globe, so that's
// exact.
//
// Two layers: `fall` is turned back to face the camera (falling things go
// straight down the screen), `skin` turns with the globe (water on the songs).
// Positions are in px at zoom 1, centred on the globe.

type Drop = { el: HTMLDivElement; x: number; y: number; z: number; vx: number; vy: number; len: number; drip: boolean };
type Flake = { el: HTMLDivElement; x: number; y: number; z: number; vy: number; ph: number };
type Bead = { el: HTMLDivElement; p: V3; r: number; age: number; hold: number; v: number; life: number };
type Ring = { el: HTMLDivElement; a: V3; age: number };
type Fog = { el: HTMLDivElement; x: number; y: number; z: number; w: number };

export type WeatherFrame = {
  cam: Camera;
  zoom: number;
  show: number; // 0..1, fades it all out in song view and the core
  w: number;
  h: number;
  cx: number;
  cy: number;
  R: number; // where drops meet the songs
  floorY: number;
  dark: boolean;
};

const P = PERSPECTIVE;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const FLOOR_NEAR = 640;
const FLOOR_FAR = 1200;
const NEAR = 720; // closest anything comes, so nothing swells past the camera
const FAR = -1500;

function div(parent: HTMLElement, css: string) {
  const el = document.createElement("div");
  el.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;will-change:transform,opacity;${css}`;
  parent.appendChild(el);
  return el;
}

export class WeatherSim {
  private drops: Drop[] = [];
  private flakes: Flake[] = [];
  private beads: Bead[] = [];
  private rings: Ring[] = [];
  private fogs: Fog[] = [];
  private puddleRings: { x: number; z: number; age: number }[] = [];
  private blobs: { x: number; z: number; k: number }[];
  private bolt: HTMLDivElement;
  private level = 0; // 0..1 how far the puddle has spread
  private t = 0;
  private flash = 0;
  private boltT = 0;
  private nextBolt = rand(3, 8);
  private darkDrawn: boolean | null = null;
  private kindDrawn = "";
  private calm: number;
  private fast: boolean;

  constructor(
    private fall: HTMLElement,
    private skin: HTMLElement,
    private flashEl: HTMLElement | null,
    private floorCv: HTMLCanvasElement | null,
    fast: boolean,
  ) {
    this.calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;
    this.fast = fast;
    // the puddle's shape: a few overlapping pools, spreading most toward you
    this.blobs = [
      { x: 0, z: 0, k: 1 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: rand(-0.75, 0.75), z: rand(-0.35, 0.7), k: rand(0.45, 0.75) * (i < 3 ? 1 : 0.8) })),
    ];
    this.bolt = div(fall, "opacity:0;filter:drop-shadow(0 0 6px rgba(200,220,255,0.9)) drop-shadow(0 0 18px rgba(170,190,255,0.6))");
  }

  destroy() {
    this.fall.replaceChildren();
    this.skin.replaceChildren();
  }

  step(dt: number, wx: Weather | null, f: WeatherFrame) {
    this.t += dt;
    const kind = wx?.kind ?? "clear";
    const snow = kind === "snow";
    const storm = kind === "storm";
    const drizzle = kind === "drizzle";
    const wet = Boolean(wx && wx.intensity > 0);
    const fog = kind === "fog";
    if (kind !== this.kindDrawn || f.dark !== this.darkDrawn) this.restyle(kind, f.dark);

    // the floor fills while it's coming down, and dries off slowly after
    const fillTime = this.fast ? 25 : (snow ? 420 : 260) / Math.max(0.2, wx?.intensity ?? 1);
    this.level = clamp01(this.level + (wet ? dt / fillTime : -dt / 900));

    this.fall.style.opacity = this.skin.style.opacity = f.show.toFixed(3);
    if (f.show <= 0) {
      if (this.floorCv) this.floorCv.style.opacity = "0";
      return;
    }

    const { cam, zoom } = f;
    // turned back to face the camera, so things fall straight down the screen
    this.fall.style.transform = `rotateY(${(-cam.yaw).toFixed(4)}rad) rotateZ(${(-TILT).toFixed(4)}rad) rotateX(${(-cam.pitch).toFixed(4)}rad) rotateZ(${(-cam.roll).toFixed(4)}rad)`;
    // the visible box at depth z, in globe px (before zoom)
    const persp = (z: number) => (P - z * zoom) / (P * zoom);
    const halfW = (z: number) => (f.w / 2 + 80) * persp(z);
    const topY = (z: number) => -(f.cy + 80) * persp(z);
    const screenY = (y: number, z: number) => f.cy + (y * zoom * P) / (P - z * zoom);
    const area = clamp01((f.w * f.h) / (1440 * 900)) * 0.55 + 0.45;
    const intensity = wx?.intensity ?? 0;
    const wind = wx?.wind ?? 0;
    const lean = storm
      ? Math.max(-0.7, Math.min(0.7, 0.18 + wind / 18 + 0.22 * Math.sin(this.t * 0.55) + 0.08 * Math.sin(this.t * 1.7)))
      : drizzle
        ? 0.05 + wind / 60
        : Math.min(0.25, wind / 40);
    const Rh = f.R;
    const Rh2 = Rh * Rh;
    const down = camInv([0, 1, 0], cam);
    const floorRad = 60 + this.level * 860;

    // ---------------------------------------------------------------- rain
    const wantDrops = !wet || snow ? 0 : Math.round((storm ? 480 : drizzle ? 260 : 170 + 230 * intensity) * area * this.calm);
    while (this.drops.filter((d) => !d.drip).length < wantDrops) this.drops.push(this.newDrop(halfW, topY, false));
    let spare = this.drops.filter((d) => !d.drip).length - wantDrops;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const py = d.y;
      d.y += d.vy * dt;
      d.x += (d.drip ? d.vx : d.vy * lean) * dt;
      if (d.drip) d.vy = Math.min(1400, d.vy + 1800 * dt);

      let done = false;
      // landing on the globe: a splash on the songs, sometimes a drop that stays
      if (!d.drip && d.x * d.x + d.z * d.z < Rh2) {
        const hit = -Math.sqrt(Rh2 - d.x * d.x - d.z * d.z);
        if (py < hit && d.y >= hit) {
          const at = camInv([d.x / Rh, hit / Rh, d.z / Rh], cam);
          if (Math.random() < 0.55) this.ring(at);
          if (Math.random() < (storm ? 0.3 : drizzle ? 0.35 : 0.4) && this.beads.length < 130)
            this.bead(at, drizzle ? rand(1.6, 3) : rand(2.2, 5.2), false);
          done = true;
        }
      }
      if (!done && d.y >= f.floorY) {
        if (Math.hypot(d.x, d.z) < floorRad * 0.9 && this.level > 0.02 && Math.random() < (d.drip ? 1 : 0.5))
          if (this.puddleRings.length < 120) this.puddleRings.push({ x: d.x, z: d.z, age: 0 });
        done = true;
      }
      if (!done && screenY(d.y - d.len, d.z) > f.h + 40) done = true;
      if (done) {
        if (d.drip || spare > 0) {
          if (!d.drip) spare--;
          d.el.remove();
          this.drops.splice(i, 1);
          continue;
        }
        this.resetDrop(d, halfW, topY);
      }
      const behind = d.z < 0 && d.x * d.x + d.y * d.y < Rh2;
      const a = (storm ? 0.85 : drizzle ? 0.55 : 0.75) * (0.3 + 0.7 * clamp01((d.z - FAR) / (NEAR - FAR))) * (behind ? 0.3 : 1);
      const ang = d.drip ? 0 : -Math.atan(lean);
      d.el.style.opacity = a.toFixed(2);
      d.el.style.transform = `translate3d(${d.x.toFixed(1)}px,${(d.y - d.len).toFixed(1)}px,${d.z.toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
    }

    // ---------------------------------------------------------------- snow
    const wantFlakes = snow ? Math.round((110 + 180 * intensity) * area * this.calm) : 0;
    while (this.flakes.length < wantFlakes) this.flakes.push(this.newFlake(halfW, topY));
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const s = this.flakes[i];
      const py = s.y;
      s.y += s.vy * dt;
      s.x += (Math.sin(this.t * 1.1 + s.ph) * 22 + wind * 5) * dt;
      let done = false;
      if (s.x * s.x + s.z * s.z < Rh2) {
        const hit = -Math.sqrt(Rh2 - s.x * s.x - s.z * s.z);
        if (py < hit && s.y >= hit) {
          if (Math.random() < 0.6 && this.beads.length < 160) this.bead(camInv([s.x / Rh, hit / Rh, s.z / Rh], cam), rand(1.2, 2.6), true);
          done = true;
        }
      }
      if (!done && (s.y >= f.floorY || screenY(s.y, s.z) > f.h + 20)) done = true;
      if (done) {
        if (this.flakes.length > wantFlakes) {
          s.el.remove();
          this.flakes.splice(i, 1);
          continue;
        }
        Object.assign(s, this.flakeSpot(halfW, topY));
      }
      const behind = s.z < 0 && s.x * s.x + s.y * s.y < Rh2;
      s.el.style.opacity = ((0.5 + 0.5 * clamp01((s.z - FAR) / (NEAR - FAR))) * (behind ? 0.3 : 1)).toFixed(2);
      s.el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,${s.z.toFixed(1)}px)`;
    }

    // ------------------------------------------------- water on the songs
    for (let i = this.beads.length - 1; i >= 0; i--) {
      const b = this.beads[i];
      b.age += dt;
      const n = b.p;
      const gn = dot(down, n);
      const t: V3 = [down[0] - gn * n[0], down[1] - gn * n[1], down[2] - gn * n[2]];
      const tl = Math.hypot(t[0], t[1], t[2]) || 1;
      let gone = b.age > b.life;
      if (b.life < 999 && b.age > b.hold) {
        // it lets go and runs down the songs, then drips off underneath
        b.v = Math.min(170, b.v + 230 * dt * (b.r / 2.6));
        const k = (b.v * dt) / Rh / tl;
        n[0] += t[0] * k;
        n[1] += t[1] * k;
        n[2] += t[2] * k;
        const l = Math.hypot(n[0], n[1], n[2]);
        n[0] /= l;
        n[1] /= l;
        n[2] /= l;
        if (dot(down, n) > 0.3) {
          const c = camV([n[0] * Rh, n[1] * Rh, n[2] * Rh], cam);
          if (camV(n, cam)[2] > -0.3) this.drip(c, b.v);
          gone = true;
        }
      }
      if (gone) {
        b.el.remove();
        this.beads.splice(i, 1);
        continue;
      }
      const sla = -n[1],
        cla = Math.sqrt(Math.max(0, 1 - sla * sla)),
        lon = Math.atan2(n[0], n[2]),
        slo = Math.sin(lon),
        clo = Math.cos(lon);
      const ex: V3 = [clo, 0, -slo],
        ey: V3 = [sla * slo, cla, sla * clo];
      const rot = Math.atan2(-dot(t, ex), dot(t, ey));
      const stretch = 1 + Math.min(0.9, b.v / 110);
      const melt = b.life < 999 ? clamp01((b.life - b.age) / 1.2) : 1;
      b.el.style.opacity = (Math.min(1, b.age * 5) * melt).toFixed(2);
      b.el.style.transform = `rotateY(${lon.toFixed(4)}rad) rotateX(${Math.asin(sla).toFixed(4)}rad) translateZ(${(Rh + 0.6).toFixed(1)}px) rotateZ(${rot.toFixed(3)}rad) scale(1,${stretch.toFixed(2)})`;
    }

    // ------------------------------------------------------------- ripples
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const life = 0.35;
      if (r.age > life) {
        r.el.remove();
        this.rings.splice(i, 1);
        continue;
      }
      const k = r.age / life;
      r.el.style.opacity = ((1 - k) * 0.9).toFixed(2);
      {
        const n = r.a,
          sla = -n[1],
          lon = Math.atan2(n[0], n[2]);
        r.el.style.transform = `rotateY(${lon.toFixed(4)}rad) rotateX(${Math.asin(sla).toFixed(4)}rad) translateZ(${(Rh + 0.8).toFixed(1)}px) scale(${(0.2 + 1.2 * k).toFixed(3)})`;
      }
    }

    // --------------------------------------------------------------- floor
    this.paintFloor(dt, f, snow || (this.kindDrawn === "snow" && !wet), floorRad);

    // ----------------------------------------------------------------- fog
    const wantFog = fog ? 12 : 0;
    while (this.fogs.length < wantFog) {
      const z = rand(-1300, 450);
      const w = rand(500, 1000);
      this.fogs.push({ el: div(this.fall, `width:${w}px;height:${w * 0.28}px;left:${-w / 2}px;top:${-w * 0.14}px`), x: rand(-1, 1) * halfW(z), y: f.floorY - rand(-30, 220), z, w });
      this.restyle(kind, f.dark, true);
    }
    while (this.fogs.length > wantFog) this.fogs.pop()!.el.remove();
    for (const g of this.fogs) {
      g.x += (8 + wind * 4) * dt;
      if (g.x - g.w / 2 > halfW(g.z)) g.x = -halfW(g.z) - g.w / 2;
      g.el.style.transform = `translate3d(${g.x.toFixed(1)}px,${g.y.toFixed(1)}px,${g.z.toFixed(1)}px)`;
    }

    // ----------------------------------------------------------- lightning
    if (storm) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = rand(5, 14);
        this.flash = 1;
        this.boltT = 0.42;
        this.strike(halfW, topY, f.floorY);
      }
    }
    if (this.boltT > 0) {
      this.boltT = Math.max(0, this.boltT - dt);
      // a strike flickers: on, off, on again, gone
      const k = this.boltT;
      this.bolt.style.opacity = k > 0.34 ? "1" : k > 0.27 ? "0.15" : k > 0.12 ? "0.9" : (k / 0.12).toFixed(2);
    }
    if (this.flashEl) {
      this.flash = Math.max(0, this.flash - dt * 1.8);
      const k = this.flash;
      this.flashEl.style.opacity = (k > 0.8 ? 0.55 : k > 0.7 ? 0.1 : k * 0.45).toFixed(3);
    }
  }

  // ------------------------------------------------------------------------

  private newDrop(halfW: (z: number) => number, topY: (z: number) => number, drip: boolean): Drop {
    const el = div(this.fall, "width:1px;transform-origin:50% 100%");
    const d: Drop = { el, x: 0, y: 0, z: 0, vx: 0, vy: 0, len: 0, drip };
    this.resetDrop(d, halfW, topY, true);
    this.paintDrop(d);
    return d;
  }

  private resetDrop(d: Drop, halfW: (z: number) => number, topY: (z: number) => number, scatter = false) {
    const kind = this.kindDrawn;
    d.z = rand(FAR, NEAR);
    d.x = rand(-1.2, 1) * halfW(d.z);
    d.y = topY(d.z) - (scatter ? rand(-1.6, 0.1) * Math.abs(topY(d.z)) : rand(0, 200));
    d.vy = kind === "storm" ? rand(1500, 1900) : kind === "drizzle" ? rand(520, 700) : rand(1000, 1300);
    d.len = kind === "storm" ? rand(44, 70) : kind === "drizzle" ? rand(9, 15) : rand(26, 44);
    d.el.style.height = d.len.toFixed(0) + "px";
  }

  private paintDrop(d: Drop) {
    const c = this.darkDrawn ? "195,214,242" : "58,84,110";
    d.el.style.width = this.kindDrawn === "storm" ? "1.8px" : this.kindDrawn === "drizzle" ? "1.1px" : "1.5px";
    d.el.style.background = `linear-gradient(rgba(${c},0), rgba(${c},0.95))`;
  }

  private drip(c: V3, v: number) {
    if (this.drops.length > 600) return;
    const el = div(this.fall, "width:1.6px;transform-origin:50% 100%;border-radius:1px");
    const d: Drop = { el, x: c[0], y: c[1], z: c[2], vx: 0, vy: v + 150, len: 7, drip: true };
    el.style.height = "7px";
    this.paintDrop(d);
    this.drops.push(d);
  }

  private newFlake(halfW: (z: number) => number, topY: (z: number) => number): Flake {
    const r = rand(1.6, 4.2);
    const el = div(this.fall, `width:${r * 2}px;height:${r * 2}px;left:${-r}px;top:${-r}px;border-radius:50%`);
    const f: Flake = { el, ph: rand(0, 6.3), ...this.flakeSpot(halfW, topY, true) };
    this.paintFlake(f);
    return f;
  }

  private flakeSpot(halfW: (z: number) => number, topY: (z: number) => number, scatter = false) {
    const z = rand(FAR, NEAR);
    return { z, x: rand(-1.1, 1.1) * halfW(z), y: topY(z) - (scatter ? rand(-1.6, 0.1) * Math.abs(topY(z)) : rand(0, 120)), vy: rand(40, 85) };
  }

  private paintFlake(f: Flake) {
    f.el.style.background = this.darkDrawn
      ? "radial-gradient(circle, rgba(232,240,255,0.95) 35%, rgba(232,240,255,0) 72%)"
      : "radial-gradient(circle, #FFFFFF 40%, rgba(255,255,255,0) 72%), radial-gradient(circle, rgba(120,140,160,0.35) 55%, rgba(120,140,160,0) 75%)";
  }

  private bead(p: V3, r: number, snow: boolean) {
    const el = div(this.skin, `width:${r * 2}px;height:${r * 2}px;left:${-r}px;top:${-r}px;border-radius:50%;backface-visibility:hidden;-webkit-backface-visibility:hidden;opacity:0`);
    el.style.background = snow
      ? "radial-gradient(circle, rgba(255,255,255,1) 45%, rgba(255,255,255,0) 75%)"
      : this.darkDrawn
        ? "radial-gradient(circle at 34% 30%, rgba(235,245,255,0.95) 0 14%, rgba(200,220,255,0.16) 26%, rgba(150,180,230,0.08) 58%, rgba(210,228,255,0.55) 72%, rgba(210,228,255,0) 80%)"
        : "radial-gradient(circle at 34% 30%, rgba(255,255,255,1) 0 14%, rgba(255,255,255,0.25) 26%, rgba(200,220,235,0.12) 56%, rgba(13,42,63,0.3) 70%, rgba(255,255,255,0.8) 76%, rgba(255,255,255,0) 82%)";
    if (!snow) el.style.boxShadow = `0 ${(r * 0.4).toFixed(1)}px ${(r * 0.7).toFixed(1)}px rgba(13,42,63,${this.darkDrawn ? 0.35 : 0.22})`;
    this.beads.push({ el, p: [...p] as V3, r, age: 0, hold: snow ? 0 : rand(0.8, 5), v: 0, life: snow ? rand(18, 40) : 999 });
  }

  // The puddle, seen in perspective on the floor: a few overlapping pools
  // that spread from under the globe, darker in the middle, the sky shining
  // off the far side, a wet rim, and rings where drops land.
  private paintFloor(dt: number, f: WeatherFrame, snow: boolean, rad: number) {
    const cv = this.floorCv;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(f.w * dpr) || cv.height !== Math.round(f.h * dpr)) {
      cv.width = Math.round(f.w * dpr);
      cv.height = Math.round(f.h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, f.w, f.h);
    cv.style.opacity = f.show.toFixed(3);
    if (this.level <= 0.002 || f.show <= 0) {
      this.puddleRings.length = 0;
      return;
    }
    const zoom = f.zoom,
      Y = f.floorY;
    const proj = (x: number, z: number): [number, number] => {
      const k = (zoom * P) / (P - Math.min(z, FLOOR_NEAR) * zoom);
      return [f.cx + x * k, f.cy + Y * k];
    };

    // the outline of all the pools together, `grow` px wider
    const shape = (grow: number) => {
      ctx.beginPath();
      for (const b of this.blobs) {
        const r = rad * b.k + grow,
          bx = b.x * rad,
          bz = b.z * rad;
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          const [sx, sy] = proj(bx + Math.cos(a) * r, Math.max(-FLOOR_FAR, bz + Math.sin(a) * r * 0.9));
          if (i) ctx.lineTo(sx, sy);
          else ctx.moveTo(sx, sy);
        }
        ctx.closePath();
      }
    };
    const top = proj(0, -FLOOR_FAR)[1],
      bottom = f.h;
    const op = clamp01(this.level * 6);
    ctx.globalAlpha = op;
    if (snow) {
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, f.dark ? "rgba(190,204,230,0.9)" : "rgba(236,242,248,0.97)");
      g.addColorStop(1, f.dark ? "rgba(225,233,248,0.95)" : "rgba(255,255,255,0.99)");
      ctx.fillStyle = g;
      shape(0);
      ctx.fill("nonzero");
    } else {
      const c = f.dark ? "40,64,110" : "86,122,155";
      const sc = f.dark ? "150,175,225" : "236,244,250";
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, `rgba(${sc},0.75)`);
      g.addColorStop(0.18, `rgba(${c},0.5)`);
      g.addColorStop(1, `rgba(${c},0.62)`);
      // a wet, bright rim, then the water
      ctx.fillStyle = f.dark ? "rgba(150,180,235,0.3)" : "rgba(255,255,255,0.75)";
      shape(10);
      ctx.fill("nonzero");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      shape(0);
      ctx.fill("nonzero");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = g;
      ctx.fill("nonzero");
      // the globe's dark reflection in the water, just under it
      const [rx, ry] = proj(0, 40);
      const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, f.R * zoom * 1.1);
      rg.addColorStop(0, f.dark ? "rgba(10,16,32,0.35)" : "rgba(30,55,80,0.22)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.clip("nonzero");
      ctx.fillStyle = rg;
      ctx.scale(1, 0.3);
      ctx.fillRect(0, 0, f.w, f.h / 0.3);
      ctx.restore();
      ctx.beginPath();
    }

    // rings where drops land
    ctx.globalAlpha = 1;
    for (let i = this.puddleRings.length - 1; i >= 0; i--) {
      const r = this.puddleRings[i];
      r.age += dt;
      if (r.age > 0.9 || snow) {
        this.puddleRings.splice(i, 1);
        continue;
      }
      const k = r.age / 0.9;
      const [x, y] = proj(r.x, r.z);
      const ry2 = proj(r.x, r.z + 10)[1] - y;
      const kk = (zoom * P) / (P - r.z * zoom);
      ctx.strokeStyle = f.dark ? `rgba(200,220,255,${(0.6 * (1 - k)).toFixed(3)})` : `rgba(255,255,255,${(0.85 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.5, (3 + 20 * k) * kk), Math.max(0.3, (3 + 20 * k) * Math.abs(ry2) / 10), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private ring(a: V3) {
    if (this.rings.length > 90) return;
    const size = 14;
    const el = div(this.skin, `width:${size}px;height:${size}px;left:${-size / 2}px;top:${-size / 2}px;border-radius:50%;backface-visibility:hidden;-webkit-backface-visibility:hidden`);
    el.style.border = `1px solid ${this.darkDrawn ? "rgba(200,220,255,0.8)" : "rgba(255,255,255,0.95)"}`;
    this.rings.push({ el, a: [...a] as V3, age: 0 });
  }

  private strike(halfW: (z: number) => number, topY: (z: number) => number, floorY: number) {
    const z = rand(-1500, -900);
    const top = topY(z) * 0.95;
    const height = floorY - top;
    const x0 = rand(-0.6, 0.6) * halfW(z);
    let x = 0;
    const pts: string[] = [];
    const branch: string[] = [];
    for (let i = 0, n = 14; i <= n; i++) {
      pts.push(`${(x + 120).toFixed(1)},${((height * i) / n).toFixed(1)}`);
      if (i === 5) for (let j = 0, bx = x; j < 5; j++) branch.push(`${((bx += rand(8, 26)) + 120).toFixed(1)},${((height * (i + j * 0.7)) / n).toFixed(1)}`);
      x += rand(-28, 28);
    }
    this.bolt.innerHTML = `<svg width="240" height="${height.toFixed(0)}" style="overflow:visible"><polyline points="${pts.join(" ")}" fill="none" stroke="#F4F7FF" stroke-width="2.4" stroke-linejoin="round"/><polyline points="${pts[5]} ${branch.join(" ")}" fill="none" stroke="#F4F7FF" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
    this.bolt.style.transform = `translate3d(${(x0 - 120).toFixed(1)}px,${top.toFixed(1)}px,${z.toFixed(1)}px)`;
  }

  private restyle(kind: string, dark: boolean, fogOnly = false) {
    if (!fogOnly) {
      this.kindDrawn = kind;
      this.darkDrawn = dark;
      for (const d of this.drops) this.paintDrop(d);
      for (const f of this.flakes) this.paintFlake(f);
    }
    const fog = dark
      ? "radial-gradient(closest-side, rgba(150,160,185,0.3), rgba(150,160,185,0))"
      : "radial-gradient(closest-side, rgba(255,255,255,0.75), rgba(255,255,255,0))";
    for (const g of this.fogs) g.el.style.background = fog;
  }
}
