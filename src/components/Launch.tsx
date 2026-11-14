"use client";

import { useEffect, useRef, useState } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { isApp } from "@/lib/native";

// What you see when TopTrack first opens: song covers fly in from every side
// and build the Globe (it's made of everyone's posts), spinning on its tilted
// axis; then the gold crown shoots down that axis, bounces twice on the north
// pole and floats up to its spot, where it keeps turning with the globe. Then
// the paper fades and the globe and crown shrink into the O of the TopTrack
// logo on the page underneath.
//
// It plays once per visit (a tab, or a launch of the iPhone app): a script
// in <head> (LAUNCH_SCRIPT, layout.tsx) marks the page before it's drawn so
// later page loads skip it without a flash. Tapping skips it.
//
// In the iPhone app, the native splash screen (ios/App/App/Assets.xcassets/
// Splash.imageset) is this exact first frame, plain paper before the first
// tile flies in, so hiding it here is invisible and the animation simply starts.
//
// It's drawn into an SVG every frame from JavaScript, not CSS animations, so
// it plays with Reduce Motion on too (the Globe's other moments do).

export const LAUNCH_KEY = "tt-launched";
export const LAUNCH_SCRIPT = `try{if(sessionStorage.getItem("${LAUNCH_KEY}"))document.documentElement.setAttribute("data-launched","");else sessionStorage.setItem("${LAUNCH_KEY}","1")}catch(e){}`;

const PAPER = "#fffdf6";
const NAVY = "#0d2a3f";
const GOLD = "#ffc94a";
const GOLD_IN = "#e8a92f"; // the inside of the band, seen over the far rim
const CORAL = "#ff5e57";
const CORAL_IN = "#d9443e";

// the globe
export const R = 78; // radius, px (the native splash is drawn to match)
const TILT = 23.4; // Earth's axis, as on the logo and the Globe
const SPIN = (Math.PI * 2) / 4.2; // one turn every 4.2 s
const W = R / 28; // the logo's globe is 28 across; strokes scale from it, a touch lighter
const SW = W * 0.78;

// the crown: the logo's crown made round, four points like the logo's three
// (the middle one and the two at the edges) seen from the front
const CS = (0.875 * R) / 28; // the logo's crown scale at this globe size
const CR = 20.5; // band radius, crown units
const FLARE = 3; // the points lean outward
const TIP = 27,
  VALLEY = 10;
const LOOK = 0.2; // how far we look down onto the band (ellipse squash)
const CONTACT = R + LOOK * CR * CS - 3; // crown base resting on the north pole, along the axis
const FLOAT = R + 17 + LOOK * CR * CS; // crown base, along the axis, floating

// timeline, seconds
const FLY = 0.5; // each song tile's flight in
const TILES_FROM = 0.5,
  TILES_TO = 1.3; // when the tiles land
const DROP = 1.45; // the crown shoots down the axis
const FALL = 0.32;
const HIT1 = DROP + FALL;
const B1 = 0.3; // first bounce
const HIT2 = HIT1 + B1;
const B2 = 0.16; // second, smaller
const HIT3 = HIT2 + B2;
const RISE = 0.6; // floats up to its spot
const FLOATED = HIT3 + RISE;
const FADE = 3.4; // then it shrinks into the O of the TopTrack logo on the page (or fades)
const FADE_FOR = 0.85;
const DONE = FADE + FADE_FOR;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const f = (n: number) => (Math.round(n * 100) / 100).toString();
// a quick squash that springs back
const pulse = (dt: number, len: number) => (dt < 0 || dt > len ? 0 : Math.sin((dt / len) * Math.PI) * (1 - dt / len));
const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------- the globe
// The globe is made of songs: square covers spread evenly over the ball,
// turning with it. They fly in from every side to build it.

type V = [number, number, number];
const TAU_TILT = (TILT * Math.PI) / 180;
const PITCH = 0.24; // we look down on it a little, so the north pole leans toward us
const AXIS: [number, number] = [Math.sin(TAU_TILT), -Math.cos(TAU_TILT)]; // up the axis, on screen
const COLORS = ["#ff5e57", "#ffc94a", "#b9f0a8", "#8fd0ff", "#0d2a3f", "#c9b6ff", "#ffb38a", "#7fd8c6"];
const HALF = 0.2; // a tile's half-width, in globe radii

const COUNT = 40;
const TILES = Array.from({ length: COUNT }, (_, i) => {
  // a Fibonacci sphere: points spread evenly over the ball
  const y = 1 - ((i + 0.5) / COUNT) * 2;
  const r = Math.sqrt(1 - y * y);
  const lon = i * 2.39996;
  const p: V = [r * Math.sin(lon), y, r * Math.cos(lon)];
  const el = Math.hypot(p[2], p[0]) || 1;
  const e: V = [p[2] / el, 0, -p[0] / el]; // east
  const n: V = [p[1] * e[2] - p[2] * e[1], p[2] * e[0] - p[0] * e[2], p[0] * e[1] - p[1] * e[0]]; // north
  return {
    p,
    e,
    n,
    color: COLORS[Math.floor(rand(i + 3) * COLORS.length)],
    land: TILES_FROM + rand(i + 40) * (TILES_TO - TILES_FROM),
    jitter: (rand(i + 80) - 0.5) * 1.1,
    reach: 560 + rand(i + 120) * 260,
    twist: (rand(i + 160) - 0.5) * 2 * Math.PI,
    dot: rand(i + 200) < 0.45,
  };
});

// a direction on the ball to the screen (x right, y down, z toward us)
function view(v: V, spin: number): V {
  const cs = Math.cos(spin),
    ss = Math.sin(spin);
  const x1 = v[0] * cs + v[2] * ss,
    z1 = -v[0] * ss + v[2] * cs;
  const cp = Math.cos(PITCH),
    sp = Math.sin(PITCH);
  const y2 = v[1] * cp - z1 * sp,
    z2 = v[1] * sp + z1 * cp;
  const X = x1,
    Y = -y2;
  const ct = Math.cos(TAU_TILT),
    st = Math.sin(TAU_TILT);
  return [X * ct - Y * st, X * st + Y * ct, z2];
}

const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");

function tile(corners: [number, number][], c: string, dot: boolean, cx: number, cy: number, scale: number) {
  const inner = dot
    ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(4.2 * scale)}" fill="${c === NAVY ? PAPER : NAVY}" opacity=".85"/>`
    : "";
  return `<polygon points="${poly(corners)}" fill="${c}" stroke="${NAVY}" stroke-width="${f(1.9 * SW)}" stroke-linejoin="round"/>${inner}`;
}

function globe(t: number, squash: number) {
  const spin = t * SPIN;
  const landed: string[] = [];
  const flying: string[] = [];
  for (const [i, T] of TILES.entries()) {
    const c = view(T.p, spin);
    const e = view(T.e, spin),
      n = view(T.n, spin);
    const cx = c[0] * R,
      cy = c[1] * R;
    const offs: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, b]) => [(a * e[0] + b * n[0]) * HALF * R, (a * e[1] + b * n[1]) * HALF * R]);
    const start = T.land - FLY;
    const arrives = view(T.p, T.land * SPIN)[2] > 0.2;
    if (arrives && t < T.land) {
      if (t < start) continue;
      const k = easeOut((t - start) / FLY);
      const at = view(T.p, T.land * SPIN);
      const len = Math.hypot(at[0], at[1]) || 1;
      const ang = Math.atan2(at[1] / len, at[0] / len) + T.jitter + (len < 0.15 ? i : 0);
      const sx = Math.cos(ang) * T.reach,
        sy = Math.sin(ang) * T.reach;
      const px = sx + (cx - sx) * k,
        py = sy + (cy - sy) * k;
      const rot = T.twist * (1 - k),
        grow = 1 + 0.9 * (1 - k);
      const cr = Math.cos(rot),
        sr = Math.sin(rot);
      // in the air it's a flat card; it settles onto the curve as it lands
      const flat = (1 - k) * 0.85;
      const sq: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      const pts = offs.map(([ox, oy], j): [number, number] => {
        const bx = ox * (1 - flat) + sq[j][0] * HALF * R * flat;
        const by = oy * (1 - flat) + sq[j][1] * HALF * R * flat;
        return [px + (bx * cr - by * sr) * grow, py + (bx * sr + by * cr) * grow];
      });
      flying.push(tile(pts, T.color, T.dot, px, py, grow));
      continue;
    }
    // the rest land round the back, out of sight: they only exist once they
    // have, so the globe starts with nothing on it
    if (t < T.land || c[2] <= 0.02) continue;
    const appear = arrives ? 1 : smooth((t - T.land) / 0.2);
    // the ones near the edge are seen side on, and a touch darker
    landed.push(
      `<g opacity="${f((0.55 + 0.45 * clamp(c[2] * 2)) * appear)}">${tile(
        offs.map(([ox, oy]) => [cx + ox, cy + oy]),
        T.color,
        T.dot,
        cx,
        cy,
        Math.max(0.3, c[2]),
      )}</g>`,
    );
  }
  // the ball itself fills in as the songs arrive, and its ink line goes round
  const body = smooth((t - 0.45) / 0.75);
  const line = smooth((t - 0.8) / 0.55);
  const C = 2 * Math.PI * R;
  const sxq = 1 + squash * 0.05,
    syq = 1 - squash * 0.07;
  return `<g transform="rotate(${TILT}) scale(${f(sxq)} ${f(syq)}) rotate(${-TILT})">
    <g opacity="${f(body)}">
      <circle cx="${f(R * 0.14)}" cy="${f(R * 0.14)}" r="${R}" fill="${NAVY}"/>
      <circle r="${R}" fill="${PAPER}"/>
    </g>
    ${landed.join("")}
    <g clip-path="url(#ttl-clip)" opacity="${f(body * 0.3)}">
      <circle cx="${f(-R * 0.3)}" cy="${f(-R * 0.3)}" r="${f(R * 1.45)}" fill="none" stroke="url(#ttl-hatch)" stroke-width="${f(R * 0.9)}"/>
    </g>
    <circle r="${R}" fill="none" stroke="${NAVY}" stroke-width="${f(3 * SW)}" stroke-dasharray="${f(C)}" stroke-dashoffset="${f(C * (1 - line))}" transform="rotate(-120)" stroke-linecap="round"/>
  </g>${flying.join("")}`;
}

// ---------------------------------------------------------------- the crown

// height of the crown's rim at angle a round the band: four points, straight
// lines down to the dips between them
function rim(a: number) {
  const q = (((a / (Math.PI / 2)) % 1) + 1) % 1; // 0 at a point, 0.5 at a dip
  const d = Math.min(q, 1 - q) * 2; // 0 at a point, 1 at a dip
  return TIP - (TIP - VALLEY) * d;
}
const radius = (h: number) => CR + FLARE * clamp((h - 4) / (TIP - 4));

function crown(spin: number) {
  // u is the angle round the band as we see it (0 facing us); the crown's own
  // angle is u - spin
  const N = 72;
  const edge = (u0: number, u1: number) => {
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i <= N; i++) {
      const u = u0 + ((u1 - u0) * i) / N;
      const h = rim(u - spin);
      const r = radius(h);
      top.push(`${f(r * Math.sin(u))} ${f(-h + LOOK * r * Math.cos(u))}`);
      bottom.push(`${f(CR * Math.sin(u))} ${f(LOOK * CR * Math.cos(u))}`);
    }
    return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
  };
  const near = edge(-Math.PI / 2, Math.PI / 2);
  const far = edge(Math.PI / 2, (3 * Math.PI) / 2);
  // the gem on each point, front ones bright, back ones darker and behind
  const gems = (front: boolean) => {
    let s = "";
    for (let k = 0; k < 4; k++) {
      const u = spin + (k * Math.PI) / 2;
      const c = Math.cos(u);
      if (front ? c < -0.02 : c >= -0.02) continue;
      const r = radius(TIP);
      const x = r * Math.sin(u),
        y = -TIP + LOOK * r * c;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="3.2" fill="${front ? CORAL_IN : CORAL}" stroke="${NAVY}" stroke-width="2.6"/>`;
    }
    return s;
  };
  // the band's line, on the near side
  const line: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const u = -Math.PI / 2 + (Math.PI * i) / 40;
    line.push(`${f(CR * Math.sin(u))} ${f(-5.5 + LOOK * CR * Math.cos(u))}`);
  }
  return `<g transform="translate(3.2 3.2)" fill="${NAVY}"><path d="${far}"/><path d="${near}"/></g>
    <path d="${far}" fill="${GOLD_IN}" stroke="${NAVY}" stroke-width="3.2" stroke-linejoin="round"/>
    ${gems(true)}
    <path d="${near}" fill="${GOLD}" stroke="${NAVY}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M${line.join(" L")}" fill="none" stroke="${NAVY}" stroke-width="2.6" stroke-linecap="round"/>
    ${gems(false)}`;
}

// where the crown is at time t: it shoots down the globe's tilted axis, lands
// on the north pole, bounces twice along the axis and floats up to its spot
function crownAt(t: number, far: number) {
  if (t < DROP) return null;
  let d: number;
  if (t < HIT1) {
    const k = (t - DROP) / FALL;
    d = far + (CONTACT - far) * Math.pow(k, 1.6); // shot down, still speeding up
  } else if (t < HIT2) {
    const k = (t - HIT1) / B1;
    d = CONTACT + R * 0.55 * 4 * k * (1 - k);
  } else if (t < HIT3) {
    const k = (t - HIT2) / B2;
    d = CONTACT + R * 0.16 * 4 * k * (1 - k);
  } else d = CONTACT;
  const squash = pulse(t - HIT1, 0.16) + pulse(t - HIT2, 0.12) * 0.45 + pulse(t - HIT3, 0.1) * 0.2;
  d += (FLOAT - CONTACT) * easeOut((t - HIT3) / RISE);
  d += t > FLOATED ? Math.sin((t - FLOATED) * 2.6) * 2.4 * smooth((t - FLOATED) / 0.4) : 0;

  // the crown starts turning when it hits, and soon keeps pace with the globe
  const ramp = 0.9;
  const s = Math.max(0, t - HIT1);
  const spin = s < ramp ? (SPIN * s * s) / (2 * ramp) : SPIN * (ramp / 2 + s - ramp);
  return { x: AXIS[0] * d, y: AXIS[1] * d, squash, spin };
}

// little ink lines where the crown hits, round the axis
function burst(t: number) {
  let s = "";
  for (const [hit, size] of [
    [HIT1, 1],
    [HIT2, 0.55],
  ] as const) {
    const k = (t - hit) / 0.32;
    if (k < 0 || k > 1) continue;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + side * (0.5 + i * 0.34);
        const r0 = R * (0.5 + 0.35 * k) * size + 14,
          r1 = r0 + 12 * size * (1 - k * 0.6);
        s += `<line x1="${f(Math.cos(ang) * r0 * 0.8)}" y1="${f(6 + Math.sin(ang) * r0 * 0.5)}" x2="${f(Math.cos(ang) * r1 * 0.8)}" y2="${f(6 + Math.sin(ang) * r1 * 0.5)}" stroke="${NAVY}" stroke-width="${f(3 * (1 - k * 0.7))}" stroke-linecap="round" opacity="${f(1 - k)}"/>`;
      }
    }
  }
  return s ? `<g transform="translate(${f(AXIS[0] * CONTACT)} ${f(AXIS[1] * CONTACT)}) rotate(${TILT})">${s}</g>` : "";
}

export function launchFrame(t: number, far = 700) {
  const c = crownAt(t, far);
  const hitGlobe = pulse(t - HIT1, 0.22) + pulse(t - HIT2, 0.16) * 0.4;
  const boil = Math.floor(t * 4) % 3;
  let out = `<g filter="url(#ttl-w${boil})">${globe(t, hitGlobe)}</g>`;
  if (c) {
    const sx = 1 + c.squash * 0.16,
      sy = 1 - c.squash * 0.24;
    out += `<g filter="url(#ttl-w${(boil + 1) % 3})" transform="translate(${f(c.x)} ${f(c.y)}) rotate(${TILT}) scale(${f(CS * sx)} ${f(CS * sy)})">${crown(c.spin)}</g>`;
    out += `<g filter="url(#ttl-w${boil})">${burst(t)}</g>`;
  }
  return out;
}

export const LAUNCH_DEFS = `<defs>
  ${[3, 11, 19]
    .map(
      (seed, i) =>
        `<filter id="ttl-w${i}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="${f(1.5 * W)}" xChannelSelector="R" yChannelSelector="G"/></filter>`,
    )
    .join("")}
  <pattern id="ttl-hatch" patternUnits="userSpaceOnUse" width="${f(4.2 * W)}" height="${f(4.2 * W)}" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="${f(4.2 * W)}" stroke="${NAVY}" stroke-width="${f(1.3 * W)}"/></pattern>
  <clipPath id="ttl-clip"><circle r="${R}"/></clipPath>
</defs>`;

// the box the drawing sits in, centred on the globe (and on the screen)
const BOX = 400;

export function Launch() {
  const [gone, setGone] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const art = useRef<SVGGElement>(null);
  const skip = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    const g = art.current;
    const hideSplash = () => {
      if (isApp()) void SplashScreen.hide({ fadeOutDuration: 120 }).catch(() => {});
    };
    if (!el || !g || document.documentElement.hasAttribute("data-launched")) {
      hideSplash();
      setGone(true);
      return;
    }
    let raf = 0;
    let t0 = 0;
    let fadeAt = FADE;
    let target: { x: number; y: number; r: number } | null | undefined;
    const svg = el.querySelector("svg") as SVGSVGElement;
    // off the screen, up the axis
    const far = (Math.max(window.innerHeight, window.innerWidth) / 2 + 110) / Math.cos(TAU_TILT);
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      if (skip.current && fadeAt > t) fadeAt = t;
      g.innerHTML = launchFrame(t, far);
      // the end: the paper fades away while the globe and crown shrink into
      // the logo's O on the page underneath, where the real one takes over
      const k = clamp((t - fadeAt) / FADE_FOR);
      if (k > 0 && target === undefined) target = findO();
      const m = k * k * (3 - 2 * k);
      el.style.background = `rgba(255,253,246,${1 - smooth(k / 0.75)})`;
      if (target) {
        const box = el.getBoundingClientRect();
        const dx = target.x - (box.left + box.width / 2),
          dy = target.y - (box.top + box.height / 2);
        const sc = 1 + (target.r / R - 1) * m;
        svg.style.transform = `translate(${dx * m}px, ${dy * m}px) scale(${sc})`;
        svg.style.opacity = String(1 - smooth((k - 0.72) / 0.28));
      } else svg.style.opacity = String(1 - k);
      if (t < fadeAt + FADE_FOR) raf = requestAnimationFrame(frame);
      else setGone(true);
    };
    hideSplash();
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (gone) return null;
  return (
    <div
      ref={wrap}
      id="tt-launch"
      data-motion
      aria-hidden
      onPointerDown={() => void (skip.current = true)}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ background: PAPER }}
    >
      <svg
        width={BOX}
        height={BOX}
        viewBox={`${-BOX / 2} ${-BOX / 2} ${BOX} ${BOX}`}
        overflow="visible"
        style={{ overflow: "visible", flex: "none" }}
      >
        <g dangerouslySetInnerHTML={{ __html: LAUNCH_DEFS }} />
        <g ref={art} dangerouslySetInnerHTML={{ __html: launchFrame(0) }} />
      </svg>
    </div>
  );
}

// The Globe O of a TopTrack wordmark showing on the page (components/globe/
// Wordmark.tsx): its centre and radius on screen. Its globe is drawn at
// 91,69 with radius 28 in a viewBox that starts at -33,-6 and is 460 wide.
function findO() {
  for (const w of document.querySelectorAll<SVGSVGElement>("svg[data-wordmark]")) {
    const b = w.getBoundingClientRect();
    if (b.width < 20 || b.bottom < 0 || b.top > window.innerHeight) continue;
    const s = b.width / 460;
    return { x: b.left + (91 + 33) * s, y: b.top + (69 + 6) * s, r: 28 * s };
  }
  return null;
}

// how long the whole thing runs, for anyone waiting on it
export const LAUNCH_SECONDS = DONE;
