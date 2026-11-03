// The TopTrack name at the top of the Globe: the icon's raised hand, then TOP
// and TRACK in Bungee. Everything is see-through, so the sky, clouds and rain
// show through the letters. `light` is true when the sky behind is dark.

const HAND = `<rect x="35" y="78" width="27" height="30"/>
  <rect x="27" y="11" width="13.5" height="50" rx="6.75"/>
  <rect x="62" y="47" width="10.5" height="25" rx="5.25"/><rect x="51.5" y="44" width="11" height="28" rx="5.5"/><rect x="40.5" y="42" width="11" height="30" rx="5.5"/>
  <path d="M27 50 V72 C27 80 33 86 41 86 H60 C68 86 72.5 80 72.5 72 V64 Z"/>
  <path d="M24 66 C24 60 30 58 36 60 L58 64 C63 65 64 72 59 73 L36 74 C29 74 24 72 24 66 Z"/>`;
// the knuckle, thumb and nail lines, cut out of the hand so the sky shows through them too
const DETAIL = `<path d="M40.5 50 V60 M51.5 50 V62 M62 52 V63"/><path d="M24 66 C24 60 30 58 36 60 L58 64 C63 65 64 72 59 73 L36 74 C29 74 24 72 24 66 Z"/><path d="M30.5 22 H37" stroke-linecap="round"/>`;

export function Wordmark({ light, size = 26 }: { light: boolean; size?: number }) {
  // by day the pale brand colours would vanish into the blue sky, so they deepen a little
  const [g1, g2] = light ? ["185,240,168", "143,208,255"] : ["70,170,96", "48,132,206"];
  const top = light ? "rgba(255,255,255,0.62)" : "rgba(13,42,63,0.5)";
  const track = `linear-gradient(180deg, rgba(${g1},0.72), rgba(${g2},0.72))`;
  const id = light ? "wm-night" : "wm-day";
  return (
    <span className="inline-flex items-end" style={{ gap: size * 0.28, fontFamily: "var(--font-bungee), var(--font-outfit), sans-serif", fontSize: size, lineHeight: 1 }}>
      <svg viewBox="22 9 52 78" width={size * 0.83} height={size * 1.25} aria-hidden style={{ marginBottom: size * -0.06 }}>
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="86">
            <stop offset="0" stopColor={`rgb(${g1})`} />
            <stop offset="1" stopColor={`rgb(${g2})`} />
          </linearGradient>
          <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="86">
            <rect x="0" y="0" width="100" height="86" fill="#fff" />
            <g fill="none" stroke="#000" strokeWidth="2.2" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: DETAIL }} />
          </mask>
        </defs>
        <g mask={`url(#${id}-m)`} opacity={0.72}>
          <g fill={`url(#${id})`} dangerouslySetInnerHTML={{ __html: HAND }} />
        </g>
      </svg>
      <span aria-hidden>
        <span style={{ color: top }}>TOP</span>
        <span style={{ backgroundImage: track, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>TRACK</span>
      </span>
      <span className="sr-only">TopTrack</span>
    </span>
  );
}
