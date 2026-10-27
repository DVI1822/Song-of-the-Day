"use client";

import { useSyncExternalStore } from "react";
import type { GlobeApi } from "./api";
import { glass } from "./ui";

// What Song of the Day is, shown once on each device and again from the
// little ? at the top right. Closing it is also when we ask to send nudges,
// since browsers only ask after a tap.

const SEEN_KEY = "sotd-welcome-seen";
const subs = new Set<() => void>();
const seen = {
  get() {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return true;
    }
  },
  set() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    subs.forEach((f) => f());
  },
  sub(f: () => void) {
    subs.add(f);
    return () => void subs.delete(f);
  },
};
export const useWelcomeSeen = () => useSyncExternalStore(seen.sub, seen.get, () => true);

export function Welcome({ api, onClose }: { api: GlobeApi; onClose(): void }) {
  const close = () => {
    seen.set();
    enablePush(api, true);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center px-5">
      <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 cursor-default bg-[#0D2A3F]/30" />
      <div
        role="dialog"
        aria-label="Welcome to Song of the Day"
        className="rise-in relative flex w-full max-w-[380px] flex-col gap-3.5 text-center rounded-[28px] border border-white/60 bg-white/[0.94] p-6 text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.55)" }}
      >
        <h2 className="display text-[26px] leading-tight">Song of the Day</h2>
        <p className="text-[15px] leading-relaxed">
          <b>One song, every day.</b> Post the one that moved you most, and find the best music your friends found
          today. Your globe lives under your real sky, weather and all. Slow down, explore, and post how you really
          feel.
        </p>
        <p className="text-[15px] leading-relaxed">
          <b>How.</b> Spotify only for now. In Spotify, copy your song&apos;s link, tap + here and paste it. You get one
          repost a day, and it all resets at midnight (watch the countdown).
        </p>
        <p className="text-[15px] leading-relaxed">
          <b>Grow your world.</b> Share your link with more people. The more friends you bring, the more good music
          fills your globe.
        </p>
        <button type="button" onClick={close} className="mt-1.5 h-12 rounded-full bg-accent text-[15px] font-semibold text-white">
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}

// The little ? that brings it back.
type HelpProps = { dark: boolean; onClick(): void; buttonRef: (el: HTMLButtonElement | null) => void };
export function HelpButton({ dark, onClick, buttonRef }: HelpProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label="What is Song of the Day?"
      className="absolute right-3 top-[max(14px,env(safe-area-inset-top))] z-[430] flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
      style={glass(dark)}
    >
      ?
    </button>
  );
}

// Nudges at noon and 9 PM. With `ask`, a browser that hasn't been asked yet
// gets asked (this has to start right inside a tap); otherwise this only
// refreshes a subscription the person already allowed.
export async function enablePush(api: GlobeApi, ask: boolean) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!api.savePush || !key || typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default" && ask && (await Notification.requestPermission()) !== "granted") return;
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key) }));
    const json = sub.toJSON();
    if (json.keys?.p256dh && json.keys.auth) await api.savePush({ endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
  } catch {
    // no nudges on this browser; everything else carries on
  }
}

function fromBase64Url(s: string) {
  const b = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
