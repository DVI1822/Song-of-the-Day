"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Post, SongFacts as Facts } from "@/lib/types";
import { glass } from "./ui";

// Facts about a song (how it was made, the story behind it, the artist), one
// at a time, beside a less-seen photo of the artist. They live in a little
// compass star at the bottom left: right after you post, your song's facts
// come out on their own, then get pulled back into the star like a black
// hole. A tap on the star brings them out again. In any song you open, the
// star is there too, and its facts only come out when you tap it.

type Load = (postId: string) => Promise<Facts | null>;

const EVERY = 8000;
const FADE = 260;
const IN_MS = 700;
const OUT_MS = 950;
const SEEN = "toptrack.factsShown.";

// --- the card -------------------------------------------------------------------

function FactsCard({ post, facts }: { post: Post; facts: Facts }) {
  const [i, setI] = useState(0);
  const [fading, setFading] = useState(false);
  const [big, setBig] = useState(false);
  const n = facts.facts.length;

  const next = () => {
    if (n < 2 || fading) return;
    setFading(true);
    setTimeout(() => {
      setI((x) => (x + 1) % n);
      setFading(false);
    }, FADE);
  };

  useEffect(() => {
    if (n < 2) return;
    const t = setTimeout(next, EVERY);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n]);

  const fact = facts.facts[i % n];
  const source = fact.source ?? null;
  const photo = facts.photo ?? null;
  const credit = photo && `Photo: ${photo.credit}${photo.license ? `, ${photo.license}` : ""}`;

  return (
    <>
      <div
        className={`pointer-events-auto flex gap-3 rounded-[18px] ${photo ? "w-[min(320px,calc(100vw-88px))] p-2 pr-4" : "w-[min(300px,calc(100vw-88px))] px-4 pb-2.5 pt-2.5"}`}
        style={glass(false)}
      >
        {photo && (
          <button
            type="button"
            onClick={() => setBig(true)}
            aria-label={`Photo of ${post.artist}. Show it bigger`}
            className="relative w-[68px] flex-none overflow-hidden rounded-[12px] bg-[#0D2A3F]/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          </button>
        )}
        <div className={`min-w-0 flex-1 ${photo ? "py-0.5" : ""}`}>
          <div className="mb-1 flex items-center gap-2 text-[10px]">
            <span className="min-w-0 flex-1 truncate font-semibold uppercase tracking-[0.14em] text-accent">
              {fact.about === "artist" ? `About ${post.artist.split(/,| feat/i)[0]}` : "Behind the song"}
            </span>
            {n > 1 && (
              <span aria-hidden className="flex gap-1">
                {facts.facts.map((_, k) => (
                  <span key={k} className="h-1 w-1 rounded-full bg-current transition-opacity" style={{ opacity: k === i % n ? 0.7 : 0.18 }} />
                ))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={next}
            aria-label={n > 1 ? `${fact.text} Next fact` : fact.text}
            className="block min-h-[54px] w-full text-left text-[13px] leading-[1.36] transition-opacity"
            style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE}ms` }}
          >
            {fact.text}
          </button>
          {(source || photo) && (
            <div className="mt-0.5 flex gap-1 truncate text-[9.5px] opacity-45">
              {source && (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex-none font-semibold">
                  {source.name}
                </a>
              )}
              {source && photo && <span aria-hidden>·</span>}
              {photo && (
                <a href={photo.page} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate">
                  {credit}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      {big &&
        photo &&
        createPortal(
          <div
            className="fixed inset-0 z-[950] flex flex-col items-center justify-center gap-3 bg-[#050914]/85 p-6 backdrop-blur-md"
            onClick={() => setBig(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={post.artist} className="rise-in max-h-[70vh] max-w-full rounded-[20px] object-contain shadow-2xl" />
            <a
              href={photo.page}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="max-w-[320px] text-center text-[11px] text-white/60"
            >
              {credit}
            </a>
          </div>,
          document.body,
        )}
    </>
  );
}

// --- coming out of the star and falling back in -------------------------------------

// The card grows out of the star, and when it closes it swings round and
// shrinks into it, as if pulled into a black hole. Scaling around the star's
// centre (transform-origin, measured from an unmoved wrapper) does both.
function Flight({ open, star, children }: { open: boolean; star: RefObject<HTMLElement | null>; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [was, setWas] = useState(open);
  const [out, setOut] = useState(false); // fully out of the star
  const [origin, setOrigin] = useState("0 100%");
  if (open !== was) {
    setWas(open);
    if (open) setMounted(true);
  }

  useLayoutEffect(() => {
    if (!mounted) return;
    const aim = () => {
      const w = wrap.current?.getBoundingClientRect();
      const s = star.current?.getBoundingClientRect();
      if (w && s) setOrigin(`${s.left + s.width / 2 - w.left}px ${s.top + s.height / 2 - w.top}px`);
    };
    let r2 = 0;
    let t = 0;
    const r1 = requestAnimationFrame(() => {
      aim();
      if (open) r2 = requestAnimationFrame(() => setOut(true));
      else {
        setOut(false);
        t = window.setTimeout(() => setMounted(false), OUT_MS);
      }
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
    };
  }, [open, mounted, star]);

  if (!mounted) return null;
  return (
    <div ref={wrap}>
      <div
        style={{
          transformOrigin: origin,
          transform: out ? "none" : "scale(0.02) rotate(-75deg)",
          opacity: out ? 1 : 0,
          filter: out ? "none" : "blur(6px)",
          transition: out
            ? `transform ${IN_MS}ms cubic-bezier(.2,.85,.25,1), opacity ${IN_MS * 0.5}ms ease-out, filter ${IN_MS}ms`
            : `transform ${OUT_MS}ms cubic-bezier(.65,0,.85,.2), opacity ${OUT_MS}ms cubic-bezier(.8,0,1,.5), filter ${OUT_MS}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// --- the compass star ---------------------------------------------------------------

// A compass rose: four long points and four short, each a lit half and a
// shaded half, in pale gold on a dark round. While it's pulling the facts in,
// it grows, glows and spins like a little black hole.
export function CompassStar({ spin }: { spin?: boolean }) {
  const point = (angle: number, long: number, half: number, k: number) => (
    <g key={k} transform={`rotate(${angle})`}>
      <path d={`M0 0 L0 ${-long} L${half} ${-half * 1.1} Z`} fill="#FFF4DC" />
      <path d={`M0 0 L0 ${-long} L${-half} ${-half * 1.1} Z`} fill="#C9A35F" />
    </g>
  );
  return (
    <svg aria-hidden viewBox="-50 -50 100 100" className={`h-full w-full ${spin ? "animate-[star-spin_0.9s_linear_infinite]" : "animate-[star-spin_60s_linear_infinite]"}`}>
      <circle r="31" fill="none" stroke="rgba(255,236,200,0.28)" strokeWidth="1" />
      <circle r="22" fill="none" stroke="rgba(255,236,200,0.16)" strokeWidth="0.8" strokeDasharray="1.5 3" />
      {[45, 135, 225, 315].map((a, k) => point(a, 27, 6, k))}
      {[0, 90, 180, 270].map((a, k) => point(a, 44, 8, k + 4))}
      <circle r="3.2" fill="#FFF4DC" />
      <circle r="1.4" fill="#C9A35F" />
    </svg>
  );
}

function StarButton({
  starRef,
  pulling,
  busy,
  open,
  label,
  onClick,
}: {
  starRef: RefObject<HTMLButtonElement | null>;
  pulling: boolean;
  busy?: boolean;
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      ref={starRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full p-[5px] transition-[transform,box-shadow] duration-500"
      style={{
        background: "radial-gradient(circle, #03040A 0%, #070A18 42%, #172042 78%, #26335E 100%)",
        transform: pulling ? "scale(1.4)" : "none",
        boxShadow: pulling
          ? "0 0 0 1.5px rgba(255,190,130,0.7), 0 0 26px 8px rgba(255,140,90,0.45), 0 0 60px 12px rgba(120,110,255,0.25)"
          : `0 0 0 1px rgba(255,236,200,${open ? 0.6 : 0.3}), 0 8px 20px -8px rgba(5,8,20,0.7)${open ? ", 0 0 18px 2px rgba(255,220,160,0.3)" : ""}`,
      }}
    >
      <CompassStar spin={pulling || busy} />
    </button>
  );
}

// --- on the Globe: your own song -------------------------------------------------------

export function MyFacts({ post, load, onOpen }: { post: Post | null; load?: Load; onOpen?: (open: boolean) => void }) {
  const [got, setGot] = useState<{ id: string; facts: Facts } | null>(null);
  const [open, setOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const star = useRef<HTMLButtonElement>(null);
  const id = post?.id ?? null;

  useEffect(() => {
    if (!id || !load) return;
    let live = true;
    load(id).then((f) => {
      if (!live || !f?.facts.length) return;
      setGot({ id, facts: f });
      // the first time, they come out by themselves, then go back in
      let shown = false;
      try {
        shown = localStorage.getItem(SEEN + id) === "1";
        localStorage.setItem(SEEN + id, "1");
      } catch {}
      if (!shown) setOpen(true);
    });
    return () => {
      live = false;
    };
  }, [id, load]);

  const facts = got && got.id === id ? got.facts : null;
  const n = facts?.facts.length ?? 0;

  const close = () => {
    setPulling(true);
    setOpen(false);
    setTimeout(() => setPulling(false), OUT_MS);
  };

  // after showing each fact once, they're pulled back into the star
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!open || !auto) return;
    const t = setTimeout(() => {
      setPulling(true);
      setOpen(false);
      setTimeout(() => setPulling(false), OUT_MS);
    }, Math.min(n, 3) * EVERY + 600);
    return () => clearTimeout(t);
  }, [open, n, auto]);

  useEffect(() => onOpen?.(open || pulling), [open, pulling, onOpen]);

  if (!facts || !post) return null;
  return (
    <>
      <div className="absolute bottom-0 left-[18px] z-[1]">
        <StarButton
          starRef={star}
          pulling={pulling}
          open={open}
          label={open ? "Put the facts about your song away" : "Facts about your song"}
          onClick={() => {
            setAuto(false);
            if (open) close();
            else setOpen(true);
          }}
        />
      </div>
      <Flight open={open} star={star}>
        <div className="mb-2">
          <FactsCard post={post} facts={facts} />
        </div>
      </Flight>
    </>
  );
}

// --- in a song you open: only when you tap the star ------------------------------------------

// The card comes out above the song, where there's room, and only asks the
// server for the facts once you tap. On short phones the star sits top left,
// clear of the play button.

export function FactsButton({ post, load }: { post: Post; load?: Load }) {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [busy, setBusy] = useState(false);
  const [none, setNone] = useState(false);
  const [open, setOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const star = useRef<HTMLButtonElement>(null);
  if (!load) return null;

  const tap = async () => {
    if (open) {
      setPulling(true);
      setOpen(false);
      setTimeout(() => setPulling(false), OUT_MS);
      return;
    }
    if (facts) return setOpen(true);
    setBusy(true);
    const f = await load(post.id).catch(() => null);
    setBusy(false);
    if (f?.facts.length) {
      setFacts(f);
      setOpen(true);
    } else {
      setNone(true);
      setTimeout(() => setNone(false), 2600);
    }
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-[max(20px,env(safe-area-inset-top))] z-[2] flex justify-center [@media(max-height:739px)]:top-[calc(max(20px,env(safe-area-inset-top))+54px)]">
        {facts && (
          <Flight open={open} star={star}>
            <FactsCard post={post} facts={facts} />
          </Flight>
        )}
      </div>
      <div className="absolute bottom-[calc(46px+env(safe-area-inset-bottom))] left-[18px] z-[2] flex items-center gap-2.5 [@media(max-height:739px)]:bottom-auto [@media(max-height:739px)]:top-[max(20px,env(safe-area-inset-top))]">
        <StarButton
          starRef={star}
          pulling={pulling}
          busy={busy}
          open={open}
          label={open ? "Put the facts away" : `Facts about ${post.title}`}
          onClick={tap}
        />
        {none && (
          <span className="rise-in rounded-full px-3 py-1.5 text-[12px]" style={glass(false)}>
            Nothing on this one yet
          </span>
        )}
      </div>
    </>
  );
}
