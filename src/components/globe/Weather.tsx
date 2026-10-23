"use client";

import { useEffect, useRef, useState } from "react";
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

// A calm overcast: the sky greys over, and one soft bank of cloud drifts very
// slowly across the top. No separate cloud shapes, nothing that pops in.
export function WeatherSky({ weather, dark }: { weather: Weather | null; dark: boolean }) {
  if (!weather || weather.kind === "clear") return null;
  const storm = weather.kind === "storm";
  const wet = weather.intensity > 0 || weather.kind === "fog";
  const grey = storm ? 1 : wet ? 0.8 : Math.max(0, weather.cloud - 0.4) * 1.2;
  const bank = Math.min(1, weather.cloud) * (dark ? 0.5 : 0.7);
  const cloud = dark ? (storm ? "20,24,34" : "58,66,84") : storm ? "120,132,144" : wet ? "176,188,198" : "255,255,255";
  const drift = Math.round(360 / (1 + weather.wind / 8));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {grey > 0 && (
        <div
          className="absolute inset-0 transition-opacity duration-[3000ms]"
          style={{
            opacity: Math.min(1, grey) * (dark ? 0.7 : 0.75),
            background: storm
              ? dark
                ? "linear-gradient(180deg, #10141E 0%, #0B0E16 60%, #07090F 100%)"
                : "linear-gradient(180deg, #7C8894 0%, #9AA5AF 45%, #BEC6CD 100%)"
              : dark
                ? "linear-gradient(180deg, #1B2130 0%, #121722 60%, #0B0F18 100%)"
                : "linear-gradient(180deg, #B3BEC8 0%, #CCD4DB 45%, #E4E8EB 100%)",
          }}
        />
      )}
      {bank > 0.05 && (
        <div
          className="absolute inset-x-0 top-0 h-[55%]"
          style={{
            opacity: bank,
            maskImage: "linear-gradient(180deg, #000 30%, transparent)",
            WebkitMaskImage: "linear-gradient(180deg, #000 30%, transparent)",
          }}
        >
          {/* two copies side by side, sliding left forever, so it never jumps */}
          <div className="absolute inset-y-0 left-0 flex w-[200%]" style={{ animation: `sky-drift ${drift}s linear infinite` }}>
            {[0, 1].map((k) => (
              <div
                key={k}
                className="h-full w-1/2"
                style={{
                  filter: "blur(24px)",
                  background: [
                    `radial-gradient(ellipse 38% 30% at 12% 28%, rgba(${cloud},0.9), rgba(${cloud},0))`,
                    `radial-gradient(ellipse 30% 26% at 40% 18%, rgba(${cloud},0.75), rgba(${cloud},0))`,
                    `radial-gradient(ellipse 42% 32% at 68% 32%, rgba(${cloud},0.85), rgba(${cloud},0))`,
                    `radial-gradient(ellipse 30% 24% at 92% 20%, rgba(${cloud},0.7), rgba(${cloud},0))`,
                  ].join(","),
                }}
              />
            ))}
          </div>
        </div>
      )}
      {weather.kind === "fog" && (
        <div
          className="absolute inset-0"
          style={{
            background: dark
              ? "linear-gradient(180deg, rgba(120,130,150,0.04) 10%, rgba(120,130,150,0.22) 70%, rgba(120,130,150,0.3))"
              : "linear-gradient(180deg, rgba(255,255,255,0.08) 10%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0.65))",
          }}
        />
      )}
    </div>
  );
}
