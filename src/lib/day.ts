// Calendar helpers. A "day" is a YYYY-MM-DD string in someone's timezone.

export function todayIn(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Consecutive days posted, ending today (or yesterday, if today's song
// isn't in yet so the streak is still alive).
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function formatTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function monthKey(day: string) {
  return day.slice(0, 7);
}

export function monthName(key: string, withYear: boolean) {
  return new Date(key + "-15T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

// The hour someone usually posts, like "8am".
export function usualHour(times: string[], timeZone: string): string | null {
  if (!times.length) return null;
  const counts = new Map<number, number>();
  for (const t of times) {
    const h = Number(
      new Date(t).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone }),
    ) % 24;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const [h] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
