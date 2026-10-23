// The sky's weather, from Open-Meteo's current conditions (WMO weather codes).
// https://open-meteo.com/en/docs

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";
export type Weather = {
  kind: WeatherKind;
  cloud: number; // 0..1 of the sky covered
  intensity: number; // 0..1 how hard it's coming down
  wind: number; // m/s, leans the rain
};
export type WeatherReply = { weather?: Weather; lat?: number; lon?: number; place?: string };

export function weatherFrom(code: number, cloudCover: number, precipitation: number, wind: number): Weather {
  const cloud = Math.max(0, Math.min(1, cloudCover / 100));
  const hard = (mm: number) => Math.max(0.2, Math.min(1, mm / 4));
  let kind: WeatherKind = "clear";
  if (code >= 95) kind = "storm";
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) kind = "snow";
  else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) kind = "rain";
  else if (code >= 51 && code <= 57) kind = "drizzle";
  else if (code === 45 || code === 48) kind = "fog";
  else if (code === 3) kind = "cloudy";
  else if (code === 2 || cloud > 0.35) kind = "partly";

  const intensity =
    kind === "storm" ? Math.max(0.7, hard(precipitation))
    : kind === "rain" ? Math.max(code === 65 || code === 82 ? 0.8 : code === 63 || code === 81 ? 0.5 : 0.3, hard(precipitation))
    : kind === "drizzle" ? 0.15
    : kind === "snow" ? Math.max(code === 75 || code === 86 ? 0.8 : code === 73 ? 0.5 : 0.3, hard(precipitation * 3))
    : 0;
  const wet = kind === "rain" || kind === "drizzle" || kind === "storm" || kind === "snow";
  return { kind, cloud: wet || kind === "fog" ? Math.max(cloud, 0.75) : kind === "cloudy" ? Math.max(cloud, 0.85) : cloud, intensity, wind };
}

// ?weather=rain (or drizzle, snow, storm, cloudy, partly, fog, clear) shows
// that weather instead of the real thing, for trying it out.
export const PRESETS: Record<WeatherKind, Weather> = {
  clear: { kind: "clear", cloud: 0, intensity: 0, wind: 2 },
  partly: { kind: "partly", cloud: 0.45, intensity: 0, wind: 3 },
  cloudy: { kind: "cloudy", cloud: 0.95, intensity: 0, wind: 4 },
  fog: { kind: "fog", cloud: 0.8, intensity: 0, wind: 1 },
  drizzle: { kind: "drizzle", cloud: 0.85, intensity: 0.15, wind: 2 },
  rain: { kind: "rain", cloud: 0.95, intensity: 0.55, wind: 4 },
  snow: { kind: "snow", cloud: 0.9, intensity: 0.5, wind: 2 },
  storm: { kind: "storm", cloud: 1, intensity: 0.9, wind: 9 },
};
