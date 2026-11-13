// The backdrops rendered in Blender: each place is a ring of real 3D ground
// around one 360° camera, so the loop has no seam. Every place comes as a few
// layers (far to near), each for summer, autumn and winter, by day and by
// night. Here they are stacked into the three sliding layers the globe
// already turns (LINE_PARALLAX), with night faded in as the sun goes down.

import type { Inks, LinePano } from "./line";
import type { Season } from "./scene";
import type { Light } from "./setting";
import type { WorldKind } from "./world";

// the rendered loop, in its own pixels
const BW = 3870,
  BH = 979;
// how much of the screen's height the loop fills, from the bottom
const FILL = 0.54;

// which files go in each of the three sliding layers, far to near
const GROUPS: Record<WorldKind, string[][]> = {
  mountain: [["far"], ["ski", "hills"], ["forest", "near", "front"]],
  coast: [["far"], ["bay"], ["near"]],
  farm: [["far", "hills"], ["fields"], ["near"]],
  woods: [["far", "hills"], ["lake"], ["near"]],
  desert: [["far"], ["mesas"], ["near"]],
  suburb: [["far"], ["blocks"], ["near"]],
  city: [["far"], ["downtown"], ["near"]],
};

type Shot = "summer" | "autumn" | "winter";
const shotFor = (s: Season): Shot => (s === "spring" ? "summer" : s);

type Set = { day: HTMLImageElement[][]; night: HTMLImageElement[][] };
const sets = new Map<string, Set | "loading" | "failed">();

function load(src: string) {
  return new Promise<HTMLImageElement>((ok, no) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => ok(im);
    im.onerror = no;
    im.src = src;
  });
}

// the images for a place and season, or null while they load (onReady is
// called once they're in, so the scene can repaint)
export function blenderSet(kind: WorldKind, season: Season, onReady: () => void): Set | null {
  const shot = shotFor(season);
  const key = `${kind}/${shot}`;
  const have = sets.get(key);
  if (have === "failed" || have === "loading") return null;
  if (have) return have;
  sets.set(key, "loading");
  const files = (tod: string) =>
    Promise.all(
      GROUPS[kind].map((g) => Promise.all(g.map((n) => load(`/backdrops/${kind}/${shot}-${n}-${tod}.webp`)))),
    );
  Promise.all([files("day"), files("night")])
    .then(([day, night]) => {
      sets.set(key, { day, night });
      onReady();
    })
    .catch(() => sets.set(key, "failed"));
  return null;
}

export function paintBlenderPano(set: Set, w: number, h: number, L: Light, I: Inks, dpr: number): LinePano {
  const k = (h * FILL) / BH;
  // never narrower than two screens, so the loop doesn't repeat on wide screens
  const kk = Math.max(k, (w * 2) / BW);
  const W = BW * kk,
    lh = BH * kk;
  const top = h - lh;
  const scale = Math.min(1.5, dpr);
  const night = Math.max(0, Math.min(1, L.night));
  const layers = set.day.map((dayIms, i) => {
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(W * scale);
    cv.height = Math.ceil(lh * scale);
    const g = cv.getContext("2d")!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const nightIms = set.night[i];
    dayIms.forEach((im, j) => {
      // day underneath, night laid over it as the light goes
      if (night < 0.99) {
        g.globalAlpha = 1;
        g.drawImage(im, 0, 0, cv.width, cv.height);
      }
      if (night > 0.01) {
        g.globalAlpha = night < 0.99 ? night : 1;
        g.drawImage(nightIms[j], 0, 0, cv.width, cv.height);
      }
    });
    g.globalAlpha = 1;
    return cv;
  });
  return {
    W,
    H: h,
    top,
    scale,
    layers,
    lays: [],
    I,
  };
}

// the drawn backdrops can still be had with ?backdrop=drawn
export function blenderOn() {
  if (typeof window === "undefined") return true;
  return new URLSearchParams(window.location.search).get("backdrop") !== "drawn";
}
