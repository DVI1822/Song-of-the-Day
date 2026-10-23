"use client";

import { useEffect, useRef } from "react";

// The core: a gooey blob of light magma that slowly shifts colour. `full`
// adds the glow and the drops that pull away and merge back (the core in the
// middle of the Globe); without it, it's the small icon version.

const FLOWS = 5;
const DROPS = 3;

function frame(t: number) {
  const w = (a: number, b: number, c: number) => (50 + a * Math.sin(t * b + c)).toFixed(1) + "%";
  const radius =
    [w(12, 0.9, 0), w(10, 1.3, 1), w(12, 0.7, 2), w(10, 1.1, 3)].join(" ") +
    " / " +
    [w(10, 1.2, 4), w(12, 0.8, 5), w(10, 1.0, 6), w(12, 1.4, 7)].join(" ");
  const rotate = `rotate(${((t * 9) % 360).toFixed(1)}deg)`;
  const hx = (45 + 8 * Math.sin(t * 0.7)).toFixed(1),
    hy = (42 + 8 * Math.cos(t * 0.6)).toFixed(1);
  const h = (t * 14) % 360;
  const hsl = (dh: number, sat: number, l: number, al = 1) => `hsla(${((h + dh) % 360).toFixed(0)},${sat}%,${l}%,${al})`;
  const blob = (k: number, color: string, size: number, spd: number, orbit: number, op: number, blend: string, blur: string) => {
    const a = t * spd + k * 2.1;
    const x = 50 + orbit * Math.cos(a) - size / 2,
      y = 50 + orbit * Math.sin(a * 1.3) - size / 2;
    return {
      left: x.toFixed(1) + "%",
      top: y.toFixed(1) + "%",
      width: size + "%",
      height: size + "%",
      borderRadius: `${w(15, 1.7, k)} ${w(15, 1.1, k + 1)} ${w(15, 1.5, k + 2)} ${w(15, 0.9, k + 3)}`,
      background: color,
      opacity: String(op),
      mixBlendMode: blend,
      filter: `blur(${blur})`,
    };
  };
  return {
    body: {
      borderRadius: radius,
      transform: rotate,
      background: `radial-gradient(circle at ${hx}% ${hy}%, ${hsl(0, 100, 97)} 0%, ${hsl(25, 100, 88)} 20%, ${hsl(55, 90, 79)} 46%, ${hsl(90, 75, 68)} 72%, ${hsl(120, 60, 55)} 100%)`,
    },
    clip: { borderRadius: radius, transform: rotate },
    flows: [
      blob(0, "#FFFFFF", 38, 0.8, 16, 0.75, "screen", "2px"),
      blob(1, hsl(40, 100, 90), 46, 0.55, 20, 0.6, "screen", "3px"),
      blob(2, hsl(180, 100, 85), 30, 1.1, 24, 0.5, "screen", "2px"),
      blob(3, hsl(150, 45, 50), 34, 0.35, 30, 0.35, "multiply", "3px"),
      blob(4, hsl(200, 45, 55), 24, 0.5, 32, 0.3, "multiply", "2px"),
    ],
    drops: [0, 1, 2].map((i) => {
      const a = t * (0.4 + 0.17 * i) + i * 2.3;
      const out = Math.max(0, Math.sin(t * (0.6 + 0.21 * i) + i * 1.7));
      const r = 26 + 26 * out,
        sz = 24 - 8 * out;
      return {
        left: (50 + r * Math.cos(a) - sz / 2).toFixed(1) + "%",
        top: (50 + r * Math.sin(a) - sz / 2).toFixed(1) + "%",
        width: sz.toFixed(1) + "%",
        height: sz.toFixed(1) + "%",
        background: `radial-gradient(circle at 40% 35%, ${hsl(30, 100, 90)}, ${hsl(70, 85, 76)} 65%, ${hsl(110, 65, 62)})`,
      };
    }),
    glow: {
      background: `radial-gradient(closest-side, ${hsl(30, 100, 82, 0.55)}, ${hsl(70, 90, 70, 0.2)} 45%, rgba(0,0,0,0) 100%)`,
      transform: `scale(${(1 + 0.08 * Math.sin(t * 1.6)).toFixed(3)})`,
    },
  };
}

type Styles = Record<string, string>;
const apply = (el: HTMLElement | null, st: Styles) => {
  if (!el) return;
  for (const k in st) (el.style as unknown as Styles)[k] = st[k];
};

export function MagmaFilters() {
  const goo = (id: string, blur: number) => (
    <filter id={id} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
      <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="g" />
      <feComposite in="SourceGraphic" in2="g" operator="over" />
    </filter>
  );
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        {goo("magmaGoo", 2.4)}
        {goo("magmaGooLg", 5.5)}
      </defs>
    </svg>
  );
}

export function Magma({ full = false, className = "" }: { full?: boolean; className?: string }) {
  const body = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const flows = useRef<(HTMLDivElement | null)[]>([]);
  const drops = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now() - 20_000;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      const f = frame((now - start) / 1000);
      apply(body.current, f.body);
      apply(clip.current, f.clip);
      apply(glow.current, f.glow);
      f.flows.forEach((s, i) => apply(flows.current[i], s));
      f.drops.forEach((s, i) => apply(drops.current[i], s));
      if (!still) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const flowEls = Array.from({ length: FLOWS }, (_, i) => (
    <div key={i} ref={(el) => void (flows.current[i] = el)} className="absolute" />
  ));

  return (
    <div className={`relative ${className}`}>
      {full && <div ref={glow} className="absolute -inset-[100%] rounded-full" />}
      <div className="absolute inset-0" style={full ? { filter: "url(#magmaGooLg)" } : undefined}>
        <div ref={body} className={`absolute ${full ? "inset-[8%]" : "inset-0"}`} />
        {full &&
          Array.from({ length: DROPS }, (_, i) => (
            <div key={i} ref={(el) => void (drops.current[i] = el)} className="absolute rounded-full" />
          ))}
      </div>
      <div ref={clip} className={`absolute overflow-hidden ${full ? "inset-[8%]" : "inset-0"}`}>
        {flowEls}
      </div>
    </div>
  );
}
