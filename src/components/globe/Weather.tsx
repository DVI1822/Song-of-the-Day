"use client";

import { useEffect, useRef, useState } from "react";
import { PRESETS, type Weather, type WeatherKind, type WeatherReply } from "@/lib/weather";
import type { Season } from "./scene";

// The real weather where you are, laid over the day and night skies. This
// file finds it and greys the sky behind the Globe; the clouds, rain, snow,
// mist and lightning live in the Globe's 3D space, in scene.ts.
//
// Try any of it with ?weather=rain (or drizzle, storm, snow, cloudy, partly,
// fog, clear). Seasonal things come along more often in that mode.

const REFRESH = 15 * 60_000;

export function override(): WeatherKind | null {
  const q = new URLSearchParams(window.location.search).get("weather");
  return q && q in PRESETS ? (q as WeatherKind) : null;
}

// ?season=autumn (or winter, spring, summer) and ?temp=-3 try those out too.
export function seasonOverride(): Season | null {
  const q = new URLSearchParams(window.location.search).get("season");
  return q === "spring" || q === "summer" || q === "autumn" || q === "winter" ? q : null;
}
export function tempOverride(): number | null {
  const q = new URLSearchParams(window.location.search).get("temp");
  return q !== null && q !== "" && Number.isFinite(Number(q)) ? Number(q) : null;
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

// The sky greys over with cloud and rain. The clouds themselves, and
// everything else, are drawn in the Globe's 3D space (scene.ts).
export function WeatherSky({ weather, dark }: { weather: Weather | null; dark: boolean }) {
  if (!weather || weather.kind === "clear") return null;
  const storm = weather.kind === "storm";
  const wet = weather.intensity > 0 || weather.kind === "fog";
  const grey = storm ? 1 : wet ? 0.8 : Math.max(0, weather.cloud - 0.4) * 1.2;
  if (grey <= 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 transition-opacity duration-[3000ms]"
      aria-hidden
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
  );
}
