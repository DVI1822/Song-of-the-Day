import { NextResponse, type NextRequest } from "next/server";
import { weatherFrom, type WeatherReply } from "@/lib/weather";

// The weather where the visitor is. The browser sends its location if it's
// allowed to; otherwise Vercel's guess from their network stands in, so
// nobody gets a permission prompt.
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
    return NextResponse.json({} satisfies WeatherReply);

  // rounded, so neighbours share a cached answer (and nobody's exact spot is sent on)
  lat = Math.round(lat * 10) / 10;
  lon = Math.round(lon * 10) / 10;
  const place = decodeURIComponent(h.get("x-vercel-ip-city") ?? "") || undefined;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,cloud_cover,precipitation,wind_speed_10m,temperature_2m&wind_speed_unit=ms`;
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return NextResponse.json({ lat, lon, place } satisfies WeatherReply);
    const c = (await res.json()).current;
    const weather = weatherFrom(c.weather_code ?? 0, c.cloud_cover ?? 0, c.precipitation ?? 0, c.wind_speed_10m ?? 0, c.temperature_2m ?? undefined);
    return NextResponse.json({ weather, lat, lon, place } satisfies WeatherReply);
  } catch {
    return NextResponse.json({ lat, lon, place } satisfies WeatherReply);
  }
}
