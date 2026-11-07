"use client";

import { useState, useSyncExternalStore } from "react";
import { locateNow } from "@/components/globe/Locate";
import { SCENE_KEY, scenePick, type ScenePick } from "@/lib/setting";

// Which drawing sits behind your Globe: worked out from where you are, or
// one you'd rather have. Kept on this device.
const OPTIONS: [ScenePick, string][] = [
  ["auto", "Where I am"],
  ["mountain", "Mountains"],
  ["coast", "Coast"],
  ["country", "Farmland"],
  ["city", "City"],
  ["off", "None"],
];

const heard = new Set<() => void>();
const store = {
  subscribe: (f: () => void) => (heard.add(f), () => void heard.delete(f)),
  get: scenePick,
  server: () => null,
};

export function ScenePicker() {
  const pick = useSyncExternalStore(store.subscribe, store.get, store.server);
  const [note, setNote] = useState("");
  const choose = (p: ScenePick) => {
    setNote("");
    try {
      if (p === "auto") localStorage.removeItem(SCENE_KEY);
      else localStorage.setItem(SCENE_KEY, p);
    } catch {}
    heard.forEach((f) => f());
  };
  const locate = () => {
    setNote("Finding you…");
    locateNow((ok) =>
      setNote(ok ? "Got it. Your Globe will show where you are." : "Location is off for TopTrack. You can turn it on in your phone's settings."),
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">The drawing behind your Globe, with your real sky and weather.</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => choose(p)}
            aria-pressed={pick === p}
            className={`h-10 rounded-full border px-4 text-sm font-semibold ${pick === p ? "border-accent bg-accent text-white" : "border-line text-card-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {pick === "auto" && (
        <button type="button" onClick={locate} className="self-start text-sm font-semibold text-accent underline underline-offset-2">
          Use my phone&apos;s location
        </button>
      )}
      {note && <p className="text-xs text-card-muted">{note}</p>}
    </div>
  );
}
