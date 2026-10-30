"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// How to put Fingerpick on your home screen, as a short slideshow: each
// tap drawn on a little phone screen, with the spot to tap pulsing. It shows
// once on each phone that's still using it in a browser, and the ? card
// brings it back any time. Android's Chrome lets a site bring up its own
// install prompt, so there it's one tap; an iPhone only allows it from the
// Share menu. Inside another app's browser (Instagram, ...) the first step is
// opening it in the real browser.

const SEEN_KEY = "sotd-app-tour";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

// Chrome fires this early, often before the globe has drawn, so listen from
// the moment this file loads and keep it for when the slideshow shows.
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

type Os = "ios" | "android";
type Way = "safari" | "chrome" | "inapp" | "prompt";

// this phone, if it's a phone still using a browser
function here(): { os: Os; way: Way } | null {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || window.matchMedia("(display-mode: standalone)").matches) return null;
  const ua = nav.userAgent;
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|TikTok|musical_ly|Line\/|LinkedInApp|Twitter|GSA\//.test(ua);
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1))
    return { os: "ios", way: inApp ? "inapp" : /CriOS|EdgiOS|FxiOS/.test(ua) ? "chrome" : "safari" };
  if (/Android/.test(ua)) return { os: "android", way: inApp || /; wv\)/.test(ua) ? "inapp" : deferred ? "prompt" : "chrome" };
  return null;
}

function pendingNow() {
  try {
    if (localStorage.getItem(SEEN_KEY) === "1") return false;
  } catch {
    return false;
  }
  return here() !== null;
}

// as a string, so it can be compared from one render to the next
function hereKey() {
  const h = here();
  return h ? `${h.os}:${h.way}` : null;
}

// whether the slideshow still has to show itself (the notifications card waits for it)
export const installPending = () => pendingNow();

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

// Shows itself once on each phone, after the welcome card.
export function InstallCard() {
  const show = useSyncExternalStore(subscribe, pendingNow, () => false);
  return show ? <AppTour onClose={() => {}} /> : null;
}

type Slide = { title: string; text: ReactNode; art: ReactNode; action?: "install" };

function slidesFor(os: Os, way: Way): Slide[] {
  const open: Slide = {
    title: "Tap the new icon",
    text:
      "Fingerpick is on your home screen now. It opens full screen like any app, and your friends' songs " +
      "reach you as notifications.",
    art: <HomeArt os={os} />,
  };
  if (way === "prompt")
    return [
      {
        title: "One tap",
        text: "Tap the button below, then Install.",
        art: <DialogArt os="android" />,
        action: "install",
      },
      open,
    ];
  const out: Slide[] = [];
  if (way === "inapp")
    out.push({
      title: `Open it in ${os === "ios" ? "Safari" : "Chrome"}`,
      text: (
        <>
          You&apos;re in another app&apos;s browser. Tap its <b>•••</b> menu, then <b>Open in {os === "ios" ? "Safari" : "Chrome"}</b>{" "}
          (or <b>Open in browser</b>).
        </>
      ),
      art: <InAppArt />,
    });
  if (os === "ios")
    out.push(
      way === "chrome"
        ? {
            title: "Tap Share",
            text: (
              <>
                Tap <ShareIcon /> <b>Share</b> at the top right of Chrome.
              </>
            ),
            art: <BarArt spot="top" />,
          }
        : {
            title: "Tap Share",
            text: (
              <>
                Tap <b>•••</b> at the bottom of Safari, then <ShareIcon /> <b>Share</b>. On some iPhones Share sits right
                in the bar.
              </>
            ),
            art: <BarArt spot="bottom" />,
          },
      {
        title: "Add to Home Screen",
        text: (
          <>
            Scroll down and tap <b>Add to Home Screen</b>. Don&apos;t see it? Tap <b>View More</b> first.
          </>
        ),
        art: <SheetArt os="ios" />,
      },
      {
        title: "Tap Add",
        text: (
          <>
            Leave <b>Open as Web App</b> on and tap <b>Add</b>.
          </>
        ),
        art: <DialogArt os="ios" />,
      },
    );
  else
    out.push(
      {
        title: "Open the menu",
        text: (
          <>
            Tap <b>⋮</b> at the top right of Chrome.
          </>
        ),
        art: <BarArt spot="top" dots />,
      },
      {
        title: "Add to Home screen",
        text: (
          <>
            Tap <b>Add to Home screen</b> (some phones say <b>Install app</b>).
          </>
        ),
        art: <SheetArt os="android" />,
      },
      {
        title: "Tap Install",
        text: (
          <>
            Tap <b>Install</b> (or <b>Add</b>).
          </>
        ),
        art: <DialogArt os="android" />,
      },
    );
  out.push(open);
  return out;
}

export function AppTour({ onClose: done }: { onClose(): void }) {
  // seen from the ? card counts too: it won't show itself again after
  const onClose = () => {
    markSeen();
    done();
  };
  const key = useSyncExternalStore(subscribe, hereKey, () => null);
  const mine = key ? { os: key.split(":")[0] as Os, way: key.split(":")[1] as Way } : null;
  const [os, setOs] = useState<Os | null>(null);
  const shown = os ?? mine?.os ?? "ios";
  const way: Way = mine && mine.os === shown ? mine.way : "safari";
  const slides = slidesFor(shown, shown === "android" && way === "safari" ? "chrome" : way);
  const [i, setI] = useState(0);
  const at = Math.min(i, slides.length - 1);
  const slide = slides[at];
  const last = at === slides.length - 1;
  const [busy, setBusy] = useState(false);
  const x0 = useRef<number | null>(null);
  const go = (d: number) => setI(Math.max(0, Math.min(slides.length - 1, at + d)));

  const install = async () => {
    if (!deferred || busy) return;
    setBusy(true);
    const e = deferred;
    deferred = null;
    try {
      await e.prompt();
      await e.userChoice;
    } catch {}
    setBusy(false);
    go(1);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center px-5">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-[#0D2A3F]/30" />
      <div
        role="dialog"
        aria-label="Get the app: add Fingerpick to your home screen"
        className="rise-in relative flex w-full max-w-[380px] flex-col items-center gap-3 rounded-[28px] border border-white/60 bg-white/[0.94] px-6 pb-5 pt-5 text-center text-card-ink backdrop-blur-2xl"
        style={{ boxShadow: "0 30px 80px -30px rgba(13,42,63,0.55)" }}
        onTouchStart={(e) => void (x0.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (x0.current === null) return;
          const dx = e.changedTouches[0].clientX - x0.current;
          x0.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center text-muted">
          <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-[6px]" />
          Get the app
        </div>
        <div className="flex rounded-full bg-card-ink/[0.06] p-0.5 text-[13px] font-semibold">
          {(["ios", "android"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                setOs(o);
                setI(0);
              }}
              className={`h-7 rounded-full px-3.5 ${shown === o ? "bg-white text-card-ink shadow-sm" : "text-muted"}`}
            >
              {o === "ios" ? "iPhone" : "Android"}
            </button>
          ))}
        </div>

        <div key={`${shown}-${at}`} className="rise-in flex flex-col items-center gap-2.5">
          {slide.art}
          <div className="text-[12px] font-semibold text-muted">
            Step {at + 1} of {slides.length}
          </div>
          <h2 className="display -mt-1.5 text-[23px] leading-tight">{slide.title}</h2>
          <p className="min-h-[66px] text-[15px] leading-snug">{slide.text}</p>
        </div>

        <div className="flex gap-1.5" aria-hidden>
          {slides.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === at ? "w-4 bg-accent" : "w-1.5 bg-card-ink/20"}`} />
          ))}
        </div>
        <div className="flex w-full gap-2">
          {at > 0 && (
            <button type="button" onClick={() => go(-1)} className="h-12 flex-1 rounded-full bg-card-ink/[0.07] text-[15px] font-semibold">
              Back
            </button>
          )}
          {slide.action === "install" && deferred ? (
            <button
              type="button"
              onClick={install}
              disabled={busy}
              className="h-12 flex-[2] rounded-full bg-accent text-[15px] font-semibold text-white disabled:opacity-60"
            >
              Add to Home Screen
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (last ? onClose() : go(1))}
              className="h-12 flex-[2] rounded-full bg-accent text-[15px] font-semibold text-white"
            >
              {last ? "Got it" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- the little phone screens ----

function Phone({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      aria-hidden
      className="relative h-[178px] w-[132px] overflow-hidden rounded-[24px] border-[5px] border-card-ink shadow-[0_14px_30px_-14px_rgba(13,42,63,0.6)]"
      style={{ background: dark ? "#0b1530" : "linear-gradient(#2a6fd6, #7fb6f2)" }}
    >
      {children}
    </div>
  );
}

// the app's globe, faintly, as the page behind the browser's buttons
const Page = () => (
  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "radial-gradient(circle at 50% 38%, #1d2f66, #070b1c)" }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/icon-192.png" alt="" className="h-16 w-16 rounded-full opacity-80" />
  </div>
);

// where to tap
const Tap = ({ className }: { className: string }) => (
  <span className={`tap-ring pointer-events-none absolute h-7 w-7 rounded-full border-2 border-accent ${className}`} />
);

function BarArt({ spot, dots = false }: { spot: "top" | "bottom"; dots?: boolean }) {
  return (
    <Phone>
      <Page />
      {spot === "top" ? (
        <div className="absolute inset-x-0 top-0 flex h-7 items-center gap-1 bg-white/95 px-2">
          <div className="h-3.5 flex-1 rounded-full bg-card-ink/10" />
          <span className="flex w-4 justify-center text-[11px] font-bold text-card-ink">{dots ? "⋮" : <ShareIcon size={12} />}</span>
          <Tap className="-right-[2px] top-0" />
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex h-8 items-center gap-1.5 bg-white/95 px-2">
          <span className="text-[11px] text-card-ink">‹</span>
          <div className="h-4 flex-1 rounded-full bg-card-ink/10" />
          <span className="text-[11px] font-bold leading-none text-card-ink">•••</span>
          <Tap className="right-[1px] top-[2px]" />
        </div>
      )}
    </Phone>
  );
}

function SheetArt({ os }: { os: Os }) {
  const rows =
    os === "ios"
      ? ["Copy", "Add to Reading List", "Add Bookmark", "Add to Home Screen", "Find on Page"]
      : ["New tab", "History", "Bookmarks", "Add to Home screen", "Settings"];
  return (
    <Phone>
      <Page />
      <div className={`absolute flex flex-col bg-white text-left text-[8.5px] text-card-ink ${os === "ios" ? "inset-x-0 bottom-0 top-9 rounded-t-[12px] px-2 pt-2" : "right-1 top-1 w-[96px] rounded-[6px] py-1 shadow-lg"}`}>
        {rows.map((r, k) => (
          <div key={r} className={`relative flex h-[18px] items-center px-1.5 ${k === 3 ? "rounded-[5px] bg-accent/10 font-semibold" : ""} ${os === "ios" ? "border-b border-card-ink/10" : ""}`}>
            {r}
            {k === 3 && <Tap className="-right-1 -top-[5px]" />}
          </div>
        ))}
      </div>
    </Phone>
  );
}

function DialogArt({ os }: { os: Os }) {
  return (
    <Phone>
      <Page />
      {os === "ios" ? (
        <div className="absolute inset-x-0 bottom-0 top-8 rounded-t-[12px] bg-[#f2f2f7] px-2 pt-2 text-[8.5px] text-card-ink">
          <div className="relative flex items-center justify-between">
            <span className="text-[#0A7AFF]">Cancel</span>
            <b>Add to Home Screen</b>
            <span className="font-semibold text-[#0A7AFF]">Add</span>
            <Tap className="-right-[6px] -top-[9px]" />
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-[8px] bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="h-6 w-6 rounded-[6px]" />
            <span className="font-semibold">Fingerpick</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between rounded-[8px] bg-white p-1.5">
            Open as Web App
            <span className="flex h-3 w-5 items-center justify-end rounded-full bg-[#34c759] px-[1px]">
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
            </span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-2 top-12 rounded-[10px] bg-white p-2 text-left text-[8.5px] text-card-ink shadow-lg">
          <b className="text-[9.5px]">Install app?</b>
          <div className="mt-1.5 flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="h-6 w-6 rounded-[6px]" />
            Fingerpick
          </div>
          <div className="relative mt-2 flex justify-end gap-2 font-semibold text-[#1a73e8]">
            <span>Cancel</span>
            <span>Install</span>
            <Tap className="-right-[7px] -top-[8px]" />
          </div>
        </div>
      )}
    </Phone>
  );
}

function InAppArt() {
  return (
    <Phone>
      <Page />
      <div className="absolute inset-x-0 top-0 flex h-7 items-center justify-between bg-white/95 px-2 text-[9px] font-semibold text-card-ink">
        <span>✕</span>
        <span className="opacity-60">mysong.day</span>
        <span className="relative">
          •••
          <Tap className="-right-[9px] -top-[8px]" />
        </span>
      </div>
      <div className="absolute right-1 top-8 w-[100px] rounded-[6px] bg-white py-1 text-left text-[8.5px] text-card-ink shadow-lg">
        <div className="px-1.5 py-[3px]">Copy link</div>
        <div className="mx-1 rounded-[5px] bg-accent/10 px-1 py-[3px] font-semibold">Open in browser</div>
        <div className="px-1.5 py-[3px]">Share</div>
      </div>
    </Phone>
  );
}

function HomeArt({ os }: { os: Os }) {
  const tint = ["#ffb347", "#6fcf97", "#56ccf2", "#bb6bd9", "#f2994a", "#eb5757", "#2f80ed"];
  return (
    <Phone>
      <div className="grid grid-cols-4 gap-[7px] p-[9px] pt-4">
        {Array.from({ length: 11 }, (_, k) =>
          k === 5 ? (
            <div key={k} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className={`h-[23px] w-[23px] ${os === "ios" ? "rounded-[6px]" : "rounded-full"}`} />
              <Tap className="-left-[2px] -top-[2px]" />
            </div>
          ) : (
            <div key={k} className={`h-[23px] w-[23px] opacity-70 ${os === "ios" ? "rounded-[6px]" : "rounded-full"}`} style={{ background: tint[k % tint.length] }} />
          ),
        )}
      </div>
    </Phone>
  );
}

// Safari's share symbol: a box with an arrow out of the top
const ShareIcon = ({ size = 17 }: { size?: number }) => (
  <svg
    aria-hidden
    width={size}
    height={size}
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
