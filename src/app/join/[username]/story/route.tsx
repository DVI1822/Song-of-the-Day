/* eslint-disable @next/next/no-img-element -- the image renderer only takes plain <img> */
import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { isConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { cleanInvite } from "@/lib/invite";

// Your song as an Instagram Story (1080×1920): the night globe with your
// cover in front, a stream of magma pouring from it into the core, your past
// songs drifting round the sphere, and the link to join you. ?post=<id>
// picks the song; otherwise your latest.

const W = 1080,
  H = 1920;
const CX = 540,
  CY = 880,
  R = 420;
const SX = 690,
  SY = 1120; // where your cover sits, in front and below the core

// Google's font CSS hands old browsers WOFF files, which the image renderer
// reads; the basic Latin set is the one marked latin.
async function font(family: string, weight: number) {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" },
    }).then((r) => r.text());
    const latin = css.split("/* latin */")[1] ?? css;
    const url = latin.match(/src: url\((.+?)\) format\('(woff|opentype|truetype)'\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// a fixed scatter of stars
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = (k: number) => {
    const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * W, y: r(2) * H * 0.92, s: 1.5 + r(3) * 3.5, a: 0.25 + r(4) * 0.7 };
});

// Spots on the sphere for the other tiles, seen from slightly above with
// Earth's tilt: x, y on screen, depth (1 in front, -1 behind).
const SPOTS = Array.from({ length: 22 }, (_, i) => {
  const lat = Math.asin(1 - ((i + 0.5) * 2) / 22) * 0.9,
    lon = i * 2.39996 + 0.6;
  const x = Math.cos(lat) * Math.sin(lon),
    y = -Math.sin(lat),
    z = Math.cos(lat) * Math.cos(lon);
  const t = (-23.4 * Math.PI) / 180,
    tx = 0.32;
  const rx = x * Math.cos(t) - y * Math.sin(t),
    ry = x * Math.sin(t) + y * Math.cos(t);
  const y2 = ry * Math.cos(tx) - z * Math.sin(tx),
    z2 = ry * Math.sin(tx) + z * Math.cos(tx);
  return { x: CX + rx * R, y: CY + y2 * R, z: z2 };
}).filter((p) => Math.hypot(p.x - SX, p.y - SY) > 240); // leave room for your cover

// latitude and longitude lines on the glass, tilted like the Earth
const TILT = (-23.4 * Math.PI) / 180;
const LINES = [
  ...[-0.5, 0, 0.5].map((lat) => {
    const dy = -Math.sin(lat) * R * Math.cos(0.32);
    return { x: CX - dy * Math.sin(TILT), y: CY + dy * Math.cos(TILT), w: 2 * R * Math.cos(lat), h: 2 * R * Math.cos(lat) * 0.31 };
  }),
  ...[0.75, 1.6].map((phi) => ({ x: CX, y: CY, w: 2 * R * Math.abs(Math.sin(phi)) * 0.999, h: 2 * R * 0.999 })),
];

export async function GET(request: Request, { params }: RouteContext<"/join/[username]/story">) {
  const username = cleanInvite((await params).username);
  const postId = new URL(request.url).searchParams.get("post");
  let name = username ? `@${username}` : "A friend";
  let song: { title: string; artist: string | null; artwork_url: string | null; caption: string | null } | null = null;
  let past: string[] = [];
  if (isConfigured && username) {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data: p } = await supabase.from("profiles").select("id, display_name").eq("username", username).maybeSingle();
    if (p) {
      name = p.display_name;
      const { data: posts } = await supabase
        .from("posts")
        .select("id, title, artist, artwork_url, caption")
        .eq("user_id", p.id)
        .order("day", { ascending: false })
        .limit(24);
      const list = posts ?? [];
      song = list.find((x) => x.id === postId) ?? list[0] ?? null;
      past = list.filter((x) => x !== song && x.artwork_url).map((x) => x.artwork_url as string);
    }
  }
  const first = name.split(" ")[0];
  const [display, body] = await Promise.all([font("Fredoka", 600), font("Outfit", 500)]);

  const C = 360; // your cover
  const coverX = SX - C / 2,
    coverY = SY - C / 2;
  // the stream from your cover into the core
  const sx = SX - CX,
    sy = SY - CY,
    len = Math.hypot(sx, sy),
    ang = (Math.atan2(sy, sx) * 180) / Math.PI;
  const tiles = SPOTS.map((p, i) => ({ ...p, art: past[i] ?? null })).sort((a, b) => a.z - b.z);

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(180deg, #050B1E 0%, #0B1A3A 45%, #16325E 78%, #2C5A86 100%)",
        color: "#EEF3F8",
        fontFamily: body ? "Outfit" : "sans-serif",
      }}
    >
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{ position: "absolute", left: s.x, top: s.y, width: s.s, height: s.s, borderRadius: 99, background: `rgba(255,255,255,${s.a.toFixed(2)})` }}
        />
      ))}
      {/* the glass sphere */}
      <div
        style={{
          position: "absolute",
          left: CX - R,
          top: CY - R,
          width: R * 2,
          height: R * 2,
          borderRadius: 9999,
          background: "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.20) 0%, rgba(160,200,240,0.08) 45%, rgba(10,20,50,0.25) 100%)",
          border: "2px solid rgba(217,255,248,0.35)",
          boxShadow: "0 0 160px 30px rgba(169,220,214,0.2), 0 0 60px 4px rgba(169,220,214,0.25)",
        }}
      />
      {LINES.map((l, i) => (
        <div
          key={`l${i}`}
          style={{
            position: "absolute",
            left: l.x - l.w / 2,
            top: l.y - l.h / 2,
            width: l.w,
            height: l.h,
            borderRadius: 9999,
            border: "2px solid rgba(217,255,248,0.16)",
            transform: "rotate(-23.4deg)",
          }}
        />
      ))}
      {/* tiles behind the core */}
      {tiles
        .filter((t) => t.z < 0)
        .map((t, i) => (
          <Tile key={`b${i}`} t={t} />
        ))}
      {/* the core */}
      <div
        style={{
          position: "absolute",
          left: CX - 150,
          top: CY - 150,
          width: 300,
          height: 300,
          borderRadius: 9999,
          background: "radial-gradient(closest-side, rgba(255,240,200,0.75), rgba(190,255,220,0.35) 45%, rgba(0,0,0,0))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: CX - 70,
          top: CY - 70,
          width: 140,
          height: 140,
          borderRadius: 9999,
          background: "radial-gradient(circle at 42% 38%, #FFFDF5 0%, #FFE2C4 22%, #F3F0A0 46%, #B7EBA4 72%, #7FD1B9 100%)",
          boxShadow: "0 0 60px 10px rgba(255,236,190,0.55)",
        }}
      />
      {/* the stream of magma from your song into the core */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY - 34,
          width: len,
          height: 68,
          borderRadius: 40,
          transformOrigin: "0% 50%",
          transform: `rotate(${ang.toFixed(1)}deg)`,
          background: "linear-gradient(90deg, rgba(255,246,220,0.95) 0%, rgba(255,214,170,0.7) 35%, rgba(200,245,170,0.45) 70%, rgba(160,230,210,0.15) 100%)",
          boxShadow: "0 0 40px 8px rgba(255,220,170,0.35)",
        }}
      />
      {/* tiles in front */}
      {tiles
        .filter((t) => t.z >= 0)
        .map((t, i) => (
          <Tile key={`f${i}`} t={t} />
        ))}
      {/* your song */}
      <div
        style={{
          position: "absolute",
          left: coverX,
          top: coverY,
          width: C,
          height: C,
          display: "flex",
          borderRadius: 94,
          overflow: "hidden",
          border: "3px solid rgba(255,255,255,0.55)",
          boxShadow: "0 40px 90px -20px rgba(0,0,0,0.6), 0 0 90px 0 rgba(217,255,248,0.35)",
          background: "radial-gradient(circle at 34% 28%, #FFFFFF 0%, #A9DCD6 24%, #2F6F7E 64%, #173C47 100%)",
        }}
      >
        {song?.artwork_url && <img src={song.artwork_url} alt="" width={C} height={C} style={{ objectFit: "cover" }} />}
      </div>

      {/* top */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ fontFamily: display ? "Fredoka" : "sans-serif", fontSize: 64, fontWeight: 600, letterSpacing: -1 }}>Song of the Day</div>
        <div style={{ fontSize: 30, color: "rgba(217,236,248,0.75)" }}>{`${first}'s song today`}</div>
      </div>

      {/* bottom */}
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 1370,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 12,
        }}
      >
        <div style={{ fontFamily: display ? "Fredoka" : "sans-serif", fontSize: 72, fontWeight: 600, lineHeight: 1.05 }}>
          {song?.title ?? "One song a day"}
        </div>
        <div style={{ fontSize: 36, color: "rgba(217,236,248,0.8)" }}>{song?.artist ?? "the one that hit hardest"}</div>
        {song?.caption && (
          <div style={{ marginTop: 14, fontSize: 32, lineHeight: 1.3, color: "rgba(238,243,248,0.92)", maxWidth: 820 }}>
            {`“${song.caption}”`}
          </div>
        )}
        <div
          style={{
            marginTop: 34,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "22px 40px",
            borderRadius: 999,
            background: "#D7262B",
            color: "#FFFFFF",
            fontSize: 34,
            fontWeight: 500,
            boxShadow: "0 20px 50px -20px rgba(215,38,43,0.8)",
          }}
        >
          {`Join me on mysong.day`}
        </div>
      </div>
    </div>,
    {
      width: W,
      height: H,
      // without either font it falls back to the renderer's own
      ...(display || body
        ? {
            fonts: [
              ...(display ? [{ name: "Fredoka", data: display, weight: 600 as const }] : []),
              ...(body ? [{ name: "Outfit", data: body, weight: 500 as const }] : []),
            ],
          }
        : {}),
      headers: { "cache-control": "public, max-age=300, s-maxage=300" },
    },
  );
}

// One of your past songs (or an empty spot) on the sphere; smaller and
// fainter round the back.
function Tile({ t }: { t: { x: number; y: number; z: number; art: string | null } }) {
  const k = 0.62 + 0.38 * ((t.z + 1) / 2);
  const s = Math.round(112 * k);
  const a = t.z < 0 ? 0.35 + 0.3 * (t.z + 1) : 0.85 + 0.15 * t.z;
  return (
    <div
      style={{
        position: "absolute",
        left: t.x - s / 2,
        top: t.y - s / 2,
        width: s,
        height: s,
        display: "flex",
        borderRadius: Math.round(s * 0.26),
        overflow: "hidden",
        opacity: a,
        border: t.art ? "none" : "2px solid rgba(217,255,248,0.35)",
        background: t.art ? "#1B2E4A" : "rgba(217,255,248,0.06)",
        boxShadow: t.z >= 0 ? "0 14px 30px -14px rgba(0,0,0,0.6)" : "none",
      }}
    >
      {t.art && <img src={t.art} alt="" width={s} height={s} style={{ objectFit: "cover" }} />}
    </div>
  );
}
