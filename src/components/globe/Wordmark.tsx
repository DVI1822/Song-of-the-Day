// The TopTrack name at the top of the Globe: the icon's raised hand, then TOP
// and TRACK in Bungee, drawn like glass: a faint tint inside a crisp coral rim, so the
// sky, clouds and rain clearly show through. `light` is true when the sky is dark.

const HAND = `<rect x="35" y="78" width="27" height="30"/>
  <rect x="27" y="11" width="13.5" height="50" rx="6.75"/>
  <rect x="62" y="47" width="10.5" height="25" rx="5.25"/><rect x="51.5" y="44" width="11" height="28" rx="5.5"/><rect x="40.5" y="42" width="11" height="30" rx="5.5"/>
  <path d="M27 50 V72 C27 80 33 86 41 86 H60 C68 86 72.5 80 72.5 72 V64 Z"/>
  <path d="M24 66 C24 60 30 58 36 60 L58 64 C63 65 64 72 59 73 L36 74 C29 74 24 72 24 66 Z"/>`;
// the knuckle, thumb and nail lines, cut out of the hand so the sky shows through them too
const DETAIL = `<path d="M40.5 50 V60 M51.5 50 V62 M62 52 V63"/><path d="M24 66 C24 60 30 58 36 60 L58 64 C63 65 64 72 59 73 L36 74 C29 74 24 72 24 66 Z"/><path d="M30.5 22 H37" stroke-linecap="round"/>`;

// the icon's coral, for the glass rim; `blend` fades it into deep blue across the name
const CORAL = "#ff5e57";
const BLUE = "#2f5fd0";
const RIM: "coral" | "blend" = "coral";

export function Wordmark({ light, size = 26 }: { light: boolean; size?: number }) {
  // by day the pale brand colours would vanish into the blue sky, so they deepen a little
  const [g1, g2] = light ? ["185,240,168", "143,208,255"] : ["70,170,96", "48,132,206"];
  // a faint fill so the letters read as tinted glass
  const top = light ? "rgba(255,255,255,0.14)" : "rgba(13,42,63,0.1)";
  const id = light ? "wm-night" : "wm-day";
  const rim = RIM === "blend" ? `url(#${id}-rim-g)` : CORAL;
  // one drawing in the hand's own units, so the rim colour runs across hand and letters alike;
  // TOP and TRACK are Bungee at 1em, sitting on the hand's baseline just as before
  return (
    <svg
      viewBox="22 9 404 78"
      width={size * 6.464}
      height={size * 1.25}
      aria-label="TopTrack"
      role="img"
      overflow="visible"
      style={{ display: "block", marginBottom: size * -0.06 }}
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="86">
          <stop offset="0" stopColor={`rgb(${g1})`} />
          <stop offset="1" stopColor={`rgb(${g2})`} />
        </linearGradient>
        <linearGradient id={`${id}-glass`} gradientUnits="userSpaceOnUse" x1="0" y1="29" x2="0" y2="74">
          <stop offset="0" stopColor={`rgb(${g1})`} stopOpacity={0.2} />
          <stop offset="1" stopColor={`rgb(${g2})`} stopOpacity={0.2} />
        </linearGradient>
        <linearGradient id={`${id}-rim-g`} gradientUnits="userSpaceOnUse" x1="24" y1="0" x2="424" y2="0">
          <stop offset="0" stopColor={CORAL} />
          <stop offset="1" stopColor={BLUE} />
        </linearGradient>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="86">
          <rect x="0" y="0" width="100" height="86" fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth="2.2" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: DETAIL }} />
        </mask>
        {/* keeps only the outer edge of the hand, for the glass rim */}
        <filter id={`${id}-rim`} x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="erode" radius="1.4" result="in" />
          <feComposite in="SourceGraphic" in2="in" operator="out" />
        </filter>
      </defs>
      <g mask={`url(#${id}-m)`}>
        <g opacity={0.2} fill={`url(#${id})`} dangerouslySetInnerHTML={{ __html: HAND }} />
        <g filter={`url(#${id}-rim)`} opacity={0.95}>
          <g fill={rim} dangerouslySetInnerHTML={{ __html: HAND }} />
        </g>
      </g>
      <text
        x="80.1"
        y="73.8"
        fontSize="62.5"
        stroke={rim}
        strokeWidth={1.375}
        strokeOpacity={0.95}
        style={{ fontFamily: "var(--font-bungee), var(--font-outfit), sans-serif" }}
        aria-hidden
      >
        <tspan fill={top}>TOP</tspan>
        <tspan fill={`url(#${id}-glass)`}>TRACK</tspan>
      </text>
    </svg>
  );
}
