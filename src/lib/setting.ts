// Where you are, in broad strokes: the kind of place the Globe sits in, shown
// as a living scene behind it (components/globe/setting.ts).
//
// Worked out on the server (app/api/setting) from free map data: OpenStreetMap
// says how big the nearest town is, and Open-Meteo's elevation data says how
// high and how steep the land around you is. Only city and mountains have a
// scene so far; the rest keep the plain sky.

export type SettingKind = "city" | "mountain" | "coast" | "town" | "country";
export type SettingReply = { kind?: SettingKind; place?: string };

// The ones with a scene to show.
export const SCENES: SettingKind[] = ["city", "mountain"];

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

// ?setting=city (or mountain) shows that scene wherever you are, and
// ?setting=off shows none.
export function settingOverride(): SettingKind | "off" | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("setting");
  return q === "off" || q === "city" || q === "mountain" || q === "coast" || q === "town" || q === "country" ? q : null;
}
