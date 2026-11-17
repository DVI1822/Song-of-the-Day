import type { Weather } from "@/lib/weather";
import type { SettingKind } from "@/lib/setting";
import { createDoodle } from "./doodle-engine";

// The doodle world: the backdrop behind the Globe since Nov 2026. A watercolor
// and wobbly-ink scene riding round a little planet, with its own sky, sun,
// moon, clouds and weather, all following the real ones. The drawing lives in
// doodle-engine.js (ported from the design demo); this wraps it for the app.
//
// Seven scenes, picked by where you are or in Settings (lib/setting.ts):
// coast, farm (countryside), suburbs (towns too), desert, woods, mountain, city.
// Every scene turns at the same locked speed and curve.

type DoodleScene = "coast" | "farm" | "suburbs" | "desert" | "woods" | "mountain" | "city";
type Engine = {
  setScene(k: DoodleScene): void;
  setInput(o: { el?: number; az?: number; kind?: string; lat?: number; lon?: number; date?: Date | null }): void;
  resize(w: number, h: number): void;
  frame(dt: number, t: number): void;
};

export function doodleScene(k: SettingKind | null): DoodleScene | null {
  switch (k) {
    case "coast":
    case "desert":
    case "woods":
    case "mountain":
    case "city":
      return k;
    case "country":
      return "farm";
    case "suburb":
    case "town":
      return "suburbs";
    default:
      return null;
  }
}

// the app's weather, in the doodle world's words: a hard storm of rain is a
// downpour, heavy snow in a strong wind a blizzard
function doodleWeather(w: Weather | null): string {
  if (!w) return "clear";
  switch (w.kind) {
    case "drizzle":
      return "rain";
    case "rain":
      return w.intensity >= 0.8 ? "downpour" : "rain";
    case "snow":
      return w.intensity >= 0.8 && w.wind >= 12 ? "blizzard" : "snow";
    default:
      return w.kind;
  }
}

export type DoodleFrame = {
  show: number;
  w: number;
  h: number;
  el: number; // the sun's height, radians
  az: number; // from north, clockwise, radians
  lat: number;
  lon: number;
  date: Date;
};

export class Doodle {
  private eng: Engine;
  private want: DoodleScene | null = null;
  private built: DoodleScene | null = null;
  private building = false;
  private lastShow = -1;
  private size = "";
  private t = 0;

  // throws when there's no WebGL2; the old backdrop stays then
  constructor(private root: HTMLDivElement) {
    this.eng = createDoodle(root) as Engine;
    root.style.opacity = "0";
  }

  // which scene to show, or null for none (the plain sky underneath)
  set(kind: SettingKind | null) {
    this.want = doodleScene(kind);
  }

  // whether a scene is up (the app hides its own sky and weather then)
  get on() {
    return this.want !== null && this.built === this.want && !this.building;
  }

  step(dt: number, wx: Weather | null, f: DoodleFrame) {
    const size = `${Math.round(f.w)}x${Math.round(f.h)}`;
    if (size !== this.size && f.w > 0 && f.h > 0) {
      this.size = size;
      this.eng.resize(f.w, f.h);
    }
    this.eng.setInput({
      el: (f.el * 180) / Math.PI,
      az: (((f.az * 180) / Math.PI) % 360 + 360) % 360,
      kind: doodleWeather(wx),
      lat: f.lat,
      lon: f.lon,
      date: f.date,
    });
    // building a scene takes a moment, so it waits for the hand font and
    // happens off the current frame
    if (this.want && this.want !== this.built && !this.building) {
      this.building = true;
      const k = this.want;
      const go = () => {
        try {
          this.eng.setScene(k);
          this.built = k;
        } catch (e) {
          console.error(e);
        }
        this.building = false;
      };
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      Promise.race([fonts ? fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(() => setTimeout(go, 30));
    }
    const show = this.on ? (f.show < 0.02 ? 0 : f.show) : 0;
    if (Math.abs(show - this.lastShow) > 0.005) {
      this.lastShow = show;
      this.root.style.opacity = show.toFixed(3);
      this.root.style.visibility = show === 0 ? "hidden" : "visible";
    }
    this.t += dt * 1000;
    if (show > 0) this.eng.frame(dt, this.t);
  }
}
