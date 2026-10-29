"use client";

import { useState, useSyncExternalStore } from "react";

// Put Song of the Day on your home screen, offered once on each device right
// after the welcome card. Android's Chrome lets a site bring up its own
// install prompt, so there it's one tap; an iPhone only allows it from
// Safari's Share menu, so there we show the three steps. Nothing shows once
// it's already running from the home screen, or on a computer.

const SEEN_KEY = "sotd-install-seen";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome fires this early, often before the globe has drawn, so listen from
// the moment this file loads and keep it for when the card shows.
let deferred: InstallPrompt | null = null;
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    ping();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    markSeen();
  });
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {}
  ping();
}

type Kind = "prompt" | "ios" | "android" | null;

function kindNow(): Kind {
  try {
    if (localStorage.getItem(SEEN_KEY) === "1") return null;
  } catch {
    return null;
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || window.matchMedia("(display-mode: standalone)").matches) return null;
  if (deferred) return "prompt";
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

// whether this card still has something to show (the notifications card waits for it)
export const installPending = () => kindNow() !== null;

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export function InstallCard() {
  const kind = useSyncExternalStore(subscribe, kindNow, () => null);
  const [busy, setBusy] = useState(false);
  if (!kind) return null;

  const install = async () => {
    if (!deferred || busy) return;
    setBusy(true);
    const e = deferred;
    deferred = null;
    try {
      await e.prompt();
      await e.userChoice;
    } catch {}
    markSeen();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center px-5">
      <button type="button" aria-label="Close" onClick={markSeen} className="absolute inset-0 cursor-default bg-[#0D2A3F]/30" />
      <div
        role="dialog"
        aria-label="Add Song of the Day to your home screen"
        className="rise-in relative flex w-full max-w-[380px] flex-col gap-3.5 rounded-[28px] border border-white/60 bg-white/[0.94] p-6 text-center text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.55)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={64} height={64} className="mx-auto h-16 w-16 rounded-[16px] shadow-[0_6px_18px_-6px_rgba(13,42,63,0.45)]" />
        <h2 className="display text-[24px] leading-tight">Put it on your home screen</h2>
        <p className="text-[15px] leading-relaxed">
          Song of the Day opens like an app, full screen, one tap away. It&apos;s also how your phone lets us nudge you
          when you haven&apos;t posted yet.
        </p>

        {kind === "ios" && (
          <ol className="flex flex-col gap-2.5 rounded-[20px] bg-card-ink/[0.05] px-4 py-3.5 text-left text-[15px] leading-snug">
            <Step n={1}>
              Tap <ShareIcon /> <b>Share</b> in Safari&apos;s bar
            </Step>
            <Step n={2}>
              Scroll down and tap <b>Add to Home Screen</b>
            </Step>
            <Step n={3}>
              Tap <b>Add</b>
            </Step>
          </ol>
        )}
        {kind === "android" && (
          <ol className="flex flex-col gap-2.5 rounded-[20px] bg-card-ink/[0.05] px-4 py-3.5 text-left text-[15px] leading-snug">
            <Step n={1}>
              Tap the <b>⋮</b> menu in your browser
            </Step>
            <Step n={2}>
              Tap <b>Add to Home screen</b> or <b>Install app</b>
            </Step>
          </ol>
        )}

        {kind === "prompt" ? (
          <button
            type="button"
            onClick={install}
            disabled={busy}
            className="mt-1 h-12 rounded-full bg-accent text-[15px] font-semibold text-white disabled:opacity-60"
          >
            Add to Home Screen
          </button>
        ) : (
          <button type="button" onClick={markSeen} className="mt-1 h-12 rounded-full bg-accent text-[15px] font-semibold text-white">
            Got it
          </button>
        )}
        {kind === "prompt" && (
          <button type="button" onClick={markSeen} className="-mt-1 h-9 text-sm font-semibold text-muted">
            Not now
          </button>
        )}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{n}</span>
      <span>{children}</span>
    </li>
  );
}

// Safari's share symbol: a box with an arrow out of the top
const ShareIcon = () => (
  <svg
    aria-hidden
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#0A7AFF"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="-mt-1 inline-block align-middle"
  >
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M8 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H16" />
  </svg>
);
