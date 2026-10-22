"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Artwork } from "@/components/Artwork";
import { FlipCover } from "@/components/FlipCover";
import { Player } from "@/components/Player";
import { formatTime, initials } from "@/lib/day";
import type { Friend, Post, Profile } from "@/lib/types";
import { DayRing } from "./DayRing";

type Props = {
  me: Profile;
  myPost: Post | null;
  friends: Friend[];
  // Where a person's core lives. The demo points these somewhere else.
  coreHref?: (username: string) => string;
};

// Featured song: either one of your friends' (by slot) or your own.
type Feature = { slot: number | "me" };

const TWO_PI = Math.PI * 2;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const FLY_IN_AT = 2.6; // zooming past this flies you into your core

// Tiles live in 100 fixed slots spread evenly over the sphere, so following
// someone new adds a tile without shuffling everyone else.
function srnd(k: number, j: number) {
  const x = Math.sin(k * 3.913 + j * 17.17) * 2741.7;
  return x - Math.floor(x);
}
function slotPos(k: number, t: number) {
  const q = (k * 37) % 100;
  const lat0 = Math.asin(1 - ((q + 0.5) * 2) / 100);
  const lon0 = q * 2.39996;
  // Each tile drifts very slowly on its own.
  const lat = Math.max(-1.35, Math.min(1.35, lat0 + 0.08 * Math.sin(t * (0.04 + srnd(k, 2) * 0.05) + k)));
  return { lat, lon: lon0 + t * (srnd(k, 1) - 0.5) * 0.035 };
}

export function Globe({ me, myPost, friends, coreHref = (u) => `/u/${u}` }: Props) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLButtonElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Motion state lives in a ref and is written straight to the DOM each
  // frame, so React only re-renders when the UI actually changes.
  const m = useRef({
    yaw: 0.5,
    pitch: -0.3,
    zoom: 1,
    vel: 0.0008,
    t: 0,
    last: 0,
    target: null as null | { yaw: number; pitch: number },
    zoomTarget: null as null | number,
    flying: false,
    frozen: false,
    drag: null as null | { x: number; y: number; lx: number; yaw: number; pitch: number },
    pinch: null as null | { d: number; zoom: number },
    pointers: new Map<number, { x: number; y: number }>(),
    moved: false,
    R: 165,
    tile: 50,
    reduced: false,
  });

  const [panel, setPanel] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [feature, setFeature] = useState<Feature | null>(null);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [size, setSize] = useState({ w: 390, h: 500 });

  const n = friends.length;
  const R = Math.max(110, Math.min(size.w * 0.42, size.h * 0.37, 300));
  const tileSize = Math.round(
    Math.max(38, Math.min(64, R * Math.sqrt((4 * Math.PI) / Math.max(n, 12)) * 0.6)) * Math.min(1.3, R / 165),
  );

  const myCore = coreHref(me.username);
  const flyIn = useCallback(() => {
    const s = m.current;
    if (s.flying) return;
    s.flying = true;
    s.target = null;
    s.zoomTarget = 2.8;
    setPanel(false);
    router.prefetch(myCore);
  }, [myCore, router]);

  // Keep the stage size current.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    m.current.R = R;
    m.current.tile = tileSize;
  }, [R, tileSize]);

  // The animation loop.
  useEffect(() => {
    const s = m.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = (now: number) => {
      const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0;
      s.last = now;
      if (!s.frozen) s.t += dt;

      if (!s.drag && !s.pinch && s.target && !s.frozen) {
        const dy = s.target.yaw - s.yaw;
        const dp = s.target.pitch - s.pitch;
        if (Math.abs(dy) + Math.abs(dp) > 0.001) {
          s.yaw += dy * 0.1;
          s.pitch += dp * 0.1;
        }
      } else if (!s.drag && !s.pinch && !s.frozen) {
        s.vel = s.vel * 0.95 + (s.reduced ? 0 : 0.00004);
        if (Math.abs(s.vel) > 0.00005) s.yaw += s.vel;
      }

      if (s.zoomTarget !== null) {
        const dz = s.zoomTarget - s.zoom;
        if (Math.abs(dz) > 0.01) s.zoom += dz * 0.07;
        else {
          s.zoom = s.zoomTarget;
          s.zoomTarget = null;
          if (s.flying) router.push(myCore);
        }
      }
      if (!s.flying && s.zoom >= FLY_IN_AT) flyIn();

      if (worldRef.current)
        worldRef.current.style.transform = `scale3d(${s.zoom},${s.zoom},${s.zoom}) rotateX(${s.pitch}rad) rotateY(${s.yaw}rad)`;

      const reveal = Math.max(0, Math.min(1, (s.zoom - 1.4) / 1.2));
      stageRef.current?.style.setProperty("--reveal", reveal.toFixed(3));
      if (coreRef.current) coreRef.current.style.transform = `rotateY(${-s.yaw}rad) rotateX(${-s.pitch}rad)`;

      const half = s.tile / 2;
      tileRefs.current.forEach((el, k) => {
        if (!el) return;
        const p = slotPos(k, s.t);
        el.style.transform = `translate(${-half}px,${-half}px) rotateY(${p.lon.toFixed(4)}rad) rotateX(${p.lat.toFixed(4)}rad) translateZ(${s.R + 6}px)`;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flyIn, myCore, router]);

  // Freeze the globe while a song is featured.
  useEffect(() => {
    m.current.frozen = feature !== null;
  }, [feature]);

  const spinTo = useCallback((k: number) => {
    const s = m.current;
    const p = slotPos(k, s.t + 1.5);
    s.target = { yaw: -p.lon + TWO_PI * Math.round((s.yaw + p.lon) / TWO_PI), pitch: -p.lat };
    s.vel = 0;
    setFocus(k);
    setPanel(false);
  }, []);

  const openFeature = useCallback(
    (slot: number | "me") => {
      if (m.current.moved) return;
      if (slot !== "me") spinTo(slot);
      setFocus(null);
      setFeature({ slot });
      requestAnimationFrame(() => setFeatureOpen(true));
    },
    [spinTo],
  );
  const closeFeature = useCallback(() => {
    setFeatureOpen(false);
    setTimeout(() => setFeature(null), 450);
  }, []);

  useEffect(() => {
    if (!feature) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeFeature();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feature, closeFeature]);

  // ---- Pointer handling: drag to spin, pinch or scroll to zoom ----
  const onPointerDown = (e: React.PointerEvent) => {
    const s = m.current;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    s.moved = false;
    if (s.pointers.size === 2) {
      const [a, b] = [...s.pointers.values()];
      s.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: s.zoom };
      s.drag = null;
      return;
    }
    s.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, yaw: s.yaw, pitch: s.pitch };
    if (s.target) {
      s.vel = 0;
      s.target = null;
      setFocus(null);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = m.current;
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pinch && s.pointers.size === 2) {
      const [a, b] = [...s.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      s.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (s.pinch.zoom * d) / s.pinch.d));
      s.zoomTarget = null;
      s.moved = true;
      return;
    }
    if (!s.drag) return;
    const dx = e.clientX - s.drag.x;
    const dy = e.clientY - s.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) {
      if (!s.moved) stageRef.current?.setPointerCapture(e.pointerId);
      s.moved = true;
    }
    s.vel = Math.max(-0.08, Math.min(0.08, (e.clientX - s.drag.lx) * 0.01));
    s.drag.lx = e.clientX;
    s.yaw = s.drag.yaw + dx * 0.01;
    s.pitch = Math.max(-1.3, Math.min(1.3, s.drag.pitch - dy * 0.01));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = m.current;
    s.pointers.delete(e.pointerId);
    if (s.pointers.size < 2) s.pinch = null;
    if (s.pointers.size === 0) s.drag = null;
  };
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // Non-passive so the page itself doesn't scroll or zoom.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = m.current;
      s.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.zoom - e.deltaY * 0.002));
      s.zoomTarget = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (d: number) => {
    const s = m.current;
    s.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (s.zoomTarget ?? s.zoom) + d));
  };

  // ---- Data for the panel and the featured card ----
  const slots = useMemo(() => friends.map((f, k) => ({ ...f, k })), [friends]);
  const posted = useMemo(
    () => slots.filter((f) => f.post).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [slots],
  );
  const waiting = useMemo(
    () => slots.filter((f) => !f.post).sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [slots],
  );

  const featured =
    feature === null
      ? null
      : feature.slot === "me"
        ? myPost && { post: myPost, who: "You", username: me.username, tz: me.timezone }
        : friends[feature.slot]?.post && {
            post: friends[feature.slot].post!,
            who: friends[feature.slot].display_name,
            username: friends[feature.slot].username,
            tz: friends[feature.slot].timezone,
          };

  const fp = featureOpen ? 1 : 0;
  const chromeStyle: React.CSSProperties = {
    opacity: 1 - fp,
    pointerEvents: featureOpen ? "none" : undefined,
    transition: "opacity .45s ease",
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-ink">
      {/* Header */}
      <header
        className="absolute inset-x-0 top-0 z-10 mx-auto flex h-[72px] max-w-[640px] items-center justify-between px-[22px] pt-[env(safe-area-inset-top)]"
        style={chromeStyle}
      >
        <div className="flex flex-col">
          <h1 className="display text-[26px] leading-[1.1]">Song of the Day</h1>
          <TodayLabel />
        </div>
        <DayRing />
      </header>

      {/* The soft turquoise aura, centered on the globe */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[236px] top-[72px]" style={{ opacity: 1 - 0.6 * fp, transition: "opacity .45s ease" }}>
        <div className="aura absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: R * 3.9, height: R * 3.9 }} />
        <div className="aura absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: R * 1.8, height: R * 1.8 }} />
      </div>

      {/* The Globe */}
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-x-0 bottom-[236px] top-[72px] cursor-grab touch-none active:cursor-grabbing"
        style={{
          perspective: 1000,
          opacity: 1 - 0.8 * fp,
          filter: `blur(${fp * 3}px)`,
          transform: `scale(${1 - 0.14 * fp})`,
          transition: "opacity .45s ease, filter .45s ease, transform .45s ease",
        }}
      >
        <div ref={worldRef} className="preserve-3d absolute left-1/2 top-1/2 h-0 w-0">
          {slots.map((f) => {
            const focused = focus === f.k;
            return (
              <div
                key={f.id}
                ref={(el) => {
                  tileRefs.current[f.k] = el;
                }}
                className="preserve-3d absolute left-0 top-0"
                style={{ width: tileSize, height: tileSize }}
              >
                {/* back face, seen through the far side of the sphere */}
                <div
                  className="backface-hidden absolute inset-0 bg-tile-back opacity-60"
                  style={{ transform: "rotateY(180deg)", borderRadius: "26%" }}
                />
                <button
                  type="button"
                  onClick={() => (f.post ? openFeature(f.k) : !m.current.moved && spinTo(f.k))}
                  aria-label={f.post ? `${f.display_name}: ${f.post.title}. Open` : `${f.display_name} hasn't posted yet`}
                  className="backface-hidden absolute inset-0 overflow-hidden"
                  style={{
                    borderRadius: "26%",
                    opacity: "calc(1 - var(--reveal, 0) * 0.8)",
                    pointerEvents: "auto",
                  }}
                >
                  {f.post ? (
                    <>
                      <Artwork src={f.post.artwork_url} alt="" className="absolute inset-0 h-full w-full" />
                      <span
                        className="absolute inset-0"
                        style={{
                          borderRadius: "26%",
                          boxShadow: focused
                            ? "inset 0 0 0 3px #0D2A3F, inset 0 0 0 5px #fff"
                            : "inset 0 0 0 1.5px rgba(255,255,255,0.75)",
                        }}
                      />
                    </>
                  ) : (
                    <span
                      className="absolute inset-0 flex flex-col items-center justify-center gap-px border-[1.5px] border-dashed border-muted bg-white/[0.07] text-ink"
                      style={{
                        borderRadius: "26%",
                        boxShadow: focused ? "0 0 0 2px #fff" : undefined,
                      }}
                    >
                      <span className="text-[11px] font-semibold">{initials(f.display_name)}</span>
                      <span className="text-[8px] tracking-[0.04em] opacity-85">not yet</span>
                    </span>
                  )}
                </button>
                {focused && (
                  <span
                    className="backface-hidden absolute left-1/2 top-full mt-1.5 whitespace-nowrap rounded-lg bg-card px-2 py-0.5 text-[10px] font-semibold text-card-ink"
                    style={{ transform: "translateX(-50%) translateZ(1px)" }}
                  >
                    {f.display_name}
                  </span>
                )}
              </div>
            );
          })}
          {/* The core: your profile, at the heart of the sphere. It always turns
             to face you, and tiles on the near side pass in front of it. */}
          <button
            ref={coreRef}
            type="button"
            onClick={() => !m.current.moved && flyIn()}
            aria-label="Your core. Open your profile"
            className="absolute -left-5 -top-5 h-10 w-10"
          >
            <span
              className="pointer-events-none absolute -inset-[46px] rounded-full"
              style={{
                background: "radial-gradient(closest-side, #D9FFF8F0, #D9FFF866 30%, #D9FFF800)",
                animation: "pulse-glow 3.2s ease-in-out infinite",
              }}
            />
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle at 40% 36%, #FFFFFF 0%, #D9FFF8 55%, #D9FFF800 100%)",
                opacity: "calc(1 - var(--reveal, 0) * 0.6)",
              }}
            />
            <span
              className="absolute inset-0 overflow-hidden rounded-full"
              style={{
                background: "radial-gradient(circle at 34% 28%, #FFFFFF 0%, #A9DCD6 24%, #2F6F7E 64%, #173C47 100%)",
                opacity: "var(--reveal, 0)",
              }}
            />
            <span
              className="absolute -inset-2 rounded-full border border-[rgba(255,74,79,0.75)]"
              style={{ transform: "rotate(-20deg) scaleY(0.32)", opacity: "var(--reveal, 0)" }}
            />
            <span
              className="absolute -inset-[15px] rounded-full border border-dashed border-[rgba(233,251,248,0.5)]"
              style={{ transform: "rotate(40deg) scaleY(0.22)", opacity: "var(--reveal, 0)" }}
            />
          </button>
        </div>

        {n === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-[62%] text-center text-sm text-muted">
            Your Globe is empty. Follow people to fill it.
          </div>
        )}

        {/* Zoom and spin controls */}
        <div className="absolute bottom-3.5 right-[max(14px,calc(50%-306px))] z-[400] flex flex-col gap-1.5">
          <RoundButton label="Zoom in" onClick={() => zoomBy(0.4)}>
            <path d="M12 5v14M5 12h14" />
          </RoundButton>
          <RoundButton label="Zoom out" onClick={() => zoomBy(-0.4)}>
            <path d="M5 12h14" />
          </RoundButton>
        </div>
        <div className="absolute bottom-3.5 left-[max(14px,calc(50%-306px))] z-[400] flex gap-1.5 opacity-90">
          <RoundButton label="Spin left" onClick={() => ((m.current.target = null), (m.current.vel = -0.09))}>
            <path d="M15 5l-7 7 7 7" />
          </RoundButton>
          <RoundButton label="Spin right" onClick={() => ((m.current.target = null), (m.current.vel = 0.09))}>
            <path d="M9 5l7 7-7 7" />
          </RoundButton>
        </div>
      </div>

      {/* People tab */}
      {!panel && (
        <button
          type="button"
          onClick={() => setPanel(true)}
          aria-label="People you follow"
          className="absolute left-0 top-[104px] z-[420] flex h-28 w-10 flex-col items-center justify-center gap-2 rounded-r-[20px] bg-card text-card-ink shadow-[0_6px_18px_-10px_rgba(0,0,0,0.5)]"
          style={chromeStyle}
        >
          <PeopleIcon />
          <span className="rotate-180 text-[11px] font-semibold tracking-[0.06em] [writing-mode:vertical-rl]">People</span>
        </button>
      )}
      {panel && (
        <PeoplePanel
          posted={posted}
          waiting={waiting}
          focus={focus}
          onPick={spinTo}
          onClose={() => setPanel(false)}
        />
      )}

      {/* Your song, under the globe */}
      <div
        className="absolute inset-x-4 bottom-[92px] z-[5] mx-auto flex max-w-[440px] flex-col gap-2.5 rounded-3xl bg-card px-4 py-3.5 text-card-ink shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)]"
        style={chromeStyle}
      >
        {myPost ? (
          <>
            <div className="text-[11px] text-card-muted">{formatTime(myPost.created_at, me.timezone)} · You</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openFeature("me")}
                aria-label={`${myPost.title} by ${myPost.artist}. Open`}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Artwork src={myPost.artwork_url} alt="" className="h-[46px] w-[46px] flex-none rounded-xl" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="display truncate text-lg leading-tight">{myPost.title}</span>
                  <span className="truncate text-[13px] text-card-muted">{myPost.artist}</span>
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="display text-lg leading-tight">What hit hardest today?</span>
              <span className="text-[13px] text-card-muted">You haven&apos;t shared your song yet.</span>
            </div>
            <Link
              href="/post"
              className="flex h-11 flex-none items-center rounded-full bg-accent px-4 text-sm font-semibold text-white"
            >
              Share
            </Link>
          </div>
        )}
        <p className="text-[11px] leading-snug text-card-muted">
          Tap the glowing core, or zoom in, to fly into your profile. Tap a song to open it.
        </p>
      </div>

      {/* Bottom nav */}
      <nav
        className="absolute inset-x-4 bottom-3.5 z-[450] mx-auto flex h-16 max-w-[440px] items-center justify-around rounded-full bg-nav pb-[env(safe-area-inset-bottom)]"
        style={chromeStyle}
      >
        <span className="flex h-11 items-center gap-2 rounded-full bg-card px-[18px] text-[13px] font-semibold text-card-ink">
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <ellipse cx="12" cy="12" rx="4" ry="9" />
            <path d="M3 12h18" />
          </svg>
          Globe
        </span>
        <Link
          href="/post"
          aria-label="Post today's song"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"
        >
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={flyIn}
          className="flex h-11 items-center gap-2 rounded-full px-[18px] text-[13px] font-semibold text-muted"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
          Profile
        </button>
      </nav>

      {/* A song, zoomed up close */}
      {feature && featured && (
        <div
          className="absolute inset-0 z-[480] overflow-y-auto"
          style={{
            background: `radial-gradient(closest-side, #D9FFF822, rgba(0,0,0,0)), rgba(2,10,12,${0.3 * fp})`,
            transition: "background .45s ease",
          }}
        >
          <button type="button" onClick={closeFeature} aria-label="Back to the globe" className="fixed inset-0 cursor-default" />
          <div
            className="relative mx-auto flex max-w-[390px] flex-col gap-3.5 px-5 pb-10 pt-[72px]"
            style={{
              opacity: fp,
              transform: featureOpen ? "none" : "scale(0.4) translateY(40px)",
              transformOrigin: "50% 45%",
              transition: "opacity .45s ease, transform .55s cubic-bezier(.2,.75,.25,1)",
            }}
          >
            <div className="relative flex h-7 items-center justify-between">
              <span className="text-xs text-muted">
                {formatTime(featured.post.created_at, featured.tz)} · {featured.who}
              </span>
              <button
                type="button"
                onClick={closeFeature}
                aria-label="Close"
                className="-mr-2.5 flex h-11 w-11 items-center justify-center text-ink"
              >
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <FlipCover
              artwork={featured.post.artwork_url}
              title={featured.post.title}
              caption={featured.post.caption}
              footer={`${featured.who} · ${formatTime(featured.post.created_at, featured.tz)}`}
            />
            <div className="relative flex flex-col gap-0.5">
              <div className="display text-[26px] leading-tight">{featured.post.title}</div>
              <div className="text-[15px] text-muted">{featured.post.artist}</div>
            </div>
            <div className="relative flex flex-col gap-3">
              <Player
                links={featured.post.platform_links}
                songUrl={featured.post.song_url}
                pageUrl={featured.post.page_url}
              />
              <div className="flex items-center justify-between">
                <Link
                  href={coreHref(featured.username)}
                  className="flex h-11 items-center rounded-full border border-muted px-[18px] text-[13px] font-semibold text-ink"
                >
                  {feature.slot === "me" ? "View your core" : `View ${featured.who}'s core`}
                </Link>
                <span className="text-[11px] text-muted">Tap cover to flip</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TodayLabel() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () =>
      setLabel(
        new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      );
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  return <span className="h-4 text-xs text-muted">{label}</span>;
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-card-ink shadow-[0_4px_14px_-6px_rgba(0,0,0,0.45)]"
    >
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {children}
      </svg>
    </button>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.5c2.6 0 4.6 1.6 5.5 4.5" />
    </svg>
  );
}

type Slot = Friend & { k: number };

function PeoplePanel({
  posted,
  waiting,
  focus,
  onPick,
  onClose,
}: {
  posted: Slot[];
  waiting: Slot[];
  focus: number | null;
  onPick: (k: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="rise-in absolute bottom-[236px] left-0 top-[72px] z-[420] flex w-[256px] flex-col rounded-r-[28px] bg-card text-card-ink shadow-[12px_0_40px_-24px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-1.5 pb-1.5 pl-[18px] pr-2 pt-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="display text-[17px]">Following</div>
          <div className="text-[11px] text-card-muted">
            {posted.length} posted · {waiting.length} not yet
          </div>
        </div>
        <Link
          href="/people"
          className="ml-auto flex h-8 items-center gap-1 rounded-full bg-accent px-2.5 text-[11px] font-semibold text-white"
        >
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Follow
        </Link>
        <button type="button" onClick={onClose} aria-label="Close people list" className="flex h-11 w-10 items-center justify-center">
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 pb-4 pt-1">
        <div className="px-2 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-deep">
          Posted today
        </div>
        {posted.length === 0 && <p className="px-2 pb-2 text-xs text-card-muted">Nobody yet. Be the first.</p>}
        {posted.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.k)}
            aria-label={`Spin to ${p.display_name}'s song`}
            className={`flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left ${focus === p.k ? "bg-soft" : ""}`}
          >
            <Artwork src={p.post!.artwork_url} alt="" className="h-[30px] w-[30px] flex-none rounded-lg" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.display_name}</span>
            <span className="text-[10px] text-card-muted">{formatTime(p.post!.created_at, p.timezone)}</span>
          </button>
        ))}
        <div className="px-2 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-card-muted">Not yet</div>
        {waiting.length === 0 && <p className="px-2 text-xs text-card-muted">Everyone&apos;s in today.</p>}
        {waiting.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.k)}
            aria-label={`Spin to ${p.display_name}`}
            className={`flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left ${focus === p.k ? "bg-soft" : ""}`}
          >
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-dashed border-card-muted text-[10px] font-semibold text-card-muted">
              {initials(p.display_name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-card-muted">{p.display_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
