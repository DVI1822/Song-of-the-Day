import Link from "next/link";
import { LegalLinks } from "@/components/Legal";
import { Wordmark } from "@/components/globe/Wordmark";

// The first page anyone sees before they sign in, drawn in the app's ink
// look: paper, navy ink lines that wobble like a pen, coral and gold, and
// hand lettering (Gaegu, the same hand as the drawn Globe's headings). Three
// little drawings say what TopTrack is: pick your top track, crown the best
// one, find new music through everyone else's.

const INK = "#0d2a3f";
const hand = { fontFamily: "var(--font-hand), var(--font-sans)", fontWeight: 700, letterSpacing: "-0.01em" } as const;

export function Landing() {
  return (
    <div data-motion className="landing relative min-h-dvh overflow-hidden" style={{ background: "#fffdf6", color: INK }}>
      <svg aria-hidden width="0" height="0" className="absolute">
        <filter id="pen">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
        <filter id="pen-edge">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3.2" />
        </filter>
      </svg>

      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-8 pt-[max(28px,env(safe-area-inset-top))]">
        <div className="mt-1 flex justify-center">
          <Wordmark size={32} />
        </div>

        <h1 className="mt-4 text-center text-[33px] leading-[1.02]" style={hand}>
          Every day has
          <br />
          <span className="relative inline-block">
            a top track.
            <Squiggle />
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-[300px] text-center text-[19px] leading-tight" style={hand}>
          What was yours today?
        </p>

        <ol className="mt-7 flex flex-col gap-6">
          <Step art={<RecordDoodle />} title="Pick your top track">
            The one song that ran your day. Paste its link and it lands on your globe.
          </Step>
          <Step art={<CrownDoodle />} title="Crown the best one" flip>
            Give your crown to the best pick on your globe each day. Crowns add up.
          </Step>
          <Step art={<FindDoodle />} title="Find your next favorite">
            Every song here meant something to someone today. Press play and find out why.
          </Step>
        </ol>

        <div className="mt-9 flex flex-col items-center gap-3.5">
          <Link
            href="/login"
            className="relative inline-flex h-14 w-full max-w-[300px] items-center justify-center rounded-full text-[24px]"
            style={{ ...hand, background: "#ff5e57", color: INK, boxShadow: `3px 4px 0 ${INK}` }}
          >
            Start your globe
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ border: `2.5px solid ${INK}`, filter: "url(#pen-edge)" }} />
          </Link>
          <Link
            href="/login"
            className="relative inline-flex h-14 w-full max-w-[300px] items-center justify-center rounded-full text-[24px]"
            style={{ ...hand, background: "#fffdf6", color: INK, boxShadow: `3px 4px 0 ${INK}` }}
          >
            Sign in
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ border: `2.5px solid ${INK}`, filter: "url(#pen-edge)" }} />
          </Link>
        </div>

        <LegalLinks className="mt-auto pt-8" />
      </main>
    </div>
  );
}

function Step({ art, title, children, flip }: { art: React.ReactNode; title: string; children: React.ReactNode; flip?: boolean }) {
  return (
    <li className={`flex items-center gap-4 ${flip ? "flex-row-reverse" : ""}`}>
      <div className="h-[84px] w-[84px] flex-none">{art}</div>
      <div className="min-w-0">
        <h2 className="text-[26px] leading-none" style={hand}>
          {title}
        </h2>
        <p className="mt-1 text-[18px] leading-[1.2]" style={{ ...hand, color: "#3b5263" }}>
          {children}
        </p>
      </div>
    </li>
  );
}

// a coral pen stroke under the headline
function Squiggle() {
  return (
    <svg aria-hidden viewBox="0 0 200 16" className="absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none" overflow="visible">
      <path
        d="M3 10 C 30 3, 52 14, 80 8 S 130 3, 158 9 S 190 7, 197 5"
        fill="none"
        stroke="#ff5e57"
        strokeWidth="4.5"
        strokeLinecap="round"
        filter="url(#pen)"
        className="draw-in"
      />
    </svg>
  );
}

// a cover with its record sliding out and turning
function RecordDoodle() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" overflow="visible">
      <g filter="url(#pen)" strokeLinejoin="round" strokeLinecap="round">
        <g className="spin-slow" style={{ transformOrigin: "62px 50px" }}>
          <circle cx="62" cy="50" r="31" fill={INK} />
          <circle cx="62" cy="50" r="22" fill="none" stroke="#fffdf6" strokeWidth="1.2" opacity=".35" />
          <circle cx="62" cy="50" r="15" fill="none" stroke="#fffdf6" strokeWidth="1.2" opacity=".35" />
          <circle cx="62" cy="50" r="9" fill="#b9f0a8" stroke={INK} strokeWidth="2.5" />
          <path d="M74 30 q 7 5 9 13" fill="none" stroke="#fffdf6" strokeWidth="2.2" opacity=".7" />
        </g>
        <rect x="11" y="22" width="56" height="56" rx="5" fill={INK} transform="translate(3 3)" />
        <rect x="11" y="22" width="56" height="56" rx="5" fill="#ff5e57" stroke={INK} strokeWidth="3" />
        <circle cx="39" cy="50" r="15" fill="#ffc94a" stroke={INK} strokeWidth="2.5" />
        <circle cx="39" cy="50" r="4" fill={INK} />
        <path d="M14 70 q 12 -7 25 0 t 25 0" fill="none" stroke={INK} strokeWidth="2.5" />
      </g>
      <g className="note-float" filter="url(#pen)">
        <path d="M84 18 v-12 l9 -3 v12" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="82" cy="18.5" rx="3.6" ry="2.8" fill={INK} />
        <ellipse cx="91" cy="15.5" rx="3.6" ry="2.8" fill={INK} />
      </g>
    </svg>
  );
}

// the logo's gold crown with a couple of sparkle marks
function CrownDoodle() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" overflow="visible">
      <g className="crown-bob" style={{ transformOrigin: "50px 70px" }}>
        <g filter="url(#pen)" transform="translate(50 68) scale(1.55)" strokeLinejoin="round">
          <path d="M-20 0 L-23 -21 L-11 -10 L0 -27 L11 -10 L23 -21 L20 0 Z" transform="translate(2.6 2.6)" fill={INK} />
          <path d="M-20 0 L-23 -21 L-11 -10 L0 -27 L11 -10 L23 -21 L20 0 Z" fill="#ffc94a" stroke={INK} strokeWidth="2.6" />
          <path d="M-20.5 -5.5 H20.5" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="-23" cy="-21" r="3.2" fill="#ff5e57" stroke={INK} strokeWidth="2.1" />
          <circle cx="0" cy="-27" r="3.2" fill="#ff5e57" stroke={INK} strokeWidth="2.1" />
          <circle cx="23" cy="-21" r="3.2" fill="#ff5e57" stroke={INK} strokeWidth="2.1" />
        </g>
      </g>
      <g filter="url(#pen)" stroke={INK} strokeWidth="2.6" strokeLinecap="round" className="sparkle">
        <path d="M10 18 l5 6 M6 30 l7 1 M20 9 l1 7" />
        <path d="M90 18 l-5 6 M94 30 l-7 1 M80 9 l-1 7" />
      </g>
      <path d="M22 88 q 28 6 56 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".25" filter="url(#pen)" />
    </svg>
  );
}

// a little globe with songs on it and notes drifting off toward you
function FindDoodle() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" overflow="visible">
      <g filter="url(#pen)" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="47" cy="55" r="33" fill={INK} transform="translate(4 4)" />
        <circle cx="47" cy="55" r="33" fill="#fffdf6" />
        <g transform="rotate(23.4 47 55)" fill="none" stroke={INK} strokeWidth="2">
          <ellipse cx="47" cy="55" rx="13" ry="33" />
          <ellipse cx="47" cy="55" rx="33" ry="8" />
        </g>
        <rect x="27" y="36" width="15" height="15" rx="2" fill="#ff5e57" stroke={INK} strokeWidth="2.4" transform="rotate(-12 34 43)" />
        <rect x="52" y="52" width="15" height="15" rx="2" fill="#8fd0ff" stroke={INK} strokeWidth="2.4" transform="rotate(10 59 59)" />
        <rect x="31" y="63" width="13" height="13" rx="2" fill="#b9f0a8" stroke={INK} strokeWidth="2.4" transform="rotate(6 37 69)" />
        <circle cx="47" cy="55" r="33" fill="none" stroke={INK} strokeWidth="3" />
      </g>
      <g filter="url(#pen)" fill={INK} stroke={INK} strokeWidth="2.2" strokeLinecap="round">
        <g className="note-float">
          <path d="M84 30 v-11" fill="none" />
          <path d="M84 19 q 6 1 7 6" fill="none" />
          <ellipse cx="81.5" cy="30.5" rx="3.4" ry="2.6" stroke="none" />
        </g>
        <g className="note-float note-late">
          <path d="M72 16 v-10 l8 -2.5 v10" fill="none" />
          <ellipse cx="70" cy="16.5" rx="3.2" ry="2.5" stroke="none" />
          <ellipse cx="78" cy="14" rx="3.2" ry="2.5" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
