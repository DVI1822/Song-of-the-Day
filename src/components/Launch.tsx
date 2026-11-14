"use client";

import { useEffect, useRef, useState } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { isApp } from "@/lib/native";

// What you see when TopTrack first opens: the drawn Globe from the logo,
// spinning on its tilted axis, then the gold crown drops in from above the
// screen, bounces twice on top of the globe, and floats up to its spot over
// the north pole, where it keeps turning with the globe. Then it all fades
// into the app.
//
// It plays once per visit (a tab, or a launch of the iPhone app): a script
// in <head> (LAUNCH_SCRIPT, layout.tsx) marks the page before it's drawn so
// later page loads skip it without a flash. Tapping skips it.
//
// In the iPhone app, the native splash screen (ios/App/App/Assets.xcassets/
// Splash.imageset) is this exact first frame, the still globe centred on
// paper, so hiding it here is invisible and the animation simply starts.
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
const CONTACT = -R - LOOK * CR * CS + 3; // crown base resting on the globe's top
const FLOAT = R + 17 + LOOK * CR * CS; // crown base, along the axis, floating

// timeline, seconds
const DROP = 0.5; // the crown starts falling
const FALL = 0.5;
const HIT1 = DROP + FALL;
const B1 = 0.32; // first bounce
const HIT2 = HIT1 + B1;
const B2 = 0.17; // second, smaller
const HIT3 = HIT2 + B2;
const RISE = 0.65; // floats up to its spot
const FLOATED = HIT3 + RISE;
const FADE = 3.3; // the whole thing fades into the app
const FADE_FOR = 0.45;
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

// ---------------------------------------------------------------- the globe

function halfEllipse(rx: number, ry: number, side: 1 | -1, vertical: boolean) {
  // half an ellipse centred on 0,0: the right/left half of a meridian, or the
  // lower/upper half of a line of latitude
  if (vertical) return `M0 ${f(-ry)} A${f(Math.abs(rx))} ${f(ry)} 0 0 ${side > 0 ? 1 : 0} 0 ${f(ry)}`;
  return `M${f(-rx)} 0 A${f(rx)} ${f(Math.abs(ry))} 0 0 ${side > 0 ? 0 : 1} ${f(rx)} 0`;
}

function globe(spin: number, squash: number) {
  const back: string[] = [];
  const front: string[] = [];
  // meridians: three, 60° apart, each a full circle round the axis
  for (let m = 0; m < 3; m++) {
    const lon = spin + (m * Math.PI) / 3 + 0.37;
    const rx = R * Math.sin(lon);
    // the half at +rx faces us while cos(lon) > 0, and the other half the rest of the time
    const near = Math.cos(lon) > 0;
    const side = rx >= 0 ? 1 : -1;
    (near ? front : back).push(halfEllipse(rx, R, side as 1 | -1, true));
    (near ? back : front).push(halfEllipse(rx, R, -side as 1 | -1, true));
  }
  // lines of latitude: the equator and two more, as on the logo
  const lats: [number, number, number][] = [
    [0, R, R * 0.24],
    [-R * 0.52, R * 0.854, R * 0.205],
    [R * 0.52, R * 0.854, R * 0.205],
  ];
  for (const [y, rx, ry] of lats) {
    front.push(`<g transform="translate(0 ${f(y)})">`);
    back.push(`<g transform="translate(0 ${f(y)})">`);
    // we look down a little, so the lower half is the near one
    front.push(halfEllipse(rx, ry, 1, false));
    back.push(halfEllipse(rx, ry, -1, false));
    front.push("</g>");
    back.push("</g>");
  }
  const path = (list: string[]) => list.map((d) => (d.startsWith("<") ? d : `<path d="${d}"/>`)).join("");
  const sx = 1 + squash * 0.05,
    sy = 1 - squash * 0.07;
  return `<g transform="translate(0 ${f(R * (1 - sy))}) scale(${f(sx)} ${f(sy)})">
    <circle cx="${f(R * 0.14)}" cy="${f(R * 0.14)}" r="${R}" fill="${NAVY}"/>
    <circle r="${R}" fill="${PAPER}"/>
    <g clip-path="url(#ttl-clip)">
      <circle cx="${f(-R * 0.3)}" cy="${f(-R * 0.3)}" r="${f(R * 1.45)}" fill="none" stroke="url(#ttl-hatch)" stroke-width="${f(R * 0.9)}" opacity="0.55"/>
      <g transform="rotate(${TILT})" fill="none" stroke="${NAVY}" stroke-linecap="round">
        <g stroke-width="${f(1.3 * SW)}" stroke-dasharray="${f(2 * SW)} ${f(3.2 * SW)}" opacity="0.32">${path(back)}</g>
        <g stroke-width="${f(1.8 * SW)}">${path(front)}</g>
      </g>
    </g>
    <circle r="${R}" fill="none" stroke="${NAVY}" stroke-width="${f(3 * SW)}"/>
    <path d="M${f(-R * 0.66)} ${f(-R * 0.3)} q ${f(R * 0.12)} ${f(-R * 0.3)} ${f(R * 0.42)} ${f(-R * 0.42)}" stroke="${NAVY}" stroke-width="${f(2.4 * SW)}" fill="none" stroke-linecap="round"/>
  </g>`;
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

// where the crown is at time t: its base point, tilt, squash and spin
function crownAt(t: number, top: number) {
  if (t < DROP) return null;
  let y: number,
    squash = 0;
  if (t < HIT1) {
    const k = (t - DROP) / FALL;
    y = top + (CONTACT - top) * k * k; // falling, faster and faster
  } else if (t < HIT2) {
    const k = (t - HIT1) / B1;
    y = CONTACT - R * 0.62 * 4 * k * (1 - k);
  } else if (t < HIT3) {
    const k = (t - HIT2) / B2;
    y = CONTACT - R * 0.17 * 4 * k * (1 - k);
  } else y = CONTACT;
  squash = pulse(t - HIT1, 0.16) * 1 + pulse(t - HIT2, 0.12) * 0.45 + pulse(t - HIT3, 0.1) * 0.2;

  // from the top of the globe to its spot over the north pole, leaning with the axis
  const lean = smooth((t - HIT1) / (FLOATED - HIT1));
  const rise = easeOut((t - HIT3) / RISE);
  const a = (TILT * Math.PI) / 180;
  const fx = FLOAT * Math.sin(a),
    fy = -FLOAT * Math.cos(a);
  const bx = (fx - 0) * rise,
    by = y + (fy - CONTACT) * rise;
  const bob = t > FLOATED ? Math.sin((t - FLOATED) * 2.6) * 2.4 * smooth((t - FLOATED) / 0.4) : 0;

  // the crown starts turning when it first hits, and soon keeps pace with the globe
  const ramp = 0.9;
  const s = Math.max(0, t - HIT1);
  const spin = s < ramp ? (SPIN * s * s) / (2 * ramp) : SPIN * (ramp / 2 + s - ramp);
  return { x: bx, y: by + bob, tilt: TILT * lean, squash, spin };
}

// little ink lines where the crown hits
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
        const ang = (-Math.PI / 2) + side * (0.5 + i * 0.34);
        const r0 = R * (0.5 + 0.35 * k) * size + 14,
          r1 = r0 + 12 * size * (1 - k * 0.6);
        const ox = 0,
          oy = CONTACT + 6;
        s += `<line x1="${f(ox + Math.cos(ang) * r0 * 0.8)}" y1="${f(oy + Math.sin(ang) * r0 * 0.5)}" x2="${f(ox + Math.cos(ang) * r1 * 0.8)}" y2="${f(oy + Math.sin(ang) * r1 * 0.5)}" stroke="${NAVY}" stroke-width="${f(3 * (1 - k * 0.7))}" stroke-linecap="round" opacity="${f(1 - k)}"/>`;
      }
    }
  }
  return s;
}

export function launchFrame(t: number, top = -600) {
  const c = crownAt(t, top);
  const hitGlobe = pulse(t - HIT1, 0.22) + pulse(t - HIT2, 0.16) * 0.4;
  const boil = Math.floor(t * 4) % 3;
  let out = `<g filter="url(#ttl-w${boil})">${globe(t * SPIN, hitGlobe)}</g>`;
  if (c) {
    const sx = 1 + c.squash * 0.16,
      sy = 1 - c.squash * 0.24;
    out += `<g filter="url(#ttl-w${(boil + 1) % 3})" transform="translate(${f(c.x)} ${f(c.y)}) rotate(${f(c.tilt)}) scale(${f(CS * sx)} ${f(CS * sy)})">${crown(c.spin)}</g>`;
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
    const top = -(window.innerHeight / 2) - 90; // just above the screen
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      if (skip.current && fadeAt > t) fadeAt = t;
      g.innerHTML = launchFrame(t, top);
      el.style.opacity = String(1 - clamp((t - fadeAt) / FADE_FOR));
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

// how long the whole thing runs, for anyone waiting on it
export const LAUNCH_SECONDS = DONE;
