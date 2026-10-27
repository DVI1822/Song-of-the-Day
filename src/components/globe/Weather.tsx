"use client";

import { useEffect, useRef, useState } from "react";
import { PRESETS, type Weather, type WeatherKind, type WeatherReply } from "@/lib/weather";
import type { Season } from "./scene";
import { weatherSky } from "./sky";

// The real weather where you are, laid over the day and night skies. This
// file finds it and greys the sky behind the Globe; the clouds, rain, snow,
// mist and lightning live in the Globe's 3D space, in scene.ts.
//
// Try any of it with ?weather=rain (or drizzle, storm, snow, cloudy, partly,
// fog, clear), and any time of day with ?hour=7 (sky.ts). Seasonal things come
// along more often in that mode.

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
// ?hour=18.5 shows the sky at that time of day, today.
export function clockNow(): Date {
  const d = new Date();
  const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("hour");
  const h = q === null || q === "" ? NaN : Number(q);
  if (!Number.isFinite(h)) return d;
  d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
  return d;
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
    let at = 0;
    const load = () => {
      at = Date.now();
      return fetch(`/api/weather${coords}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<WeatherReply>) : null))
        .then((w) => {
          if (!on || !w) return;
          if (w.lat !== undefined && w.lon !== undefined) placed.current(w.lat, w.lon);
          if (!forced && w.weather) setWeather(w.weather);
        })
        .catch(() => {});
    };
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
    // coming back to the app (a phone keeps the tab asleep): check again if it's been a while
    const back = () => {
      if (document.visibilityState === "visible" && Date.now() - at > 5 * 60_000) load();
    };
    document.addEventListener("visibilitychange", back);
    if (forced) queueMicrotask(() => on && setWeather(PRESETS[forced]));
    return () => {
      on = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", back);
    };
  }, []);

  return weather;
}

// ---------------------------------------------------------------------------
// Behind the Globe: a greyer sky, drifting clouds, fog
// ---------------------------------------------------------------------------

// The sky greys over with cloud and rain (its colours are in sky.ts). The
// clouds themselves, and everything else, are drawn in the Globe's 3D space
// (scene.ts).
export function WeatherSky({ weather, dark, warm }: { weather: Weather | null; dark: boolean; warm: number }) {
  const sky = weatherSky(weather, dark ? 1 : 0, warm);
  if (!sky) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 transition-[opacity,background] duration-[3000ms]"
      aria-hidden
      style={{ opacity: sky.opacity, background: sky.bg }}
    />
  );
}
