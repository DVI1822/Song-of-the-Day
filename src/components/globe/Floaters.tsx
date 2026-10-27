"use client";

import type { CSSProperties, ReactNode } from "react";
import { camV, latLon, type Bit, type Camera, type V3 } from "./math";

// A handful of little things floating in the globe's invisible water with the
// songs: pumpkins and candy corn in October, hearts in February. They drift
// quicker than the songs, knock apart any that stick together, and spin when
// they're hit. Each is built in 3D from a few crossed slices.
//
// Try any month's set with ?month=2 (1 is January).

export type Kind =
  | "pumpkin"
  | "leaf"
  | "candycorn"
  | "football"
  | "snowflake"
  | "snowball"
  | "star"
  | "heart"
  | "shamrock"
  | "basketball"
  | "egg"
  | "flower"
  | "sunflower"
  | "beachball"
  | "watermelon"
  | "apple"
  | "ornament"
  | "candycane";

// what's big each month
const MONTHS: Kind[][] = [
  ["snowflake", "snowflake", "snowball", "snowball", "star"],
  ["heart", "heart", "heart", "football"],
  ["shamrock", "shamrock", "shamrock", "basketball"],
  ["egg", "egg", "egg", "flower"],
  ["flower", "flower", "flower", "sunflower"],
  ["beachball", "beachball", "flower", "watermelon"],
  ["star", "star", "star", "watermelon", "beachball"],
  ["beachball", "beachball", "sunflower", "sunflower", "watermelon"],
  ["apple", "apple", "leaf", "leaf", "football"],
  ["pumpkin", "pumpkin", "leaf", "leaf", "candycorn", "candycorn", "football"],
  ["leaf", "leaf", "leaf", "pumpkin", "football"],
  ["ornament", "ornament", "ornament", "snowflake", "snowflake", "candycane"],
];

export function monthOverride(): number | null {
  const q = Number(new URLSearchParams(window.location.search).get("month"));
  return Number.isInteger(q) && q >= 1 && q <= 12 ? q - 1 : null;
}

// how big each is, next to half a song tile
const SIZE: Record<Kind, number> = {
  pumpkin: 0.46,
  leaf: 0.42,
  candycorn: 0.32,
  football: 0.4,
  snowflake: 0.4,
  snowball: 0.34,
  star: 0.38,
  heart: 0.38,
  shamrock: 0.4,
  basketball: 0.4,
  egg: 0.34,
  flower: 0.4,
  sunflower: 0.44,
  beachball: 0.44,
  watermelon: 0.4,
  apple: 0.38,
  ornament: 0.36,
  candycane: 0.4,
};

export function floatersFor(month: number, half: number) {
  return MONTHS[month].map((kind) => ({ kind, r: Math.max(12, SIZE[kind] * half * 1.25) }));
}

export type BitEl = { box: HTMLDivElement | null };

const slice: CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "visible", filter: "brightness(var(--lit, 1))" };
const svg = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${body}</svg>`)}")`;

// A round thing from slices turning about one axis: a paper-lantern ball.
function Ball({
  base,
  light,
  dark,
  rib,
  n = 8,
  sx = 1,
  sy = 1,
  colors,
  children,
}: {
  base: string;
  light: string;
  dark: string;
  rib?: string;
  n?: number;
  sx?: number;
  sy?: number;
  colors?: string[];
  children?: ReactNode;
}) {
  return (
    <div className="preserve-3d absolute inset-0" style={{ transform: `scale3d(${sx},${sy},${sx})` }}>
      {Array.from({ length: n }, (_, i) => {
        const c = colors ? colors[i % colors.length] : base;
        return (
          <div
            key={i}
            style={{
              ...slice,
              borderRadius: "50%",
              transform: `rotateY(${(i * 180) / n}deg)`,
              background: colors ? c : `radial-gradient(circle at 38% 32%, ${light}, ${c} 55%, ${dark})`,
              boxShadow: rib ? `inset 0 0 0 1.5px ${rib}` : undefined,
            }}
          />
        );
      })}
      {/* the middle, so it reads round from above too */}
      <div
        style={{
          ...slice,
          borderRadius: "50%",
          transform: "rotateX(90deg)",
          background: colors ? colors[0] : `radial-gradient(circle, ${base} 60%, ${dark})`,
          boxShadow: rib ? `inset 0 0 0 1.5px ${rib}` : undefined,
        }}
      />
      {children}
    </div>
  );
}

// A flat thing with a little thickness.
function Flat({ art, edge, spin = 0 }: { art: string; edge: string; spin?: number }) {
  const one = (z: number, bg: string) => (
    <div
      style={{
        ...slice,
        transform: `rotateY(${spin}deg) translateZ(${z}px)`,
        background: bg,
        backgroundSize: "100% 100%",
      }}
    />
  );
  return (
    <div className="preserve-3d absolute inset-0">
      {one(-1.2, art)}
      {one(0, edge)}
      {one(1.2, art)}
    </div>
  );
}

// the same picture as a solid colour, for the edge layer
const solid = (body: string, color: string) => svg(body.replace(/fill='[^']*'/g, `fill='${color}'`).replace(/stroke='[^']*'/g, `stroke='${color}'`));

const ART = {
  leaf: "<path fill='COLOR' d='M50 4 C62 22 78 22 90 30 C80 40 86 52 94 60 C78 62 70 66 66 80 C58 72 54 76 50 96 C46 76 42 72 34 80 C30 66 22 62 6 60 C14 52 20 40 10 30 C22 22 38 22 50 4 Z'/><path stroke='VEIN' stroke-width='2.5' fill='none' d='M50 18 V92 M50 50 L26 36 M50 50 L74 36 M50 66 L30 64 M50 66 L70 64'/>",
  heart: "<path fill='#E8445A' d='M50 88 C20 64 6 48 6 30 C6 16 18 6 30 6 C40 6 46 12 50 20 C54 12 60 6 70 6 C82 6 94 16 94 30 C94 48 80 64 50 88 Z'/><ellipse fill='#FF9AA8' cx='30' cy='26' rx='9' ry='6'/>",
  shamrock:
    "<g fill='#3FA34D'><circle cx='50' cy='28' r='19'/><circle cx='29' cy='52' r='19'/><circle cx='71' cy='52' r='19'/></g><path stroke='#2D7A38' stroke-width='6' fill='none' d='M50 54 Q52 76 64 94'/>",
  snowflake:
    "<g stroke='#EAF6FF' stroke-width='7' stroke-linecap='round' fill='none'><path d='M50 6 V94 M12 28 L88 72 M12 72 L88 28'/><path d='M38 14 L50 24 L62 14 M38 86 L50 76 L62 86 M14 42 L26 37 L22 24 M86 58 L74 63 L78 76 M14 58 L26 63 L22 76 M86 42 L74 37 L78 24'/></g>",
  star: "<path fill='COLOR' d='M50 4 L62 36 L96 38 L69 58 L79 92 L50 72 L21 92 L31 58 L4 38 L38 36 Z'/>",
  flower:
    "<g fill='COLOR'><circle cx='50' cy='24' r='18'/><circle cx='76' cy='42' r='18'/><circle cx='66' cy='72' r='18'/><circle cx='34' cy='72' r='18'/><circle cx='24' cy='42' r='18'/></g><circle fill='#FFD24A' cx='50' cy='50' r='14'/>",
  sunflower:
    "<g fill='#FFC425'>" +
    Array.from({ length: 12 }, (_, i) => `<ellipse cx='50' cy='16' rx='9' ry='16' transform='rotate(${i * 30} 50 50)'/>`).join("") +
    "</g><circle fill='#6B3E1F' cx='50' cy='50' r='19'/>",
  watermelon:
    "<path fill='#3E8E3E' d='M4 30 A46 46 0 0 0 96 30 Z'/><path fill='#F2F7E8' d='M10 30 A40 40 0 0 0 90 30 Z'/><path fill='#F0485B' d='M14 30 A36 36 0 0 0 86 30 Z'/><g fill='#2B1A1A'><ellipse cx='36' cy='44' rx='2.5' ry='4'/><ellipse cx='50' cy='52' rx='2.5' ry='4'/><ellipse cx='64' cy='44' rx='2.5' ry='4'/><ellipse cx='44' cy='38' rx='2.5' ry='4'/><ellipse cx='58' cy='38' rx='2.5' ry='4'/></g>",
  candycane:
    "<path stroke='#FFFFFF' stroke-width='16' stroke-linecap='round' fill='none' d='M40 94 V34 A16 16 0 0 1 72 34 V42'/><path stroke='#E8303F' stroke-width='16' stroke-dasharray='9 9' fill='none' d='M40 94 V34 A16 16 0 0 1 72 34 V42'/>",
  candycorn: "<path fill='#FFF8EC' d='M50 6 L62 36 L38 36 Z'/><path fill='#F7881F' d='M38 36 L62 36 L74 66 L26 66 Z'/><path fill='#FFCC2E' d='M26 66 L74 66 L82 86 Q50 98 18 86 Z'/>",
};
const tint = (body: string, color: string, vein = "rgba(0,0,0,0.25)") => body.replace("COLOR", color).replace("VEIN", vein);

function Shape({ kind, i, r }: { kind: Kind; i: number; r: number }) {
  switch (kind) {
    case "pumpkin":
      return (
        <Ball base="#F28A1C" light="#FFC266" dark="#B85A0C" rib="rgba(140,60,10,0.55)" sy={0.82}>
          <div
            style={{
              ...slice,
              inset: "auto",
              left: "44%",
              top: "-8%",
              width: "12%",
              height: "22%",
              borderRadius: 4,
              background: "linear-gradient(90deg,#4E6B2A,#7FA046)",
            }}
          />
        </Ball>
      );
    case "football":
      return (
        <div className="preserve-3d absolute inset-0" style={{ transform: "rotateZ(90deg)" }}>
          <Ball base="#8A4B25" light="#B9763F" dark="#5A2E14" sx={0.62} n={6}>
            <div
              style={{
                ...slice,
                inset: "auto",
                left: "40%",
                top: "28%",
                width: "20%",
                height: "44%",
                transform: `rotateY(90deg) translateZ(${r.toFixed(1)}px)`,
                background: "repeating-linear-gradient(0deg,#fff 0 2px,transparent 2px 6px), linear-gradient(90deg,transparent 45%,#fff 45% 55%,transparent 55%)",
              }}
            />
          </Ball>
        </div>
      );
    case "snowball":
      return <Ball base="#F4F9FF" light="#FFFFFF" dark="#B9CBE0" />;
    case "basketball":
      return <Ball base="#E8742A" light="#FFA45E" dark="#A2470F" rib="rgba(40,20,10,0.8)" n={4} />;
    case "egg":
      return <Ball base={["#F7B6D2", "#B9E3F7", "#FFE79A"][i % 3]} light="#FFFFFF" dark={["#D47FA6", "#7FB8D8", "#E2BE4C"][i % 3]} sx={0.78} />;
    case "beachball":
      return <Ball base="#fff" light="#fff" dark="#ddd" colors={["#FF5A5F", "#FFFFFF", "#3BA7F5", "#FFD23F"]} n={4} />;
    case "apple":
      return (
        <Ball base="#D7262B" light="#FF6B6B" dark="#8E1216" sy={0.9}>
          <div style={{ ...slice, inset: "auto", left: "47%", top: "-4%", width: "7%", height: "18%", background: "#5A3A1E" }} />
        </Ball>
      );
    case "ornament":
      return (
        <Ball base={["#D7262B", "#2E8B57", "#E2B53E"][i % 3]} light="#FFFFFF" dark={["#7E1015", "#165233", "#A07A1A"][i % 3]}>
          <div style={{ ...slice, inset: "auto", left: "40%", top: "-6%", width: "20%", height: "12%", borderRadius: 2, background: "#C9CFD6" }} />
        </Ball>
      );
    case "candycorn":
      return (
        <div className="preserve-3d absolute inset-0">
          {[0, 60, 120].map((a) => (
            <div key={a} style={{ ...slice, transform: `rotateY(${a}deg)`, background: svg(ART.candycorn) }} />
          ))}
        </div>
      );
    case "leaf": {
      const c = ["#E3672A", "#C9381E", "#E8A41F"][i % 3];
      const body = tint(ART.leaf, c);
      return <Flat art={svg(body)} edge={solid(body, "#8A3A14")} />;
    }
    case "star": {
      const c = ["#E8303F", "#FFFFFF", "#2F6BD8", "#FFD23F"][i % 4];
      const body = tint(ART.star, c);
      return <Flat art={svg(body)} edge={solid(body, "#9AA3B5")} />;
    }
    case "flower": {
      const c = ["#F7A1C4", "#B9A5F2", "#FFFFFF"][i % 3];
      const body = tint(ART.flower, c);
      return <Flat art={svg(body)} edge={solid(body, "#C77D9C")} />;
    }
    case "heart":
    case "shamrock":
    case "snowflake":
    case "sunflower":
    case "watermelon":
    case "candycane": {
      const body = ART[kind];
      const edge = { heart: "#A82235", shamrock: "#256B30", snowflake: "#A9C6E0", sunflower: "#B9860F", watermelon: "#2B6A2B", candycane: "#B0202C" }[kind];
      return <Flat art={svg(body)} edge={solid(body, edge)} />;
    }
  }
}

export function FloaterLayer({ items, els }: { items: { kind: Kind; r: number }[]; els: React.RefObject<BitEl[]> }) {
  return items.map(({ kind, r }, i) => {
    els.current[i] ??= { box: null };
    const be = els.current[i];
    return (
      <div
        key={i}
        ref={(el) => void (be.box = el)}
        aria-hidden
        className="preserve-3d pointer-events-none absolute"
        style={{ left: -r, top: -r, width: 2 * r, height: 2 * r, transformOrigin: `${r}px ${r}px` }}
      >
        <Shape kind={kind} i={i} r={r} />
      </div>
    );
  });
}

// One frame: each rides the water at its spot, turned however it's spinning,
// lit like the songs around it.
export function drawFloaters(
  bits: Bit[],
  els: BitEl[],
  { Rb, cam, zoom, L, day, hide }: { Rb: number; cam: Camera; zoom: number; L: V3; day: number; hide: boolean },
) {
  bits.forEach((o, i) => {
    const box = els[i]?.box;
    if (!box) return;
    if (hide) {
      box.style.visibility = "hidden";
      return;
    }
    const { lat, lon } = latLon(o.p);
    const out: V3 = [Math.cos(lat) * Math.sin(lon), -Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
    const ez = camV(out, cam);
    const camZ = zoom * Rb * ez[2];
    if (camZ > 820) {
      box.style.visibility = "hidden";
      return;
    }
    box.style.visibility = "";
    const R = o.R;
    const m = [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, 0, 0, 0, 1];
    box.style.transform =
      `rotateY(${lon.toFixed(4)}rad) rotateX(${lat.toFixed(4)}rad) translateZ(${(Rb + o.r * 0.45 + o.f.h).toFixed(2)}px) ` +
      `matrix3d(${m.map((x) => x.toFixed(4)).join(",")})`;
    const lit = ez[0] * L[0] + ez[1] * L[1] + ez[2] * L[2];
    box.style.setProperty("--lit", (0.45 + 0.55 * day * (0.55 + 0.45 * Math.max(0, lit)) + 0.15 * (1 - day)).toFixed(3));
  });
}
