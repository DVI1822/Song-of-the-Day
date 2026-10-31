// Halloween: a look the Globe wears for one day. Three takes to choose from:
//
//   pumpkin  Pumpkin Patch. A harvest moon in a plum dusk, a jack-o'-lantern
//            core glowing orange, bats flitting past, candle-orange buttons.
//   haunted  Haunted Fog. A cold green night, a ghost-light core, mist rolling
//            round the globe's feet and the odd ghost drifting through.
//   blood    Blood Moon. A huge red moon behind the globe, a crimson core,
//            a cobweb in the corner with its spider, embers rising.
//
// Only shows on October 31 by the viewer's own clock, so it takes itself
// down at their midnight. ?halloween=pumpkin|haunted|blood previews any of
// them on any day (and ?halloween=off hides it).

export type HalloweenName = "pumpkin" | "haunted" | "blood";

// The one that goes live on the day. null: none yet.
export const HALLOWEEN_PICK: HalloweenName | null = null;

export type HalloweenLook = {
  name: HalloweenName;
  sky: string; // the whole sky, behind everything
  core: string[]; // the core's light, in place of its neon
  accent: string; // the + button and badges
  accentRgb: string;
  title: string; // the title's colour
  titleFont: string; // a CSS font-family
  titleGlow: string; // its text-shadow
  titleSize: number;
};

const LOOKS: Record<HalloweenName, HalloweenLook> = {
  pumpkin: {
    name: "pumpkin",
    sky: "linear-gradient(180deg, #1A0B2E 0%, #3A1647 42%, #7A2E3A 78%, #C2552A 100%)",
    core: ["#FF8A1F", "#FFC24A", "#FF5A1F", "#FFE08A"],
    accent: "#F26B1D",
    accentRgb: "242,107,29",
    title: "#FFB347",
    titleFont: "var(--font-creepster), var(--font-outfit), sans-serif",
    titleGlow: "0 0 18px rgba(255,140,30,0.65), 0 2px 0 #5A1E06",
    titleSize: 32,
  },
  haunted: {
    name: "haunted",
    sky: "linear-gradient(180deg, #050B0A 0%, #0D1F1C 45%, #1E3A34 80%, #3F5F55 100%)",
    core: ["#9CFFD8", "#5EF2B4", "#C8FFF0", "#7FD8FF"],
    accent: "#2FBF8C",
    accentRgb: "47,191,140",
    title: "#D8FFF0",
    titleFont: "var(--font-gothic), serif",
    titleGlow: "0 0 22px rgba(120,255,210,0.7), 0 0 4px rgba(200,255,240,0.6)",
    titleSize: 30,
  },
  blood: {
    name: "blood",
    sky: "linear-gradient(180deg, #040103 0%, #14030A 45%, #2C0610 80%, #4A0A14 100%)",
    core: ["#FF2A3D", "#FF6B5A", "#B3122E", "#FF9A8A"],
    accent: "#C8102E",
    accentRgb: "200,16,46",
    title: "#FF3B4E",
    titleFont: "var(--font-nosifer), var(--font-outfit), sans-serif",
    titleGlow: "0 0 16px rgba(255,30,60,0.6), 0 2px 0 #3A0008",
    titleSize: 21,
  },
};

const isName = (q: string | null): q is HalloweenName => q === "pumpkin" || q === "haunted" || q === "blood";

let query: string | null | undefined;

// Which look is on right now, if any. Only in the browser.
export function halloween(): HalloweenLook | null {
  if (typeof window === "undefined") return null;
  if (query === undefined) query = new URLSearchParams(window.location.search).get("halloween");
  if (query === "off") return null;
  if (isName(query)) return LOOKS[query];
  const now = new Date();
  const onTheDay = now.getMonth() === 9 && now.getDate() === 31;
  return onTheDay && HALLOWEEN_PICK ? LOOKS[HALLOWEEN_PICK] : null;
}
