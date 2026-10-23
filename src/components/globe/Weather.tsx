"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PRESETS, type Weather, type WeatherKind, type WeatherReply } from "@/lib/weather";

// The real weather where you are, laid over the day and night skies: clouds
// drift by, fog hangs low, and rain or snow falls across the Globe. Raindrops
// bead up on the songs and slide off, and the bottom of the screen slowly
// fills into a puddle (or a snow drift) while it keeps coming down.
//
// Try any of it with ?weather=rain (or drizzle, storm, snow, cloudy, partly,
// fog, clear). The puddle fills fast in that mode so you can see it.

const REFRESH = 15 * 60_000;

function override(): WeatherKind | null {
  const q = new URLSearchParams(window.location.search).get("weather");
  return q && q in PRESETS ? (q as WeatherKind) : null;
}

export function useWeather(onPlace: (lat: number, lon: number) => void) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const placed = useRef(onPlace);
  useEffect(() => {
    placed.current = onPlace;
  });

  useEffect(() => {
    const forced = override();
    let coords = "";
    let on = true;
    const load = () =>
      fetch(`/api/weather${coords}`)
        .then((r) => (r.ok ? (r.json() as Promise<WeatherReply>) : null))
        .then((w) => {
          if (!on || !w) return;
          if (w.lat !== undefined && w.lon !== undefined) placed.current(w.lat, w.lon);
          if (!forced && w.weather) setWeather(w.weather);
        })
        .catch(() => {});
    // The device's own location if it's already been allowed; otherwise the
    // server goes by the network, with no prompt.
    const located = () =>
      navigator.geolocation.getCurrentPosition(
        (g) => {
          coords = `?lat=${g.coords.latitude.toFixed(2)}&lon=${g.coords.longitude.toFixed(2)}`;
          load();
        },
        () => load(),
      );
    if (!navigator.permissions) load();
    else
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((ps) => (ps.state === "granted" ? located() : load()))
        .catch(() => load());
    const t = setInterval(load, REFRESH);
    if (forced) queueMicrotask(() => on && setWeather(PRESETS[forced]));
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  return weather;
}

// ---------------------------------------------------------------------------
// Behind the Globe: a greyer sky, drifting clouds, fog
// ---------------------------------------------------------------------------

const PUFFS = [
  [0, 30, 90, 40],
  [50, 8, 100, 60],
  [120, 22, 90, 46],
  [30, 40, 150, 30],
];

export function WeatherSky({ weather, dark, w, h }: { weather: Weather | null; dark: boolean; w: number; h: number }) {
  const clouds = useMemo(() => {
    if (!weather) return [];
    const n = Math.round(weather.cloud * 8);
    // spread out by index so they don't bunch up; fixed per weather
    return Array.from({ length: n }, (_, i) => {
      const r = (k: number) => {
        const x = Math.sin((i + 1) * 12.9898 * k + weather.cloud * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      const dur = (110 + 70 * r(1)) / (1 + weather.wind / 10);
      return { y: (0.02 + 0.5 * r(2)) * h, scale: 0.6 + 0.9 * r(3), dur, delay: -dur * ((i + r(4)) / n) };
    });
  }, [weather, h]);

  if (!weather || weather.kind === "clear") return null;
  const wet = weather.intensity > 0 || weather.kind === "fog";
  const grey = wet ? 0.8 : Math.max(0, weather.cloud - 0.45) * 1.3;
  const puff = dark
    ? wet
      ? "rgba(52,60,78,0.85)"
      : "rgba(70,80,104,0.6)"
    : wet
      ? "#B4BFC9"
      : weather.cloud > 0.8
        ? "#D3DBE2"
        : "#FFFFFF";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {grey > 0 && (
        <div
          className="absolute inset-0 transition-opacity duration-[3000ms]"
          style={{
            opacity: Math.min(1, grey) * (dark ? 0.7 : 0.75),
            background: dark
              ? "linear-gradient(180deg, #1B2130 0%, #121722 60%, #0B0F18 100%)"
              : "linear-gradient(180deg, #A9B5C0 0%, #C6CFD7 45%, #E2E6EA 100%)",
          }}
        />
      )}
      {clouds.map((c, i) => (
        <div
          key={i}
          className="absolute left-0 top-0"
          style={
            {
              "--x0": `-${260 * c.scale}px`,
              "--x1": `${w + 40}px`,
              "--y0": `${c.y}px`,
              "--y1": `${c.y + 12}px`,
              animation: `sky-travel ${c.dur}s linear ${c.delay}s infinite`,
            } as CSSProperties
          }
        >
          <div className="relative h-[70px] w-[220px] origin-top-left" style={{ transform: `scale(${c.scale})` }}>
            {PUFFS.map(([x, y, cw, ch], j) => (
              <div
                key={j}
                className="absolute rounded-full"
                style={{ left: x, top: y, width: cw, height: ch, background: `radial-gradient(closest-side, ${puff} 45%, transparent)` }}
              />
            ))}
          </div>
        </div>
      ))}
      {weather.kind === "fog" && (
        <div
          className="absolute inset-0"
          style={{
            background: dark
              ? "linear-gradient(180deg, rgba(120,130,150,0.05) 10%, rgba(120,130,150,0.32) 70%, rgba(120,130,150,0.45))"
              : "linear-gradient(180deg, rgba(255,255,255,0.1) 10%, rgba(255,255,255,0.65) 70%, rgba(255,255,255,0.8))",
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// In front of the Globe: rain, snow, drops on the songs, the puddle
// ---------------------------------------------------------------------------

export type GlobeSpot = { cx: number; cy: number; r: number; open: boolean };

type Streak = { x: number; y: number; v: number; len: number };
type Flake = { x: number; y: number; r: number; v: number; ph: number };
type Bead = { x: number; y: number; r: number; age: number; hold: number; vy: number };
type Ripple = { x: number; age: number };

export function WeatherFront({
  weather,
  dark,
  w,
  h,
  globe,
}: {
  weather: Weather | null;
  dark: boolean;
  w: number;
  h: number;
  globe: () => GlobeSpot;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ weather, dark, globe });
  useEffect(() => {
    live.current = { weather, dark, globe };
  });
  const falling = Boolean(weather && weather.intensity > 0);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || !falling) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;
    const fast = override() !== null;
    const maxLevel = Math.max(30, Math.min(64, h * 0.07));

    const streaks: Streak[] = [];
    const flakes: Flake[] = [];
    const beads: Bead[] = [];
    const ripples: Ripple[] = [];
    let level = 0;
    let flash = 0;
    let nextFlash = 4 + Math.random() * 8;
    let beadDebt = 0;
    let last = performance.now();
    let t = 0;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const { weather: wx, dark: night, globe: spot } = live.current;
      if (!wx) return;
      const snow = wx.kind === "snow";
      const drizzle = wx.kind === "drizzle";
      const g = spot();
      const lean = Math.max(-1, Math.min(1, wx.wind / 12)) * 0.35; // horizontal px per vertical px
      const surface = h - level;

      // the puddle (or drift) rises while it's coming down
      const fill = (fast ? 25 : 260 / Math.max(0.25, wx.intensity)) * (snow ? 1.6 : 1);
      level = Math.min(maxLevel, level + (maxLevel / fill) * dt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (snow) {
        const want = Math.round((40 + 140 * wx.intensity) * calm);
        while (flakes.length < want)
          flakes.push({ x: Math.random() * w, y: Math.random() * -h, r: 0.8 + Math.random() * 2, v: 25 + Math.random() * 45, ph: Math.random() * 6 });
        flakes.length = Math.min(flakes.length, want);
        ctx.fillStyle = night ? "rgba(225,233,248,0.85)" : "rgba(255,255,255,0.95)";
        ctx.strokeStyle = night ? "rgba(0,0,0,0)" : "rgba(150,170,190,0.35)";
        ctx.lineWidth = 0.5;
        for (const f of flakes) {
          f.y += f.v * dt;
          f.x += (Math.sin(t * 1.3 + f.ph) * 14 + wx.wind * 6) * dt;
          if (f.y > surface) {
            f.y = -5;
            f.x = Math.random() * w;
          }
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else {
        const want = Math.round((drizzle ? 45 : 50 + 170 * wx.intensity) * calm);
        while (streaks.length < want)
          streaks.push({ x: Math.random() * (w + 200) - 100, y: Math.random() * -h, v: 0, len: 0 });
        streaks.length = Math.min(streaks.length, want);
        ctx.strokeStyle = night ? "rgba(170,190,225,0.32)" : "rgba(90,115,140,0.32)";
        ctx.lineWidth = drizzle ? 0.7 : 1;
        ctx.beginPath();
        for (const s of streaks) {
          if (!s.v) {
            s.v = (drizzle ? 420 : 850) + Math.random() * 400;
            s.len = (drizzle ? 6 : 12) + Math.random() * (drizzle ? 6 : 14);
          }
          s.y += s.v * dt;
          s.x += s.v * lean * dt;
          if (s.y > surface) {
            if (level > 3 && Math.random() < 0.35) ripples.push({ x: s.x, age: 0 });
            s.y = -s.len - Math.random() * 60;
            s.x = Math.random() * (w + 200) - 100;
            s.v = 0;
          }
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.len * lean, s.y - s.len);
        }
        ctx.stroke();
      }

      // drops landing on the songs, then sliding off
      if (!g.open) {
        beadDebt += dt * (snow ? 1.5 : drizzle ? 1.5 : 2 + 6 * wx.intensity) * calm;
        while (beadDebt >= 1 && beads.length < 50) {
          beadDebt -= 1;
          const a = Math.random() * Math.PI * 2,
            d = Math.sqrt(Math.random()) * g.r * 0.95;
          beads.push({
            x: g.cx + Math.cos(a) * d,
            y: g.cy + Math.sin(a) * d,
            r: (snow ? 1.2 : 1.4) + Math.random() * (snow ? 1.6 : 2.4),
            age: 0,
            hold: 1.5 + Math.random() * 5,
            vy: 0,
          });
        }
        beadDebt = Math.min(beadDebt, 1);
      }
      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i];
        b.age += dt;
        if (!snow && b.age > b.hold) {
          b.vy = Math.min(220, b.vy + 260 * dt * (b.r / 3));
          b.y += b.vy * dt;
        }
        const life = snow ? b.hold + 2 : b.hold + 2.5;
        const out = g.open || b.age > life || Math.hypot(b.x - g.cx, b.y - g.cy) > g.r * 1.02;
        const alpha = Math.min(1, b.age * 4) * (out ? 0 : Math.min(1, (life - b.age) * 1.5));
        if (out && b.age > 0.3) {
          beads.splice(i, 1);
          continue;
        }
        if (snow) {
          ctx.fillStyle = `rgba(255,255,255,${(0.9 * alpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (b.vy > 20) {
          // a little wet trail behind a sliding drop
          ctx.strokeStyle = `rgba(255,255,255,${(0.18 * alpha).toFixed(3)})`;
          ctx.lineWidth = b.r * 0.9;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y - Math.min(30, b.vy * 0.12));
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,255,255,${(0.16 * alpha).toFixed(3)})`;
        ctx.strokeStyle = `rgba(${night ? "200,220,255" : "255,255,255"},${(0.7 * alpha).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * (1 + Math.min(0.5, b.vy / 300)), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${(0.9 * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.5, b.r * 0.28), 0, Math.PI * 2);
        ctx.fill();
      }

      // the puddle, or a snow drift
      if (level > 0.5) {
        const top = h - level;
        const wave = (x: number) =>
          snow
            ? top + Math.sin(x * 0.031) * 2.4 + Math.sin(x * 0.083 + 1.7) * 1.2
            : top + Math.sin(x * 0.02 + t * 1.5) * 1.1 + Math.sin(x * 0.051 - t * 2.3) * 0.6;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 6) ctx.lineTo(x, wave(x));
        ctx.lineTo(w, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, top, 0, h);
        if (snow) {
          grad.addColorStop(0, night ? "rgba(214,224,242,0.9)" : "rgba(255,255,255,0.97)");
          grad.addColorStop(1, night ? "rgba(170,185,215,0.9)" : "rgba(226,234,242,0.97)");
        } else {
          grad.addColorStop(0, night ? "rgba(70,95,140,0.45)" : "rgba(150,186,214,0.42)");
          grad.addColorStop(1, night ? "rgba(25,35,65,0.7)" : "rgba(98,138,176,0.55)");
        }
        ctx.fillStyle = grad;
        ctx.fill();
        // the shine along the surface
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) (x ? ctx.lineTo : ctx.moveTo).call(ctx, x, wave(x));
        ctx.strokeStyle = snow ? "rgba(255,255,255,0.9)" : night ? "rgba(190,210,255,0.45)" : "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1;
        ctx.stroke();

        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          rp.age += dt;
          if (rp.age > 0.7 || snow) {
            ripples.splice(i, 1);
            continue;
          }
          const k = rp.age / 0.7;
          ctx.strokeStyle = `rgba(255,255,255,${(0.55 * (1 - k)).toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(rp.x, wave(rp.x) + 2, 2 + 12 * k, 0.6 + 3 * k, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (ripples.length > 80) ripples.splice(0, ripples.length - 80);
      }

      // lightning
      if (wx.kind === "storm") {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flash = 1;
          nextFlash = 6 + Math.random() * 14;
        }
        if (flash > 0) {
          const f = flash > 0.75 ? 1 : flash > 0.6 ? 0.3 : flash;
          ctx.fillStyle = `rgba(255,255,255,${(0.45 * f).toFixed(3)})`;
          ctx.fillRect(0, 0, w, h);
          flash = Math.max(0, flash - dt * 2.2);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, cv.width, cv.height);
    };
  }, [falling, w, h]);

  if (!falling) return null;
  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 z-[5]" style={{ width: w, height: h }} />;
}
