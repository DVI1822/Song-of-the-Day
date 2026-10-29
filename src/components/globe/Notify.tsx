"use client";

import { useEffect, useState } from "react";
import type { GlobeApi } from "./api";
import { installPending } from "./Install";
import { LATER_KEY, enablePush, notifyLater } from "./Welcome";

// Asks again for notifications, for anyone who hasn't turned them on: a
// friend posting their song, likes and notes on yours, and the nudges. If
// they waved it off it comes back a few days later; if the phone or browser
// has them switched off, it says where to switch them back on (a site can't
// ask twice), and checks back in a week. On an iPhone this only works from
// the home screen, which the Add to Home Screen card covers first.

type Ask = "ask" | "off";

function askNow(api: GlobeApi): Ask | null {
  if (!api.savePush || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  if (Notification.permission === "granted" || installPending()) return null;
  try {
    if (Date.now() < Number(localStorage.getItem(LATER_KEY) || 0)) return null;
  } catch {
    return null;
  }
  return Notification.permission === "denied" ? "off" : "ask";
}

export function NotifyCard({ api }: { api: GlobeApi }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  // not the moment the globe opens: let it settle first
  useEffect(() => {
    const t = setTimeout(() => setAsk(askNow(api)), 2500);
    return () => clearTimeout(t);
  }, [api]);
  if (!ask) return null;

  const close = (days: number) => {
    notifyLater(days);
    setAsk(null);
  };
  const turnOn = async () => {
    setBusy(true);
    await enablePush(api, true);
    setBusy(false);
    // said no to the browser's own question: leave it a while
    close(Notification.permission === "granted" ? 0 : 7);
  };
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const phone = iphone || /Android/.test(ua);

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center px-5">
      <button type="button" aria-label="Close" onClick={() => close(3)} className="absolute inset-0 cursor-default bg-[#0D2A3F]/30" />
      <div
        role="dialog"
        aria-label="Turn on notifications"
        className="rise-in relative flex w-full max-w-[380px] flex-col gap-3.5 rounded-[28px] border border-white/60 bg-white/[0.94] p-6 text-center text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.55)" }}
      >
        <BellIcon />
        <h2 className="display text-[24px] leading-tight">
          {ask === "ask" ? "Know when friends post" : "Notifications are off"}
        </h2>
        <p className="text-[15px] leading-relaxed">
          Hear the moment someone on your globe posts their song, and when people like yours or leave a note.
        </p>
        {ask === "off" && (
          <p className="rounded-[20px] bg-card-ink/[0.05] px-4 py-3.5 text-left text-[15px] leading-snug">
            {iphone ? (
              <>
                Open <b>Settings</b>, tap <b>Notifications</b>, then <b>Song of the Day</b>, and turn on <b>Allow Notifications</b>.
              </>
            ) : phone ? (
              <>
                Open your phone&apos;s <b>Settings</b>, find <b>Song of the Day</b> under <b>Notifications</b> (or your browser&apos;s
                site settings), and allow them.
              </>
            ) : (
              <>
                Click the icon just left of the address bar, find <b>Notifications</b>, and set it to <b>Allow</b>.
              </>
            )}
          </p>
        )}
        {ask === "ask" ? (
          <>
            <button
              type="button"
              onClick={turnOn}
              disabled={busy}
              className="mt-1 h-12 rounded-full bg-accent text-[15px] font-semibold text-white disabled:opacity-60"
            >
              Turn on notifications
            </button>
            <button type="button" onClick={() => close(3)} className="-mt-1 h-9 text-sm font-semibold text-muted">
              Not now
            </button>
          </>
        ) : (
          <button type="button" onClick={() => close(7)} className="mt-1 h-12 rounded-full bg-accent text-[15px] font-semibold text-white">
            Got it
          </button>
        )}
      </div>
    </div>
  );
}

const BellIcon = () => (
  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
    <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9" />
      <path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  </span>
);
