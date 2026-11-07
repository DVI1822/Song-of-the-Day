// Where you are, in broad strokes: the kind of place the Globe sits in, shown
// as a living scene behind it (components/globe/setting.ts).
//
// Worked out on the server (app/api/setting) from free map data: OpenStreetMap
// says how big the nearest town is, and Open-Meteo's elevation data says how
// high and how steep the land around you is. City, mountains, coast and
// countryside have a scene so far; towns keep the plain sky.

export type SettingKind = "city" | "mountain" | "coast" | "town" | "country";
export type SettingReply = { kind?: SettingKind; place?: string };

// The ones with a scene to show.
export const SCENES: SettingKind[] = ["city", "mountain", "coast", "country"];

// elevation in metres at the middle, and the gap between the highest and
// lowest of the points around it (about 15 km out); population of the place
// you're in, if OpenStreetMap knows it
export function classify(o: { elevation: number | null; relief: number | null; population: number | null; placeType: string | null }): SettingKind {
  const pop = o.population ?? 0;
  const relief = o.relief ?? 0;
  const high = o.elevation ?? 0;
  const bigCity = pop >= 500_000;
  const city = pop >= 100_000 || (pop === 0 && o.placeType === "city");
  const mountains = relief >= 700 || (high >= 1200 && relief >= 350);
  if (bigCity) return "city";
  if (mountains) return "mountain";
  if (city) return "city";
  if (o.placeType === "town" || o.placeType === "suburb") return "town";
  return "country";
}

// The scene someone picked in Settings ("auto" or nothing: from where they
// are). Kept on the device.
export const SCENE_KEY = "tt-scene";
export type ScenePick = "auto" | "city" | "mountain" | "coast" | "country" | "off";
const PICKS: ScenePick[] = ["auto", "city", "mountain", "coast", "country", "off"];
export function scenePick(): ScenePick {
  try {
    const v = localStorage.getItem(SCENE_KEY) as ScenePick | null;
    return v && PICKS.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

// ?setting=city (or mountain, coast, country) shows that scene wherever you
// are, and ?setting=off shows none; otherwise the scene picked in Settings
export function settingOverride(): SettingKind | "off" | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("setting");
  if (q === "off" || q === "city" || q === "mountain" || q === "coast" || q === "town" || q === "country") return q;
  const p = scenePick();
  return p === "auto" ? null : p;
}
