"use client";

import { useEffect, useState } from "react";
import { LOCATED } from "./Weather";
import { scenePick } from "@/lib/setting";

// Asks once for the phone's location, so the scene behind the Globe (and the
// sky) is where you really are. Without it the server guesses from the
// network, and on a phone's data that's often the carrier's nearest big
// city. Saying no is fine: the guess stays, and Settings has a scene picker.

export const ASKED_KEY = "tt-locate-asked";

function asked() {
  try {
    return localStorage.getItem(ASKED_KEY) !== null;
  } catch {
    return true;
  }
}
function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {}
}

// The last place the phone itself said you were, kept on this device. A
// home-screen app on iPhone forgets that location was allowed and reports
// "ask again" every launch, and the Settings page has no Globe to hear the
// news, so without this the network's guess (often a far-off city) wins.
export const HERE_KEY = "tt-here";
export function rememberHere(lat: number, lon: number) {
  try {
    localStorage.setItem(HERE_KEY, JSON.stringify({ lat: +lat.toFixed(2), lon: +lon.toFixed(2), t: Date.now() }));
  } catch {}
}
export function rememberedHere(): { lat: number; lon: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(HERE_KEY) ?? "null") as { lat?: unknown; lon?: unknown } | null;
    return v && typeof v.lat === "number" && typeof v.lon === "number" ? { lat: v.lat, lon: v.lon } : null;
  } catch {
    return null;
  }
}

// share the phone's location with the sky and the scene
export function locateNow(done?: (ok: boolean) => void) {
  if (!("geolocation" in navigator)) return done?.(false);
  navigator.geolocation.getCurrentPosition(
    (g) => {
      rememberHere(g.coords.latitude, g.coords.longitude);
      window.dispatchEvent(
        new CustomEvent(LOCATED, {
          detail: { lat: g.coords.latitude, lon: g.coords.longitude },
        }),
      );
      done?.(true);
    },
    () => done?.(false),
    { maximumAge: 60 * 60_000, timeout: 15_000 },
  );
}

export function LocateCard() {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (asked() || scenePick() !== "auto" || !("geolocation" in navigator)) return;
    let on = true;
    const t = setTimeout(() => {
      const show = () => on && setAsk(true);
      if (!navigator.permissions) return show();
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((ps) => {
          // already allowed (the sky uses it) or turned off: nothing to ask
          if (ps.state === "prompt") show();
          else markAsked();
        })
        .catch(show);
    }, 1800);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, []);
  if (!ask) return null;

  const close = () => {
    markAsked();
    setAsk(false);
  };
  const allow = () => {
    setBusy(true);
    locateNow(() => {
      setBusy(false);
      close();
    });
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 cursor-default bg-[#0D2A3F]/30"
      />
      <div
        role="dialog"
        aria-label="Show where you are"
        className="rise-in relative flex w-full max-w-[380px] flex-col gap-3.5 rounded-[28px] border border-white/60 bg-white/[0.94] p-6 text-center text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.55)" }}
      >
        <PinIcon />
        <h2 className="display text-[24px] leading-tight">Show where you are</h2>
        <p className="text-[15px] leading-relaxed">
          Behind your Globe is a drawing of your kind of place: mountains, the coast, the suburbs, farmland or the city,
          with your real sky and weather. Your location only picks the scene. It&apos;s never shown to anyone.
        </p>
        <button
          type="button"
          onClick={allow}
          disabled={busy}
          className="mt-1 h-12 rounded-full bg-accent text-[15px] font-semibold text-white disabled:opacity-60"
        >
          Use my location
        </button>
        <button type="button" onClick={close} className="-mt-1 h-9 text-sm font-semibold text-muted">
          Not now
        </button>
      </div>
    </div>
  );
}

const PinIcon = () => (
  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
    <svg
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  </span>
);
