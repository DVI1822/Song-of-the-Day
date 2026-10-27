"use client";

import { useEffect, useRef } from "react";
import { drift, type CoreLook } from "./coreLook";

// The core: a gooey blob of light magma that slowly shifts colour. `full`
// adds the glow and the drops that pull away and merge back (the core in the
// middle of the Globe); without it, it's the small icon version. Given a
// `look` (see coreLook.ts), it takes that person's colours, style and drops
// instead.

const FLOWS = 5;
const MAX_DROPS = 6;
const STARS = 12;

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

// Someone's own core, in the style their songs give it.
function styled(t0: number, look: CoreLook) {
  const t = t0 * look.speed,
    wob = look.wobble / 11;
  const w = (a: number, b: number, c: number) => (50 + a * wob * Math.sin(t * b + c)).toFixed(1) + "%";
  const radius =
    [w(12, 0.9, 0), w(10, 1.3, 1), w(12, 0.7, 2), w(10, 1.1, 3)].join(" ") +
    " / " +
    [w(10, 1.2, 4), w(12, 0.8, 5), w(10, 1.0, 6), w(12, 1.4, 7)].join(" ");
  const rotate = `rotate(${((t * 9) % 360).toFixed(1)}deg)`;
  const hx = (45 + 8 * Math.sin(t * 0.7)).toFixed(1),
    hy = (42 + 8 * Math.cos(t * 0.6)).toFixed(1);
  const C = look.colors,
    dark = look.style === "lava" || look.style === "nebula" || look.style === "electric";
  const c = (k: number, white = 0, a = 1) => drift(C, t0 * 0.12 + k * 1.7, white, a);
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
  const mode = dark ? "screen" : "normal";
  const shine = { glossy: 0.55, hazy: 0.3, electric: 0.2, lava: 0.12, nebula: 0.08, matte: 0 }[look.style];
  return {
    body: {
      borderRadius: radius,
      transform: rotate,
      background: dark
        ? `radial-gradient(circle at ${hx}% ${hy}%, ${c(0, 0, 0.9)} 0%, ${look.base} 70%)`
        : `radial-gradient(circle at ${hx}% ${hy}%, ${c(0, 0.35)} 0%, ${c(1, 0.05)} 40%, ${c(2)} 75%, ${look.base} 100%)`,
      filter: look.style === "hazy" ? "blur(1px)" : "",
    },
    clip: { borderRadius: radius, transform: rotate, filter: look.style === "hazy" ? "blur(1.5px)" : "" },
    flows: [
      blob(0, c(0, dark ? 0 : 0.2), 40, 0.8, 16, dark ? 0.9 : 0.7, mode, "4px"),
      blob(1, c(1), 46, 0.55, 20, dark ? 0.75 : 0.6, mode, "5px"),
      blob(2, c(2, 0.1), 30, 1.1, 24, 0.6, mode, "4px"),
      blob(3, c(3), 34, 0.35, 28, 0.5, mode, "5px"),
      blob(4, `rgba(255,255,255,${shine})`, 26, 0.5, 10, 1, "normal", "6px"),
    ],
    drops: Array.from({ length: MAX_DROPS }, (_, i): Styles => {
      if (i >= look.drops) return { width: "0", height: "0" };
      const a = t * (0.4 + 0.17 * (i % 3)) + i * ((Math.PI * 2) / look.drops);
      const out = Math.max(0, Math.sin(t * (0.6 + 0.21 * (i % 3)) + i * 1.7));
      const r = 26 + 26 * out,
        sz = 24 - 8 * out;
      return {
        left: (50 + r * Math.cos(a) - sz / 2).toFixed(1) + "%",
        top: (50 + r * Math.sin(a) - sz / 2).toFixed(1) + "%",
        width: sz.toFixed(1) + "%",
        height: sz.toFixed(1) + "%",
        // the body's own edge colour, so drops melt back into it
        background: dark
          ? `radial-gradient(circle at 40% 35%, ${c(i, 0, 0.6)}, ${look.base} 70%)`
          : `radial-gradient(circle at 40% 35%, ${c(2, 0.1)}, ${look.base} 80%)`,
      };
    }),
    glow: {
      background: `radial-gradient(closest-side, ${c(0, 0.2, dark ? 0.5 : 0.4)}, ${c(1, 0, 0.18)} 45%, rgba(0,0,0,0) 100%)`,
      transform: `scale(${(1 + 0.08 * Math.sin(t * 1.6)).toFixed(3)})`,
    },
    rim: (look.style === "electric"
      ? {
          borderRadius: radius,
          transform: rotate,
          boxShadow: `0 0 0 1.5px ${c(2, 0.2)}, 0 0 10px 1px ${c(2, 0, 0.5 + 0.4 * Math.abs(Math.sin(t0 * 3.1)))}`,
        }
      : { boxShadow: "none" }) as Styles,
    stars: Array.from({ length: STARS }, (_, i) => ({
      left: (50 + 30 * Math.sin(i * 12.9 + t0 * 0.05) + 3 * Math.sin(t0 * 0.3 + i)).toFixed(1) + "%",
      top: (50 + 30 * Math.cos(i * 7.3 + t0 * 0.04) + 3 * Math.cos(t0 * 0.25 + i)).toFixed(1) + "%",
      opacity: look.stars ? (0.25 + 0.75 * Math.abs(Math.sin(t0 * 1.5 + i))).toFixed(2) : "0",
    })),
    sheen: { opacity: look.sheen ? "0.3" : "0" },
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

type MagmaProps = { full?: boolean; className?: string; look?: CoreLook | null };
export function Magma({ full = false, className = "", look }: MagmaProps) {
  const body = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const rim = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);
  const flows = useRef<(HTMLDivElement | null)[]>([]);
  const drops = useRef<(HTMLDivElement | null)[]>([]);
  const stars = useRef<(HTMLDivElement | null)[]>([]);
  const lookRef = useRef(look);
  useEffect(() => {
    lookRef.current = look;
  }, [look]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now() - 20_000;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      const t = (now - start) / 1000,
        lk = lookRef.current;
      if (lk) {
        const f = styled(t, lk);
        apply(rim.current, f.rim);
        apply(sheen.current, f.sheen);
        f.stars.forEach((s, i) => apply(stars.current[i], s));
        apply(body.current, f.body);
        apply(clip.current, f.clip);
        apply(glow.current, f.glow);
        f.flows.forEach((s, i) => apply(flows.current[i], s));
        f.drops.forEach((s, i) => apply(drops.current[i], s));
      } else {
        const f = frame(t);
        apply(rim.current, { boxShadow: "none" });
        apply(sheen.current, { opacity: "0" });
        stars.current.forEach((el) => apply(el, { opacity: "0" }));
        apply(body.current, { ...f.body, filter: "" });
        apply(clip.current, { ...f.clip, filter: "" });
        apply(glow.current, f.glow);
        f.flows.forEach((s, i) => apply(flows.current[i], s));
        drops.current.forEach((el, i) => apply(el, f.drops[i] ?? { width: "0", height: "0" }));
      }
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
        {/* drops sit under the body, so only the part that's pulled away shows */}
        {full &&
          Array.from({ length: MAX_DROPS }, (_, i) => (
            <div key={i} ref={(el) => void (drops.current[i] = el)} className="absolute rounded-full" />
          ))}
        <div ref={body} className={`absolute ${full ? "inset-[8%]" : "inset-0"}`} />
      </div>
      <div ref={clip} className={`absolute overflow-hidden ${full ? "inset-[8%]" : "inset-0"}`}>
        {flowEls}
        {/* an early riser's warm sheen, and a night owl's stars */}
        <div
          ref={sheen}
          className="absolute left-[15%] top-[8%] h-[45%] w-[70%] rounded-full bg-[#FFD9A0] blur-[6px]"
          style={{ opacity: 0 }}
        />
        {full &&
          Array.from({ length: STARS }, (_, i) => (
            <div
              key={i}
              ref={(el) => void (stars.current[i] = el)}
              className="absolute h-[2px] w-[2px] rounded-full bg-white"
              style={{ opacity: 0 }}
            />
          ))}
      </div>
      {/* electric cores get a glowing edge */}
      <div ref={rim} className={`pointer-events-none absolute ${full ? "inset-[8%]" : "inset-0"}`} />
    </div>
  );
}
