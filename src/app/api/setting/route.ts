import { NextResponse, type NextRequest } from "next/server";
import { classify, type SettingReply } from "@/lib/setting";

// What kind of place the visitor is in (lib/setting.ts), from where they are:
// the browser's location if it's allowed, otherwise Vercel's guess from their
// network, as for the weather. Coordinates are rounded to about 10 km before
// anything is asked, and every answer is cached for a month, so each area is
// looked up about once. A year of rain (Open-Meteo's archive) picks out the
// desert.

const MONTH = 30 * 24 * 3600;
// OpenStreetMap asks that every app names itself
const UA = "TopTrack/1.0 (+https://www.mytoptrack.io)";

async function population(lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10&extratags=1&accept-language=en`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: MONTH } });
  if (!res.ok) return { population: null, placeType: null, place: undefined };
  const j = (await res.json()) as { addresstype?: string; name?: string; extratags?: { population?: string } | null };
  const raw = j.extratags?.population?.replace(/[^\d]/g, "") ?? "";
  return { population: raw ? Number(raw) : null, placeType: j.addresstype ?? null, place: j.name };
}

// the middle and eight points round it, about 15 km out
async function terrain(lat: number, lon: number) {
  const d = 0.14,
    dl = d / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const pts: [number, number][] = [];
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) pts.push([lat + a * d, lon + b * dl]);
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[0].toFixed(3)).join(",")}&longitude=${pts.map((p) => p[1].toFixed(3)).join(",")}`;
  const res = await fetch(url, { next: { revalidate: MONTH } });
  if (!res.ok) return { elevation: null, relief: null };
  const e = ((await res.json()) as { elevation?: number[] }).elevation ?? [];
  if (e.length !== 9) return { elevation: null, relief: null };
  return { elevation: e[4], relief: Math.max(...e) - Math.min(...e) };
}

// a year of rain, to tell the desert from everywhere else
async function rainfall(lat: number, lon: number) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=2024-01-01&end_date=2024-12-31&daily=precipitation_sum&timezone=UTC`;
  const res = await fetch(url, { next: { revalidate: MONTH } });
  if (!res.ok) return null;
  const d = ((await res.json()) as { daily?: { precipitation_sum?: (number | null)[] } }).daily?.precipitation_sum;
  if (!d || d.length < 300) return null;
  return d.reduce<number>((a, v) => a + (v ?? 0), 0);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const h = request.headers;
  const num = (v: string | null) => (v === null || v === "" ? NaN : Number(v));
  let lat = num(q.get("lat")),
    lon = num(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    lat = num(h.get("x-vercel-ip-latitude"));
    lon = num(h.get("x-vercel-ip-longitude"));
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return NextResponse.json({} satisfies SettingReply);
  lat = Math.round(lat * 10) / 10;
  lon = Math.round(lon * 10) / 10;

  const [pop, land, rain] = await Promise.all([
    population(lat, lon).catch(() => ({ population: null, placeType: null, place: undefined })),
    terrain(lat, lon).catch(() => ({ elevation: null, relief: null })),
    rainfall(lat, lon).catch(() => null),
  ]);
  // nothing came back at all: say nothing rather than guess
  if (pop.placeType === null && land.elevation === null) return NextResponse.json({} satisfies SettingReply);
  const kind = classify({ ...land, population: pop.population, placeType: pop.placeType, rain });
  return NextResponse.json({ kind, place: pop.place } satisfies SettingReply, {
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}
