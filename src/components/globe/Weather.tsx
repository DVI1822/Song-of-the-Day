"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PRESETS, type Weather, type WeatherKind, type WeatherReply } from "@/lib/weather";

// The real weather where you are, laid over the day and night skies. This
// file finds it and draws the sky behind the Globe (a greyer sky, drifting
// clouds); the rain, snow, fog and lightning live in the Globe's 3D space,
// in weather3d.ts.
//
// Try any of it with ?weather=rain (or drizzle, storm, snow, cloudy, partly,
// fog, clear). The puddle fills fast in that mode so you can see it.

const REFRESH = 15 * 60_000;

export function override(): WeatherKind | null {
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
  const grey = weather.kind === "storm" ? 1 : wet ? 0.8 : Math.max(0, weather.cloud - 0.45) * 1.3;
  const puff = dark
    ? wet
      ? "rgba(52,60,78,0.85)"
      : "rgba(70,80,104,0.6)"
    : weather.kind === "storm"
      ? "#7D8894"
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
            background:
              weather.kind === "storm"
                ? dark
                  ? "linear-gradient(180deg, #10141E 0%, #0B0E16 60%, #07090F 100%)"
                  : "linear-gradient(180deg, #6F7C88 0%, #8F9AA5 45%, #B6BEC6 100%)"
                : dark
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
