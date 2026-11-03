"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Post, SongFacts as Facts } from "@/lib/types";
import { glass } from "./ui";

// Facts about a song (how it was made, the story behind it, the artist), one
// at a time, beside a less-seen photo of the artist. They live in a compass
// star button at the globe's bottom left, opposite the "bring the songs to the
// front" button: right after you post, your song's facts come out on their
// own, then get pulled back into the star like a black hole. A tap on the star
// brings them out again. In any song you open, the star sits on the bottom
// right of the album cover, and its facts only come out when you tap it.

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

// A plain compass star, drawn like the Globe's other button icons: one
// colour (the button's ink), a four-point star with short ticks between the
// points. While it's pulling the facts in it spins, like a little black hole.
export function CompassStar({ spin }: { spin?: boolean }) {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className={spin ? "animate-[star-spin_0.8s_linear_infinite]" : ""}
    >
      <path d="M12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5Z" fill="currentColor" />
      <path d="M5.6 5.6 7.6 7.6M18.4 5.6 16.4 7.6M5.6 18.4 7.6 16.4M18.4 18.4 16.4 16.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// The round glass button, the twin of the "bring the songs to the front"
// button on the other side of the globe.
function StarButton({
  starRef,
  pulling,
  busy,
  open,
  label,
  dark,
  onClick,
}: {
  starRef: RefObject<HTMLButtonElement | null>;
  pulling: boolean;
  busy?: boolean;
  open: boolean;
  label: string;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={starRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-500"
      style={{ ...glass(dark), transform: pulling ? "scale(1.25)" : "none" }}
    >
      <CompassStar spin={pulling || busy} />
    </button>
  );
}

// --- on the Globe: your own song -------------------------------------------------------

export function MyFacts({
  post,
  load,
  onOpen,
  starHost,
  dark,
}: {
  post: Post | null;
  load?: Load;
  onOpen?: (open: boolean) => void;
  starHost: HTMLElement | null;
  dark: boolean;
}) {
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
      {starHost &&
        createPortal(
          <StarButton
            starRef={star}
            pulling={pulling}
            open={open}
            dark={dark}
            label={open ? "Put the facts about your song away" : "Facts about your song"}
            onClick={() => {
              setAuto(false);
              if (open) close();
              else setOpen(true);
            }}
          />,
          starHost,
        )}
      <Flight open={open} star={star}>
        <div className="mb-2">
          <FactsCard post={post} facts={facts} />
        </div>
      </Flight>
    </>
  );
}

// --- in a song you open: only when you tap the star ------------------------------------------

// The star sits on the bottom right of the album cover; the card comes out
// above the song, where there's room, and the facts are only asked for once
// you tap.
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
      {facts &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-[max(20px,env(safe-area-inset-top))] z-[490] flex justify-center">
            <Flight open={open} star={star}>
              <FactsCard post={post} facts={facts} />
            </Flight>
          </div>,
          document.body,
        )}
      <div className="absolute bottom-3 right-3 z-[2] flex flex-row-reverse items-center gap-2">
        <StarButton
          starRef={star}
          pulling={pulling}
          busy={busy}
          open={open}
          dark={false}
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
