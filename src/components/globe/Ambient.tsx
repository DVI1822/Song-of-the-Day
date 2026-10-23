"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Rare little moments in the sky, a few an hour so they stay a surprise.
// Night: a shooting star, a constellation glinting in, a comet, a UFO or a
// far-off spaceship. Day: a cloud, a passing rain cloud, a bird, a bug.
//
// To see them without waiting, open the page with ?sky=1 (one every few
// seconds) or ?sky=ufo (just that one).

const NIGHT = ["shooting", "shooting", "constellation", "constellation", "comet", "ufo", "ship"] as const;
const DAY = ["cloud", "cloud", "cloud", "rain", "bird", "bird", "bug"] as const;
type Kind = (typeof NIGHT)[number] | (typeof DAY)[number];
type Event = { id: number; kind: Kind; style: CSSProperties; flip: boolean };

const MIN_GAP = 7 * 60_000;
const MAX_GAP = 22 * 60_000;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function build(kind: Kind, w: number, h: number): Event {
  const flip = Math.random() < 0.5; // left-to-right or the other way
  const across = (y0: number, y1: number, pad: number) => ({
    "--x0": `${flip ? w + pad : -pad}px`,
    "--x1": `${flip ? -pad : w + pad}px`,
    "--y0": `${y0}px`,
    "--y1": `${y1}px`,
  });
  let style: Record<string, string | number>;
  switch (kind) {
    case "shooting": {
      const x = rand(0.1, 0.9) * w,
        y = rand(0.05, 0.45) * h;
      const dx = (flip ? -1 : 1) * rand(160, 260),
        dy = rand(60, 140);
      style = {
        "--x0": `${x}px`,
        "--y0": `${y}px`,
        "--x1": `${x + dx}px`,
        "--y1": `${y + dy}px`,
        "--rot": `${Math.atan2(dy, dx)}rad`,
        animationDuration: `${rand(0.8, 1.3)}s`,
      };
      break;
    }
    case "constellation":
      style = { left: rand(0.08, 0.7) * w, top: rand(0.06, 0.3) * h, animationDuration: "7s" };
      break;
    case "comet":
      style = { ...across(rand(0.05, 0.3) * h, rand(0.1, 0.4) * h, 120), animationDuration: `${rand(24, 34)}s` };
      break;
    case "ufo":
    case "ship":
      style = { ...across(rand(0.08, 0.35) * h, rand(0.05, 0.4) * h, 40), animationDuration: `${rand(12, 18)}s` };
      break;
    case "cloud":
    case "rain":
      style = { ...across(rand(0.03, 0.2) * h, rand(0.03, 0.2) * h, 230), animationDuration: `${rand(70, 110)}s` };
      break;
    case "bird":
      style = { ...across(rand(0.08, 0.35) * h, rand(0.05, 0.3) * h, 30), animationDuration: `${rand(9, 14)}s` };
      break;
    case "bug":
      style = { left: rand(0.2, 0.75) * w, top: rand(0.2, 0.6) * h, animationDuration: "7s" };
      break;
  }
  return { id: Date.now(), kind, style: style as CSSProperties, flip };
}

export function Ambient({ dark, w, h }: { dark: boolean; w: number; h: number }) {
  const [ev, setEv] = useState<Event | null>(null);

  // The next moment is timed from the end of the last one.
  useEffect(() => {
    if (ev) return;
    const q = new URLSearchParams(window.location.search).get("sky");
    const only = q && ([...NIGHT, ...DAY] as string[]).includes(q) ? (q as Kind) : null;
    const t = setTimeout(
      () => {
        const pool = dark ? NIGHT : DAY;
        setEv(build(only ?? pool[Math.floor(Math.random() * pool.length)], w, h));
      },
      q ? 4000 : rand(MIN_GAP, MAX_GAP),
    );
    return () => clearTimeout(t);
  }, [ev, dark, w, h]);

  if (!ev) return null;
  const done = () => setEv((cur) => (cur?.id === ev.id ? null : cur));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <Thing key={ev.id} ev={ev} onDone={done} />
    </div>
  );
}

function Thing({ ev, onDone }: { ev: Event; onDone(): void }) {
  const travel = { ...ev.style, animationName: "sky-travel", animationTimingFunction: "linear", animationFillMode: "both" };
  const end = { onAnimationEnd: (e: React.AnimationEvent) => e.target === e.currentTarget && onDone() };
  const face = ev.flip ? { transform: "scaleX(-1)" } : undefined;

  switch (ev.kind) {
    case "shooting":
      return (
        <div {...end} className="absolute left-0 top-0" style={{ ...ev.style, animationName: "sky-shoot", animationTimingFunction: "ease-out", animationFillMode: "both" }}>
          <div
            className="h-px w-[90px] origin-right"
            style={{ transform: "translateX(-100%) rotate(var(--rot))", background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75))" }}
          />
        </div>
      );
    case "constellation": {
      const pts = [
        [0, 18],
        [22, 6],
        [44, 14],
        [58, 34],
        [84, 30],
        [96, 52],
      ];
      return (
        <svg {...end} width="110" height="64" className="absolute" style={{ ...ev.style, animationName: "sky-glint", animationFillMode: "both" }}>
          <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="rgba(200,220,255,0.18)" strokeWidth="0.6" />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x + 3} cy={y + 3} r={i % 2 ? 1.1 : 1.5} fill="#fff" className="sky-twinkle" style={{ animationDelay: `${i * 0.35}s` }} />
          ))}
        </svg>
      );
    }
    case "comet":
      return (
        <div {...end} className="absolute left-0 top-0" style={{ ...travel, opacity: 0.7 }}>
          <div style={face} className="relative">
            <div className="absolute -left-[110px] top-[1px] h-[3px] w-[110px] rounded-full" style={{ background: "linear-gradient(90deg, rgba(160,220,255,0), rgba(190,235,255,0.55))", filter: "blur(1px)" }} />
            <div className="h-[5px] w-[5px] rounded-full bg-white" style={{ boxShadow: "0 0 8px 3px rgba(190,235,255,0.7)" }} />
          </div>
        </div>
      );
    case "ufo":
      return (
        <div {...end} className="absolute left-0 top-0" style={travel}>
          <svg width="22" height="12" viewBox="0 0 22 12" className="sky-bob opacity-80">
            <ellipse cx="11" cy="4.5" rx="4" ry="3.2" fill="rgba(180,230,255,0.55)" />
            <ellipse cx="11" cy="7" rx="10" ry="2.6" fill="#8C98A6" />
            <circle cx="5" cy="7.2" r="0.9" fill="#B6FF9C" className="sky-twinkle" />
            <circle cx="11" cy="7.8" r="0.9" fill="#FFE17A" className="sky-twinkle" style={{ animationDelay: ".3s" }} />
            <circle cx="17" cy="7.2" r="0.9" fill="#B6FF9C" className="sky-twinkle" style={{ animationDelay: ".6s" }} />
          </svg>
        </div>
      );
    case "ship":
      return (
        <div {...end} className="absolute left-0 top-0" style={{ ...travel, animationDuration: `calc(${ev.style.animationDuration} * 1.5)` }}>
          <svg width="16" height="8" viewBox="0 0 16 8" style={face} className="opacity-75">
            <path d="M0 4 L12 1 L16 4 L12 7 Z" fill="#AEB8C4" />
            <circle cx="1" cy="4" r="1.2" fill="#FF9B6B" className="sky-twinkle" />
          </svg>
        </div>
      );
    case "cloud":
    case "rain":
      return (
        <div {...end} className="absolute left-0 top-0" style={travel}>
          <div className="relative h-[70px] w-[220px]" style={{ opacity: ev.kind === "rain" ? 0.9 : 0.85 }}>
            {[
              [0, 30, 90, 40],
              [50, 8, 100, 60],
              [120, 22, 90, 46],
              [30, 40, 150, 30],
            ].map(([x, y, cw, ch], i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: x,
                  top: y,
                  width: cw,
                  height: ch,
                  background: ev.kind === "rain" ? "radial-gradient(closest-side, #AEBBC7 40%, rgba(174,187,199,0))" : "radial-gradient(closest-side, #FFFFFF 45%, rgba(255,255,255,0))",
                  boxShadow: i === 3 ? "0 10px 18px -12px rgba(110,140,165,0.35)" : undefined,
                }}
              />
            ))}
            {ev.kind === "rain" && <div className="sky-rain absolute left-[40px] top-[56px] h-[90px] w-[140px]" />}
          </div>
        </div>
      );
    case "bird":
      return (
        <div {...end} className="absolute left-0 top-0" style={travel}>
          <svg width="18" height="10" viewBox="0 0 18 10" style={face}>
            <path className="sky-flap" d="M1 3 Q5 0 9 5 Q13 0 17 3" fill="none" stroke="#3E5566" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      );
    case "bug":
      return (
        <div {...end} className="absolute" style={{ ...ev.style, animationName: "sky-buzz", animationFillMode: "both", animationTimingFunction: "ease-in-out" }}>
          <svg width="8" height="6" viewBox="0 0 8 6">
            <ellipse className="sky-wing" cx="3" cy="1.6" rx="2" ry="1.3" fill="rgba(210,225,235,0.8)" />
            <ellipse className="sky-wing" cx="5" cy="1.6" rx="2" ry="1.3" fill="rgba(210,225,235,0.8)" />
            <ellipse cx="4" cy="3.6" rx="2.2" ry="1.6" fill="#2E3A40" />
          </svg>
        </div>
      );
  }
}
